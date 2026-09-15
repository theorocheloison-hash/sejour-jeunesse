// MIROIR de backend/src/common/champs-inscription.constants.ts — garder synchronisé.
// Source de vérité UNIQUE des champs d'inscription. Ordre = ordre d'affichage
// (grille saisie, formulaire parent, colonnes CSV). Les lots consommateurs
// importeront d'ici et supprimeront leurs listes locales (fait au rebranchement,
// pas ici). RÈGLES appliquées par les consommateurs :
//  - Bloc A : toujours présents, obligatoires (sauf parentEmail : requis pour l'envoi
//    familles, optionnel en saisie directe ; jamais saisi sur le formulaire parent).
//  - Bloc B : configurables par séjour ; ACTIVÉ = OBLIGATOIRE, avec une affordance
//    explicite « Aucune / Non / Ne concerne pas » là où « rien » est une réponse légitime.
//  - contactParent : masqué de la liste des inscrits côté hébergeur (détail au clic organisateur).
//  - sante : déclenche le consentement médical (RGPD art. 9) sur le formulaire parent.

export type BlocInscription = 'A' | 'B';
export type TypeChampInscription = 'text' | 'tel' | 'email' | 'date' | 'number' | 'select' | 'boolean';
export interface OptionChamp { value: string; label: string; }
export interface ChampInscription {
  cle: string; libelle: string; bloc: BlocInscription; type: TypeChampInscription;
  colonne: string; sante: boolean; contactParent?: boolean;
  min?: number; max?: number; options?: OptionChamp[];
}

export const CHAMPS_INSCRIPTION: ChampInscription[] = [
  // Bloc A — identité & contact (fixe, obligatoire, hors config)
  { cle: 'eleveNom',           libelle: "Nom de l'élève",              bloc: 'A', type: 'text',  colonne: 'eleveNom',           sante: false },
  { cle: 'elevePrenom',        libelle: "Prénom de l'élève",           bloc: 'A', type: 'text',  colonne: 'elevePrenom',        sante: false },
  { cle: 'eleveDateNaissance', libelle: 'Date de naissance',           bloc: 'A', type: 'date',  colonne: 'eleveDateNaissance', sante: false },
  { cle: 'nomParent',          libelle: 'Nom du parent / responsable', bloc: 'A', type: 'text',  colonne: 'nomParent',          sante: false, contactParent: true },
  { cle: 'telephoneUrgence',   libelle: "Téléphone d'urgence",         bloc: 'A', type: 'tel',   colonne: 'telephoneUrgence',   sante: false, contactParent: true },
  { cle: 'parentEmail',        libelle: 'Email du parent',             bloc: 'A', type: 'email', colonne: 'parentEmail',        sante: false, contactParent: true },
  // Bloc B — attributs participant (configurables, activé = obligatoire)
  { cle: 'sexe',               libelle: 'Sexe',                        bloc: 'B', type: 'select',  colonne: 'hebergementCategorie', sante: false,
    options: [ { value: 'FILLE', label: 'Fille' }, { value: 'GARCON', label: 'Garçon' }, { value: 'AUTRE', label: 'Autre' } ] },
  { cle: 'taille',             libelle: 'Taille (cm)',                 bloc: 'B', type: 'number',  colonne: 'taille',   sante: false, min: 50, max: 250 },
  { cle: 'poids',              libelle: 'Poids (kg)',                  bloc: 'B', type: 'number',  colonne: 'poids',    sante: false, min: 10, max: 200 },
  { cle: 'pointure',           libelle: 'Pointure',                    bloc: 'B', type: 'number',  colonne: 'pointure', sante: false, min: 20, max: 50 },
  { cle: 'niveauSki',          libelle: 'Niveau de ski',               bloc: 'B', type: 'select',  colonne: 'niveauSki', sante: false,
    options: [ { value: 'DEBUTANT', label: 'Débutant' }, { value: 'INTERMEDIAIRE', label: 'Intermédiaire' }, { value: 'CONFIRME', label: 'Confirmé' }, { value: 'HORS_PISTE', label: 'Hors-piste' } ] },
  { cle: 'saitNager',          libelle: 'Aisance aquatique (sait nager)', bloc: 'B', type: 'boolean', colonne: 'saitNager', sante: false },
  { cle: 'regimeAlimentaire',  libelle: 'Régime alimentaire',          bloc: 'B', type: 'select',  colonne: 'regimeAlimentaire', sante: false,
    options: [ { value: 'Aucun régime particulier', label: 'Aucun régime particulier' }, { value: 'Végétarien', label: 'Végétarien' }, { value: 'Végétalien/Vegan', label: 'Végétalien/Vegan' }, { value: 'Sans porc', label: 'Sans porc' }, { value: 'Sans gluten', label: 'Sans gluten' }, { value: 'Autre', label: 'Autre' } ] },
  { cle: 'allergies',          libelle: 'Allergies / intolérances',    bloc: 'B', type: 'text', colonne: 'allergies',      sante: true },
  { cle: 'infosMedicales',     libelle: 'Informations médicales',      bloc: 'B', type: 'text', colonne: 'infosMedicales', sante: true },
];

export const CHAMP_PAR_CLE: Record<string, ChampInscription> =
  Object.fromEntries(CHAMPS_INSCRIPTION.map((c) => [c.cle, c]));
// Clés configurables (Bloc B) = seules valeurs valides de champsActifs (modèle + snapshot séjour).
export const CLES_BLOC_B: string[] = CHAMPS_INSCRIPTION.filter((c) => c.bloc === 'B').map((c) => c.cle);
// Clés « donnée de santé » → consentement médical côté parent.
export const CLES_SANTE: string[] = CHAMPS_INSCRIPTION.filter((c) => c.sante).map((c) => c.cle);
