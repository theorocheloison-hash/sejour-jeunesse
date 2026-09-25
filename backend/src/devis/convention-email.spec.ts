import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { StorageService } from '../storage/storage.service';
import type { ClientsService } from '../clients/clients.service';
import type { SequenceService } from '../sequence/sequence.service';
import type { OccupationsService } from '../chambres/occupations.service';

import { DevisService } from './devis.service';

/**
 * LOT CONV — l'email de convention JOINT le PDF (le dossier OVH `conventions`
 * est privé depuis le 19/06 : une URL brute donnait AccessDenied) :
 * - pièce jointe = buffer déjà construit (base64) + built.fileName ;
 * - AUCUNE URL du bucket dans le HTML (bouton et « copiez ce lien » supprimés) ;
 * - garde-fou 7 Mo AVANT l'envoi (l'upload OVH + conventionUrl restent posés) ;
 * - assertEnvoiExterneAutorise toujours appelé avant l'envoi (centre non
 *   validé + destinataire tiers → 403, aucun email).
 */

const URL_BUCKET = 'https://bucket.ovh.example/conventions/convention-DEV-1.pdf';

function builtFixture(over: Partial<Record<string, unknown>> = {}) {
  return {
    buffer: Buffer.from('%PDF-fake-convention'),
    contactEmail: 'client@ecole.fr',
    contactNom: 'Mme Dupont',
    sejourTitre: 'Classe verte',
    sejourId: 'sejour-1',
    centreId: 'centre-1',
    centreNom: 'Le Sauvageon',
    centreStatut: 'ACTIVE',
    centreOrganisationId: null,
    centreUserId: 'user-heb',
    centreEmail: 'resa@lesauvageon.com',
    dateDebutFmt: '01/02/2027',
    dateFinFmt: '06/02/2027',
    effectifEleves: 24,
    effectifEncadrants: 3,
    fileName: 'convention-DEV-2026-0099.pdf',
    ...over,
  };
}

function mockPrisma() {
  return {
    devis: { update: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'heb@centre.fr' }) },
    membership: { findUnique: jest.fn().mockResolvedValue(null) },
    sejourClient: { findFirst: jest.fn().mockResolvedValue(null) },
    activiteClient: { create: jest.fn().mockResolvedValue({}) },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

describe('genererConventionScolaire — email en pièce jointe (LOT CONV)', () => {
  let prisma: PrismaMock;
  let email: { sendGenericNotification: jest.Mock };
  let storage: { uploadBuffer: jest.Mock };
  let service: DevisService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    storage = { uploadBuffer: jest.fn().mockResolvedValue(URL_BUCKET) };
    service = new DevisService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      storage as unknown as StorageService,
      {} as ClientsService,
      {} as SequenceService,
      {} as OccupationsService,
    );
  });

  it('joint le PDF (base64 du buffer construit, nom = built.fileName) — aucun re-téléchargement OVH', async () => {
    const built = builtFixture();
    jest.spyOn(service, 'buildConventionScolairePdf').mockResolvedValue(built as never);

    await service.genererConventionScolaire('devis-1', 'user-heb');

    expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
    const args = email.sendGenericNotification.mock.calls[0];
    // 7e argument = pièce jointe
    expect(args[6]).toEqual([
      { content: built.buffer.toString('base64'), name: 'convention-DEV-2026-0099.pdf' },
    ]);
    // Upload OVH + conventionUrl : strictement inchangés (le front en dépend)
    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      built.buffer, built.fileName, 'conventions', 'application/pdf',
    );
    expect(prisma.devis.update).toHaveBeenCalledWith({
      where: { id: 'devis-1' },
      data: { conventionUrl: URL_BUCKET },
    });
  });

  it("le HTML ne contient AUCUNE URL du bucket, annonce la pièce jointe, garde « lu et approuvé » et dit « chez {centre} »", async () => {
    jest.spyOn(service, 'buildConventionScolairePdf').mockResolvedValue(builtFixture() as never);

    await service.genererConventionScolaire('devis-1', 'user-heb');

    const html: string = email.sendGenericNotification.mock.calls[0][2];
    expect(html).not.toContain(URL_BUCKET);
    expect(html).not.toContain('Télécharger la convention');
    expect(html).not.toContain('copiez ce lien');
    expect(html).toContain('Vous trouverez la convention de séjour en pièce jointe.');
    expect(html).toContain('lu et approuvé');
    expect(html).toContain('chez Le Sauvageon');
    expect(html).not.toContain('au Chalet');
    // Expéditeur au nom du centre + replyTo inchangés
    expect(email.sendGenericNotification.mock.calls[0][3]).toBe('Le Sauvageon');
    expect(email.sendGenericNotification.mock.calls[0][4]).toEqual({ name: 'Le Sauvageon', email: 'resa@lesauvageon.com' });
  });

  it('PDF > 7 Mo → BadRequestException FR, AUCUN email ; upload + conventionUrl déjà posés', async () => {
    jest.spyOn(service, 'buildConventionScolairePdf').mockResolvedValue(
      builtFixture({ buffer: Buffer.alloc(7 * 1024 * 1024 + 1) }) as never,
    );

    await expect(service.genererConventionScolaire('devis-1', 'user-heb'))
      .rejects.toThrow(BadRequestException);
    await expect(service.genererConventionScolaire('devis-1', 'user-heb'))
      .rejects.toThrow('La convention fait plus de 7 Mo');
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
    expect(storage.uploadBuffer).toHaveBeenCalled();
    expect(prisma.devis.update).toHaveBeenCalled();
  });

  it('centre non validé + destinataire tiers → assertEnvoiExterneAutorise bloque AVANT l\'envoi', async () => {
    jest.spyOn(service, 'buildConventionScolairePdf').mockResolvedValue(
      builtFixture({ centreStatut: 'PENDING' }) as never,
    );

    await expect(service.genererConventionScolaire('devis-1', 'user-heb'))
      .rejects.toThrow(ForbiddenException);
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
    // Génération + upload restent autorisés (comportement historique)
    expect(storage.uploadBuffer).toHaveBeenCalled();
  });

  it('pas de contactEmail → aucun email, aucun garde-fou déclenché, upload/URL posés', async () => {
    jest.spyOn(service, 'buildConventionScolairePdf').mockResolvedValue(
      builtFixture({ contactEmail: null, buffer: Buffer.alloc(8 * 1024 * 1024) }) as never,
    );

    await expect(service.genererConventionScolaire('devis-1', 'user-heb')).resolves.toBeDefined();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
    expect(prisma.devis.update).toHaveBeenCalled();
  });
});
