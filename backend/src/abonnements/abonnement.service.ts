import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TypeAbonnement, StatutAbonnement, PlanAbonnement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { TRIAL_DUREE_JOURS, TRIAL_EXTENSION_JOURS } from '../centres/trial.helper.js';
import { FactureLiavoService } from '../facture-liavo/facture-liavo.service.js';
import { EmailService } from '../email/email.service.js';
import { MandateMethod, MollieApiError, SubscriptionStatus } from '@mollie/api-client';
import { calculerMontantAbonnementCents, centsToMollie } from './abonnement.constants.js';
import { mollieClient } from './mollie.client.js';
import { resyncMontantOrganisation } from './resync-montant.helper.js';
import { montantRecurrentOrganisationCents } from './montant-organisation.helper.js';

@Injectable()
export class AbonnementService {
  constructor(
    private prisma: PrismaService,
    private factureLiavoService: FactureLiavoService,
    private emailService: EmailService,
  ) {}

  private maskIban(iban: string): string {
    const clean = iban.replace(/\s+/g, '');
    if (clean.length <= 6) return clean;
    const prefix = clean.slice(0, 2);
    const suffix = clean.slice(-4);
    const masked = '•'.repeat(clean.length - 6);
    return `${prefix}${masked}${suffix}`;
  }

  /**
   * Résout le centre actif (X-Centre-Id) et son organisation — unique porteur
   * de l'état d'abonnement (Lot 2a puis L3c). Toutes les lectures (guards,
   * cron, admin) sont sur l'organisation depuis L3a→L3c-0 ; les colonnes abo
   * de CentreHebergement sont gelées (plus jamais écrites, retrait au L6+).
   */
  private async resolveOrganisation(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    if (!centre.organisationId) {
      throw new ConflictException("Ce centre n'est rattaché à aucune organisation");
    }
    return { centre, organisationId: centre.organisationId };
  }

  /**
   * Seul le PROPRIETAIRE de l'organisation peut souscrire/annuler/gérer
   * l'essai. claimStatut VALIDE non exigé (payer ≠ envoyer des emails
   * externes) ; les collaborateurs de centre n'ont pas de Membership → 403.
   */
  private async assertProprietaireOrganisation(userId: string, organisationId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
      select: { role: true },
    });
    if (!membership || membership.role !== 'PROPRIETAIRE') {
      throw new ForbiddenException("Seul le propriétaire de l'organisation peut gérer l'abonnement.");
    }
  }

  // ── Trial 30j Pilotage (tout déverrouillé pour découvrir) ─────────────

  async activerTrial(userId: string, centreId?: string | null) {
    const { centre, organisationId } = await this.resolveOrganisation(userId, centreId);
    await this.assertProprietaireOrganisation(userId, organisationId);

    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { trialStartedAt: true, mollieMandatId: true },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');

    if (org.trialStartedAt) {
      throw new BadRequestException('La période d\'essai a déjà été utilisée pour cette organisation');
    }

    if (org.mollieMandatId) {
      throw new BadRequestException('Cette organisation a déjà un abonnement actif');
    }

    const now = new Date();
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + TRIAL_DUREE_JOURS);

    const data = {
      planAbonnement: PlanAbonnement.PILOTAGE,
      abonnementStatut: StatutAbonnement.ACTIF,
      abonnementActifJusquAu: expiration,
      trialStartedAt: now,
    };
    const updated = await this.prisma.organisation.update({ where: { id: organisationId }, data });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, prenom: true, nom: true },
      });
      const dateExp = expiration.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      await this.emailService.sendNotifAdmin(
        `[Admin] Nouveau trial — ${centre.nom}`,
        `<p><strong>${centre.nom}</strong> a activé un essai gratuit (30 jours Pilotage).</p>
         <table style="width:100%;border-collapse:collapse;margin:16px 0">
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.nom}</td></tr>
           <tr><td style="padding:8px 12px;font-size:13px;color:#666">Hébergeur</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${user?.prenom ?? ''} ${user?.nom ?? ''} — ${user?.email ?? 'N/A'}</td></tr>
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Expiration</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${dateExp}</td></tr>
         </table>`,
      );
    } catch (err) {
      console.error('[activerTrial] Erreur envoi notif admin:', err);
    }

    return updated;
  }

  /**
   * Self-service : prolonge l'essai de TRIAL_EXTENSION_JOURS (15) jours
   * (10.1b-5). Une seule extension par essai — le guard est dérivé des dates
   * existantes (essai frais = 30j < 40, déjà étendu = 45j > 40 → seuil 40j),
   * pas de champ dédié.
   */
  async demanderExtension(userId: string, centreId?: string | null) {
    const { centre, organisationId } = await this.resolveOrganisation(userId, centreId);
    await this.assertProprietaireOrganisation(userId, organisationId);

    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { trialStartedAt: true, mollieMandatId: true, abonnementActifJusquAu: true },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');

    // Réservé aux essais (pas de mandat Mollie, pas un client payé/virement)
    if (!org.trialStartedAt || org.mollieMandatId) {
      throw new BadRequestException("L'extension est réservée aux comptes en période d'essai.");
    }

    // Anti-abus : une seule extension. Essai frais = 30j < 40 (autorisé),
    // déjà étendu = 30 + 15 = 45j > 40 (2e extension bloquée) → seuil 40j.
    const trialStart = new Date(org.trialStartedAt);
    const seuil = new Date(trialStart); seuil.setDate(seuil.getDate() + 40);
    if (org.abonnementActifJusquAu && new Date(org.abonnementActifJusquAu) > seuil) {
      throw new BadRequestException('Une extension a déjà été accordée pour cet essai.');
    }

    // Prolonger de TRIAL_EXTENSION_JOURS depuis max(aujourd'hui, fin actuelle)
    const now = new Date();
    const finActuelle = org.abonnementActifJusquAu ? new Date(org.abonnementActifJusquAu) : now;
    const base = finActuelle > now ? finActuelle : now;
    const nouvelleFin = new Date(base); nouvelleFin.setDate(nouvelleFin.getDate() + TRIAL_EXTENSION_JOURS);
    const data = { abonnementActifJusquAu: nouvelleFin, abonnementStatut: StatutAbonnement.ACTIF };
    await this.prisma.organisation.update({ where: { id: organisationId }, data });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, prenom: true, nom: true },
      });
      const dateExp = nouvelleFin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      await this.emailService.sendNotifAdmin(
        `[Admin] Extension d'essai — ${centre.nom}`,
        `<p><strong>${centre.nom}</strong> a demandé une extension d'essai (+${TRIAL_EXTENSION_JOURS} jours).</p>
         <table style="width:100%;border-collapse:collapse;margin:16px 0">
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.nom}</td></tr>
           <tr><td style="padding:8px 12px;font-size:13px;color:#666">Hébergeur</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${user?.prenom ?? ''} ${user?.nom ?? ''} — ${user?.email ?? 'N/A'}</td></tr>
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Nouvelle expiration</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${dateExp}</td></tr>
         </table>`,
      );
    } catch (err) {
      console.error('[demanderExtension] Erreur envoi notif admin:', err);
    }

    return { success: true, actifJusquAu: nouvelleFin };
  }

  // ── Statut ────────────────────────────────────────────────────────────────

  async getStatut(userId: string, centreId?: string | null) {
    const { organisationId } = await this.resolveOrganisation(userId, centreId);
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        abonnement: true,
        abonnementStatut: true,
        abonnementActifJusquAu: true,
        planAbonnement: true,
        trialStartedAt: true,
        mollieMandatId: true,
        mollieSubscriptionId: true,
      },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    const now = new Date();
    const expiration = org.abonnementActifJusquAu;

    const actif =
      org.abonnementStatut === 'ACTIF' &&
      !!expiration &&
      expiration >= now;

    const joursRestants =
      actif && expiration
        ? Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // Distinguer trial (pas de mandat) vs abonnement payé (mandat signé)
    const isTrial = actif && !!org.trialStartedAt && !org.mollieMandatId;
    const trialExpire = !actif && !!org.trialStartedAt && !org.mollieMandatId;

    return {
      type: org.abonnement,
      statut: org.abonnementStatut,
      actifJusquAu: org.abonnementActifJusquAu,
      plan: org.planAbonnement,
      actif,
      joursRestants,
      mandatActif: !!org.mollieMandatId,
      mollieSubscriptionId: org.mollieSubscriptionId ?? null,
      isTrial,
      trialExpire,
      trialUsed: !!org.trialStartedAt,
    };
  }

  // ── Souscription SEPA (mandat directdebit via IBAN, sans carte) ──────────

  async souscrire(userId: string, plan: string, frequence: string, iban: string, titulaire: string, centreId?: string | null, cgvAcceptee?: boolean, ip?: string | null) {
    if (!cgvAcceptee) {
      throw new BadRequestException('Vous devez accepter les Conditions Générales de Vente');
    }
    if (!['ESSENTIEL', 'COMPLET', 'PILOTAGE'].includes(plan)) {
      throw new BadRequestException('Plan invalide');
    }
    if (!['MENSUEL', 'ANNUEL'].includes(frequence)) {
      throw new BadRequestException('Fréquence invalide');
    }

    const { centre, organisationId } = await this.resolveOrganisation(userId, centreId);
    await this.assertProprietaireOrganisation(userId, organisationId);
    const org = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation introuvable');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, prenom: true, nom: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const ibanClean = iban.replace(/\s+/g, '').toUpperCase();

    // Si une subscription existe déjà SUR L'ORG, l'annuler (upgrade/changement).
    // C'est LA garde anti-double-souscription : le 2e centre d'une org abonnée
    // retombe sur la même subscription (remplacée), jamais 2 mandats.
    if (org.mollieSubscriptionId && org.mollieCustomerId) {
      try {
        await mollieClient.customerSubscriptions.cancel(
          org.mollieSubscriptionId,
          { customerId: org.mollieCustomerId },
        );
      } catch (err) {
        // Le cancel a échoué. On ne crée JAMAIS la nouvelle subscription tant
        // qu'on n'a pas la preuve que l'ancienne n'est plus active — sinon deux
        // subscriptions coexistent sur le même customer = double prélèvement.
        // Fast-path : un 404 Mollie PROUVE que l'ancienne subscription n'existe
        // plus (déjà supprimée). On teste `instanceof MollieApiError` pour ne pas
        // prendre une erreur réseau brute (sans statusCode fiable) pour un 404.
        const dejaDisparue = err instanceof MollieApiError && err.statusCode === 404;
        if (!dejaDisparue) {
          // Get de vérité : seul arbitre fiable de l'état réel de l'ancienne.
          let ancienneInactive = false;
          try {
            const ancienne = await mollieClient.customerSubscriptions.get(
              org.mollieSubscriptionId,
              { customerId: org.mollieCustomerId },
            );
            ancienneInactive = ancienne.status === SubscriptionStatus.canceled;
          } catch (getErr) {
            // 404 au get = ancienne subscription disparue → objectif atteint.
            // Tout autre échec (réseau/5xx) = état inconnu → on bloque.
            ancienneInactive = getErr instanceof MollieApiError && getErr.statusCode === 404;
          }
          if (!ancienneInactive) {
            // État incertain : l'ancienne subscription peut être toujours active.
            // On bloque AVANT tout write DB / création — rien n'est modifié.
            // Trace sans fuite : jamais l'IBAN ni le corps, seulement message/statut + org.
            console.error(
              '[souscrire] annulation ancienne subscription non confirmée — re-souscription bloquée',
              { organisationId, statusCode: err instanceof MollieApiError ? err.statusCode : undefined, message: err instanceof Error ? err.message : String(err) },
            );
            throw new ServiceUnavailableException(
              "L'abonnement en cours n'a pas pu être mis à jour (service de paiement momentanément indisponible). Réessayez dans quelques instants.",
            );
          }
        }
      }
      await this.prisma.organisation.update({
        where: { id: organisationId },
        data: { mollieSubscriptionId: null },
      });
    }

    // Calculer le montant : centres EXPLOITÉS de l'organisation (userId non null
    // exclut les fiches catalogue APIDAE/LMDJ jamais revendiquées)
    const nbCentresActifs = await this.prisma.centreHebergement.count({
      where: { organisationId, statut: 'ACTIVE', userId: { not: null } },
    });
    const montantTotal = calculerMontantAbonnementCents(plan, frequence, nbCentresActifs);

    // Créer ou réutiliser le customer Mollie (1 customer = 1 organisation)
    let mollieCustomerId = org.mollieCustomerId;
    if (!mollieCustomerId) {
      const customer = await mollieClient.customers.create({
        name: org.raisonSociale ?? org.nom,
        email: user.email,
      });
      mollieCustomerId = customer.id;
    }

    // Créer le mandat SEPA directement avec l'IBAN
    const mandate = await mollieClient.customerMandates.create({
      customerId: mollieCustomerId,
      method: MandateMethod.directdebit,
      consumerName: titulaire,
      consumerAccount: ibanClean,
    });

    // Créer la subscription (Mollie attend la validation du mandat avant de prélever)
    const interval = frequence === 'ANNUEL' ? '12 months' : '1 month';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const intervalLabel = frequence === 'ANNUEL' ? 'annuel' : 'mensuel';

    const subscription = await mollieClient.customerSubscriptions.create({
      customerId: mollieCustomerId,
      amount: { value: centsToMollie(montantTotal), currency: 'EUR' },
      interval,
      description: `Abonnement LIAVO ${plan} ${intervalLabel} — ${org.nom}`,
      startDate: startDate.toISOString().split('T')[0],
      mandateId: mandate.id,
      webhookUrl: `${process.env.BACKEND_URL || 'https://api.liavo.fr'}/abonnements/webhook`,
    });

    // Grace period : accès immédiat pendant la validation du mandat SEPA (2-5 jours).
    // Le webhook mettra l'expiration réelle quand le 1er prélèvement réussit.
    const now = new Date();
    const gracePeriod = new Date(now);
    gracePeriod.setDate(gracePeriod.getDate() + 14);
    // Si le trial actuel est plus long que le grace period, le garder
    const currentExp = org.abonnementActifJusquAu ? new Date(org.abonnementActifJusquAu) : null;
    const expiration = currentExp && currentExp > gracePeriod ? currentExp : gracePeriod;

    const dataAbonnement = {
      mollieCustomerId,
      mollieMandatId: mandate.id,
      mollieSubscriptionId: subscription.id,
      planAbonnement: plan as any,
      abonnement: frequence as any,
      abonnementStatut: 'ACTIF' as const,
      abonnementActifJusquAu: expiration,
    };
    await this.prisma.organisation.update({ where: { id: organisationId }, data: dataAbonnement });

    await this.prisma.acceptationCgv.create({
      data: {
        centreId: centre.id,
        organisationId,
        userId,
        plan,
        frequence,
        ipAddress: ip ?? null,
      },
    });

    try {
      const frequenceLabel = frequence === 'ANNUEL' ? 'Annuel' : 'Mensuel';
      const montantLabel = (montantTotal / 100).toFixed(2);
      const ibanMasque = this.maskIban(ibanClean);
      await this.emailService.sendConfirmationAbonnement(
        user!.email, user!.prenom ?? '', centre.nom, plan, frequenceLabel, montantLabel, ibanMasque,
      );
    } catch (err) {
      console.error('[souscrire] Erreur envoi email confirmation:', err);
    }

    try {
      const frequenceLabel = frequence === 'ANNUEL' ? 'Annuel' : 'Mensuel';
      const montantLabel = (montantTotal / 100).toFixed(2);
      await this.emailService.sendNotifAdmin(
        `[Admin] Nouvelle souscription — ${centre.nom}`,
        `<p><strong>${centre.nom}</strong> a souscrit un abonnement.</p>
         <table style="width:100%;border-collapse:collapse;margin:16px 0">
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.nom}</td></tr>
           <tr><td style="padding:8px 12px;font-size:13px;color:#666">Hébergeur</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${user!.prenom} ${user!.nom} — ${user!.email}</td></tr>
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Plan</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${plan} ${frequenceLabel}</td></tr>
           <tr><td style="padding:8px 12px;font-size:13px;color:#666">Montant</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${montantLabel} € HT</td></tr>
         </table>`,
      );
    } catch (err) {
      console.error('[souscrire] Erreur envoi notif admin:', err);
    }

    return { success: true, plan, frequence, montant: montantTotal };
  }

  // ── Webhook Mollie ────────────────────────────────────────────────────────

  async handleWebhook(paymentId: string) {
    console.log('[mollie-webhook] Reçu paymentId:', paymentId);
    if (!paymentId) return { received: true };

    let payment: any;
    try {
      payment = await mollieClient.payments.get(paymentId);
    } catch (err) {
      console.error('[mollie-webhook] Erreur fetch payment:', err);
      return { received: true };
    }

    const customerId = payment.customerId;
    console.log('[mollie-webhook] Payment status:', payment.status, '| sequenceType:', payment.sequenceType, '| customerId:', customerId);
    if (!customerId) return { received: true };

    // Résolution par l'ORGANISATION — unicité garantie par l'index partiel L1
    // (organisations_mollie_customer_id_key).
    const org = await this.prisma.organisation.findFirst({
      where: { mollieCustomerId: customerId },
    });
    if (!org) {
      console.error('[mollie-webhook] Organisation introuvable pour customerId:', customerId);
      return { received: true };
    }

    // ── Paiement récurrent réussi → prolonger l'abonnement ──
    if (payment.status === 'paid' && payment.sequenceType === 'recurring') {
      const factureExistante = await this.prisma.factureLiavo.findFirst({ where: { molliePaymentId: paymentId } });
      if (factureExistante) {
        console.log('[mollie-webhook] Paiement déjà traité (facture', factureExistante.numero, '), skip');
        return { received: true, alreadyProcessed: true };
      }

      const frequence = org.abonnement;
      const now = new Date();
      const oldExp = org.abonnementActifJusquAu;
      const base = oldExp && oldExp > now ? oldExp : now;
      const expiration = new Date(base);
      if (frequence === 'ANNUEL') {
        expiration.setFullYear(expiration.getFullYear() + 1);
      } else {
        expiration.setMonth(expiration.getMonth() + 1);
      }

      await this.prisma.organisation.update({
        where: { id: org.id },
        data: {
          abonnementStatut: StatutAbonnement.ACTIF,
          abonnementActifJusquAu: expiration,
        },
      });
      console.log('[mollie-webhook] Abonnement prolongé organisation', org.id, 'jusqu\'au', expiration.toISOString());

      try {
        // Facture = montant RÉELLEMENT PRÉLEVÉ (payment.amount.value, chaîne
        // décimale "147.00"). Fallback recalcul théorique si absent/invalide —
        // jamais de facture à 0 €.
        let montantFacture = Math.round(Number(payment.amount?.value) * 100);
        if (!payment.amount?.value || !Number.isFinite(montantFacture) || montantFacture <= 0) {
          console.error('[mollie-webhook] payment.amount invalide, fallback recalcul théorique:', payment.amount);
          // Recalcul théorique via le point de calcul unique (iso-comportement :
          // même plan, même fréquence org, même comptage ACTIVE + userId non null).
          montantFacture = await montantRecurrentOrganisationCents(this.prisma, org.id);
        }
        // Centre représentatif (trace + fallback destinataire actuel d'emettre —
        // le destinataire raison sociale org est le Lot 4).
        const centreRepresentatif = await this.prisma.centreHebergement.findFirst({
          where: { organisationId: org.id, statut: 'ACTIVE', userId: { not: null } },
          orderBy: { createdAt: 'asc' },
        });
        if (!centreRepresentatif) {
          console.error('[mollie-webhook] Aucun centre exploité pour organisation', org.id, '— facture non émise');
        } else {
          await this.factureLiavoService.emettre(
            centreRepresentatif.id, montantFacture, org.planAbonnement, frequence ?? 'MENSUEL', paymentId, null, org.id,
          );
          console.log('[mollie-webhook] Facture LIAVO émise pour organisation', org.id);
        }
      } catch (err) {
        console.error('[mollie-webhook] Erreur émission facture LIAVO:', err);
      }

      // DERNIER geste : réaligner le montant de la subscription (auto-correction
      // des resyncs ratés aux transitions de centres). Fire-and-forget.
      resyncMontantOrganisation(this.prisma, mollieClient, org.id).catch((err) =>
        console.error('[mollie-webhook] resync:', err),
      );

      return { received: true, renewed: true };
    }

    // ── Paiement échoué ou expiré ──
    if (['failed', 'expired', 'canceled'].includes(payment.status)) {
      console.warn(`[mollie-webhook] Paiement ${payment.status} pour organisation ${org.id}`);
      // On ne désactive PAS immédiatement — Mollie retentera automatiquement
      // via la subscription. Désactivation manuelle si besoin.
      return { received: true, status: payment.status };
    }

    return { received: true };
  }

  // ── Annuler l'abonnement ──────────────────────────────────────────────────

  async annuler(userId: string, centreId?: string | null) {
    const { centre, organisationId } = await this.resolveOrganisation(userId, centreId);
    await this.assertProprietaireOrganisation(userId, organisationId);

    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        mollieSubscriptionId: true,
        mollieCustomerId: true,
        planAbonnement: true,
        abonnementActifJusquAu: true,
      },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');

    if (org.mollieSubscriptionId && org.mollieCustomerId) {
      try {
        await mollieClient.customerSubscriptions.cancel(
          org.mollieSubscriptionId,
          { customerId: org.mollieCustomerId },
        );
      } catch (err) {
        console.error('[annuler] Erreur annulation Mollie:', err);
      }
    }

    // L'abonnement reste actif jusqu'à la fin de la période en cours
    const updated = await this.prisma.organisation.update({
      where: { id: organisationId },
      data: {
        mollieSubscriptionId: null,
        // abonnementStatut reste ACTIF jusqu'à expiration naturelle
        // Le cron ou une vérif au login basculera en INACTIF à l'expiration
      },
    });

    // Fetch user UNE SEULE FOIS pour les 2 emails
    let user: { email: string; prenom: string | null; nom: string | null } | null = null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, prenom: true, nom: true },
      });
    } catch (err) {
      console.error('[annuler] Erreur fetch user:', err);
    }

    if (user?.email) {
      try {
        const dateExp = org.abonnementActifJusquAu
          ? org.abonnementActifJusquAu.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
          : 'la fin de la période en cours';
        await this.emailService.sendConfirmationAnnulation(
          user.email, user.prenom ?? '', centre.nom, dateExp,
        );
      } catch (err) {
        console.error('[annuler] Erreur envoi email annulation:', err);
      }

      try {
        await this.emailService.sendNotifAdmin(
          `[Admin] Annulation — ${centre.nom}`,
          `<p><strong>${centre.nom}</strong> a annulé son abonnement.</p>
           <table style="width:100%;border-collapse:collapse;margin:16px 0">
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.nom}</td></tr>
             <tr><td style="padding:8px 12px;font-size:13px;color:#666">Hébergeur</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${user.prenom ?? ''} ${user.nom ?? ''} — ${user.email}</td></tr>
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Plan actuel</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${org.planAbonnement}</td></tr>
           </table>`,
        );
      } catch (err) {
        console.error('[annuler] Erreur envoi notif admin:', err);
      }
    }

    return updated;
  }

  async getFactures(userId: string, centreId?: string | null) {
    const { organisationId } = await this.resolveOrganisation(userId, centreId);
    return this.factureLiavoService.listerParOrganisation(organisationId);
  }
}
