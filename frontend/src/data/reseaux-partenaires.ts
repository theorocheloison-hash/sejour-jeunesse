export interface ReseauPartenaire {
  nom: string;
  tel: string;
  email: string;
  logo: string;            // chemin relatif depuis /public (ex: '/logos/lmdj.png')
  couleurPrimaire: string; // hex — header / accents
  couleurSecondaire: string;
  baseline: string;        // sous le logo
  titrePage: string;       // remplace "Lancer un appel d'offres"
  sousTitrePage: string;   // remplace le sous-titre standard
  departementsDefaut?: string[]; // codes dépt (ex. ['73','74']) — si renseigné, le step Destination est sauté et auto-rempli
}

// Réseaux partenaires : clé = slug d'URL (?reseau=lmdj) et valeur stockée en base (sourceReseau).
export const RESEAUX_PARTENAIRES: Record<string, ReseauPartenaire> = {
  lmdj: {
    nom: 'La Montagne des Juniors',
    tel: '04 50 45 69 54',
    email: 'contact@lamdj.com',
    logo: '/logos/lmdj.png',
    couleurPrimaire: '#D41920',
    couleurSecondaire: '#2BB5D4',
    baseline: 'Ressources · Réseau · Classes & Colos',
    titrePage: 'Confiez-nous votre recherche d\'hébergement',
    sousTitrePage: 'Notre réseau compte plus de 100 centres de vacances agréés en Savoie et Haute-Savoie. Décrivez votre projet et recevez des propositions personnalisées.',
    departementsDefaut: ['73', '74'],
  },
  iddj: {
    nom: 'Isère Drôme Destination Juniors',
    tel: '',
    email: '',
    logo: '',
    couleurPrimaire: '#1B4060',
    couleurSecondaire: '#C87D2E',
    baseline: '',
    titrePage: 'Confiez-nous votre recherche d\'hébergement',
    sousTitrePage: 'Décrivez votre projet de séjour — les centres de votre zone vous envoient leurs devis.',
  },
};
