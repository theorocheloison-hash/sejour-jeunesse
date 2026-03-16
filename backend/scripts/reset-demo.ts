import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🗑️  Reset demo — suppression des données de test…\n');

  const results = await prisma.$transaction([
    // 1. Paiement
    prisma.paiement.deleteMany(),
    // 2. Inscription
    prisma.inscription.deleteMany(),
    // 3. LigneDevis
    prisma.ligneDevis.deleteMany(),
    // 4. Devis
    prisma.devis.deleteMany(),
    // 5. DemandeDevis
    prisma.demandeDevis.deleteMany(),
    // 6. AccompagnateurMission
    prisma.accompagnateurMission.deleteMany(),
    // 7. AutorisationParentale
    prisma.autorisationParentale.deleteMany(),
    // 8. DocumentSejour
    prisma.documentSejour.deleteMany(),
    // 9. PlanningActivite
    prisma.planningActivite.deleteMany(),
    // 10. Message
    prisma.message.deleteMany(),
    // 11. Hebergement
    prisma.hebergement.deleteMany(),
    // 12. Sejour
    prisma.sejour.deleteMany(),
  ]);

  const labels = [
    'Paiement',
    'Inscription',
    'LigneDevis',
    'Devis',
    'DemandeDevis',
    'AccompagnateurMission',
    'AutorisationParentale',
    'DocumentSejour',
    'PlanningActivite',
    'Message',
    'Hebergement',
    'Sejour',
  ];

  let total = 0;
  for (let i = 0; i < labels.length; i++) {
    const count = results[i].count;
    total += count;
    console.log(`  ${labels[i].padEnd(25)} ${count} ligne(s) supprimée(s)`);
  }

  console.log(`\n✅ Total : ${total} ligne(s) supprimée(s) en une transaction atomique.`);
}

main()
  .catch((err) => {
    console.error('❌ Erreur lors du reset :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
