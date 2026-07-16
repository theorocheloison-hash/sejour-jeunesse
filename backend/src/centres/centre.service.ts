import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { CentreHebergement, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { RegisterCentreDto } from './dto/register-centre.dto.js';
import { UpdateCentreDto } from './dto/update-centre.dto.js';
import { CreateCentreDto } from './dto/create-centre.dto.js';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { STATUTS_DEVIS_RETENUS, STATUTS_DEVIS_ENGAGEANTS } from '../devis/devis-statuts.constants.js';
import { STATUTS_SEJOUR_CONFIRMES } from '../sejours/sejour-statuts.constants.js';
import { getCentreForUser, getCentresForUser } from './centre.helper.js';
import { getUserCentrePermissions } from './permission.helper.js';
import { matchesCapacite } from '../demandes/demande.service.js';
import { findOrCreateOrganisation, findOrCreateMembership } from '../organisations/organisation.helpers.js';
import { trialExpiration } from './trial.helper.js';
import { normaliserDepartement } from '../utils/departements.js';

// ── Configuration des champs d'inscription (saisie directe participants) ──
export const CHAMPS_STANDARD_INSCRIPTION = [
  'taille', 'poids', 'pointure', 'niveauSki', 'regimeAlimentaire',
  'eleveDateNaissance', 'nomParent', 'telephoneUrgence', 'infosMedicales',
] as const;

export const DEFAULT_CONFIG_INSCRIPTION = {
  champsActifs: [...CHAMPS_STANDARD_INSCRIPTION],
  champsCustom: [],
};

@Injectable()
export class CentreService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private storage: StorageService,
    private email: EmailService,
  ) {}

  /**
   * Permissions de l'user connecté sur le centre actif (X-Centre-Id, ou centre par défaut).
   * Retourne OWNER_PERMISSIONS pour un propriétaire, sinon les permissions du collaborateur.
   */
  async getMesPermissions(userId: string, centreId?: string | null) {
    let cid = centreId;
    if (!cid) {
      const centre = await getCentreForUser(this.prisma, userId);
      cid = centre.id;
    }
    const perms = await getUserCentrePermissions(this.prisma, userId, cid);
    if (!perms) throw new ForbiddenException('Aucun accès à ce centre');
    return perms;
  }

  /**
   * État d'onboarding du centre actif, dérivé (aucun état stocké) :
   * profil, catalogue, conformité (justificatif + IBAN), premier séjour,
   * premier devis envoyé. Le repli de la carte onboarding est purement frontend.
   */
  async getOnboardingStatus(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const [[produitsActifs, sejourRecent, devisEnvoyes], membership] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.produitCatalogue.count({
          where: { centreId: centre.id, actif: true },
        }),
        this.prisma.sejour.findFirst({
          where: { hebergementSelectionneId: centre.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        }),
        this.prisma.devis.count({
          where: { centreId: centre.id, dateEnvoi: { not: null } },
        }),
      ]),
      centre.organisationId
        ? this.prisma.membership.findFirst({
            where: { userId, organisationId: centre.organisationId },
            select: { claimStatut: true },
          })
        : Promise.resolve(null),
    ]);

    let justificatif: 'ABSENT' | 'EN_ATTENTE_VALIDATION' | 'VALIDE' = 'ABSENT';
    if (membership?.claimStatut === 'VALIDE') {
      justificatif = 'VALIDE';
    } else if (membership?.claimStatut === 'EN_ATTENTE_VALIDATION') {
      justificatif = 'EN_ATTENTE_VALIDATION';
    }
    // Multi-centre : le justificatif peut être porté par le centre lui-même
    // (claimDocumentUrl) plutôt que par le membership → au minimum en attente.
    if (justificatif === 'ABSENT' && centre.claimDocumentUrl) {
      justificatif = 'EN_ATTENTE_VALIDATION';
    }

    const iban = centre.iban != null;
    const etapes = {
      profil: { ok: centre.imageUrl != null && !!centre.description?.trim() },
      catalogue: { ok: produitsActifs > 0 },
      conformite: {
        justificatif,
        iban,
        ok: justificatif !== 'ABSENT' && iban,
      },
      sejour: { ok: !!sejourRecent, id: sejourRecent?.id ?? null },
      devis: { ok: devisEnvoyes > 0 },
    };

    return {
      etapes,
      // Organisation du CENTRE ACTIF — cible du dépôt de justificatif (upload-kbis).
      // mon-claim-statut est scopé au user (findFirst) : en multi-organisation il
      // désignerait une organisation arbitraire. Celle-ci lève l'ambiguïté.
      organisationId: centre.organisationId,
      centreValide: centre.statut === 'ACTIVE',
      // envoisBloques : miroir EXACT de assertEnvoiExterneAutorise (centre.helper.ts),
      // moins l'exception "destinataire = soi". Source unique de vérité pour l'encart
      // pré-envoi + le pied de checklist. Endpoint owner-only (checklist affichée si isOwned),
      // donc le membership déjà chargé = celui du propriétaire visé par le gate.
      envoisBloques:
        centre.statut !== 'ACTIVE' ||
        (!!centre.organisationId &&
          !!membership &&
          ['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'REFUSE'].includes(
            membership.claimStatut,
          )),
      complete:
        etapes.profil.ok &&
        etapes.catalogue.ok &&
        etapes.conformite.ok &&
        etapes.sejour.ok &&
        etapes.devis.ok,
    };
  }

  /** Retourne la config des champs d'inscription du centre, ou le défaut. */
  async getConfigInscription(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const raw = centre.champsInscription as { champsActifs?: unknown } | null;
    if (!raw || !Array.isArray(raw.champsActifs)) return DEFAULT_CONFIG_INSCRIPTION;
    return raw;
  }

  /** Valide puis enregistre la config des champs d'inscription du centre. */
  async updateConfigInscription(
    userId: string,
    body: { champsActifs?: unknown; champsCustom?: unknown },
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // ── Validation champsActifs ──
    if (!Array.isArray(body.champsActifs)) {
      throw new BadRequestException('champsActifs doit être un tableau');
    }
    const allowed = new Set<string>(CHAMPS_STANDARD_INSCRIPTION);
    for (const c of body.champsActifs) {
      if (typeof c !== 'string' || !allowed.has(c)) {
        throw new BadRequestException(`Champ standard invalide : ${String(c)}`);
      }
    }
    // Dédupliquer (ex: ["taille","taille"] → ["taille"])
    const champsActifs = [...new Set(body.champsActifs as string[])];

    // ── Validation champsCustom ──
    if (!Array.isArray(body.champsCustom)) {
      throw new BadRequestException('champsCustom doit être un tableau');
    }
    if (body.champsCustom.length > 5) {
      throw new BadRequestException('Maximum 5 champs personnalisés');
    }
    const VALID_TYPES = new Set(['text', 'number', 'select']);
    const nomsVus = new Set<string>();
    const champsCustom = body.champsCustom.map((raw) => {
      const c = raw as {
        nom?: unknown;
        type?: unknown;
        obligatoire?: unknown;
        options?: unknown;
      };
      if (typeof c.nom !== 'string' || c.nom.trim().length === 0 || c.nom.length > 100) {
        throw new BadRequestException('Nom de champ personnalisé invalide (1-100 caractères)');
      }
      if (typeof c.type !== 'string' || !VALID_TYPES.has(c.type)) {
        throw new BadRequestException(`Type de champ invalide : ${String(c.type)}`);
      }
      const nomKey = c.nom.trim().toLowerCase();
      if (nomsVus.has(nomKey)) {
        throw new BadRequestException(`Nom de champ personnalisé dupliqué : ${c.nom}`);
      }
      nomsVus.add(nomKey);
      let options: string[] | undefined;
      if (c.type === 'select') {
        if (!Array.isArray(c.options) || c.options.length === 0) {
          throw new BadRequestException('Un champ de type select doit avoir des options non vides');
        }
        options = c.options.map((o) => String(o));
      }
      return {
        nom: c.nom,
        type: c.type as 'text' | 'number' | 'select',
        obligatoire: Boolean(c.obligatoire),
        ...(options ? { options } : {}),
      };
    });

    const champsInscription = { champsActifs, champsCustom };

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { champsInscription },
    });

    return champsInscription;
  }

  async getMesCentres(userId: string) {
    // Inclut les centres possédés ET ceux où l'user est collaborateur accepté.
    const allCentres = await getCentresForUser(this.prisma, userId);
    const ids = allCentres.map(c => c.id);
    const centres = await this.prisma.centreHebergement.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, nom: true, ville: true, adresse: true, codePostal: true,
        capacite: true, imageUrl: true, logoUrl: true, statut: true,
        abonnementStatut: true, planAbonnement: true,
        userId: true, // pour calculer isOwned (non exposé dans la réponse)
      },
      orderBy: { nom: 'asc' },
    });
    return centres.map(c => ({
      id: c.id, nom: c.nom, ville: c.ville, adresse: c.adresse,
      codePostal: c.codePostal, capacite: c.capacite, imageUrl: c.imageUrl,
      logoUrl: c.logoUrl,
      statut: c.statut, abonnementStatut: c.abonnementStatut,
      planAbonnement: c.planAbonnement,
      isOwned: c.userId === userId,
    }));
  }

  /** Centres de l'hébergeur en attente de validation (PENDING) — pour le bandeau dashboard. */
  async getMesCentresPending(userId: string) {
    return this.prisma.centreHebergement.findMany({
      where: { userId, statut: 'PENDING' },
      // organisationId : permet au frontend d'identifier les centres déjà couverts
      // par un claim EN_ATTENTE_VALIDATION de leur organisation (validerClaim
      // active tous les centres PENDING de l'organisation d'un coup).
      select: { id: true, nom: true, claimDocumentUrl: true, organisationId: true },
      orderBy: { nom: 'asc' },
    });
  }

  async createCentre(userId: string, dto: CreateCentreDto) {
    // Centre + organisation + membership : tout ou rien, même pattern que
    // registerHebergeur. Sans transaction, un échec du rattachement laissait un
    // centre orphelin sans organisation ni membership — invisible de toutes les
    // listes admin (/admin/claims et /admin/centres/pending), donc jamais activable.
    let centre: CentreHebergement;
    try {
      centre = await this.prisma.$transaction(async (tx) => {
        const centresExistants = await tx.centreHebergement.count({ where: { userId } });

        // Résolution de l'organisation — la structure juridique (la DONNÉE) prime
        // sur le chemin emprunté :
        // (1) SIRET saisi → dédup par SIREN (un établissement secondaire porte le
        //     même SIREN que sa société ; une seconde société = SIREN différent =
        //     autre organisation — le SIRET saisi n'est jamais ignoré) ;
        // (2) sinon, membership VALIDE le plus ancien (déterministe) : cas nominal
        //     du multi-centre, la dédup nom+ville ne matcherait pas le nom du
        //     chalet contre celui de l'organisation et créerait une org orpheline ;
        // (3) sinon, dédup textuelle / création.
        const orgParams = {
          nom: dto.nom,
          adresse: dto.adresse,
          ville: dto.ville,
          codePostal: dto.codePostal,
          siret: dto.siret ?? null,
          siren: dto.siret ? dto.siret.substring(0, 9) : null,
          typeStructure: null,
          source: 'MANUAL' as const,
        };
        let organisationId: string;
        if (dto.siret) {
          const { organisation } = await findOrCreateOrganisation(tx, orgParams);
          organisationId = organisation.id;
        } else {
          const membershipValide = await tx.membership.findFirst({
            where: { userId, claimStatut: 'VALIDE' },
            orderBy: { claimValidatedAt: 'asc' },
            select: { organisationId: true },
          });
          if (membershipValide) {
            organisationId = membershipValide.organisationId;
          } else {
            const { organisation } = await findOrCreateOrganisation(tx, orgParams);
            organisationId = organisation.id;
          }
        }

        const created = await tx.centreHebergement.create({
          data: {
            nom: dto.nom,
            adresse: dto.adresse,
            ville: dto.ville,
            codePostal: dto.codePostal,
            capacite: dto.capacite,
            telephone: dto.telephone ?? null,
            siret: dto.siret ?? null,
            email: dto.email ?? null,
            description: dto.description ?? null,
            userId,
            statut: 'PENDING',
            organisationId,
          },
        });

        // claimStatut dérivé de la RELATION entre l'utilisateur et l'organisation
        // effectivement résolue — jamais du chemin emprunté. Un hébergeur validé
        // ailleurs qui rattache un centre à une SECONDE société doit justifier
        // CETTE structure (EN_ATTENTE_DOCUMENT).
        // Invariant : tout centre PENDING sort dans au moins une liste admin —
        // org déjà possédée par le user ou par un tiers (pas de claim concurrent)
        // → NON_APPLICABLE, le centre sort dans /admin/centres/pending (filtre
        // memberships.some(VALIDE)) ; org neuve ou non revendiquée → tunnel
        // justificatif, le claim sort dans /admin/claims.
        const membershipValideSurCetteOrg = await tx.membership.findFirst({
          where: { userId, organisationId, claimStatut: 'VALIDE' },
          select: { id: true },
        });
        const claimValideAutre = await tx.membership.findFirst({
          where: { organisationId, claimStatut: 'VALIDE', userId: { not: userId } },
          select: { id: true },
        });
        const claimFields: { claimStatut: 'NON_APPLICABLE' | 'EN_ATTENTE_DOCUMENT'; claimSubmittedAt?: Date } =
          membershipValideSurCetteOrg || claimValideAutre
            ? { claimStatut: 'NON_APPLICABLE' }
            : { claimStatut: 'EN_ATTENTE_DOCUMENT', claimSubmittedAt: new Date() };
        await findOrCreateMembership(tx, {
          userId,
          organisationId,
          role: 'PROPRIETAIRE',
          isPrimary: centresExistants === 0,
          ...claimFields,
        });

        return created;
      }, { timeout: 10000 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 : contrainte unique violée pendant la transaction.
        if (err.code === 'P2002') {
          throw new ConflictException('Un centre ou une organisation identique existe déjà.');
        }
        // P2000 : valeur trop longue pour la colonne (VarChar dépassé).
        if (err.code === 'P2000') {
          const colonne = (err.meta as { column_name?: string } | undefined)?.column_name;
          throw new BadRequestException(
            colonne
              ? `La valeur du champ « ${colonne} » est trop longue. Corrigez-la puis réessayez.`
              : 'Une des informations saisies est trop longue. Corrigez-la puis réessayez.',
          );
        }
      }
      console.error(
        `[createCentre] Échec de la création du centre « ${dto.nom} » — rollback complet, aucune donnée créée :`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }

    this.email.sendGenericNotification(
      process.env.ADMIN_EMAIL ?? 'contact@liavo.fr',
      'Nouveau centre à valider',
      `Un hébergeur a créé un nouveau centre.<br><br>Centre&nbsp;: ${dto.nom}<br>Ville&nbsp;: ${dto.ville}<br>SIRET&nbsp;: ${dto.siret ?? 'Non renseigné'}<br>Capacité&nbsp;: ${dto.capacite} places<br>Hébergeur&nbsp;: user ID ${userId}<br><br>Connectez-vous au dashboard admin pour valider ou refuser.`,
      'LIAVO Admin',
    ).catch(err => console.error('[createCentre] Echec email admin', err));

    return centre;
  }

  /**
   * Upload d'un justificatif pour un centre PENDING (hébergeur déjà validé qui a
   * ajouté un centre sans fournir de document au moment du claim). Stocke l'URL sur
   * le centre (champ distinct du justificatif de société porté par le Membership).
   */
  async uploadJustificatif(userId: string, centreId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Justificatif : formats acceptés PDF, JPG ou PNG.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Le justificatif ne peut pas dépasser 10 Mo.');
    }

    const centre = await this.prisma.centreHebergement.findUnique({ where: { id: centreId } });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.userId !== userId) throw new ForbiddenException('Ce centre ne vous appartient pas');

    const url = await this.storage.upload(file, 'claims');
    await this.prisma.centreHebergement.update({
      where: { id: centreId },
      data: { claimDocumentUrl: url, claimSubmittedAt: centre.claimSubmittedAt ?? new Date() },
    });

    this.email.sendGenericNotification(
      process.env.ADMIN_EMAIL ?? 'contact@liavo.fr',
      `[LIAVO] Justificatif reçu — ${centre.nom}`,
      `Un justificatif a été fourni pour le centre <strong>${centre.nom}</strong> (en attente d'activation).<br><br>` +
      `<a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/admin/claims">Voir les centres à valider →</a>`,
      'LIAVO Admin',
    ).catch((err) => console.error('[uploadJustificatif] échec email admin', err));

    return { success: true, claimDocumentUrl: url };
  }

  // Le workflow admin de validation (claims + centres PENDING) vit dans
  // claim.service et admin.service — les implémentations permissives qui
  // vivaient ici ont été supprimées (validation sans justificatif, activation
  // de tous les centres du user toutes organisations confondues).

  async getDashboardGlobal(userId: string, periodeDebut?: string, periodeFin?: string) {
    // Seuls les centres ACTIVE apparaissent dans « Mes centres » et les KPI consolidés.
    // Les centres PENDING (en attente de validation admin) sont exclus.
    const allCentres = await getCentresForUser(this.prisma, userId);
    const centreIds = allCentres.map(c => c.id);
    const centres = await this.prisma.centreHebergement.findMany({
      where: { id: { in: centreIds } },
      select: {
        id: true, nom: true, ville: true, capacite: true, imageUrl: true,
        capaciteGroupeMin: true, capaciteGroupeMax: true, reseau: true,
      },
    });
    if (centres.length === 0) return null;

    const now = new Date();
    const debut = periodeDebut ? new Date(periodeDebut) : new Date(now.getFullYear(), 0, 1);
    const fin = periodeFin ? new Date(periodeFin) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    // KPI 1 : À traiter
    const demandesOuvertesRaw = await this.prisma.demandeDevis.findMany({
      where: {
        statut: 'OUVERTE',
        OR: [
          { centreDestinataireId: { in: centreIds } },
          { centreDestinataireId: null },
        ],
        NOT: { devis: { some: { centreId: { in: centreIds } } } },
        demandesIgnorees: { none: { centreId: { in: centreIds } } },
      },
      select: {
        id: true, titre: true, dateDebut: true, dateFin: true, nombreEleves: true,
        nombreAccompagnateurs: true,
        dateButoireReponse: true, centreDestinataireId: true,
        enseignant: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateButoireReponse: 'asc' },
      take: 20,
    });

    // Post-filtre capacité (broadcast uniquement). Appliqué AVANT les compteurs (nbUrgents,
    // aTraiter.total, aTraiterDetail) pour ne pas fausser les KPIs.
    const demandesOuvertes = demandesOuvertesRaw.filter((d) => {
      // Demande ciblée vers l'un de mes centres → toujours incluse (hors fourchette inclus).
      if (d.centreDestinataireId != null) return true;
      // Broadcast → incluse si AU MOINS UN centre de l'hébergeur accepte ce total.
      const total = (d.nombreEleves ?? 0) + (d.nombreAccompagnateurs ?? 0);
      return centres.some((c) => matchesCapacite(total, c));
    });

    const devisEnAttenteReponse = await this.prisma.devis.findMany({
      where: {
        centreId: { in: centreIds },
        statut: { in: ['EN_ATTENTE', 'EN_ATTENTE_VALIDATION'] },
      },
      select: {
        id: true, centreId: true, montantTTC: true, createdAt: true, statut: true,
        demande: { select: { titre: true, dateButoireReponse: true, dateDebut: true, dateFin: true, nombreEleves: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const urgences7j = new Date();
    urgences7j.setDate(urgences7j.getDate() + 7);
    const nbUrgents = [...demandesOuvertes, ...devisEnAttenteReponse].filter(item => {
      const butoire = 'dateButoireReponse' in item ? item.dateButoireReponse : item.demande?.dateButoireReponse;
      return butoire && new Date(butoire) <= urgences7j;
    }).length;

    // KPI 2 : À facturer (Lot 1 : la facturation vit dans l'entité Facture, le devis ne mute plus)
    // 2a. Acompte à émettre : devis signé/sélectionné SANS facture ACOMPTE.
    const aFacturerAcompteRaw = await this.prisma.devis.findMany({
      where: {
        centreId: { in: centreIds },
        statut: { in: STATUTS_DEVIS_ENGAGEANTS },
        factures: { none: { typeFacture: 'ACOMPTE' } },
      },
      select: {
        id: true, centreId: true, montantTTC: true, montantTotal: true,
        montantAcompte: true, pourcentageAcompte: true, statut: true,
        demande: { select: { titre: true, dateDebut: true, dateFin: true } },
      },
    });
    const aFacturerAcompte = aFacturerAcompteRaw.map(d => {
      const ttc = d.montantTTC ?? Number(d.montantTotal);
      const montantAcompte = d.montantAcompte ?? (ttc * (d.pourcentageAcompte ?? 30) / 100);
      return {
        id: d.id, centreId: d.centreId, montantTTC: d.montantTTC,
        montantAcompte, statut: d.statut, demande: d.demande,
      };
    });

    // 2b. Solde à émettre : facture ACOMPTE validée, séjour terminé, SANS facture SOLDE.
    const acomptesValides = await this.prisma.facture.findMany({
      where: {
        typeFacture: 'ACOMPTE',
        acompteVerse: true,
        devis: { centreId: { in: centreIds }, demande: { dateFin: { lt: now } } },
        facturesSolde: { none: {} }, // pas de facture SOLDE pointant vers cet acompte
      },
      select: {
        id: true, montantTTC: true, montantFacture: true,
        devis: {
          select: {
            id: true, centreId: true, montantVerseTotal: true, statut: true,
            demande: { select: { titre: true, dateDebut: true, dateFin: true } },
          },
        },
      },
    });
    const aFacturerSolde = acomptesValides.map(f => ({
      id: f.devis.id, centreId: f.devis.centreId, montantTTC: f.montantTTC,
      // Refacto facture-solde (étape 6) : encaissé RÉEL du devis (Σ versements),
      // plus le postulat « facturé = versé ». Aligné sur emettreFactureSolde :
      // au moins l'acompte facturé (legacy validé sans versement complet),
      // sur-paiement crédité — pas de discontinuité.
      montantVerseTotal: Math.max(f.devis.montantVerseTotal ?? 0, f.montantFacture),
      statut: f.devis.statut, demande: f.devis.demande,
    }));

    const montantAFacturer = [
      ...aFacturerAcompte.map(d => d.montantAcompte ?? 0),
      ...aFacturerSolde.map(d => (d.montantTTC ?? 0) - (d.montantVerseTotal ?? 0)),
    ].reduce((sum, m) => sum + m, 0);

    // KPI 3 : Paiements en attente — factures émises dont le règlement reste incomplet.
    const facturesEmises = await this.prisma.facture.findMany({
      where: { devis: { centreId: { in: centreIds } } },
      select: {
        id: true, numero: true, typeFacture: true, montantFacture: true,
        montantVerseTotal: true, dateEmission: true, acompteVerse: true,
        devis: {
          select: {
            centreId: true,
            demande: { select: { titre: true } },
            sejourDirect: { select: { titre: true } },
          },
        },
      },
    });
    const facturesImpayees = facturesEmises
      // Un acompte validé n'est jamais un impayé (micro-écart d'arrondi/frais ignoré).
      .filter(f => (f.montantVerseTotal ?? 0) < f.montantFacture
        && !(f.typeFacture === 'ACOMPTE' && f.acompteVerse))
      .map(f => ({
        id: f.id, centreId: f.devis.centreId,
        montantTTC: f.montantFacture, // "dû" = montant de CETTE facture
        montantVerseTotal: f.montantVerseTotal ?? 0,
        statut: f.typeFacture,
        dateFacture: f.dateEmission, numeroFacture: f.numero,
        demande: { titre: f.devis.demande?.titre ?? f.devis.sejourDirect?.titre ?? '—' },
      }));
    const montantEnAttente = facturesImpayees.reduce((sum, f) => sum + (f.montantTTC - f.montantVerseTotal), 0);

    const devisLibresImpayees = await this.prisma.devisLibre.findMany({
      where: {
        centreId: { in: centreIds },
        statut: 'ACCEPTE',
      },
      select: {
        id: true, centreId: true, montantTTC: true, montantVerseTotal: true, numeroDevis: true,
        client: { select: { nom: true } },
      },
    });
    const dlImpayees = devisLibresImpayees.filter(d => (d.montantVerseTotal ?? 0) < (d.montantTTC ?? 0));
    const montantDLEnAttente = dlImpayees.reduce((sum, d) => sum + ((d.montantTTC ?? 0) - (d.montantVerseTotal ?? 0)), 0);

    // KPI 4 : CA
    const caEncaisse = await this.prisma.versementPaiement.aggregate({
      where: {
        devis: { centreId: { in: centreIds } },
        datePaiement: { gte: debut, lte: fin },
      },
      _sum: { montant: true },
    });

    const caEncaisseDL = await this.prisma.versementDevisLibre.aggregate({
      where: {
        devisLibre: { centreId: { in: centreIds } },
        datePaiement: { gte: debut, lte: fin },
      },
      _sum: { montant: true },
    });

    const previsionnel = await this.prisma.devis.findMany({
      where: {
        centreId: { in: centreIds },
        statut: { in: STATUTS_DEVIS_RETENUS },
      },
      select: { montantTTC: true, montantVerseTotal: true },
    });
    const caPrevisionnel = previsionnel.reduce((sum, d) => sum + ((d.montantTTC ?? 0) - (d.montantVerseTotal ?? 0)), 0);

    // CA ventilé « via réseau » : si au moins un centre de l'hébergeur appartient à un
    // réseau, on isole le CA confirmé issu de demandes provenant de ce réseau.
    const reseauNom = centres.find(c => c.reseau)?.reseau ?? null;
    let caViaReseau = 0;
    if (reseauNom) {
      const devisReseau = await this.prisma.devis.findMany({
        where: {
          centreId: { in: centreIds },
          statut: { in: STATUTS_DEVIS_RETENUS },
          isComplementaire: false,
          demande: { sourceReseau: { equals: reseauNom, mode: 'insensitive' } },
        },
        select: { montantTTC: true },
      });
      caViaReseau = devisReseau.reduce((sum, d) => sum + (d.montantTTC ?? 0), 0);
    }

    // KPI 5 (Lot 1) : factures émises (nombre + montant total facturé) sur le périmètre.
    const facturesEmisesAgg = await this.prisma.facture.aggregate({
      where: { devis: { centreId: { in: centreIds } } },
      _count: { _all: true },
      _sum: { montantFacture: true },
    });

    // Planning consolidé
    const dans60j = new Date();
    dans60j.setDate(dans60j.getDate() + 60);
    const il30j = new Date();
    il30j.setDate(il30j.getDate() - 30);

    const sejoursPlanning = await this.prisma.sejour.findMany({
      where: {
        hebergementSelectionneId: { in: centreIds },
        dateFin: { gte: il30j },
        dateDebut: { lte: dans60j },
        statut: { notIn: ['DRAFT'] },
      },
      select: {
        id: true, titre: true, dateDebut: true, dateFin: true, placesTotales: true,
        nombreAccompagnateurs: true,
        statut: true, hebergementSelectionneId: true,
        // Tous les devis du centre — couleur planning = devis le PLUS AVANCÉ.
        // Lot 1 : factures incluses (la facturation ne mute plus le statut du devis).
        devisDirect: {
          where: { centreId: { in: centreIds } },
          select: { statut: true, factures: { select: { typeFacture: true } } },
        },
        demandes: {
          select: {
            devis: {
              where: { centreId: { in: centreIds } },
              select: { statut: true, factures: { select: { typeFacture: true } } },
            },
          },
        },
      },
    });

    const optionsPlanning = devisEnAttenteReponse
      .filter(d => d.demande?.dateDebut && d.demande?.dateFin)
      .map(d => ({
        id: d.id,
        titre: d.demande!.titre,
        dateDebut: d.demande!.dateDebut,
        dateFin: d.demande!.dateFin,
        participants: d.demande!.nombreEleves,
        centreId: d.centreId,
        type: 'OPTION' as const,
      }));

    const compteursCentres = await Promise.all(centres.map(async (c) => {
      const devisEnAttente = await this.prisma.devis.count({
        where: { centreId: c.id, statut: { in: ['EN_ATTENTE', 'EN_ATTENTE_VALIDATION'] } },
      });
      const sejoursActifs = await this.prisma.sejour.count({
        where: {
          hebergementSelectionneId: c.id,
          statut: { in: STATUTS_SEJOUR_CONFIRMES },
        },
      });
      return { centreId: c.id, devisEnAttente, sejoursActifs };
    }));

    return {
      centres: centres.map(c => ({
        ...c,
        ...(compteursCentres.find(cc => cc.centreId === c.id) ?? {}),
      })),
      kpis: {
        aTraiter: {
          total: demandesOuvertes.length + devisEnAttenteReponse.length,
          urgents: nbUrgents,
          description: 'Demandes et devis en attente de votre réponse',
        },
        aFacturer: {
          total: aFacturerAcompte.length + aFacturerSolde.length,
          montant: Math.round(montantAFacturer * 100) / 100,
          description: 'Séjours à facturer (acompte ou solde)',
        },
        paiementsEnAttente: {
          total: facturesImpayees.length + dlImpayees.length,
          montant: Math.round((montantEnAttente + montantDLEnAttente) * 100) / 100,
          description: 'Factures émises en attente de règlement',
        },
        chiffreAffaires: {
          encaisse: Math.round(((caEncaisse._sum.montant ?? 0) + (caEncaisseDL._sum.montant ?? 0)) * 100) / 100,
          previsionnel: Math.round(caPrevisionnel * 100) / 100,
          caViaReseau: Math.round(caViaReseau * 100) / 100,
          reseauNom,
          periodeDebut: debut.toISOString(),
          periodeFin: fin.toISOString(),
          description: 'CA encaissé et prévisionnel sur la période',
        },
        facturesEmises: {
          total: facturesEmisesAgg._count._all,
          montant: Math.round((facturesEmisesAgg._sum.montantFacture ?? 0) * 100) / 100,
          description: 'Factures émises (acompte + solde)',
        },
      },
      aTraiterDetail: { demandes: demandesOuvertes, devis: devisEnAttenteReponse },
      aFacturerDetail: { acomptes: aFacturerAcompte, soldes: aFacturerSolde },
      paiementsDetail: { factures: facturesImpayees, devisLibres: dlImpayees },
      planning: { sejours: sejoursPlanning, options: optionsPlanning },
    };
  }

  async searchPublic(search: string) {
    if (!search || search.length < 2) return [];

    const EN_API =
      'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';

    // ── Requête Prisma (centres ACTIVE uniquement) ────────────────────
    const prismaPromise = this.prisma.centreHebergement.findMany({
      where: {
        statut: 'ACTIVE',
        OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { ville: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nom: true,
        adresse: true,
        ville: true,
        codePostal: true,
        telephone: true,
        email: true,
        capacite: true,
        description: true,
        departement: true,
        siret: true,
        agrementEducationNationale: true,
        typeSejours: true,
        apidaeId: true,
        userId: true,
      },
      take: 10,
      orderBy: { nom: 'asc' },
    });

    // ── Requête API Éducation Nationale ───────────────────────────────
    const whereClause = [
      `search(nom_de_la_structure_d_accueil_et_d_hebergement_fr,"${search}")`,
      `search(nom_du_lieu_d_accueil_ville,"${search}")`,
    ].join(' OR ');

    const params = new URLSearchParams({ limit: '10', where: whereClause });

    const enPromise = fetch(`${EN_API}?${params}`)
      .then((res) => res.json())
      .then((data: { results: Array<Record<string, any>> }) =>
        (data.results ?? []).map((r) => ({
          id: String(r.identifiant ?? ''),
          nom: String(r.nom_de_la_structure_d_accueil_et_d_hebergement_fr ?? ''),
          adresse: '',
          ville: String(r.nom_du_lieu_d_accueil_ville ?? ''),
          codePostal: String(r.nom_du_lieu_d_accueil_code_postal ?? ''),
          telephone: null,
          email: null,
          // Number(...) || 0 : NaN (type inattendu) est falsy mais pas nullish → seul || le rattrape.
          capacite: Number(r.nombre_de_lits_pour_les_eleves) || 0,
          description: r.description_longue ? String(r.description_longue) : null,
          departement: r.nom_du_lieu_d_accueil_departement ? String(r.nom_du_lieu_d_accueil_departement) : null,
          siret: null,
          agrementEducationNationale: null,
          typeSejours: [] as string[],
        })),
      )
      .catch(() => [] as Array<{
        id: string; nom: string; adresse: string; ville: string;
        codePostal: string; telephone: string | null; email: string | null;
        capacite: number; description: string | null; departement: string | null;
        siret: string | null; agrementEducationNationale: string | null;
        typeSejours: string[];
      }>);

    // ── Exécution parallèle — Prisma en premier, puis EN ─────────────
    const [prismaResults, enResults] = await Promise.all([prismaPromise, enPromise]);

    const normalise = (s: string): string =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

    const prismaKeys = new Set(
      prismaResults.map((r) => `${normalise(r.nom)}|${normalise(r.ville)}`),
    );
    const prismaApidaeIds = new Set(
      prismaResults.filter(r => r.apidaeId).map(r => r.apidaeId),
    );

    // userId = source de vérité de la revendication ; on ne l'expose jamais, on
    // dérive isClaimed. Les records EN ne sont pas en base → jamais revendiqués.
    const prismaTagged = prismaResults.map(({ userId, ...rest }) => ({
      ...rest,
      isClaimed: !!userId,
      _source: 'BASE' as const,
    }));
    const enDedup = enResults
      .filter((r) => !prismaKeys.has(`${normalise(r.nom)}|${normalise(r.ville)}`) && !prismaApidaeIds.has(r.id))
      .map((r) => ({ ...r, isClaimed: false, _source: 'API_EN' as const }));

    return [...prismaTagged, ...enDedup];
  }

  async getPublic(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return null;
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id },
      select: {
        id: true, nom: true, adresse: true, ville: true, codePostal: true,
        telephone: true, email: true, capacite: true, description: true,
        imageUrl: true, siteWeb: true, typeSejours: true, thematiquesCentre: true,
        activitesCentre: true, equipements: true, accessiblePmr: true,
        agrementEducationNationale: true, periodeOuverture: true, departement: true,
        source: true, apidaeId: true, organisationId: true, userId: true,
        statut: true,
      },
    });
    if (!centre || centre.statut !== 'ACTIVE') return null;
    // userId et statut non exposés → on dérive isClaimed
    const { userId, statut, ...rest } = centre;
    return { ...rest, isClaimed: !!userId };
  }

  async materialiserCentreEN(data: {
    identifiantEN: string;
    nom: string;
    ville: string;
    codePostal: string;
    capacite: number;
    departement: string | null;
  }): Promise<{ centreId: string; organisationId: string }> {
    // 1. Vérifier qu'un centre avec cet identifiant EN n'existe pas déjà
    const existant = await this.prisma.centreHebergement.findFirst({
      where: { apidaeId: data.identifiantEN },
      select: { id: true, organisationId: true, ville: true },
    });
    const normaliseVille = (s: string): string =>
      (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

    if (existant && normaliseVille(existant.ville ?? '') === normaliseVille(data.ville ?? '')) {
      if (existant.organisationId) {
        return { centreId: existant.id, organisationId: existant.organisationId };
      }
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom: data.nom,
        ville: data.ville,
        codePostal: data.codePostal,
        departement: data.departement ?? null,
        source: 'API_EDUCATION_NATIONALE',
        sourceId: data.identifiantEN,
      });
      await this.prisma.centreHebergement.update({
        where: { id: existant.id },
        data: { organisationId: organisation.id },
      });
      return { centreId: existant.id, organisationId: organisation.id };
    }

    // 2. Créer Organisation + CentreHebergement minimal
    const { organisation } = await findOrCreateOrganisation(this.prisma, {
      nom: data.nom,
      ville: data.ville,
      codePostal: data.codePostal,
      departement: data.departement ?? null,
      source: 'API_EDUCATION_NATIONALE',
      sourceId: data.identifiantEN,
    });

    const centre = await this.prisma.centreHebergement.create({
      data: {
        nom: data.nom,
        adresse: '',
        ville: data.ville,
        codePostal: data.codePostal,
        capacite: data.capacite,
        departement: normaliserDepartement(data.departement),
        apidaeId: data.identifiantEN,
        source: 'API_EN',
        organisationId: organisation.id,
        statut: 'PENDING',
      },
    });

    return { centreId: centre.id, organisationId: organisation.id };
  }

  async register(dto: RegisterCentreDto) {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token: dto.token },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.utilisedAt) throw new ConflictException('Cette invitation a déjà été utilisée');

    // CAS 1 (admin) — vérifier que le centre pré-existant est revendiquable AVANT de créer le User
    if (invitation.centreExistantId) {
      const centreCible = await this.prisma.centreHebergement.findUnique({
        where: { id: invitation.centreExistantId },
      });
      if (!centreCible) {
        throw new NotFoundException('Le centre lié à cette invitation est introuvable');
      }
      if (centreCible.userId) {
        throw new ConflictException('Ce centre a déjà un propriétaire');
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom ?? dto.nom ?? '',
        nom: dto.nomContact ?? '',
        email: invitation.email,
        motDePasse: hashed,
        // Sans ce flag (défaut false), login() compare contre DUMMY_HASH :
        // reconnexion par mot de passe impossible pour ces comptes.
        motDePasseDefini: true,
        role: Role.HEBERGEUR,
      },
    });

    this.email.notifyAdminNewAccount(
      { prenom: user.prenom, nom: user.nom, email: user.email, role: user.role },
      'Créé via une invitation admin'
        + (invitation.centrePrecreerNom ? ` — ${invitation.centrePrecreerNom}` : ''),
    ).catch(() => {});

    let centre: Awaited<ReturnType<typeof this.prisma.centreHebergement.findUnique>>;
    let centreExistantApidae:
      | Awaited<ReturnType<typeof this.prisma.centreHebergement.findFirst>>
      | null = null;

    if (invitation.centreExistantId) {
      // ── CAS 1 : invitation admin pointant vers un centre déjà en base ────
      centre = await this.prisma.centreHebergement.update({
        where: { id: invitation.centreExistantId },
        data: { userId: user.id, statut: 'ACTIVE' },
      });
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          planAbonnement: 'COMPLET',
          abonnementStatut: 'ACTIF',
          abonnementActifJusquAu: trialExpiration(),
        },
      });
    } else if (invitation.centrePrecreerNom) {
      // ── CAS 2 : invitation admin avec données pré-remplies ─────────────
      centre = await this.prisma.centreHebergement.create({
        data: {
          nom:         invitation.centrePrecreerNom,
          adresse:     invitation.centrePrecreerAdresse ?? '',
          ville:       invitation.centrePrecreerVille ?? '',
          codePostal:  invitation.centrePrecreerCodePostal ?? '',
          capacite:    invitation.centrePrecreerCapacite ?? 0,
          siret:       invitation.centrePrecreerSiret ?? null,
          departement: normaliserDepartement(invitation.centrePrecreerDepartement),
          email:       invitation.email,
          userId:      user.id,
          statut:      'ACTIVE',
        },
      });
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          planAbonnement: 'COMPLET',
          abonnementStatut: 'ACTIF',
          abonnementActifJusquAu: trialExpiration(),
        },
      });
    } else {
      // ── CAS 3 : invitation minimale (réseau ou autonome) — matching APIDAE ─
      // Passe 1 : par email
      centreExistantApidae = await this.prisma.centreHebergement.findFirst({
        where: {
          email: invitation.email,
          userId: null,
          source: 'APIDAE',
        },
      });

      // Passe 2 : fallback nom + ville si pas trouvé
      if (!centreExistantApidae && dto.nom && dto.ville) {
        centreExistantApidae = await this.prisma.centreHebergement.findFirst({
          where: {
            userId: null,
            source: 'APIDAE',
            nom: { equals: dto.nom, mode: 'insensitive' },
            ville: { equals: dto.ville, mode: 'insensitive' },
          },
        });
      }

      if (centreExistantApidae) {
        // Claim du centre APIDAE — merge non-écrasant
        centre = await this.prisma.centreHebergement.update({
          where: { id: centreExistantApidae.id },
          data: {
            userId: user.id,
            statut: 'ACTIVE',
            ...(dto.nom && !centreExistantApidae.nom && { nom: dto.nom }),
            ...(dto.adresse && !centreExistantApidae.adresse && { adresse: dto.adresse }),
            ...(dto.ville && !centreExistantApidae.ville && { ville: dto.ville }),
            ...(dto.codePostal && !centreExistantApidae.codePostal && { codePostal: dto.codePostal }),
            ...(dto.telephone && !centreExistantApidae.telephone && { telephone: dto.telephone }),
          },
        });
      } else {
        centre = await this.prisma.centreHebergement.create({
          data: {
            nom: dto.nom ?? '',
            adresse: dto.adresse ?? '',
            ville: dto.ville ?? '',
            codePostal: dto.codePostal ?? '',
            telephone: dto.telephone ?? null,
            email: invitation.email,
            capacite: dto.capacite ?? 0,
            description: dto.description ?? null,
            reseau: dto.reseau ?? null,
            userId: user.id,
            statut: 'ACTIVE',
          },
        });
      }
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          planAbonnement: 'COMPLET',
          abonnementStatut: 'ACTIF',
          abonnementActifJusquAu: trialExpiration(),
        },
      });
    }

    if (!centre) {
      throw new NotFoundException('Centre introuvable après création');
    }

    await this.prisma.invitationHebergement.update({
      where: { id: invitation.id },
      data: { utilisedAt: new Date() },
    });

    // Organisation + Membership (commun aux 3 cas)
    let organisationId = centre.organisationId;
    if (!organisationId) {
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom: centre.nom,
        adresse: centre.adresse,
        codePostal: centre.codePostal,
        ville: centre.ville,
        emailContact: centre.email,
        telephoneContact: centre.telephone,
        siteWeb: centre.siteWeb,
        siret: centre.siret,
        siren: centre.siret ? centre.siret.substring(0, 9) : null,
        source: centreExistantApidae ? 'APIDAE' : 'MANUAL',
        sourceId: centreExistantApidae?.apidaeId ?? null,
        typeStructure: null,
      });
      organisationId = organisation.id;
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: { organisationId },
      });
    }

    await findOrCreateMembership(this.prisma, {
      userId: user.id,
      organisationId,
      role: 'PROPRIETAIRE',
      isPrimary: true,
      claimStatut: 'NON_APPLICABLE',
    });

    const payload = { sub: user.id, email: user.email, role: user.role, tokenVersion: 0 };
    const access_token = this.jwt.sign(payload);

    // Refresh token rotatif 30j (même pattern que auth.service.buildAuthResponse)
    const refreshToken = randomUUID();
    const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, refreshTokenExpires },
    });

    return {
      access_token,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, role: user.role },
      centre,
    };
  }

  async checkInvitation(token: string): Promise<{
    cas: 1 | 2 | 3;
    isApidae: boolean;
    centreExistantId: string | null;
    centre: {
      id?: string;
      nom: string;
      ville: string;
      departement: string | null;
      capacite: number;
      imageUrl: string | null;
    } | null;
    precreer: {
      nom: string;
      adresse: string | null;
      ville: string | null;
      codePostal: string | null;
      capacite: number | null;
      siret: string | null;
      departement: string | null;
    } | null;
  }> {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token },
      include: {
        centreExistant: {
          select: {
            id: true, nom: true, ville: true, departement: true,
            capacite: true, imageUrl: true,
          },
        },
      },
    });

    if (!invitation || invitation.utilisedAt) {
      return { cas: 3, isApidae: false, centre: null, centreExistantId: null, precreer: null };
    }

    // CAS 1 : centre existant pointé par l'admin
    if (invitation.centreExistantId && invitation.centreExistant) {
      return {
        cas: 1,
        isApidae: false,
        centre: invitation.centreExistant,
        centreExistantId: invitation.centreExistantId,
        precreer: null,
      };
    }

    // CAS 2 : données pré-remplies par l'admin
    if (invitation.centrePrecreerNom) {
      return {
        cas: 2,
        isApidae: false,
        centre: {
          nom: invitation.centrePrecreerNom,
          ville: invitation.centrePrecreerVille ?? '',
          departement: invitation.centrePrecreerDepartement ?? null,
          capacite: invitation.centrePrecreerCapacite ?? 0,
          imageUrl: null,
        },
        centreExistantId: null,
        precreer: {
          nom: invitation.centrePrecreerNom,
          adresse: invitation.centrePrecreerAdresse ?? null,
          ville: invitation.centrePrecreerVille ?? null,
          codePostal: invitation.centrePrecreerCodePostal ?? null,
          capacite: invitation.centrePrecreerCapacite ?? null,
          siret: invitation.centrePrecreerSiret ?? null,
          departement: invitation.centrePrecreerDepartement ?? null,
        },
      };
    }

    // CAS 3 : matching APIDAE existant — passe 1 email, passe 2 nomCentre
    let centre = await this.prisma.centreHebergement.findFirst({
      where: { email: invitation.email, userId: null, source: 'APIDAE' },
      select: { nom: true, ville: true, departement: true, capacite: true, imageUrl: true },
    });
    if (!centre && invitation.nomCentre) {
      centre = await this.prisma.centreHebergement.findFirst({
        where: {
          userId: null,
          source: 'APIDAE',
          nom: { equals: invitation.nomCentre, mode: 'insensitive' },
        },
        select: { nom: true, ville: true, departement: true, capacite: true, imageUrl: true },
      });
    }
    return {
      cas: 3,
      isApidae: !!centre,
      centre: centre ?? null,
      centreExistantId: null,
      precreer: null,
    };
  }

  async getMonProfil(userId: string, centreId?: string | null) {
    return getCentreForUser(this.prisma, userId, centreId);
  }

  async updateMonProfil(userId: string, dto: UpdateCentreDto, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        ...dto,
        // departement normalisé vers le code INSEE (override le ...dto brut).
        ...(dto.departement !== undefined && { departement: normaliserDepartement(dto.departement) }),
        ...(dto.equipements !== undefined && { equipements: { set: dto.equipements } }),
        ...(dto.thematiquesCentre !== undefined && { thematiquesCentre: { set: dto.thematiquesCentre } }),
        ...(dto.activitesCentre !== undefined && { activitesCentre: { set: dto.activitesCentre } }),
      },
    });
  }

  async uploadImage(userId: string, file: Express.Multer.File, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new ForbiddenException('Format non supporté. Utilisez JPG, PNG ou WebP.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ForbiddenException('Fichier trop lourd. Maximum 10MB.');
    }

    if (centre.imageUrl) {
      await this.storage.delete(centre.imageUrl);
    }

    const imageUrl = await this.storage.upload(file, 'centres');

    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { imageUrl },
    });
  }

  async uploadBrochure(userId: string, file: Express.Multer.File, centreId?: string | null) {
    if (!file) throw new BadRequestException('Fichier manquant');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Seuls les fichiers PDF sont acceptés');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Fichier trop lourd (max 10 Mo)');
    }

    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const brochureUrl = await this.storage.upload(file, `centres/${centre.id}/brochures`);

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { brochureUrl },
    });

    return { brochureUrl };
  }

  async uploadConventionPdf(userId: string, file: Express.Multer.File, centreId?: string | null) {
    if (!file) throw new BadRequestException('Fichier manquant');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Seuls les fichiers PDF sont acceptés');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Fichier trop lourd (max 10 Mo)');
    }

    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Supprimer l'ancien PDF de convention s'il existe.
    if (centre.conventionPdfUrl) {
      await this.storage.delete(centre.conventionPdfUrl);
    }

    const conventionPdfUrl = await this.storage.upload(file, `centres/${centre.id}/conventions-centre`);

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { conventionPdfUrl },
    });

    return { conventionPdfUrl };
  }

  async supprimerConventionPdf(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    if (centre.conventionPdfUrl) {
      await this.storage.delete(centre.conventionPdfUrl);
    }

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { conventionPdfUrl: null },
    });

    return { success: true };
  }

  /**
   * Logo de l'hébergeur affiché en en-tête des devis et factures PDF.
   * JPG/PNG STRICTEMENT (react-pdf crash silencieusement sur le webp). Max 2 Mo.
   */
  async uploadLogo(userId: string, file: Express.Multer.File, centreId?: string | null) {
    if (!file) throw new BadRequestException('Fichier manquant');
    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Logo : formats acceptés JPG ou PNG uniquement.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Le logo ne peut pas dépasser 2 Mo.');
    }

    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Supprimer l'ancien logo AVANT d'uploader le nouveau (évite les orphelins OVH)
    if (centre.logoUrl) {
      await this.storage.delete(centre.logoUrl);
    }

    const logoUrl = await this.storage.upload(file, 'logos');

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { logoUrl },
    });

    return { logoUrl };
  }

  /** Supprime le logo de l'hébergeur (OVH + base). */
  async deleteLogo(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    if (centre.logoUrl) {
      await this.storage.delete(centre.logoUrl);
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: { logoUrl: null },
      });
    }

    return { ok: true };
  }

  async uploadDocument(userId: string, file: Express.Multer.File, dto: CreateDocumentDto, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const url = await this.storage.upload(file, 'documents-centre');

    return this.prisma.document.create({
      data: {
        centreId: centre.id,
        type: dto.type,
        nom: dto.nom,
        url,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : null,
      },
    });
  }

  async getDisponibilites(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.disponibilite.findMany({
      where: { centreId: centre.id },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async createDisponibilite(userId: string, dto: CreateDisponibiliteDto, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.disponibilite.create({
      data: {
        centreId: centre.id,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        capaciteDisponible: dto.capaciteDisponible,
        commentaire: dto.commentaire,
      },
    });
  }

  async deleteDisponibilite(userId: string, id: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const dispo = await this.prisma.disponibilite.findUnique({ where: { id } });
    if (!dispo || dispo.centreId !== centre.id) {
      throw new ForbiddenException('Disponibilité introuvable ou non autorisée');
    }
    return this.prisma.disponibilite.delete({ where: { id } });
  }

  async getDocuments(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.document.findMany({
      where: { centreId: centre.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(userId: string, dto: CreateDocumentDto, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.document.create({
      data: {
        centreId: centre.id,
        type: dto.type,
        nom: dto.nom,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : null,
      },
    });
  }

  async getProduitsCatalogue(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const existants = await this.prisma.produitCatalogue.findMany({
      where: { centreId: centre.id },
    });

    if (existants.length === 0) {
      await this.prisma.produitCatalogue.createMany({
        data: [
          {
            centreId: centre.id,
            nom: 'Pension complète',
            description: 'Repas du soir, nuitée, petit-déjeuner, repas du midi (panier repas ou sur place) et goûter',
            type: 'HEBERGEMENT',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
          {
            centreId: centre.id,
            nom: 'Location matériel ski',
            description: null,
            type: 'ACTIVITE',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
          {
            centreId: centre.id,
            nom: 'Cours ESF',
            description: null,
            type: 'ACTIVITE',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
          {
            centreId: centre.id,
            nom: 'Transport aller-retour',
            description: null,
            type: 'TRANSPORT',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
        ],
      });

      return this.prisma.produitCatalogue.findMany({
        where: { centreId: centre.id, actif: true },
        orderBy: [{ type: 'asc' }, { nom: 'asc' }],
      });
    }

    return this.prisma.produitCatalogue.findMany({
      where: { centreId: centre.id, actif: true },
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    });
  }

  async createProduit(userId: string, dto: {
    nom: string;
    description?: string;
    type: string;
    prixUnitaireHT: number;
    prixUnitaireTTC?: number;
    tva: number;
    unite: string;
    nbMoniteursMax?: number;
  }, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.produitCatalogue.create({
      data: { centreId: centre.id, ...dto },
    });
  }

  async importProduits(userId: string, produits: {
    nom: string;
    description?: string;
    type: string;
    prixUnitaireHT: number;
    prixUnitaireTTC?: number;
    tva: number;
    unite: string;
  }[], centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const valides = produits.filter(p =>
      p.nom &&
      ['HEBERGEMENT', 'REPAS', 'TRANSPORT', 'ACTIVITE', 'AUTRE'].includes(p.type) &&
      ['PAR_ELEVE', 'PAR_NUIT', 'PAR_JOUR', 'FORFAIT'].includes(p.unite) &&
      !isNaN(p.prixUnitaireHT) &&
      p.prixUnitaireHT >= 0 &&
      [0, 5.5, 10, 20].includes(p.tva)
    );

    if (valides.length === 0) throw new BadRequestException('Aucun produit valide trouvé dans le fichier');

    await this.prisma.produitCatalogue.createMany({
      data: valides.map(p => ({
        centreId: centre.id,
        nom: p.nom,
        description: p.description ?? null,
        type: p.type,
        prixUnitaireHT: p.prixUnitaireHT,
        prixUnitaireTTC: p.prixUnitaireTTC ?? null,
        tva: p.tva,
        unite: p.unite,
        actif: true,
      })),
    });

    return { imported: valides.length, total: produits.length };
  }

  async updateProduit(userId: string, produitId: string, dto: {
    nom?: string;
    description?: string;
    type?: string;
    prixUnitaireHT?: number;
    prixUnitaireTTC?: number;
    tva?: number;
    unite?: string;
  }, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const produit = await this.prisma.produitCatalogue.findUnique({ where: { id: produitId } });
    if (!produit || produit.centreId !== centre.id) throw new ForbiddenException('Produit introuvable');
    return this.prisma.produitCatalogue.update({
      where: { id: produitId },
      data: dto,
    });
  }

  async accepterMandatFacturation(userId: string, ipAddress: string | null = null, userAgent: string | null = null, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    if (centre.mandatFacturationAccepte) {
      return centre; // Déjà accepté — ne pas écraser ip/ua
    }

    const version = process.env.MANDAT_VERSION ?? '1.0';
    const dateAcceptation = new Date();

    const updated = await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        mandatFacturationAccepte: true,
        mandatFacturationAccepteAt: dateAcceptation,
        mandatFacturationVersion: version,
        mandatFacturationIpAddress: ipAddress,
        mandatFacturationUserAgent: userAgent,
      },
    });

    // Email de confirmation (non bloquant)
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user) {
        await this.email.sendMandatFacturationConfirmation(
          user.email,
          centre.nom,
          dateAcceptation,
          version,
        );
      }
    } catch { /* non bloquant */ }

    return updated;
  }

  async archiveProduit(userId: string, produitId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const produit = await this.prisma.produitCatalogue.findUnique({ where: { id: produitId } });
    if (!produit || produit.centreId !== centre.id) throw new ForbiddenException('Produit introuvable');
    return this.prisma.produitCatalogue.update({
      where: { id: produitId },
      data: { actif: false },
    });
  }

  async updateCapacitesProduit(userId: string, produitId: string, dto: {
    capaciteParGroupe?: number | null;
    encadrementParGroupe?: number | null;
    simultaneitePossible?: boolean;
    dureeMinutes?: number | null;
    nbMoniteursMax?: number | null;
  }, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const produit = await this.prisma.produitCatalogue.findUnique({ where: { id: produitId } });
    if (!produit || produit.centreId !== centre.id) throw new ForbiddenException('Produit introuvable');
    return this.prisma.produitCatalogue.update({
      where: { id: produitId },
      data: dto,
    });
  }

}
