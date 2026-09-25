import { peutEcrireInscriptions, peutEnvoyerAuxFamilles } from './sejour-ownership';

/**
 * B4 — « qui tient la main » : matrice des droits d'inscription.
 *   DIRECT                    → hébergeur (propriétaire / collaborateur sejours:WRITE)
 *   COLLAB, main ORGANISATEUR → organisateur rattaché
 *   COLLAB, main HEBERGEUR    → hébergeur pour la liste, PERSONNE pour l'envoi aux familles
 */

const PROPRIO = 'proprio';
const COLLAB_WRITE = 'collab-w';
const COLLAB_READ = 'collab-r';
const ORGA = 'orga';
const TIERS = 'tiers';

function prismaMock() {
  return {
    centreHebergement: {
      findUnique: jest.fn().mockResolvedValue({ id: 'c1', userId: PROPRIO, statut: 'ACTIVE' }),
    },
    collaborateurCentre: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          where.userId === COLLAB_WRITE ? { permissions: { sejours: 'WRITE' } }
            : where.userId === COLLAB_READ ? { permissions: { sejours: 'READ' } }
            : null,
        ),
      ),
    },
  };
}

function sejour(modeGestion: 'DIRECT' | 'COLLABORATIF', responsableInscriptions: 'ORGANISATEUR' | 'HEBERGEUR') {
  return {
    modeGestion,
    responsableInscriptions,
    createurId: modeGestion === 'DIRECT' ? null : ORGA,
    hebergementSelectionneId: 'c1',
    hebergementSelectionne: { userId: PROPRIO },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ecrire = (s: ReturnType<typeof sejour>, u: string) => peutEcrireInscriptions(prismaMock() as any, s, u);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const envoyer = (s: ReturnType<typeof sejour>, u: string) => peutEnvoyerAuxFamilles(prismaMock() as any, s, u);

describe('B4 — droits d\'inscription', () => {
  it('DIRECT : hébergeur (propriétaire + collaborateur WRITE) écrit et envoie ; les autres non', async () => {
    // la valeur de responsableInscriptions est sans effet sur un DIRECT
    for (const resp of ['ORGANISATEUR', 'HEBERGEUR'] as const) {
      const s = sejour('DIRECT', resp);
      expect(await ecrire(s, PROPRIO)).toBe(true);
      expect(await ecrire(s, COLLAB_WRITE)).toBe(true);
      expect(await ecrire(s, COLLAB_READ)).toBe(false);
      expect(await ecrire(s, TIERS)).toBe(false);
      expect(await envoyer(s, PROPRIO)).toBe(true);
      expect(await envoyer(s, COLLAB_WRITE)).toBe(true);
      expect(await envoyer(s, COLLAB_READ)).toBe(false);
    }
  });

  it('COLLAB, main ORGANISATEUR : seul l\'organisateur écrit et envoie', async () => {
    const s = sejour('COLLABORATIF', 'ORGANISATEUR');
    expect(await ecrire(s, ORGA)).toBe(true);
    expect(await envoyer(s, ORGA)).toBe(true);
    for (const u of [PROPRIO, COLLAB_WRITE, COLLAB_READ, TIERS]) {
      expect(await ecrire(s, u)).toBe(false);
      expect(await envoyer(s, u)).toBe(false);
    }
  });

  it('COLLAB, main HEBERGEUR : l\'hébergeur écrit, l\'organisateur passe en lecture, personne n\'envoie', async () => {
    const s = sejour('COLLABORATIF', 'HEBERGEUR');
    expect(await ecrire(s, PROPRIO)).toBe(true);
    expect(await ecrire(s, COLLAB_WRITE)).toBe(true);
    expect(await ecrire(s, COLLAB_READ)).toBe(false);
    expect(await ecrire(s, ORGA)).toBe(false);
    for (const u of [PROPRIO, COLLAB_WRITE, ORGA]) {
      expect(await envoyer(s, u)).toBe(false);
    }
  });

  it('COLLAB sans organisateur rattaché (createurId null) : personne n\'écrit côté organisateur', async () => {
    const s = { ...sejour('COLLABORATIF', 'ORGANISATEUR'), createurId: null };
    expect(await ecrire(s, ORGA)).toBe(false);
    expect(await envoyer(s, ORGA)).toBe(false);
  });
});
