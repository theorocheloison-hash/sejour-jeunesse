export interface ReseauPartenaire {
  nom: string;
  tel: string;
  email: string;
  logo?: string;
}

// Réseaux partenaires : clé = slug d'URL (?reseau=lmdj) et valeur stockée en base (sourceReseau).
export const RESEAUX_PARTENAIRES: Record<string, ReseauPartenaire> = {
  lmdj: {
    nom: 'La Montagne des Juniors',
    tel: '04 50 45 69 54',
    email: 'contact@lamdj.com',
  },
  iddj: {
    nom: 'Isère Drôme Destination Juniors',
    tel: '',
    email: '',
  },
};
