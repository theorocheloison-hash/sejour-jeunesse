import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDemandeDto } from './dto/create-demande.dto.js';

// Département → Région mapping (code postal → région)
const DEPT_TO_REGION: Record<string, string> = {
  '01': 'Auvergne-Rhône-Alpes', '03': 'Auvergne-Rhône-Alpes', '07': 'Auvergne-Rhône-Alpes',
  '15': 'Auvergne-Rhône-Alpes', '26': 'Auvergne-Rhône-Alpes', '38': 'Auvergne-Rhône-Alpes',
  '42': 'Auvergne-Rhône-Alpes', '43': 'Auvergne-Rhône-Alpes', '63': 'Auvergne-Rhône-Alpes',
  '69': 'Auvergne-Rhône-Alpes', '73': 'Auvergne-Rhône-Alpes', '74': 'Auvergne-Rhône-Alpes',
  '21': 'Bourgogne-Franche-Comté', '25': 'Bourgogne-Franche-Comté', '39': 'Bourgogne-Franche-Comté',
  '58': 'Bourgogne-Franche-Comté', '70': 'Bourgogne-Franche-Comté', '71': 'Bourgogne-Franche-Comté',
  '89': 'Bourgogne-Franche-Comté', '90': 'Bourgogne-Franche-Comté',
  '22': 'Bretagne', '29': 'Bretagne', '35': 'Bretagne', '56': 'Bretagne',
  '18': 'Centre-Val de Loire', '28': 'Centre-Val de Loire', '36': 'Centre-Val de Loire',
  '37': 'Centre-Val de Loire', '41': 'Centre-Val de Loire', '45': 'Centre-Val de Loire',
  '20': 'Corse',
  '08': 'Grand Est', '10': 'Grand Est', '51': 'Grand Est', '52': 'Grand Est',
  '54': 'Grand Est', '55': 'Grand Est', '57': 'Grand Est', '67': 'Grand Est',
  '68': 'Grand Est', '88': 'Grand Est',
  '02': 'Hauts-de-France', '59': 'Hauts-de-France', '60': 'Hauts-de-France',
  '62': 'Hauts-de-France', '80': 'Hauts-de-France',
  '75': 'Île-de-France', '77': 'Île-de-France', '78': 'Île-de-France',
  '91': 'Île-de-France', '92': 'Île-de-France', '93': 'Île-de-France',
  '94': 'Île-de-France', '95': 'Île-de-France',
  '14': 'Normandie', '27': 'Normandie', '50': 'Normandie', '61': 'Normandie', '76': 'Normandie',
  '16': 'Nouvelle-Aquitaine', '17': 'Nouvelle-Aquitaine', '19': 'Nouvelle-Aquitaine',
  '23': 'Nouvelle-Aquitaine', '24': 'Nouvelle-Aquitaine', '33': 'Nouvelle-Aquitaine',
  '40': 'Nouvelle-Aquitaine', '47': 'Nouvelle-Aquitaine', '64': 'Nouvelle-Aquitaine',
  '79': 'Nouvelle-Aquitaine', '86': 'Nouvelle-Aquitaine', '87': 'Nouvelle-Aquitaine',
  '09': 'Occitanie', '11': 'Occitanie', '12': 'Occitanie', '30': 'Occitanie',
  '31': 'Occitanie', '32': 'Occitanie', '34': 'Occitanie', '46': 'Occitanie',
  '48': 'Occitanie', '65': 'Occitanie', '66': 'Occitanie', '81': 'Occitanie', '82': 'Occitanie',
  '44': 'Pays de la Loire', '49': 'Pays de la Loire', '53': 'Pays de la Loire',
  '72': 'Pays de la Loire', '85': 'Pays de la Loire',
  '04': "Provence-Alpes-Côte d'Azur", '05': "Provence-Alpes-Côte d'Azur",
  '06': "Provence-Alpes-Côte d'Azur", '13': "Provence-Alpes-Côte d'Azur",
  '83': "Provence-Alpes-Côte d'Azur", '84': "Provence-Alpes-Côte d'Azur",
  '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte',
};

function getDeptCode(codePostal: string): string {
  if (codePostal.startsWith('97')) return codePostal.substring(0, 3);
  if (codePostal.startsWith('20')) return '20';
  return codePostal.substring(0, 2);
}

function matchesZone(regionCible: string, centre: { ville: string; codePostal: string }): boolean {
  if (!regionCible || regionCible === '') return true;

  const colonIdx = regionCible.indexOf(':');
  if (colonIdx === -1) return true;

  const type = regionCible.substring(0, colonIdx);
  const value = regionCible.substring(colonIdx + 1);
  const deptCode = getDeptCode(centre.codePostal);

  switch (type) {
    case 'FRANCE':
      return true;
    case 'REGION':
      return DEPT_TO_REGION[deptCode] === value;
    case 'DEPARTEMENT': {
      const deptTarget = value.split(' - ')[0];
      return deptCode === deptTarget;
    }
    case 'VILLE': {
      const villeName = value.split(' (')[0].toLowerCase();
      return centre.ville.toLowerCase().includes(villeName) ||
             villeName.includes(centre.ville.toLowerCase());
    }
    default:
      return true;
  }
}

@Injectable()
export class DemandeService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDemandeDto, enseignantId: string) {
    return this.prisma.demandeDevis.create({
      data: {
        titre: dto.titre,
        description: dto.description,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nombreEleves: dto.nombreEleves,
        villeHebergement: dto.villeHebergement,
        regionCible: dto.regionCible ?? '',
        dateButoireReponse: dto.dateButoireReponse ? new Date(dto.dateButoireReponse) : null,
        nombreAccompagnateurs: dto.nombreAccompagnateurs ?? null,
        heureArrivee: dto.heureArrivee ?? null,
        heureDepart: dto.heureDepart ?? null,
        activitesSouhaitees: dto.activitesSouhaitees ?? null,
        budgetMaxParEleve: dto.budgetMaxParEleve ?? null,
        transportAller:    dto.transportAller ?? null,
        transportSurPlace: dto.transportSurPlace ?? null,
        centreDestinataireId: dto.centreDestinataireId ?? null,
        sejourId: dto.sejourId,
        enseignantId,
      },
    });
  }

  async findOpen(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
      select: { id: true, ville: true, codePostal: true },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    // TODO: ABONNEMENT — réactiver la vérification d'abonnement

    const ignorees = await this.prisma.demandeIgnoree.findMany({
      where: { centreId: centre.id },
      select: { demandeId: true },
    });
    const ignoreeIds = ignorees.map(i => i.demandeId);

    // Récupérer les demandeIds auxquelles ce centre a déjà répondu
    const dejarepondus = await this.prisma.devis.findMany({
      where: { centreId: centre.id },
      select: { demandeId: true },
    });
    const dejaReponduIds = dejarepondus.map(d => d.demandeId);

    const demandes = await this.prisma.demandeDevis.findMany({
      where: {
        statut: 'OUVERTE',
        id: { notIn: [...ignoreeIds, ...dejaReponduIds] },
        OR: [
          { dateButoireReponse: null },
          { dateButoireReponse: { gte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { centreDestinataireId: null },
              { centreDestinataireId: centre.id },
            ],
          },
        ],
      },
      include: {
        enseignant: { select: { id: true, prenom: true, nom: true, email: true } },
        sejour: { select: { niveauClasse: true, thematiquesPedagogiques: true } },
        _count: { select: { devis: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return demandes.filter((d) => matchesZone(d.regionCible, centre));
  }

  async getMesDemandes(enseignantId: string) {
    return this.prisma.demandeDevis.findMany({
      where: { enseignantId },
      include: {
        _count: { select: { devis: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id },
      include: {
        enseignant: { select: { id: true, prenom: true, nom: true, email: true } },
        devis: {
          include: {
            centre: { select: { id: true, nom: true, ville: true, email: true, capacite: true } },
          },
        },
      },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');
    return demande;
  }

  async getComparatif(demandeId: string, user: { id: string; role: string }) {
    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: demandeId },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');

    if (user.role === 'TEACHER' && demande.enseignantId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.devis.findMany({
      where: { demandeId },
      include: {
        centre: {
          select: { id: true, nom: true, ville: true, telephone: true, email: true, capacite: true, description: true },
        },
      },
      orderBy: { montantTotal: 'asc' },
    });
  }

  async ignorerDemande(userId: string, demandeId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    return this.prisma.demandeIgnoree.upsert({
      where: { demandeId_centreId: { demandeId, centreId: centre.id } },
      create: { demandeId, centreId: centre.id },
      update: {},
    });
  }
}
