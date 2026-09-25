import { detecterColonnesImport } from './autorisation.service';

/**
 * Import CSV — detecterColonnesImport. Les mots-clés génériques (« parent »,
 * « responsable », « ski », « taille ») ne prennent jamais une colonne déjà
 * revendiquée par un champ plus précis (email, téléphone d'urgence, pointure).
 */
const h = (...cols: string[]) => cols.map((c) => c.trim().toLowerCase());

describe('detecterColonnesImport', () => {
  it('« Email parent » sans colonne nom parent → email seulement, nomParent absent', () => {
    const c = detecterColonnesImport(h('Nom', 'Prénom', 'Email parent'));
    expect(c.colEmail).toBe(2);
    expect(c.colNomParent).toBe(-1);
  });

  it('« Email parent » AVANT « Nom du parent » → chaque colonne à son champ', () => {
    const c = detecterColonnesImport(
      h('Nom', 'Prénom', 'Email parent', 'Nom du parent'),
    );
    expect(c.colEmail).toBe(2);
    expect(c.colNomParent).toBe(3);
  });

  it('« Courriel du responsable » n’est jamais pris comme nom parent', () => {
    const c = detecterColonnesImport(
      h('Nom', 'Prénom', 'Courriel du responsable'),
    );
    expect(c.colEmail).toBe(2);
    expect(c.colNomParent).toBe(-1);
  });

  it('« Téléphone urgence parent » → téléphone d’urgence, pas nom parent', () => {
    const c = detecterColonnesImport(
      h('Nom', 'Prénom', 'Téléphone urgence parent', 'Responsable'),
    );
    expect(c.colTelUrgence).toBe(2);
    expect(c.colNomParent).toBe(3);
  });

  it('« Téléphone parent » sans « urgence » reste pris comme nom parent (historique assumé)', () => {
    const c = detecterColonnesImport(h('Nom', 'Prénom', 'Téléphone parent'));
    expect(c.colNomParent).toBe(2);
    expect(c.colTelUrgence).toBe(-1);
  });

  it('« Pointure ski » avant « Niveau de ski » → chacune à son champ', () => {
    const c = detecterColonnesImport(
      h('Nom', 'Prénom', 'Pointure ski', 'Niveau de ski'),
    );
    expect(c.colPointure).toBe(2);
    expect(c.colNiveauSki).toBe(3);
  });

  it('« Taille chaussure » avant « Taille (cm) » → chacune à son champ', () => {
    const c = detecterColonnesImport(
      h('Nom', 'Prénom', 'Taille chaussure', 'Taille (cm)'),
    );
    expect(c.colPointure).toBe(2);
    expect(c.colTaille).toBe(3);
  });

  it('modèle LIAVO complet (ordre du modèle) → mapping inchangé', () => {
    const c = detecterColonnesImport(
      h(
        'Nom',
        'Prénom',
        'Date de naissance',
        'Sexe (Fille / Garçon)',
        'Taille (cm)',
        'Poids (kg)',
        'Pointure',
        'Niveau de ski (Débutant / Intermédiaire / Confirmé / Hors-piste)',
        'Attestation aquatique (Fournie / Non fournie)',
        'Régime alimentaire',
        'Allergies / intolérances',
        'Informations médicales',
        'Nom du parent / responsable',
        "Téléphone d'urgence",
        'Email parent',
      ),
    );
    expect(c).toEqual({
      colNom: 0,
      colPrenom: 1,
      colDateNaissance: 2,
      colSexe: 3,
      colTaille: 4,
      colPoids: 5,
      colPointure: 6,
      colNiveauSki: 7,
      colAttestation: 8,
      colRegime: 9,
      colAllergies: 10,
      colInfosMedicales: 11,
      colNomParent: 12,
      colTelUrgence: 13,
      colEmail: 14,
    });
  });

  it('colonnes absentes → -1', () => {
    const c = detecterColonnesImport(h('Nom', 'Prénom'));
    expect(c.colEmail).toBe(-1);
    expect(c.colNomParent).toBe(-1);
    expect(c.colNiveauSki).toBe(-1);
  });
});
