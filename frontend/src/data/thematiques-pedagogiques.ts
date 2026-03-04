export const NIVEAUX = [
  'CP/CE1/CE2',
  'CM1/CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Terminale',
] as const;

export type Niveau = (typeof NIVEAUX)[number];

export const THEMATIQUES: Record<Niveau, string[]> = {
  'CP/CE1/CE2': [
    'Découverte du vivant et des milieux naturels',
    'Les saisons et phénomènes climatiques',
    'Vivre ensemble et citoyenneté',
    'Découverte du patrimoine local et régional',
    'Arts visuels et expression créative en nature',
  ],
  'CM1/CM2': [
    'Géographie : paysages et territoires français',
    'Sciences : écosystèmes et biodiversité',
    'Histoire : patrimoine historique et culturel',
    'EMC : solidarité et engagement citoyen',
    'EPS : activités physiques en milieu naturel',
  ],
  '6ème': [
    'SVT : biodiversité et adaptation des êtres vivants',
    'Géographie : espaces et paysages de France',
    'Histoire : l\'Antiquité et les traces du passé',
    'EPS : activités de pleine nature et sécurité',
    'EMC : règles de vie collective',
  ],
  '5ème': [
    'SVT : géologie et structure de la Terre',
    'Géographie : développement durable des territoires',
    'Histoire : le Moyen-Âge et le patrimoine médiéval',
    'Physique-Chimie : matière et énergie',
    'EPS : coopération et dépassement de soi',
  ],
  '4ème': [
    'SVT : reproduction et évolution du vivant',
    'Géographie : mondialisation et territoires',
    'Histoire : révolutions et patrimoine industriel',
    'Physique-Chimie : énergie et environnement',
    'EPS : activités d\'orientation en milieu naturel',
  ],
  '3ème': [
    'SVT : génétique et évolution',
    'Géographie : France et monde contemporain',
    'Histoire : le XXème siècle et mémoire',
    'EMC : démocratie et engagement citoyen',
    'EPS : projets collectifs sportifs',
  ],
  '2nde': [
    'SVT : biodiversité et évolution',
    'Géographie : sociétés et développement durable',
    'Histoire : le monde méditerranéen antique',
    'SES : individus et sociétés',
    'EPS : activités de pleine nature',
  ],
  '1ère': [
    'SVT : génétique et évolution des espèces',
    'Géographie : dynamiques territoriales de la France',
    'Histoire : guerres mondiales et mémoire',
    'Spécialités scientifiques : expérimentation terrain',
    'EPS : performance et dépassement',
  ],
  'Terminale': [
    'SVT : enjeux environnementaux contemporains',
    'Géographie : mondialisation et inégalités',
    'Histoire : le monde contemporain',
    'Grand oral : projet interdisciplinaire terrain',
    'EPS : projet sportif et bien-être',
  ],
};

export const REGIONS = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  'Provence-Alpes-Côte d\'Azur',
] as const;
