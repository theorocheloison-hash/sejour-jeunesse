import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { shouldRequireKbis } from './organisation.helpers.js';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://liavo.fr';

@Injectable()
export class ClaimService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private email: EmailService,
  ) {}

  /**
   * Initie un claim sur une Organisation.
   * Crée ou met à jour le Membership avec claimStatut=EN_ATTENTE_DOCUMENT
   * si Kbis requis, ou EN_ATTENTE_VALIDATION directement si non requis.
   *
   * Règle : un seul claim actif par Organisation (bloque si VALIDE existant).
   */
  async initierClaim(userId: string, organisationId: string, userRole: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');

    const claimValide = await this.prisma.membership.findFirst({
      where: { organisationId, claimStatut: 'VALIDE' },
    });
    if (claimValide) {
      throw new BadRequestException('Cette organisation a déjà un propriétaire validé');
    }

    const claimExistant = await this.prisma.membership.findFirst({
      where: {
        userId,
        organisationId,
        claimStatut: { in: ['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION'] },
      },
    });
    if (claimExistant) {
      return { membership: claimExistant, kbisRequis: false, alreadyPending: true };
    }

    const kbisRequis = await shouldRequireKbis(this.prisma, { userRole, organisationId });
    const claimStatut = kbisRequis ? 'EN_ATTENTE_DOCUMENT' : 'EN_ATTENTE_VALIDATION';

    const membership = await this.prisma.membership.upsert({
      where: { userId_organisationId: { userId, organisationId } },
      create: {
        userId,
        organisationId,
        role: 'PROPRIETAIRE',
        isPrimary: false,
        claimStatut,
        claimSubmittedAt: new Date(),
      },
      update: {
        claimStatut,
        claimSubmittedAt: new Date(),
        claimRefuseRaison: null,
      },
    });

    return { membership, kbisRequis, alreadyPending: false };
  }

  /**
   * Upload du Kbis (PDF uniquement, max 10MB).
   * Met à jour le Membership avec l'URL du document et passe en EN_ATTENTE_VALIDATION.
   * Notifie l'admin par email.
   */
  async uploadKbis(
    userId: string,
    organisationId: string,
    file: Express.Multer.File,
  ) {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Le Kbis doit être un fichier PDF');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Le fichier ne peut pas dépasser 10 Mo');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
      include: {
        organisation: { select: { nom: true } },
        user: { select: { prenom: true, nom: true, email: true } },
      },
    });

    if (!membership) throw new NotFoundException('Aucun claim en cours pour cette organisation');
    if (membership.claimStatut !== 'EN_ATTENTE_DOCUMENT') {
      throw new BadRequestException("Ce claim n'attend pas de document");
    }

    const url = await this.storage.upload(file, 'kbis');

    const updated = await this.prisma.membership.update({
      where: { userId_organisationId: { userId, organisationId } },
      data: {
        claimDocumentUrl: url,
        claimSiretExtrait: null,
        claimStatut: 'EN_ATTENTE_VALIDATION',
        claimSubmittedAt: new Date(),
      },
    });

    const adminEmail = process.env.ADMIN_EMAIL ?? 'contact@liavo.fr';
    await this.email.sendGenericNotification(
      adminEmail,
      `[LIAVO] Nouveau claim à valider — ${membership.organisation.nom}`,
      `<p>Un hébergeur a soumis un claim pour validation.</p>
       <p><strong>Structure :</strong> ${membership.organisation.nom}<br>
       <strong>Hébergeur :</strong> ${membership.user.prenom} ${membership.user.nom} (${membership.user.email})</p>
       <p><a href="${FRONTEND_URL}/dashboard/admin/claims">Voir les claims en attente →</a></p>`,
    );

    return { success: true, claimStatut: updated.claimStatut };
  }

  /**
   * Liste tous les Memberships EN_ATTENTE_VALIDATION (pour admin).
   */
  async getClaimsEnAttente() {
    return this.prisma.membership.findMany({
      where: { claimStatut: 'EN_ATTENTE_VALIDATION' },
      include: {
        user: { select: { id: true, prenom: true, nom: true, email: true } },
        organisation: {
          select: {
            id: true,
            nom: true,
            siren: true,
            siret: true,
            adresse: true,
            ville: true,
            codePostal: true,
            centresHebergement: { select: { id: true, nom: true }, take: 3 },
          },
        },
      },
      orderBy: { claimSubmittedAt: 'asc' },
    });
  }

  /**
   * Retourne le claim en cours d'un User (EN_ATTENTE_DOCUMENT ou EN_ATTENTE_VALIDATION),
   * ou null si aucun.
   */
  async getMonClaimStatut(userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        claimStatut: { in: ['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION'] },
      },
      include: { organisation: { select: { nom: true } } },
    });
    if (!membership) return { claimStatut: null };
    return {
      claimStatut: membership.claimStatut,
      organisationNom: membership.organisation.nom,
      membershipId: membership.id,
    };
  }

  /**
   * Valide un claim : passe claimStatut=VALIDE, isPrimary=true,
   * active le compte hébergeur (compteValide=true).
   * Notifie l'hébergeur.
   */
  async validerClaim(membershipId: string, validateurId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, prenom: true, email: true } },
        organisation: { select: { nom: true } },
      },
    });
    if (!membership) throw new NotFoundException('Membership introuvable');
    if (membership.claimStatut !== 'EN_ATTENTE_VALIDATION') {
      throw new BadRequestException("Ce claim n'est pas en attente de validation");
    }

    await this.prisma.$transaction([
      this.prisma.membership.update({
        where: { id: membershipId },
        data: {
          claimStatut: 'VALIDE',
          claimValidatedById: validateurId,
          claimValidatedAt: new Date(),
          isPrimary: true,
        },
      }),
      this.prisma.user.update({
        where: { id: membership.userId },
        data: { compteValide: true },
      }),
    ]);

    await this.email.sendGenericNotification(
      membership.user.email,
      'Votre claim LIAVO a été validé',
      `<p>Bonjour ${membership.user.prenom},</p>
       <p>Votre revendication du centre <strong>${membership.organisation.nom}</strong> a été validée.</p>
       <p>Vous pouvez désormais accéder à toutes les fonctionnalités de votre espace hébergeur.</p>
       <p><a href="${FRONTEND_URL}/dashboard/hebergeur">Accéder à mon espace →</a></p>`,
    );

    return { success: true };
  }

  /**
   * Refuse un claim avec motif. Notifie l'hébergeur.
   */
  async refuserClaim(membershipId: string, motif: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { prenom: true, email: true } },
        organisation: { select: { nom: true } },
      },
    });
    if (!membership) throw new NotFoundException('Membership introuvable');
    if (membership.claimStatut !== 'EN_ATTENTE_VALIDATION') {
      throw new BadRequestException("Ce claim n'est pas en attente de validation");
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        claimStatut: 'REFUSE',
        claimRefuseRaison: motif || 'Document non conforme',
      },
    });

    await this.email.sendGenericNotification(
      membership.user.email,
      "Votre claim LIAVO n'a pas pu être validé",
      `<p>Bonjour ${membership.user.prenom},</p>
       <p>Votre revendication du centre <strong>${membership.organisation.nom}</strong>
       n'a pas pu être validée pour la raison suivante :</p>
       <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
         ${motif || 'Document non conforme'}
       </blockquote>
       <p>Si vous pensez qu'il s'agit d'une erreur, contactez-nous à
       <a href="mailto:contact@liavo.fr">contact@liavo.fr</a>.</p>`,
    );

    return { success: true };
  }
}
