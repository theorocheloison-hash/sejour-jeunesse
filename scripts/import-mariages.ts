/**
 * Import one-shot des événements privés du Chalet Le Sauvageon sur LIAVO PROD.
 *
 * Stratégie (validée) : « API création + SQL statut, 0 email ».
 *   1. Crée chaque séjour DIRECT (POST /sejours/direct) — statut OPTION imposé par le backend.
 *   2. Si non planningOnly : crée le devis (POST /devis/direct) — statut EN_ATTENTE.
 *   3. NE signe PAS via l'API publique (cela enverrait un email "Confirmation de réservation"
 *      à chaque vrai client). À la place, ce script génère un fichier SQL
 *      (scripts/import-mariages-statuts.sql) qui bascule, en base prod :
 *        - devis  → SELECTIONNE (+ nom signataire = clientNom, "déjà signés dans la vraie vie")
 *        - séjour → CONVENTION  (= "Confirmé" au planning)
 *      Ce SQL doit être appliqué via Bash (pas PowerShell) pour préserver les accents UTF-8.
 *
 * Exécution :  npx tsx scripts/import-mariages.ts
 * NE PAS COMMITTER (contient des identifiants).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.liavo.fr';
const EMAIL = 'resa@lesauvageon.com';
const PASSWORD = process.env.LIAVO_IMPORT_PWD ?? ''; // ne PAS committer en clair — passer via env au besoin
const DELAY_MS = 500;

// ─── Types ───────────────────────────────────────────────────────────────────
interface EventInput {
  titre: string;
  dateDebut: string;
  dateFin: string;
  clientNom: string;
  email: string;
  telephone: string;
  produit: string;
  montantHT: number;
  montantTTC: number;
  tva: number;
  planningOnly?: boolean;
}

interface CreatedRow {
  titre: string;
  sejourId: string;
  devisId: string | null;
  clientNom: string;
  signed: boolean; // devis à passer SELECTIONNE + séjour à passer CONVENTION
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const round2 = (n: number) => Math.round(n * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retire les champs vides/undefined d'un payload (le ValidationPipe rejette "" sur @IsEmail). */
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/** Sous-type événement déduit du titre (purement cosmétique). */
function typeSejourFromTitre(titre: string): string {
  const t = titre.toLowerCase();
  if (t.includes('mariage')) return 'MARIAGE';
  if (t.includes('anniversaire')) return 'ANNIVERSAIRE';
  if (t.includes('famille')) return 'REUNION_FAMILLE';
  return 'AUTRE_EVENEMENT';
}

async function api<T = any>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message ?? data ?? res.statusText;
    throw new Error(`${method} ${path} → ${res.status} ${Array.isArray(msg) ? msg.join(', ') : msg}`);
  }
  return data as T;
}

/** Échappe une valeur texte pour un littéral SQL simple-quote. */
const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const events: EventInput[] = JSON.parse(
    readFileSync(join(__dirname, 'import-mariages-sauvageon.json'), 'utf-8'),
  );

  console.log(`🔐 Connexion à ${API_BASE} en tant que ${EMAIL}...`);
  const { access_token: token } = await api<{ access_token: string }>(
    'POST', '/auth/login', null, { email: EMAIL, password: PASSWORD },
  );
  if (!token) throw new Error('Pas de access_token renvoyé par /auth/login');
  console.log('✅ Authentifié.\n');

  const created: CreatedRow[] = [];
  let okCount = 0;
  let planningOnlyCount = 0;
  let errCount = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (i > 0) await sleep(DELAY_MS);

    try {
      // a. Séjour DIRECT (statut OPTION imposé par le backend)
      const sejourPayload = clean({
        titre: ev.titre,
        natureSejour: 'EVENEMENT',
        typeSejour: typeSejourFromTitre(ev.titre),
        dateDebut: ev.dateDebut,
        dateFin: ev.dateFin,
        nombreParticipants: 0, // inconnu (gestion libre = chalet entier)
        clientNom: ev.clientNom,
        clientEmail: ev.email,
        clientTelephone: ev.telephone,
      });
      const sejour = await api<{ id: string }>('POST', '/sejours/direct', token, sejourPayload);

      if (ev.planningOnly) {
        created.push({ titre: ev.titre, sejourId: sejour.id, devisId: null, clientNom: ev.clientNom, signed: false });
        planningOnlyCount++;
        console.log(`⚠️  ${ev.titre} — planningOnly (séjour ${sejour.id} créé, sans devis)`);
        continue;
      }

      // b. Devis DIRECT (statut EN_ATTENTE) — 1 ligne libre, prixUnitaire stocké en HT
      const montantTVA = round2(ev.montantTTC - ev.montantHT);
      const pourcentageAcompte = 30;
      const montantAcompte = round2(ev.montantTTC * (pourcentageAcompte / 100));
      const devisPayload = {
        sejourDirectId: sejour.id,
        montantTotal: ev.montantTTC.toFixed(2),
        montantParEleve: ev.montantTTC.toFixed(2),
        tauxTva: ev.tva,
        montantHT: ev.montantHT,
        montantTVA,
        montantTTC: ev.montantTTC,
        pourcentageAcompte,
        montantAcompte,
        lignes: [
          {
            description: ev.produit,
            quantite: 1,
            prixUnitaire: ev.montantHT, // le backend stocke la ligne en HT
            tva: ev.tva,
            totalHT: ev.montantHT,
            totalTTC: ev.montantTTC,
          },
        ],
      };
      const devis = await api<{ id: string }>('POST', '/devis/direct', token, devisPayload);

      created.push({ titre: ev.titre, sejourId: sejour.id, devisId: devis.id, clientNom: ev.clientNom, signed: true });
      okCount++;
      console.log(`✅ ${ev.titre} — séjour ${sejour.id} créé — devis ${devis.id} créé (EN_ATTENTE → SQL: SELECTIONNE/CONVENTION)`);
    } catch (err) {
      errCount++;
      console.error(`❌ ${ev.titre} — ${(err as Error).message}`);
    }
  }

  // ── Sauvegarde des IDs créés (idempotence / traçabilité) ──
  writeFileSync(
    join(__dirname, 'import-mariages-results.json'),
    JSON.stringify(created, null, 2),
    'utf-8',
  );

  // ── Génération du SQL de bascule des statuts (à appliquer via Bash) ──
  const signed = created.filter((c) => c.signed && c.devisId);
  if (signed.length > 0) {
    const devisValues = signed
      .map((c) => `  (${sqlStr(c.devisId!)}::uuid, ${sqlStr(c.clientNom)})`)
      .join(',\n');
    const sejourIds = signed.map((c) => `${sqlStr(c.sejourId)}::uuid`).join(', ');
    const sql = `-- Bascule des statuts des événements importés — Chalet Le Sauvageon
-- Généré par scripts/import-mariages.ts. Appliquer via Bash (UTF-8) :
--   scalingo --app <APP> pg-console < scripts/import-mariages-statuts.sql
BEGIN;

-- Devis créés EN_ATTENTE → SELECTIONNE (déjà signés dans la vraie vie)
UPDATE devis AS d SET
  statut = 'SELECTIONNE',
  nom_signataire_directeur = v.nom,
  signature_directeur = 'Signé (import événements Sauvageon) — ' || to_char(now(), 'DD/MM/YYYY'),
  date_signature_directeur = now()
FROM (VALUES
${devisValues}
) AS v(id, nom)
WHERE d.id = v.id AND d.statut = 'EN_ATTENTE';

-- Séjours liés → CONVENTION (= "Confirmé" au planning)
UPDATE sejours SET statut = 'CONVENTION'
WHERE id IN (${sejourIds}) AND statut = 'OPTION';

COMMIT;
`;
    writeFileSync(join(__dirname, 'import-mariages-statuts.sql'), sql, 'utf-8');
  }

  console.log(`\n──────── Résumé ────────`);
  console.log(`✅ Séjour + devis créés : ${okCount}`);
  console.log(`⚠️  planningOnly (séjour seul) : ${planningOnlyCount}`);
  console.log(`❌ Erreurs : ${errCount}`);
  console.log(`📄 IDs sauvegardés → scripts/import-mariages-results.json`);
  if (signed.length > 0) {
    console.log(`📄 SQL de bascule → scripts/import-mariages-statuts.sql (${signed.length} devis/séjours)`);
  }
}

main().catch((err) => {
  console.error('\n💥 Échec global :', err);
  process.exit(1);
});
