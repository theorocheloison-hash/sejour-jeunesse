import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { shouldRequireKbis, findOrCreateOrganisation } from './organisation.helpers.js';

const EN_CATALOGUE_API =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    // Garde anti-doublon : bloque seulement si l'organisation est déjà revendiquée
    // par un AUTRE user. Si c'est le MÊME user (cas multi-centre — ex. plusieurs
    // centres sous une même structure), on ne crée pas de nouveau claim : on
    // retourne succès, le rattachement du centre étant fait par l'appelant.
    const claimValide = await this.prisma.membership.findFirst({
      where: { organisationId, claimStatut: 'VALIDE' },
    });
    if (claimValide && claimValide.userId !== userId) {
      throw new BadRequestException('Cette organisation a déjà un propriétaire validé');
    }
    if (claimValide && claimValide.userId === userId) {
      return { membership: claimValide, kbisRequis: false, alreadyPending: false, alreadyOwner: true };
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

    // Notifier l'admin dès qu'un claim entre en attente de validation SANS Kbis.
    // (Le chemin avec Kbis notifie l'admin à l'upload du document, cf. uploadKbis.)
    if (claimStatut === 'EN_ATTENTE_VALIDATION') {
      await this.notifierAdminNouveauClaim(organisationId, userId);
    }

    return { membership, kbisRequis, alreadyPending: false };
  }

  /** Notifie l'admin d'un nouveau claim à valider (même format que uploadKbis). Non bloquant. */
  private async notifierAdminNouveauClaim(organisationId: string, userId: string) {
    try {
      const [org, user] = await Promise.all([
        this.prisma.organisation.findUnique({ where: { id: organisationId }, select: { nom: true } }),
        this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true, email: true } }),
      ]);
      if (!org || !user) return;
      const adminEmail = process.env.ADMIN_EMAIL ?? 'contact@liavo.fr';
      await this.email.sendGenericNotification(
        adminEmail,
        `[LIAVO] Nouveau claim à valider — ${org.nom}`,
        `<p>Un hébergeur a soumis un claim pour validation.</p>
         <p><strong>Structure :</strong> ${org.nom}<br>
         <strong>Hébergeur :</strong> ${user.prenom} ${user.nom} (${user.email})</p>
         <p><a href="${FRONTEND_URL}/dashboard/admin/claims">Voir les claims en attente →</a></p>`,
      );
    } catch { /* non bloquant */ }
  }

  /**
   * Revendique un centre depuis le catalogue public (centre Liavo par UUID, ou
   * record Éducation Nationale par identifiant externe). Crée/retrouve l'Organisation,
   * initie le claim, puis crée/lie le CentreHebergement.
   *
   * Ordre volontaire : initierClaim() est appelé AVANT de lier le centre à l'org.
   * Une org fraîche n'a pas encore de centre → shouldRequireKbis = false →
   * claim EN_ATTENTE_VALIDATION (pas de blocage Kbis) + notification admin. C'est
   * indispensable au flux d'auto-claim à l'inscription (l'utilisateur n'est pas
   * connecté et ne pourrait pas uploader de Kbis).
   */
  async claimFromCatalogue(catalogueId: string, userId: string, userRole: string) {
    // ── 1. Résoudre les données du centre ──
    let existingCentreId: string | null = null;
    let centreUserId: string | null = null;
    let organisationId: string | null = null;
    let identifiantEN: string | null = null;
    let nom = '', ville = '', codePostal = '', adresse = '';
    let capacite = 0;
    let departement: string | null = null;
    let siret: string | null = null;

    if (UUID_RE.test(catalogueId)) {
      const centre = await this.prisma.centreHebergement.findUnique({ where: { id: catalogueId } });
      if (!centre) throw new NotFoundException('Centre introuvable');
      existingCentreId = centre.id;
      centreUserId = centre.userId;
      organisationId = centre.organisationId;
      nom = centre.nom; ville = centre.ville; codePostal = centre.codePostal;
      adresse = centre.adresse; capacite = centre.capacite;
      departement = centre.departement; siret = centre.siret;
    } else {
      // Record EN : dédup par apidaeId, sinon récupération depuis l'API EN
      const existant = await this.prisma.centreHebergement.findFirst({
        where: { apidaeId: catalogueId, source: 'API_EN' },
      });
      identifiantEN = catalogueId;
      if (existant) {
        existingCentreId = existant.id;
        centreUserId = existant.userId;
        organisationId = existant.organisationId;
        nom = existant.nom; ville = existant.ville; codePostal = existant.codePostal;
        adresse = existant.adresse; capacite = existant.capacite;
        departement = existant.departement; siret = existant.siret;
      } else {
        const rec = await this.fetchEnRecord(catalogueId);
        nom = rec.nom; ville = rec.ville; codePostal = rec.codePostal;
        capacite = rec.capacite; departement = rec.departement;
      }
    }

    // ── 2. Organisation (dédup SIREN → nom+ville via helper) — créée AVANT le centre ──
    if (!organisationId) {
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom,
        adresse: adresse || null,
        ville,
        codePostal,
        departement,
        siret,
        siren: siret ? siret.substring(0, 9) : null,
        source: identifiantEN ? 'API_EDUCATION_NATIONALE' : 'MANUAL',
        sourceId: identifiantEN,
      });
      organisationId = organisation.id;
    }

    // ── 3. Initier le claim (org sans centre → pas de Kbis → EN_ATTENTE_VALIDATION + email admin) ──
    const claim = await this.initierClaim(userId, organisationId, userRole);

    // ── 4. Créer / lier le centre à l'organisation (+ userId si orphelin) ──
    let centreId: string;
    if (existingCentreId) {
      centreId = existingCentreId;
      await this.prisma.centreHebergement.update({
        where: { id: existingCentreId },
        data: {
          organisationId,
          ...(centreUserId ? {} : { userId }), // ne pas voler un centre déjà détenu
        },
      });
    } else {
      const centre = await this.prisma.centreHebergement.create({
        data: {
          nom,
          adresse: adresse || '',
          ville,
          codePostal,
          capacite,
          departement,
          apidaeId: identifiantEN,
          source: 'API_EN',
          statut: 'PENDING',
          organisationId,
          userId,
        },
      });
      centreId = centre.id;
    }

    return {
      centreId,
      organisationId,
      claimStatut: claim.membership.claimStatut,
      kbisRequis: claim.kbisRequis,
    };
  }

  /** Récupère un record du catalogue Éducation Nationale par identifiant externe. */
  private async fetchEnRecord(identifiant: string): Promise<{
    nom: string; ville: string; codePostal: string; capacite: number; departement: string | null;
  }> {
    const params = new URLSearchParams({ limit: '1', where: `identifiant="${identifiant}"` });
    const res = await fetch(`${EN_CATALOGUE_API}?${params}`);
    const data = (await res.json()) as { results?: Array<Record<string, any>> };
    const r = data?.results?.[0];
    if (!r) throw new NotFoundException('Centre du catalogue introuvable');
    return {
      nom: r.nom_de_la_structure_d_accueil_et_d_hebergement_fr,
      ville: r.nom_du_lieu_d_accueil_ville,
      codePostal: r.nom_du_lieu_d_accueil_code_postal,
      capacite: (r.nombre_de_lits_pour_les_eleves as number) ?? 0,
      departement: (r.nom_du_lieu_d_accueil_departement as string) ?? null,
    };
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

    // Activer les centres de l'organisation : rattacher les orphelins à l'hébergeur,
    // puis passer ses centres PENDING en ACTIVE (visibles au catalogue / « mes centres »).
    await this.prisma.centreHebergement.updateMany({
      where: { organisationId: membership.organisationId, userId: null },
      data: { userId: membership.userId },
    });
    await this.prisma.centreHebergement.updateMany({
      where: { organisationId: membership.organisationId, userId: membership.userId, statut: 'PENDING' },
      data: { statut: 'ACTIVE' },
    });

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
