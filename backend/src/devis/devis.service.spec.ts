import { resoudreEtablissement } from './devis.service.js';

/**
 * Tests de la fonction pure resoudreEtablissement (identité établissement de la
 * convention). Fige les fallbacks DIVERGENTS entre DIRECT et COLLAB :
 *   DIRECT  : clientOrganisation → clientNom → 'Établissement scolaire'
 *   COLLAB  : clientOrganisation → 'Établissement scolaire' (jamais de repli sur un nom)
 * Aucun mock, aucune instanciation de DevisService, aucun import PDF.
 */
describe('resoudreEtablissement — nom', () => {
  it('(a) DIRECT avec clientOrganisation → organisation', () => {
    expect(
      resoudreEtablissement({ mode: 'DIRECT', clientOrganisation: 'Collège Saint-Michel', clientNom: 'Dupont' }).etablissementNom,
    ).toBe('Collège Saint-Michel');
  });

  it('(b) DIRECT sans clientOrganisation mais avec clientNom → clientNom', () => {
    expect(
      resoudreEtablissement({ mode: 'DIRECT', clientOrganisation: null, clientNom: 'Dupont' }).etablissementNom,
    ).toBe('Dupont');
  });

  it('(c) DIRECT sans clientOrganisation ni clientNom → constante de repli', () => {
    expect(
      resoudreEtablissement({ mode: 'DIRECT', clientOrganisation: null, clientNom: null }).etablissementNom,
    ).toBe('Établissement scolaire');
  });

  it('(d) COLLAB avec clientOrganisation → organisation', () => {
    expect(
      resoudreEtablissement({ mode: 'COLLAB', clientOrganisation: 'Lycée Jean Moulin' }).etablissementNom,
    ).toBe('Lycée Jean Moulin');
  });

  it('(e) COLLAB sans clientOrganisation → constante de repli (clientNom ignoré)', () => {
    expect(
      resoudreEtablissement({ mode: 'COLLAB', clientOrganisation: null, clientNom: 'Ignoré' }).etablissementNom,
    ).toBe('Établissement scolaire');
  });
});

describe('resoudreEtablissement — adresse sérialisée', () => {
  it('(f) adresse complète → "rue, CP Ville"', () => {
    expect(
      resoudreEtablissement({
        mode: 'DIRECT',
        clientAdresse: '12 rue des Écoles',
        clientCodePostal: '30000',
        clientVille: 'Nîmes',
      }).etablissementAdresse,
    ).toBe('12 rue des Écoles, 30000 Nîmes');
  });

  it('(g) adresse vide → null', () => {
    expect(
      resoudreEtablissement({ mode: 'COLLAB', clientOrganisation: 'X' }).etablissementAdresse,
    ).toBeNull();
  });
});
