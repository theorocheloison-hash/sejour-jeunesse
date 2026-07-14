import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { FactureLiavoService } from '../facture-liavo/facture-liavo.service';

// Stub : facture-liavo.service importe la chaîne @react-pdf (ESM), que Jest ne
// transforme pas. AdminService ne s'en sert pas dans refuserCentre.
jest.mock('../facture-liavo/facture-liavo.service', () => ({ FactureLiavoService: class {} }));

import { AdminService } from './admin.service';

/**
 * Tests de refuserCentre : gardes (404 / 403), passage en SUSPENDED, et email
 * motivé à l'hébergeur (le refus silencieux est le bug que cette méthode corrige).
 */

function mockPrisma() {
  return {
    centreHebergement: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function centrePending(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1',
    nom: 'Chalet des Nants',
    statut: 'PENDING',
    user: { email: 'heb@centre.fr', prenom: 'Jean' },
    ...over,
  };
}

describe('AdminService.refuserCentre', () => {
  let prisma: PrismaMock;
  let email: { sendGenericNotification: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    prisma = mockPrisma();
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      {} as FactureLiavoService,
    );
  });

  it('centre inexistant → NotFoundException', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(null);
    await expect(service.refuserCentre('inconnu')).rejects.toThrow(NotFoundException);
    expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it('centre ACTIVE → ForbiddenException (seul un PENDING est refusable)', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centrePending({ statut: 'ACTIVE' }));
    await expect(service.refuserCentre('centre-1')).rejects.toThrow(ForbiddenException);
    expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it('centre PENDING avec motif → SUSPENDED + 1 email contenant le motif', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centrePending());

    const res = await service.refuserCentre('centre-1', 'SIRET introuvable au registre');

    expect(prisma.centreHebergement.update).toHaveBeenCalledWith({
      where: { id: 'centre-1' },
      data: { statut: 'SUSPENDED' },
    });
    expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
    const [dest, sujet, html] = email.sendGenericNotification.mock.calls[0];
    expect(dest).toBe('heb@centre.fr');
    expect(sujet).toContain('Chalet des Nants');
    expect(html).toContain('SIRET introuvable au registre');
    expect(res).toEqual({ message: 'Centre refusé.' });
  });

  it('centre PENDING sans motif → SUSPENDED + 1 email avec le motif par défaut', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centrePending());

    await service.refuserCentre('centre-1');

    expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
    expect(email.sendGenericNotification.mock.calls[0][2]).toContain('Document non conforme');
  });

  it("échec de l'email → le refus aboutit quand même (non bloquant)", async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centrePending());
    email.sendGenericNotification.mockRejectedValue(new Error('Brevo down'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await service.refuserCentre('centre-1', 'motif');
    // Laisse le .catch fire-and-forget se résoudre avant de vérifier le log.
    await new Promise((r) => setImmediate(r));

    expect(res).toEqual({ message: 'Centre refusé.' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
