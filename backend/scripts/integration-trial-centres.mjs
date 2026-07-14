/**
 * Test d'intégration sur base Postgres JETABLE — JAMAIS la prod.
 * Prouve bout en bout les commits 0a23953 (source unique trial), 6b5bb4a
 * (createCentre atomique) et 9724d2a (résolution d'organisation par SIRET).
 * Vrais services, vraie base, vraies contraintes SQL ; seul EmailService est
 * mocké (aucun mail ne part).
 *
 * Fichier .mjs volontairement hors périmètre tsc : il consomme le build dist/.
 *
 * Usage :
 *   docker run -d --name liavo-it-db -e POSTGRES_USER=it -e POSTGRES_PASSWORD=it \
 *     -e POSTGRES_DB=liavo_it -p 55432:5432 postgres:16-alpine
 *   npx prisma db push --url postgresql://it:it@localhost:55432/liavo_it
 *   npm run build
 *   DATABASE_URL=postgresql://it:it@localhost:55432/liavo_it \
 *     node scripts/integration-trial-centres.mjs
 *   docker rm -f liavo-it-db
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const URL_JETABLE = 'localhost:55432/liavo_it';
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes(URL_JETABLE)) {
  console.error(`REFUS : DATABASE_URL doit pointer la base jetable (${URL_JETABLE}). Jamais la prod.`);
  process.exit(1);
}

const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
const { CentreService } = require('../dist/src/centres/centre.service.js');
const { AdminService } = require('../dist/src/admin/admin.service.js');
const { ClaimService } = require('../dist/src/organisations/claim.service.js');

function jours(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── Mini-harness d'assertions ────────────────────────────────────────────
const rapports = [];
let courant = [];

function verifie(label, ok, obs, exp) {
  courant.push({ label, ok, obs, exp });
}
function egal(label, obs, exp) {
  const o = obs instanceof Date ? obs.getTime() : obs;
  const e = exp instanceof Date ? exp.getTime() : exp;
  verifie(label, o === e, obs, exp);
}
async function test(nom, fn) {
  courant = [];
  try {
    await fn();
    rapports.push({ test: nom, resultats: courant });
  } catch (erreur) {
    rapports.push({ test: nom, resultats: courant, erreur });
  }
}

// ─── Mock email : toute méthode devient un no-op asynchrone enregistré ─────
const emailCalls = [];
const emailMock = new Proxy(
  {},
  {
    get: (_t, prop) =>
      (...args) => {
        emailCalls.push({ methode: String(prop), args });
        return Promise.resolve(undefined);
      },
  },
);

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  const centreService = new CentreService(prisma, {}, {}, emailMock);
  const adminService = new AdminService(prisma, emailMock, {});
  const claimService = new ClaimService(prisma, {}, emailMock);

  /** Hébergeur VALIDÉ mono-centre (le montage Pôle Montagne / Louise). */
  async function fixtureHebergeurValide(sfx, centreOver = {}) {
    const user = await prisma.user.create({
      data: {
        role: 'HEBERGEUR', prenom: 'Test', nom: `Hebergeur ${sfx}`,
        email: `it-${sfx}@test.local`, motDePasse: 'hash-factice',
        motDePasseDefini: true, emailVerifie: true, compteValide: true,
      },
    });
    const org = await prisma.organisation.create({
      data: { nom: `Structure Test ${sfx}`, ville: 'Annecy', source: 'MANUAL' }, // siren NULL
    });
    const membership = await prisma.membership.create({
      data: {
        userId: user.id, organisationId: org.id, role: 'PROPRIETAIRE',
        isPrimary: true, claimStatut: 'VALIDE', claimValidatedAt: jours(-30),
      },
    });
    const centreA = await prisma.centreHebergement.create({
      data: {
        nom: `Centre A ${sfx}`, adresse: '1 rue du Test', ville: 'Annecy',
        codePostal: '74000', capacite: 80, userId: user.id, organisationId: org.id,
        statut: 'ACTIVE', trialStartedAt: jours(-10), abonnementActifJusquAu: jours(20),
        planAbonnement: 'PILOTAGE', abonnementStatut: 'ACTIF',
        mollieMandatId: null, modePaiement: null,
        ...centreOver,
      },
    });
    return { user, org, membership, centreA };
  }

  const dtoCentre = (nom, over = {}) => ({
    nom, adresse: '2 chemin des Chalets', ville: 'Annecy', codePostal: '74000', capacite: 50, ...over,
  });

  // ════ Fixture principale + T1..T3 + T6 (même hébergeur) ════
  const f1 = await fixtureHebergeurValide('pole');
  let centreB;

  await test('T1 — createCentre SANS SIRET (hébergeur validé, multi-centre)', async () => {
    const orgsAvant = await prisma.organisation.count();
    centreB = await centreService.createCentre(f1.user.id, dtoCentre('Chalet B'));
    const orgsApres = await prisma.organisation.count();
    const b = await prisma.centreHebergement.findUnique({ where: { id: centreB.id } });
    const m = await prisma.membership.findUnique({ where: { id: f1.membership.id } });

    egal('centre B créé, statut PENDING', b?.statut, 'PENDING');
    egal('centre B rattaché à Structure Test (pas une org neuve)', b?.organisationId, f1.org.id);
    egal("nombre d'organisations inchangé", orgsApres, orgsAvant);
    egal('membership existant toujours VALIDE', m?.claimStatut, 'VALIDE');
    egal('centre B sans trial (trialStartedAt NULL)', b?.trialStartedAt, null);
    egal('centre B abonnementStatut INACTIF', b?.abonnementStatut, 'INACTIF');
  });

  await test('T2 — visibilité admin (invariant)', async () => {
    const pending = await adminService.getCentresPending();
    const claims = await claimService.getClaimsEnAttente();
    const dansPending = pending.some((c) => c.id === centreB.id);
    const dansClaims = claims.some(
      (cl) =>
        cl.organisationId === f1.org.id ||
        (cl.organisation?.centresHebergement ?? []).some((c) => c.id === centreB.id),
    );
    verifie(
      `centre B visible dans au moins une liste (centres/pending: ${dansPending}, claims: ${dansClaims})`,
      dansPending || dansClaims,
      { dansPending, dansClaims },
      'au moins une liste',
    );
  });

  await test("T3 — activerCentre + alignement de l'essai en cours", async () => {
    const aAvant = await prisma.centreHebergement.findUnique({ where: { id: f1.centreA.id } });
    await adminService.activerCentre(centreB.id);
    const b = await prisma.centreHebergement.findUnique({ where: { id: centreB.id } });
    const aApres = await prisma.centreHebergement.findUnique({ where: { id: f1.centreA.id } });

    egal('centre B passe ACTIVE', b?.statut, 'ACTIVE');
    egal('centre B planAbonnement PILOTAGE', b?.planAbonnement, 'PILOTAGE');
    egal('centre B abonnementStatut ACTIF', b?.abonnementStatut, 'ACTIF');
    egal(
      'B.abonnementActifJusquAu === A.abonnementActifJusquAu (MÊME date, pas de nouvel essai 30j)',
      b?.abonnementActifJusquAu, aAvant?.abonnementActifJusquAu,
    );
    egal('B.trialStartedAt === A.trialStartedAt (MÊME date)', b?.trialStartedAt, aAvant?.trialStartedAt);
    egal('centre A non modifié — trialStartedAt', aApres?.trialStartedAt, aAvant?.trialStartedAt);
    egal(
      'centre A non modifié — abonnementActifJusquAu (pas de prolongation)',
      aApres?.abonnementActifJusquAu, aAvant?.abonnementActifJusquAu,
    );
    verifie(
      'trial de B hérité, pas ouvert maintenant (trialStartedAt vieux de ~10 jours)',
      !!b?.trialStartedAt && Date.now() - b.trialStartedAt.getTime() > 9 * 86400000,
      b?.trialStartedAt, 'J-10',
    );
  });

  await test('T4 — essai expiré : le centre suivant est ACTIVE mais sans essai', async () => {
    const f = await fixtureHebergeurValide('exp', {
      trialStartedAt: jours(-40), abonnementActifJusquAu: jours(-1),
      abonnementStatut: 'INACTIF', planAbonnement: 'PILOTAGE',
    });
    const c = await centreService.createCentre(f.user.id, dtoCentre('Centre C exp'));
    await adminService.activerCentre(c.id);
    const cApres = await prisma.centreHebergement.findUnique({ where: { id: c.id } });

    egal('centre C ACTIVE', cApres?.statut, 'ACTIVE');
    egal('centre C sans trial (trialStartedAt NULL)', cApres?.trialStartedAt, null);
    egal('centre C abonnementStatut INACTIF', cApres?.abonnementStatut, 'INACTIF');
    egal('centre C plan inchangé (défaut DECOUVERTE)', cApres?.planAbonnement, 'DECOUVERTE');
  });

  await test('T5 — non-régression clients existants (3 gardes)', async () => {
    const cas = [
      ['a) mandat Mollie', { mollieMandatId: 'mdt_test', trialStartedAt: jours(-100), abonnementActifJusquAu: jours(265) }],
      ['b) VIREMENT (Choucas)', { modePaiement: 'VIREMENT', trialStartedAt: null, abonnementActifJusquAu: jours(90) }],
      ['c) abonnement offert (Sauvageon)', { trialStartedAt: null, abonnementActifJusquAu: jours(200) }],
    ];
    for (const [nom, over] of cas) {
      const sfx = nom.substring(0, 1);
      const f = await fixtureHebergeurValide(`t5${sfx}`, over);
      const c = await centreService.createCentre(f.user.id, dtoCentre(`Centre T5${sfx}`));
      await adminService.activerCentre(c.id);
      const cApres = await prisma.centreHebergement.findUnique({ where: { id: c.id } });
      egal(`${nom} : aucun essai posé (trialStartedAt NULL)`, cApres?.trialStartedAt, null);
      egal(`${nom} : abonnementStatut INACTIF`, cApres?.abonnementStatut, 'INACTIF');
      const aApres = await prisma.centreHebergement.findUnique({ where: { id: f.centreA.id } });
      egal(`${nom} : centre existant intact`, aApres?.abonnementStatut, 'ACTIF');
    }
  });

  await test('T6 — seconde société (SIRET au SIREN différent)', async () => {
    const c = await centreService.createCentre(
      f1.user.id,
      dtoCentre('Centre Corrèze', { ville: 'Chambéret', codePostal: '19370', siret: '99999999900019' }),
    );
    const cDb = await prisma.centreHebergement.findUnique({ where: { id: c.id } });
    verifie(
      'organisation DISTINCTE de Structure Test', cDb?.organisationId !== f1.org.id,
      cDb?.organisationId, `≠ ${f1.org.id}`,
    );
    const m = await prisma.membership.findUnique({
      where: { userId_organisationId: { userId: f1.user.id, organisationId: cDb.organisationId } },
    });
    egal('membership EN_ATTENTE_DOCUMENT sur la seconde société', m?.claimStatut, 'EN_ATTENTE_DOCUMENT');
    verifie('claimSubmittedAt renseigné', m?.claimSubmittedAt instanceof Date, m?.claimSubmittedAt, 'Date');
    const claims = await claimService.getClaimsEnAttente();
    verifie(
      'le claim sort dans getClaimsEnAttente()',
      claims.some((cl) => cl.id === m?.id),
      claims.map((cl) => cl.id), m?.id,
    );
  });

  await test('T7 — atomicité : échec en cours de transaction → rollback total', async () => {
    const user = await prisma.user.create({
      data: {
        role: 'HEBERGEUR', prenom: 'Test', nom: 'Atomic',
        email: 'it-atomic@test.local', motDePasse: 'hash-factice',
        motDePasseDefini: true, emailVerifie: true, compteValide: true,
      },
    });
    const avant = {
      orgs: await prisma.organisation.count(),
      centres: await prisma.centreHebergement.count(),
      memberships: await prisma.membership.count(),
    };
    let erreur = null;
    try {
      // telephone VarChar(20) → P2000 sur centre.create, APRÈS la création de
      // l'organisation dans la transaction : le rollback doit tout effacer.
      await centreService.createCentre(user.id, dtoCentre('Centre Atomic', { telephone: '0'.repeat(30) }));
    } catch (e) {
      erreur = e;
    }
    verifie('createCentre rejette (erreur mappée)', erreur !== null, erreur ? erreur.message : null, 'exception');
    const apres = {
      orgs: await prisma.organisation.count(),
      centres: await prisma.centreHebergement.count(),
      memberships: await prisma.membership.count(),
    };
    egal('AUCUNE organisation créée', apres.orgs, avant.orgs);
    egal('AUCUN centre créé', apres.centres, avant.centres);
    egal('AUCUN membership créé', apres.memberships, avant.memberships);
  });

  // ─── Rapport ───
  let echecs = 0;
  for (const r of rapports) {
    const ko = r.resultats.filter((x) => !x.ok);
    const statut = r.erreur ? 'ROUGE (exception)' : ko.length ? 'ROUGE' : 'VERT';
    if (statut !== 'VERT') echecs++;
    console.log(`\n${statut === 'VERT' ? '✅' : '❌'} ${r.test} — ${statut}`);
    for (const x of r.resultats) {
      console.log(
        `   ${x.ok ? '✓' : '✗'} ${x.label}${x.ok ? '' : ` — observé: ${JSON.stringify(x.obs)} / attendu: ${JSON.stringify(x.exp)}`}`,
      );
    }
    if (r.erreur) console.log(`   ✗ exception: ${r.erreur.message ?? r.erreur}`);
  }
  console.log(
    `\nEmails interceptés (aucun parti) : ${emailCalls.length} — méthodes: ${[...new Set(emailCalls.map((c) => c.methode))].join(', ')}`,
  );
  console.log(echecs === 0 ? '\n═══ TOUT VERT ═══' : `\n═══ ${echecs} TEST(S) ROUGE(S) ═══`);

  await prisma.$disconnect();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Échec du harness :', e);
  process.exit(2);
});
