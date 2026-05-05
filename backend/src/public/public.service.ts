import { Injectable, ConflictException } from '@nestjs/common';
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
  typeStructure?: string;
  etablissementNom?: string;
  etablissementVille?: string;
  etablissementUai?: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  niveauClasse?: string;
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
      typeStructure: (dto.typeStructure as any) ?? 'AUTRE',
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
          thematiquesPedagogiques: [],
          statut:                  'SUBMITTED',
          typeContexte:            typeContexte,
          ageMin:                  null,
          ageMax:                  null,
          moinsde6ans:             false,
          typeAccueilACM:          null,
          projetEducatif:          null,
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

    // centresNotifies : 1 si contact direct, 0 si appel d'offres géographique
    // (le comptage géographique précis sera ajouté quand findOpen() sera extrait
    // en service partagé — on ne ment pas avec un chiffre approximatif)
    const centresNotifies = dto.centreDestinataireId ? 1 : 0;

    return { success: true, sejourId: sejour.id, demandeId: demande.id, centresNotifies };
  }
}
