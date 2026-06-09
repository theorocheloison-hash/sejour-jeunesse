import { Injectable, ConflictException } from '@nestjs/common';
import { TypeStructure } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { findOrCreateOrganisation, findOrCreateMembership } from '../organisations/organisation.helpers.js';

const TYPE_HORS_SCOLAIRE = new Set([
  'MAIRIE', 'COLLECTIVITE_TERRITORIALE', 'CENTRE_LOISIRS',
  'ASSOCIATION', 'COMITE_ENTREPRISE', 'ENTREPRISE',
  'MICRO_ENTREPRISE',
]);

export interface DemandePubliqueDto {
  prenom: string;
  nom: string;
  email: string;
  typeStructure?: TypeStructure;
  etablissementNom?: string;
  etablissementVille?: string;
  etablissementUai?: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  niveauClasse?: string;
  thematiquesPedagogiques?: string[];
  regionCible?: string;
  villeHebergement?: string;
  centreDestinataireId?: string;
  dateButoireReponse?: string;
  nombreAccompagnateurs?: number;
  heureArrivee?: string;
  heureDepart?: string;
  transportAller?: string;
  transportSurPlace?: boolean;
  activitesSouhaitees?: string;
  budgetMaxParEleve?: number;
  informationsComplementaires?: string;
  ageMin?: number;
  ageMax?: number;
  moinsde6ans?: boolean;
  typeAccueilACM?: string;
  projetEducatif?: string;
}

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private jwt: JwtService,
  ) {}

  async soumettreDemandePublique(dto: DemandePubliqueDto) {
    const emailNorm = dto.email.toLowerCase().trim();

    // 1. Compte actif existant → refus avec message clair
    const existant = await this.prisma.user.findUnique({ where: { email: emailNorm } });
    if (existant?.compteValide) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email. Connectez-vous pour soumettre une demande.'
      );
    }

    // 2. Créer ou réutiliser le User dormant (compteValide=false)
    let user = existant;
    if (!user) {
      const motDePasseTmp = await bcrypt.hash(randomUUID(), 10);
      user = await this.prisma.user.create({
        data: {
          prenom:            dto.prenom,
          nom:               dto.nom,
          email:             emailNorm,
          motDePasse:        motDePasseTmp,
          role:              'ORGANISATEUR',
          compteValide:      false,
          emailVerifie:      false,
        },
      });
    }

    // 3. Organisation + Membership
    const { organisation: orgaPrincipale } = await findOrCreateOrganisation(this.prisma, {
      nom:           dto.etablissementNom ?? `${dto.prenom} ${dto.nom}`,
      ville:         dto.etablissementVille ?? null,
      uai:           dto.etablissementUai ?? null,
      typeStructure: dto.typeStructure ?? TypeStructure.AUTRE,
      source:        'MANUAL',
    });

    await findOrCreateMembership(this.prisma, {
      userId:         user.id,
      organisationId: orgaPrincipale.id,
      role:           'PROPRIETAIRE',
      isPrimary:      true,
      claimStatut:    'NON_APPLICABLE',
    });

    // 4. Séjour + DemandeDevis dans une transaction atomique
    const typeContexte = dto.typeStructure && TYPE_HORS_SCOLAIRE.has(dto.typeStructure)
      ? 'HORS_SCOLAIRE'
      : 'SCOLAIRE';

    const { sejour, demande } = await this.prisma.$transaction(async (tx) => {
      const sejour = await tx.sejour.create({
        data: {
          titre:                   dto.titre,
          lieu:                    dto.villeHebergement ?? dto.etablissementVille ?? '',
          dateDebut:               new Date(dto.dateDebut),
          dateFin:                 new Date(dto.dateFin),
          placesTotales:           dto.nombreEleves,
          placesRestantes:         dto.nombreEleves,
          niveauClasse:            dto.niveauClasse ?? null,
          thematiquesPedagogiques: dto.thematiquesPedagogiques ?? [],
          statut:                  'SUBMITTED',
          typeContexte:            typeContexte,
          ageMin:                  dto.ageMin ?? null,
          ageMax:                  dto.ageMax ?? null,
          moinsde6ans:             dto.moinsde6ans ?? false,
          typeAccueilACM:          dto.typeAccueilACM ?? null,
          projetEducatif:          dto.projetEducatif ?? null,
          createurId:              user!.id,
        },
      });
      const demande = await tx.demandeDevis.create({
        data: {
          sejourId:              sejour.id,
          titre:                 dto.titre,
          dateDebut:             new Date(dto.dateDebut),
          dateFin:               new Date(dto.dateFin),
          nombreEleves:          dto.nombreEleves,
          villeHebergement:      dto.villeHebergement ?? dto.etablissementVille ?? '',
          regionCible:           dto.regionCible ?? '',
          enseignantId:          user!.id,
          centreDestinataireId:  dto.centreDestinataireId ?? null,
          dateButoireReponse:    dto.dateButoireReponse ? new Date(dto.dateButoireReponse) : null,
          nombreAccompagnateurs: dto.nombreAccompagnateurs ?? null,
          heureArrivee:          dto.heureArrivee ?? null,
          heureDepart:           dto.heureDepart ?? null,
          transportAller:        dto.transportAller ?? null,
          transportSurPlace:     dto.transportSurPlace ?? null,
          activitesSouhaitees:   dto.activitesSouhaitees ?? null,
          informationsComplementaires: dto.informationsComplementaires ?? null,
          budgetMaxParEleve:     dto.budgetMaxParEleve ?? null,
        },
      });
      return { sejour, demande };
    });

    // 5. Magic link TTL 7 jours
    const magicToken = randomUUID();
    const magicExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken: magicToken, magicLinkExpires: magicExpires },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const magicUrl = `${frontendUrl}/auth/magic/${magicToken}`;

    // 6. Email unique — confirmation + magic link
    await this.email.sendMagicLink(emailNorm, dto.prenom, dto.titre, magicUrl);

    // Notification fire-and-forget aux hébergeurs inscrits dont la zone matche
    this.notifierCentresInscrits({
      titre: dto.titre,
      villeHebergement: dto.villeHebergement ?? dto.etablissementVille ?? '',
      dateDebut: new Date(dto.dateDebut),
      dateFin: new Date(dto.dateFin),
      regionCible: dto.regionCible ?? '',
      centreDestinataireId: dto.centreDestinataireId ?? null,
      typeContexte: typeContexte,
    }).catch((err) => console.error('[PUBLIC] Erreur notification centres:', err));

    return { success: true, sejourId: sejour.id, demandeId: demande.id, centresNotifies: 0 };
  }

  private async notifierCentresInscrits(demande: {
    titre: string;
    villeHebergement: string;
    dateDebut: Date;
    dateFin: Date;
    regionCible: string;
    centreDestinataireId: string | null;
    typeContexte?: string;
  }): Promise<void> {
    const fmt = (d: Date) =>
      d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (demande.centreDestinataireId) {
      const centre = await this.prisma.centreHebergement.findUnique({
        where: { id: demande.centreDestinataireId },
        select: { nom: true, email: true },
      });
      if (centre?.email) {
        await this.email.sendNouvelleDemandeDevis(
          centre.email, centre.nom, demande.titre,
          demande.villeHebergement, `${fmt(demande.dateDebut)} → ${fmt(demande.dateFin)}`,
        );
      }
      return;
    }

    const centres = await this.prisma.centreHebergement.findMany({
      where: { statut: 'ACTIVE', email: { not: null }, userId: { not: null } },
      select: { nom: true, email: true, ville: true, codePostal: true },
    });

    const getDeptCode = (cp: string) => {
      if (cp.startsWith('97')) return cp.substring(0, 3);
      return cp.substring(0, 2);
    };

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
      '44': 'Pays de la Loire', '49': 'Pays de la Loire', '53': 'Pays de la Loire',
      '72': 'Pays de la Loire', '85': 'Pays de la Loire',
      '75': 'Île-de-France', '77': 'Île-de-France', '78': 'Île-de-France',
      '91': 'Île-de-France', '92': 'Île-de-France', '93': 'Île-de-France',
      '94': 'Île-de-France', '95': 'Île-de-France',
      '14': 'Normandie', '27': 'Normandie', '50': 'Normandie', '61': 'Normandie', '76': 'Normandie',
      '02': 'Hauts-de-France', '59': 'Hauts-de-France', '60': 'Hauts-de-France',
      '62': 'Hauts-de-France', '80': 'Hauts-de-France',
      '08': 'Grand Est', '10': 'Grand Est', '51': 'Grand Est', '52': 'Grand Est',
      '54': 'Grand Est', '55': 'Grand Est', '57': 'Grand Est', '67': 'Grand Est',
      '68': 'Grand Est', '88': 'Grand Est',
      '09': 'Occitanie', '11': 'Occitanie', '12': 'Occitanie', '30': 'Occitanie',
      '31': 'Occitanie', '32': 'Occitanie', '34': 'Occitanie', '46': 'Occitanie',
      '48': 'Occitanie', '65': 'Occitanie', '66': 'Occitanie', '81': 'Occitanie', '82': 'Occitanie',
      '16': 'Nouvelle-Aquitaine', '17': 'Nouvelle-Aquitaine', '19': 'Nouvelle-Aquitaine',
      '23': 'Nouvelle-Aquitaine', '24': 'Nouvelle-Aquitaine', '33': 'Nouvelle-Aquitaine',
      '40': 'Nouvelle-Aquitaine', '47': 'Nouvelle-Aquitaine', '64': 'Nouvelle-Aquitaine',
      '79': 'Nouvelle-Aquitaine', '86': 'Nouvelle-Aquitaine', '87': 'Nouvelle-Aquitaine',
      '04': "Provence-Alpes-Côte d'Azur", '05': "Provence-Alpes-Côte d'Azur",
      '06': "Provence-Alpes-Côte d'Azur", '13': "Provence-Alpes-Côte d'Azur",
      '83': "Provence-Alpes-Côte d'Azur", '84': "Provence-Alpes-Côte d'Azur",
    };

    const matchesZone = (regionCible: string, centre: { ville: string; codePostal: string }): boolean => {
      if (!regionCible || regionCible === '') return true;
      const colonIdx = regionCible.indexOf(':');
      if (colonIdx === -1) return true;
      const type = regionCible.substring(0, colonIdx);
      const value = regionCible.substring(colonIdx + 1);
      const deptCode = getDeptCode(centre.codePostal);
      switch (type) {
        case 'FRANCE': return true;
        case 'REGION': return DEPT_TO_REGION[deptCode] === value;
        case 'DEPARTEMENT': return deptCode === value.split(' - ')[0];
        case 'VILLE': {
          const villeName = value.split(' (')[0].toLowerCase();
          return centre.ville.toLowerCase().includes(villeName) || villeName.includes(centre.ville.toLowerCase());
        }
        default: return true;
      }
    };

    const cibles = centres.filter((c) =>
      matchesZone(demande.regionCible, { ville: c.ville, codePostal: c.codePostal ?? '' }),
    );

    await Promise.allSettled(
      cibles.map((c) =>
        this.email.sendNouvelleDemandeDevis(
          c.email!, c.nom, demande.titre,
          demande.villeHebergement, `${fmt(demande.dateDebut)} → ${fmt(demande.dateFin)}`,
        ),
      ),
    );
  }
}
