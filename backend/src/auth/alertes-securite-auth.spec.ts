import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

/** Alertes maison — câblage côté authentification. Règles : securite.service.spec. */
function make() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    centreHebergement: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const securite = {
    connexionEchouee: jest.fn().mockResolvedValue(undefined),
    connexionReussie: jest.fn().mockResolvedValue(undefined),
    motDePasseChange: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = { sign: jest.fn().mockReturnValue('jwt') };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AuthService(prisma as any, jwt as any, {} as any, {} as any, {} as any, securite as any);
  return { service, prisma, securite };
}
const ctx = { ip: '1.2.3.4', userAgent: 'UA' };

describe('AuthService — alertes maison', () => {
  it('login raté → connexionEchouee avec l\'email saisi et le contexte, puis 401', async () => {
    const { service, prisma, securite } = make();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@y.fr', password: 'mauvais' } as any, ctx)).rejects.toThrow(UnauthorizedException);
    expect(securite.connexionEchouee).toHaveBeenCalledWith('x@y.fr', ctx);
    expect(securite.connexionReussie).not.toHaveBeenCalled();
  });

  it('login réussi → connexionReussie', async () => {
    const { service, prisma, securite } = make();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'p@e.fr', prenom: 'P', nom: 'E', role: 'ORGANISATEUR',
      motDePasse: await bcrypt.hash('bonpass1', 4), motDePasseDefini: true,
      compteValide: false, emailVerifie: true, reseauNom: null, tokenVersion: 0,
    });
    prisma.user.findFirst.mockResolvedValue(null);
    await service.login({ email: 'p@e.fr', password: 'bonpass1' } as any, ctx);
    expect(securite.connexionReussie).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', role: 'ORGANISATEUR' }), ctx);
    expect(securite.connexionEchouee).not.toHaveBeenCalled();
  });

  it('réinitialisation → toutes les sessions coupées (refresh token effacé) + titulaire prévenu', async () => {
    const { service, prisma, securite } = make();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'h@c.fr', prenom: 'Léa', tokenVersion: 2 });
    await service.reinitialiserMotDePasse('tok', 'nouveau-mdp', ctx);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      tokenVersion: 3, refreshToken: null, refreshTokenExpires: null, resetPasswordToken: null,
    });
    expect(securite.motDePasseChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', email: 'h@c.fr' }), 'REINITIALISE', ctx,
    );
  });

  it('modification d\'un mot de passe existant → titulaire prévenu', async () => {
    const { service, prisma, securite } = make();
    prisma.user.findUnique.mockResolvedValue({
      email: 'h@c.fr', prenom: 'Léa', motDePasseDefini: true, motDePasse: await bcrypt.hash('ancien123', 4), tokenVersion: 0,
    });
    await service.definirMotDePasse('u1', 'nouveau123', 'ancien123', ctx);
    expect(securite.motDePasseChange).toHaveBeenCalledWith({ id: 'u1', email: 'h@c.fr', prenom: 'Léa' }, 'MODIFIE', ctx);
  });

  it('première définition (après lien magique) → aucun mail', async () => {
    const { service, prisma, securite } = make();
    prisma.user.findUnique.mockResolvedValue({
      email: 'h@c.fr', prenom: 'Léa', motDePasseDefini: false, motDePasse: 'uuid', tokenVersion: 0,
    });
    await service.definirMotDePasse('u1', 'nouveau123', undefined, ctx);
    expect(securite.motDePasseChange).not.toHaveBeenCalled();
  });
});
