import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
  const localUrls: { table: string; id: string; field: string; url: string }[] = [];

  // Vérifier AutorisationParentale
  const autos = await prisma.autorisationParentale.findMany({
    where: {
      OR: [
        { documentMedicalUrl: { startsWith: '/uploads' } },
        { attestationAssuranceUrl: { startsWith: '/uploads' } },
      ]
    },
    select: { id: true, documentMedicalUrl: true, attestationAssuranceUrl: true }
  });
  autos.forEach(a => {
    if (a.documentMedicalUrl?.startsWith('/uploads'))
      localUrls.push({ table: 'AutorisationParentale', id: a.id, field: 'documentMedicalUrl', url: a.documentMedicalUrl });
    if (a.attestationAssuranceUrl?.startsWith('/uploads'))
      localUrls.push({ table: 'AutorisationParentale', id: a.id, field: 'attestationAssuranceUrl', url: a.attestationAssuranceUrl });
  });

  // Vérifier Document (centres)
  const docs = await prisma.document.findMany({
    where: { url: { startsWith: '/uploads' } },
    select: { id: true, url: true, nom: true }
  });
  docs.forEach(d => localUrls.push({ table: 'Document', id: d.id, field: 'url', url: d.url ?? '' }));

  // Vérifier Devis (documentUrl)
  const devis = await prisma.devis.findMany({
    where: { documentUrl: { startsWith: '/uploads' } },
    select: { id: true, documentUrl: true }
  });
  devis.forEach(d => localUrls.push({ table: 'Devis', id: d.id, field: 'documentUrl', url: d.documentUrl ?? '' }));

  // Vérifier DocumentSejour
  const docsSejour = await prisma.documentSejour.findMany({
    where: { url: { startsWith: '/uploads' } },
    select: { id: true, url: true, nom: true }
  });
  docsSejour.forEach(d => localUrls.push({ table: 'DocumentSejour', id: d.id, field: 'url', url: d.url }));

  // Vérifier CentreHebergement (imageUrl)
  const centres = await prisma.centreHebergement.findMany({
    where: { imageUrl: { startsWith: '/uploads' } },
    select: { id: true, nom: true, imageUrl: true }
  });
  centres.forEach(c => localUrls.push({ table: 'CentreHebergement', id: c.id, field: 'imageUrl', url: c.imageUrl ?? '' }));

  console.log(`\n=== AUDIT URLs locales (/uploads/) ===`);
  console.log(`Total : ${localUrls.length} URLs locales trouvées\n`);
  localUrls.forEach(u => console.log(`[${u.table}] id=${u.id} | ${u.field} = ${u.url}`));

  if (localUrls.length === 0) {
    console.log('✅ Aucune URL locale — base de données propre.');
  } else {
    console.log('\n⚠️  Ces fichiers doivent être migrés vers R2 manuellement.');
  }

  await prisma.$disconnect();
}

audit().catch(console.error);
