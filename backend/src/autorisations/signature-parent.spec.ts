import { erreursSignatureParent } from './autorisation.service';
import { CLES_BLOC_B } from '../common/champs-inscription.constants';
import type { SignerAutorisationDto } from './dto/signer-autorisation.dto';

/**
 * Back 3 — la fonction pure erreursSignatureParent impose côté serveur les
 * règles de la page parent : Bloc A toujours obligatoire ; chaque clé ACTIVE du
 * snapshot exigée (bornes des numbers, options des selects, réponse explicite
 * sur allergies/infosMedicales, régime ≠ littéral « Autre ») ; consentement
 * santé dès qu'une clé sante est active. Une clé NON active est ignorée.
 */

const BLOC_A_VALIDE: SignerAutorisationDto = {
  nomParent: 'Marie Dupont',
  telephoneUrgence: '0612345678',
  eleveDateNaissance: '2015-04-03',
  rgpdAccepte: true,
};

const PAYLOAD_COMPLET: SignerAutorisationDto = {
  ...BLOC_A_VALIDE,
  sexe: 'FILLE',
  taille: 140,
  poids: 35,
  pointure: 36,
  niveauSki: 'DEBUTANT',
  attestationAquatique: 'NON_CONCERNE',
  regimeAlimentaire: 'Sans porc',
  allergies: 'Aucune',
  infosMedicales: 'Aucune',
  consentementMedical: true,
};

describe('erreursSignatureParent', () => {
  it('sans snapshot : Bloc A valide suffit, même si le DTO envoie du Bloc B', () => {
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, taille: 999 }, null)).toEqual([]);
  });

  it('sans snapshot : Bloc A incomplet → les 3 libellés Bloc A', () => {
    const erreurs = erreursSignatureParent(
      { nomParent: '  ', telephoneUrgence: '', eleveDateNaissance: 'pas-une-date', rgpdAccepte: true },
      null,
    );
    expect(erreurs).toEqual([
      'Nom du parent / responsable',
      "Téléphone d'urgence",
      'Date de naissance',
    ]);
  });

  it('snapshot complet + payload complet valide → aucune erreur', () => {
    expect(erreursSignatureParent(PAYLOAD_COMPLET, [...CLES_BLOC_B])).toEqual([]);
  });

  it('number hors bornes ou absent → erreur avec la plage', () => {
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, taille: 300 }, ['taille']))
      .toEqual(['Taille (cm) (entre 50 et 250)']);
    expect(erreursSignatureParent(BLOC_A_VALIDE, ['taille']))
      .toEqual(['Taille (cm) (entre 50 et 250)']);
  });

  it('select hors options refusé, valeur canonique acceptée', () => {
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, niveauSki: 'EXPERT' }, ['niveauSki']))
      .toEqual(['Niveau de ski']);
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, niveauSki: 'DEBUTANT' }, ['niveauSki']))
      .toEqual([]);
  });

  it("régime : littéral « Autre » refusé, texte libre et « Aucun régime particulier » acceptés", () => {
    const actifs = ['regimeAlimentaire'];
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, regimeAlimentaire: 'Autre' }, actifs))
      .toEqual(['Régime alimentaire']);
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, regimeAlimentaire: 'Halal' }, actifs))
      .toEqual([]);
    expect(
      erreursSignatureParent(
        { ...BLOC_A_VALIDE, regimeAlimentaire: 'Aucun régime particulier' },
        actifs,
      ),
    ).toEqual([]);
  });

  it("allergies : vide/absent refusé, « Aucune » ou texte accepté (consentement requis)", () => {
    const actifs = ['allergies'];
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, consentementMedical: true }, actifs))
      .toEqual(['Allergies / intolérances']);
    expect(
      erreursSignatureParent({ ...BLOC_A_VALIDE, allergies: '  ', consentementMedical: true }, actifs),
    ).toEqual(['Allergies / intolérances']);
    expect(
      erreursSignatureParent({ ...BLOC_A_VALIDE, allergies: 'Aucune', consentementMedical: true }, actifs),
    ).toEqual([]);
    expect(
      erreursSignatureParent({ ...BLOC_A_VALIDE, allergies: 'Arachide', consentementMedical: true }, actifs),
    ).toEqual([]);
  });

  it('santé active sans consentementMedical → refusé ; sans clé santé → non exigé', () => {
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, allergies: 'Aucune' }, ['allergies']))
      .toEqual(['consentement au traitement des données de santé']);
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, taille: 140 }, ['taille']))
      .toEqual([]);
  });

  it('clé non active ignorée : poids hors bornes non validé si non demandé', () => {
    expect(erreursSignatureParent({ ...BLOC_A_VALIDE, taille: 140, poids: 5 }, ['taille']))
      .toEqual([]);
  });
});
