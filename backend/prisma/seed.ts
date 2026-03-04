import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const hebergements = [
  {
    nom: 'Auberge du Mont-Blanc',
    type: 'auberge' as const,
    adresse: '12 rue des Alpinistes, 74400 Chamonix',
    ville: 'Chamonix',
    capacite: 60,
    prixParJour: 35,
    agrement: true,
    telephone: '04 50 12 34 56',
    email: 'contact@auberge-montblanc.fr',
    activites: ['randonnée', 'escalade', 'ski'],
    description: 'Auberge de jeunesse agréée au pied du Mont-Blanc, idéale pour les séjours montagne.',
  },
  {
    nom: 'Gîte des Calanques',
    type: 'gite' as const,
    adresse: '8 chemin de Sormiou, 13009 Marseille',
    ville: 'Marseille',
    capacite: 30,
    prixParJour: 28,
    agrement: true,
    telephone: '04 91 23 45 67',
    email: 'gite-calanques@orange.fr',
    activites: ['kayak', 'plongée', 'randonnée', 'voile'],
    description: 'Gîte agréé avec accès direct aux calanques. Activités nautiques encadrées.',
  },
  {
    nom: 'Centre nature Loire',
    type: 'autre' as const,
    adresse: '45 route des Châteaux, 41000 Blois',
    ville: 'Blois',
    capacite: 80,
    prixParJour: 22,
    agrement: true,
    telephone: '02 54 78 90 12',
    email: 'centre.loire@education.fr',
    activites: ['vélo', 'canoë', 'histoire', 'patrimoine'],
    description: 'Centre d\'hébergement au cœur de la vallée de la Loire. Classes patrimoine et nature.',
  },
  {
    nom: 'Chalet Étoile des Neiges',
    type: 'chalet' as const,
    adresse: '3 impasse du Téléski, 73120 Courchevel',
    ville: 'Courchevel',
    capacite: 40,
    prixParJour: 45,
    agrement: false,
    telephone: '04 79 08 11 22',
    email: 'etoile.neiges@montagne.fr',
    activites: ['ski', 'raquettes', 'luge'],
    description: 'Chalet tout confort en station. Non agréé Éducation nationale.',
  },
  {
    nom: 'Camping pédagogique du Verdon',
    type: 'tente' as const,
    adresse: 'Lieu-dit Les Gorges, 04120 Castellane',
    ville: 'Castellane',
    capacite: 50,
    prixParJour: 15,
    agrement: true,
    telephone: '04 92 83 67 89',
    email: 'camping.verdon@nature.fr',
    activites: ['rafting', 'escalade', 'spéléologie', 'bivouac'],
    description: 'Camping agréé dans les gorges du Verdon. Encadrement sport de pleine nature.',
  },
  {
    nom: 'Hôtel Côte d\'Azur Jeunesse',
    type: 'hotel' as const,
    adresse: '22 boulevard de la Croisette, 06400 Cannes',
    ville: 'Cannes',
    capacite: 100,
    prixParJour: 42,
    agrement: false,
    telephone: '04 93 45 67 89',
    email: 'hotel.jeunesse@cannes.fr',
    activites: ['plage', 'cinéma', 'musée'],
    description: 'Hôtel en bord de mer, capacité importante. Non agréé.',
  },
  {
    nom: 'Ferme pédagogique du Pays Basque',
    type: 'gite' as const,
    adresse: '15 chemin d\'Etxola, 64250 Espelette',
    ville: 'Espelette',
    capacite: 25,
    prixParJour: 20,
    agrement: true,
    telephone: '05 59 93 12 34',
    email: 'ferme.basque@agriculture.fr',
    activites: ['ferme', 'cuisine', 'pelote basque', 'randonnée'],
    description: 'Ferme pédagogique agréée. Découverte du terroir et de la culture basque.',
  },
  {
    nom: 'Village vacances Atlantique',
    type: 'autre' as const,
    adresse: '1 allée des Dunes, 40600 Biscarrosse',
    ville: 'Biscarrosse',
    capacite: 200,
    prixParJour: 30,
    agrement: true,
    telephone: '05 58 78 90 00',
    email: 'vva@vacances-atlantique.fr',
    activites: ['surf', 'vélo', 'voile', 'environnement'],
    description: 'Grand village vacances agréé en bord d\'océan. Classes de mer et environnement.',
  },
  {
    nom: 'Auberge alsacienne',
    type: 'auberge' as const,
    adresse: '7 rue du Vignoble, 68000 Colmar',
    ville: 'Colmar',
    capacite: 35,
    prixParJour: 25,
    agrement: false,
    telephone: '03 89 41 56 78',
    email: 'auberge.alsace@orange.fr',
    activites: ['patrimoine', 'gastronomie', 'marché de Noël'],
    description: 'Auberge au cœur du vignoble alsacien. Idéale pour séjour culturel.',
  },
  {
    nom: 'Centre montagnard des Pyrénées',
    type: 'chalet' as const,
    adresse: '20 route du Col du Tourmalet, 65120 Barèges',
    ville: 'Barèges',
    capacite: 45,
    prixParJour: 32,
    agrement: true,
    telephone: '05 62 92 34 56',
    email: 'centre.pyrenees@montagne.fr',
    activites: ['ski', 'randonnée', 'astronomie', 'thermalisme'],
    description: 'Centre agréé en altitude. Observation astronomique et découverte montagnarde.',
  },
];

async function main() {
  console.log('Seeding hébergements catalogue...');
  for (const h of hebergements) {
    await prisma.hebergement.create({
      data: {
        ...h,
        sejourId: null,
      },
    });
  }
  console.log(`${hebergements.length} hébergements créés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
