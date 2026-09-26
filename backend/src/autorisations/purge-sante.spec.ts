import { PurgeSanteService } from './purge-sante.service';

/** Point 6b — purge des données de santé J+30 après la fin du séjour. */
function make(cibles: Array<{ id: string; documentMedicalUrl: string | null }>) {
  const prisma = {
    autorisationParentale: {
      findMany: jest.fn().mockResolvedValue(cibles),
      updateMany: jest.fn().mockResolvedValue({ count: cibles.length }),
    },
  };
  const storage = { delete: jest.fn().mockResolvedValue(undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new PurgeSanteService(prisma as any, storage as any), prisma, storage };
}

describe('PurgeSanteService', () => {
  const now = new Date('2026-12-31T02:00:00Z');

  it('cible les séjours terminés depuis plus de 30 jours ET porteurs de données de santé', async () => {
    const { service, prisma } = make([]);
    await expect(service.purgerDonneesSante(now)).resolves.toEqual({ purgees: 0 });
    const where = prisma.autorisationParentale.findMany.mock.calls[0][0].where;
    expect(where.sejour.dateFin.lt).toEqual(new Date('2026-12-01T02:00:00Z'));
    expect(where.OR).toEqual([
      { allergies: { not: null } },
      { infosMedicales: { not: null } },
      { documentMedicalUrl: { not: null } },
    ]);
    expect(prisma.autorisationParentale.updateMany).not.toHaveBeenCalled();
  });

  it('efface allergies, infos médicales et document (fichier OVH compris), rien d\'autre', async () => {
    const { service, prisma, storage } = make([
      { id: 'a1', documentMedicalUrl: 'https://s3/doc1.pdf' },
      { id: 'a2', documentMedicalUrl: null },
    ]);
    await expect(service.purgerDonneesSante(now)).resolves.toEqual({ purgees: 2 });
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith('https://s3/doc1.pdf');
    expect(prisma.autorisationParentale.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1', 'a2'] } },
      data: { allergies: null, infosMedicales: null, documentMedicalUrl: null, donneesSantePurgeesAt: now },
    });
  });

  it('le cron ne fait rien sans ENABLE_CRON=true', async () => {
    const { service, prisma } = make([]);
    const avant = process.env.ENABLE_CRON;
    delete process.env.ENABLE_CRON;
    await service.cronPurge();
    expect(prisma.autorisationParentale.findMany).not.toHaveBeenCalled();
    if (avant === undefined) delete process.env.ENABLE_CRON;
    else process.env.ENABLE_CRON = avant;
  });
});
