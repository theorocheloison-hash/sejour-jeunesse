import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateDemandeDto } from './dto/create-demande.dto.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { normaliserDepartements } from '../utils/departements.js';

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

/**
 * Matching zone d'une demande vers un centre.
 * `departementsCibles` (codes, ex. ['73','74']) PRIME sur `regionCible` quand renseigné :
 * le centre matche s'il est dans l'un des départements ciblés. Sinon, fallback `regionCible`.
 */
function matchesDemandeZone(
  demande: { regionCible: string; departementsCibles: string[] },
  centre: { ville: string; codePostal: string },
): boolean {
  if (demande.departementsCibles && demande.departementsCibles.length > 0) {
    const deptCode = getDeptCode(centre.codePostal);
    return demande.departementsCibles.some((d) => d.split(' - ')[0] === deptCode);
  }
  return matchesZone(demande.regionCible, centre);
}

/**
 * Filtre capacité : le total participants (élèves + accompagnateurs) doit tenir dans
 * la fourchette [capaciteGroupeMin, capaciteGroupeMax] du centre. NULL = pas de borne.
 */
export function matchesCapacite(
  totalParticipants: number,
  centre: { capaciteGroupeMin: number | null; capaciteGroupeMax: number | null },
): boolean {
  if (centre.capaciteGroupeMin != null && totalParticipants < centre.capaciteGroupeMin) return false;
  if (centre.capaciteGroupeMax != null && totalParticipants > centre.capaciteGroupeMax) return false;
  return true;
}

/**
 * Construit le libellé de période d'une demande/séjour : soit les dates fixes,
 * soit la période flexible (mois · année · note · durée), sinon « Période à définir ».
 */
export function buildPeriodeLabel(dto: {
  dateDebut?: string;
  dateFin?: string;
  moisSouhaite?: number;
  anneeSouhaitee?: number;
  noteDateFlexible?: string;
  dureeNuits?: number;
}): string {
  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  if (dto.dateDebut && dto.dateFin) {
    const fmt = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${fmt(dto.dateDebut)} → ${fmt(dto.dateFin)}`;
  }
  const parts: string[] = [];
  if (dto.moisSouhaite) parts.push(MOIS[dto.moisSouhaite - 1]);
  if (dto.anneeSouhaitee) parts.push(String(dto.anneeSouhaitee));
  if (dto.noteDateFlexible) parts.push(dto.noteDateFlexible);
  if (dto.dureeNuits) parts.push(`~${dto.dureeNuits} nuits`);
  return parts.length > 0 ? parts.join(' · ') : 'Période à définir';
}

@Injectable()
export class DemandeService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateDemandeDto, enseignantId: string) {
    const demande = await this.prisma.demandeDevis.create({
      data: {
        titre: dto.titre,
        description: dto.description,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : null,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        moisSouhaite: dto.moisSouhaite ?? null,
        anneeSouhaitee: dto.anneeSouhaitee ?? null,
        noteDateFlexible: dto.noteDateFlexible ?? null,
        dureeNuits: dto.dureeNuits ?? null,
        nombreEleves: dto.nombreEleves,
        villeHebergement: dto.villeHebergement,
        regionCible: dto.regionCible ?? '',
        departementsCibles: normaliserDepartements(dto.departementsCibles),
        typePension: dto.typePension ?? [],
        dateButoireReponse: dto.dateButoireReponse ? new Date(dto.dateButoireReponse) : null,
        nombreAccompagnateurs: dto.nombreAccompagnateurs ?? null,
        heureArrivee: dto.heureArrivee ?? null,
        heureDepart: dto.heureDepart ?? null,
        activitesSouhaitees: dto.activitesSouhaitees ?? null,
        informationsComplementaires: dto.informationsComplementaires ?? null,
        budgetMaxParEleve: dto.budgetMaxParEleve ?? null,
        transportAller:    dto.transportAller ?? null,
        transportSurPlace: dto.transportSurPlace ?? null,
        centreDestinataireId: dto.centreDestinataireId ?? null,
        sejourId: dto.sejourId,
        enseignantId,
      },
      include: { sejour: { select: { typeContexte: true } } },
    });

    this.notifierCentresInscrits({
      titre: demande.titre,
      villeHebergement: demande.villeHebergement,
      dateDebut: demande.dateDebut,
      dateFin: demande.dateFin,
      periodeLabel: buildPeriodeLabel(dto),
      regionCible: demande.regionCible,
      departementsCibles: demande.departementsCibles,
      centreDestinataireId: demande.centreDestinataireId,
      nombreEleves: demande.nombreEleves,
      nombreAccompagnateurs: demande.nombreAccompagnateurs,
      typeContexte: demande.sejour?.typeContexte ?? undefined,
    }).catch((err) => console.error('[DEMANDE] Erreur notification centres:', err));

    return demande;
  }

  async findOpen(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const now = new Date();
    const accesComplet =
      centre.abonnementStatut === 'ACTIF' &&
      !!centre.abonnementActifJusquAu &&
      centre.abonnementActifJusquAu >= now;

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
    const dejaReponduIds = dejarepondus
      .map(d => d.demandeId)
      .filter((id): id is string => id !== null);

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
        enseignant: {
          select: {
            id: true, prenom: true, nom: true, email: true, telephone: true,
            memberships: {
              where: { isPrimary: true },
              select: { organisation: { select: { nom: true, ville: true, typeStructure: true } } },
              take: 1,
            },
          },
        },
        sejour: {
          select: {
            niveauClasse: true, thematiquesPedagogiques: true,
            ageMin: true, ageMax: true, projetEducatif: true, typeContexte: true,
          },
        },
        _count: { select: { devis: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return demandes
      .filter((d) => matchesDemandeZone(d, centre))
      .filter((d) => {
        // Demande ciblée vers ce centre → toujours visible, hors fourchette inclus.
        if (d.centreDestinataireId === centre.id) return true;
        // Broadcast → filtre capacité sur le total participants (élèves + accompagnateurs).
        const total = (d.nombreEleves ?? 0) + (d.nombreAccompagnateurs ?? 0);
        return matchesCapacite(total, centre);
      })
      .map((d) => {
        if (accesComplet) return d;
        return {
          ...d,
          enseignant: {
            id: d.enseignant.id,
            prenom: d.enseignant.prenom,
            nom: d.enseignant.nom,
            email: null,
            // Contact (email + téléphone) masqué sans abonnement ; l'établissement reste visible.
            telephone: null,
            memberships: d.enseignant.memberships,
          },
        };
      });
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

    if (user.role === 'ORGANISATEUR' && demande.enseignantId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.devis.findMany({
      where: { demandeId },
      include: {
        lignes: true,
        centre: {
          select: {
            id: true, nom: true, ville: true, telephone: true, email: true,
            capacite: true, description: true, adresse: true, codePostal: true,
            siret: true, tvaIntracommunautaire: true, iban: true, conditionsAnnulation: true,
            logoUrl: true,
          },
        },
        demande: {
          include: {
            enseignant: {
              select: { prenom: true, nom: true, email: true, telephone: true },
            },
            sejour: {
              select: {
                id: true, titre: true, dateDebut: true, dateFin: true,
                niveauClasse: true, statut: true,
                createur: {
                  select: { prenom: true, nom: true },
                },
              },
            },
          },
        },
      },
      orderBy: { montantTotal: 'asc' },
    });
  }

  async ignorerDemande(userId: string, demandeId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.demandeIgnoree.upsert({
      where: { demandeId_centreId: { demandeId, centreId: centre.id } },
      create: { demandeId, centreId: centre.id },
      update: {},
    });
  }

  private async notifierCentresInscrits(demande: {
    titre: string;
    villeHebergement: string;
    dateDebut: Date | null;
    dateFin: Date | null;
    periodeLabel: string;
    regionCible: string;
    departementsCibles: string[];
    centreDestinataireId: string | null;
    nombreEleves: number;
    nombreAccompagnateurs: number | null;
    typeContexte?: string;
  }): Promise<void> {
    if (demande.centreDestinataireId) {
      const centre = await this.prisma.centreHebergement.findUnique({
        where: { id: demande.centreDestinataireId },
        select: { nom: true, email: true },
      });
      if (centre?.email) {
        await this.email.sendNouvelleDemandeDevis(
          centre.email, centre.nom, demande.titre,
          demande.villeHebergement, demande.periodeLabel,
          demande.typeContexte,
        );
      }
      return;
    }

    const centres = await this.prisma.centreHebergement.findMany({
      where: { statut: 'ACTIVE', email: { not: null }, userId: { not: null } },
      select: {
        nom: true, email: true, ville: true, codePostal: true,
        capaciteGroupeMin: true, capaciteGroupeMax: true,
      },
    });

    // Broadcast : on ne notifie que les centres dont la zone ET la fourchette de
    // capacité matchent (total participants = élèves + accompagnateurs).
    const totalParticipants = demande.nombreEleves + (demande.nombreAccompagnateurs ?? 0);
    const cibles = centres.filter((c) =>
      matchesDemandeZone(demande, { ville: c.ville, codePostal: c.codePostal }) &&
      matchesCapacite(totalParticipants, c),
    );

    await Promise.allSettled(
      cibles.map((c) =>
        this.email.sendNouvelleDemandeDevis(
          c.email!, c.nom, demande.titre,
          demande.villeHebergement, demande.periodeLabel,
          demande.typeContexte,
        ),
      ),
    );
  }
}
