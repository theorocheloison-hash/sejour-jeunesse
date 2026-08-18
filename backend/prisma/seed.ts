/**
 * Seed LOCAL LIAVO — jeu de données minimal pour le développement (liavo_dev).
 * Remplace le vestige catalogue (10 `Hebergement` legacy, non idempotent).
 *
 * GARDE ANTI-PROD : refuse de tourner si DATABASE_URL ne pointe pas sur
 * localhost/127.0.0.1 — protection définitive, avant toute connexion.
 * IDEMPOTENT : upsert/findFirst partout, re-lançable sans doublon.
 *
 * Comptes créés (@test.local, aucun email réel — et BREVO_API_KEY absente du
 * .env local = kill-switch : les envois sont seulement loggés) :
 *   hebergeur@test.local    / Hebergeur1!     (HEBERGEUR — centre ACTIVE, org PILOTAGE ACTIF)
 *   organisateur@test.local / Organisateur1!  (ORGANISATEUR — sans organisation, cas réel majoritaire)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

// ── Garde anti-prod : localhost obligatoire ─────────────────────────────────
let hote = '';
try { hote = new URL(DATABASE_URL).hostname; } catch { /* URL vide/invalide → refus */ }
if (hote !== 'localhost' && hote !== '127.0.0.1') {
  console.error('[seed] REFUS : DATABASE_URL ne pointe pas sur localhost — ce seed est strictement local.');
  console.error('[seed] Hôte détecté : ' + (hote || '(URL absente ou invalide)'));
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MDP_HEBERGEUR = 'Hebergeur1!';
const MDP_ORGANISATEUR = 'Organisateur1!';

async function main() {
  // ── 1. Hébergeur : User (les 3 gates de login() posés) ────────────────────
  const hebergeur = await prisma.user.upsert({
    where: { email: 'hebergeur@test.local' },
    update: {},
    create: {
      prenom: 'Hugo',
      nom: 'Test-Hébergeur',
      email: 'hebergeur@test.local',
      motDePasse: await bcrypt.hash(MDP_HEBERGEUR, 12), // 12 rounds, comme auth.service
      motDePasseDefini: true, // sinon login() compare contre DUMMY_HASH
      emailVerifie: true,     // gate 2 (EMAIL_NON_VERIFIE)
      compteValide: true,     // gate 3 (HEBERGEUR)
      role: 'HEBERGEUR',
    },
  });

  // ── 2. Organisation : PORTEUR de l'abonnement (L3c) ───────────────────────
  // PILOTAGE ACTIF « offert » : trialStartedAt null → garde b de
  // demarrerOuAlignerTrial (aucun nouvel essai au login), hors cible du cron.
  let organisation = await prisma.organisation.findFirst({
    where: { nom: 'Organisation Test Locale' },
  });
  if (!organisation) {
    organisation = await prisma.organisation.create({
      data: {
        nom: 'Organisation Test Locale',
        emailContact: 'hebergeur@test.local',
        planAbonnement: 'PILOTAGE',
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: new Date('2099-12-31'),
      },
    });
  }

  // ── 3. Membership PROPRIETAIRE, claim VALIDE (tunnel court-circuité) ──────
  await prisma.membership.upsert({
    where: { userId_organisationId: { userId: hebergeur.id, organisationId: organisation.id } },
    update: {},
    create: {
      userId: hebergeur.id,
      organisationId: organisation.id,
      role: 'PROPRIETAIRE',
      isPrimary: true,
      claimStatut: 'VALIDE',
      claimValidatedAt: new Date(),
    },
  });

  // ── 4. Centre exploité ACTIVE ─────────────────────────────────────────────
  // Les colonnes abo du centre restent aux DEFAULTS : gelées depuis L3c,
  // l'org est l'unique porteur — ne jamais les écrire.
  let centre = await prisma.centreHebergement.findFirst({
    where: { nom: 'Chalet du Test', userId: hebergeur.id },
  });
  if (!centre) {
    centre = await prisma.centreHebergement.create({
      data: {
        nom: 'Chalet du Test',
        adresse: '1 route du Développement',
        ville: 'Vallorcine',
        codePostal: '74660',
        capacite: 40,
        email: 'hebergeur@test.local',
        statut: 'ACTIVE',
        userId: hebergeur.id,
        organisationId: organisation.id,
      },
    });
  }

  // ── 5. Organisateur : sans organisation ni membership (cas réel) ──────────
  await prisma.user.upsert({
    where: { email: 'organisateur@test.local' },
    update: {},
    create: {
      prenom: 'Olivia',
      nom: 'Test-Organisatrice',
      email: 'organisateur@test.local',
      motDePasse: await bcrypt.hash(MDP_ORGANISATEUR, 12),
      motDePasseDefini: true,
      emailVerifie: true,
      compteValide: true, // sans effet pour ORGANISATEUR (gate 3 = HEBERGEUR seul), posé par cohérence
      role: 'ORGANISATEUR',
    },
  });

  // ── 6. Séjour DIRECT rattaché au centre ───────────────────────────────────
  // createurId NULL = convention réelle des DIRECT (le discriminant est
  // peutGererEnPropre : hebergementSelectionne.userId === userId).
  let sejour = await prisma.sejour.findFirst({
    where: { titre: 'Séjour test local', hebergementSelectionneId: centre.id },
  });
  if (!sejour) {
    sejour = await prisma.sejour.create({
      data: {
        titre: 'Séjour test local',
        lieu: 'Vallorcine',
        dateDebut: new Date('2026-10-05'),
        dateFin: new Date('2026-10-09'),
        placesTotales: 40,
        placesRestantes: 40,
        statut: 'OPTION', // cohérent avec un devis émis EN_ATTENTE (pattern prod 05/08)
        modeGestion: 'DIRECT',
        natureSejour: 'SEJOUR',
        typeContexte: 'SCOLAIRE',
        createurId: null,
        hebergementSelectionneId: centre.id,
        clientPrenom: 'Claire',
        clientNom: 'Cliente-Test',
        clientEmail: 'client@test.local',
        clientOrganisation: 'École du Test',
      },
    });
  }

  // ── 7. Devis EN_ATTENTE sur le séjour DIRECT ──────────────────────────────
  const devisExistant = await prisma.devis.findFirst({ where: { sejourDirectId: sejour.id } });
  if (!devisExistant) {
    await prisma.devis.create({
      data: {
        sejourDirectId: sejour.id,
        centreId: centre.id,
        montantTotal: '8400.00',
        montantParEleve: '210.00',
        tauxTva: 10,
        montantHT: 7636.36,
        montantTVA: 763.64,
        montantTTC: 8400,
        statut: 'EN_ATTENTE',
        description: 'Pension complète 4 nuits — jeu de données local',
        numeroDevis: 'DEV-LOCAL-0001', // hors SequenceService, suffisant en local
      },
    });
  }

  console.log('[seed] OK — jeu minimal en place :');
  console.log('  hebergeur@test.local    / ' + MDP_HEBERGEUR + '  (centre « Chalet du Test », org PILOTAGE ACTIF)');
  console.log('  organisateur@test.local / ' + MDP_ORGANISATEUR);
  console.log('  Séjour DIRECT « Séjour test local » (OPTION) + devis DEV-LOCAL-0001 (EN_ATTENTE)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
