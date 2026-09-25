import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AutorisationService } from './autorisation.service';
import { AutorisationController } from './autorisation.controller';
import { PLAN_KEY } from '../auth/decorators/plan.decorator';

/**
 * envoyer-invitations côté centre : gate anti-phishing (assertEnvoiExterneAutorise)
 * avant tout email, et plan ESSENTIEL déclaré sur la route (PlanGuard). L'organisateur
 * créateur n'est pas concerné par le gate anti-phishing.
 */

const HEBERGEUR_ID = 'heb-1';
const ORGA_ID = 'orga-1';

function sejour(overrides: { createurId: string | null; statut: string }) {
  return {
    createurId: overrides.createurId,
    titre: 'Séjour test',
    modeGestion: 'DIRECT',
    hebergementSelectionneId: 'centre-1',
    hebergementSelectionne: {
      userId: HEBERGEUR_ID,
      nom: 'Chalet Test',
      email: 'contact@chalet.test',
      statut: overrides.statut,
      organisationId: null,
    },
  };
}

function makeService(sej: unknown) {
  const prisma = {
    sejour: { findUnique: jest.fn().mockResolvedValue(sej) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'moi@chalet.test' }),
    },
    autorisationParentale: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'a1',
            parentEmail: 'parent@test.local',
            elevePrenom: 'Léa',
            eleveNom: 'DURAND',
            tokenSignature: 't1',
          },
        ]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const email = {
    sendAutorisationParentale: jest.fn().mockResolvedValue(undefined),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AutorisationService(
    prisma as any,
    email as any,
    {} as any,
  );
  return { service, prisma, email };
}

describe('envoyerInvitations — gate anti-phishing côté centre', () => {
  it('centre PENDING (en propre) → 403 CENTRE_EN_VALIDATION, aucun email', async () => {
    const { service, email, prisma } = makeService(
      sejour({ createurId: null, statut: 'PENDING' }),
    );
    await expect(
      service.envoyerInvitations('sej-1', HEBERGEUR_ID),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.envoyerInvitations('sej-1', HEBERGEUR_ID),
    ).rejects.toThrow(/CENTRE_EN_VALIDATION/);
    expect(email.sendAutorisationParentale).not.toHaveBeenCalled();
    expect(prisma.autorisationParentale.findMany).not.toHaveBeenCalled();
  });

  it('organisateur créateur : pas de gate centre, même si le centre est PENDING', async () => {
    const { service, prisma } = makeService(
      sejour({ createurId: ORGA_ID, statut: 'PENDING' }),
    );
    await service.envoyerInvitations('sej-1', ORGA_ID).catch(() => undefined);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.autorisationParentale.findMany).toHaveBeenCalled();
  });
});

describe('POST /autorisations/envoyer-invitations — plan requis', () => {
  it('déclare RequirePlan ESSENTIEL (soft)', () => {
    const meta = new Reflector().get(
      PLAN_KEY,
      AutorisationController.prototype.envoyerInvitations,
    );
    expect(meta).toEqual({ plan: 'ESSENTIEL', strict: false });
  });
});
