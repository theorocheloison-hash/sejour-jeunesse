import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TypeAbonnement, StatutAbonnement, PlanAbonnement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { FactureLiavoService } from '../facture-liavo/facture-liavo.service.js';
import { EmailService } from '../email/email.service.js';
import createMollieClient, { MandateMethod } from '@mollie/api-client';

const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY ?? '',
});

const PRIX_MENSUEL: Record<string, number> = {
  ESSENTIEL: 2900,
  COMPLET: 4900,
  PILOTAGE: 6900,
};
const PRIX_ANNUEL: Record<string, number> = {
  ESSENTIEL: 29000,
  COMPLET: 49000,
  PILOTAGE: 69000,
};
const CENTRE_SUPP_MENSUEL = 3900;
const CENTRE_SUPP_ANNUEL = 39000;

function centsToMollie(cents: number): string {
  return (cents / 100).toFixed(2);
}

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

  // ── Simuler (existant — admin/test, pas de paiement réel) ─────────────

  async simuler(userId: string, type: TypeAbonnement, plan: PlanAbonnement, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const now = new Date();
    const expiration = new Date(now);
    if (type === TypeAbonnement.MENSUEL) {
      expiration.setMonth(expiration.getMonth() + 1);
    } else {
      expiration.setFullYear(expiration.getFullYear() + 1);
    }
    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        abonnement: type,
        abonnementStatut: StatutAbonnement.ACTIF,
        abonnementActifJusquAu: expiration,
        planAbonnement: plan,
      },
    });
  }

  // ── Trial 30j Pilotage (tout déverrouillé pour découvrir) ─────────────

  async activerTrial(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    if (centre.trialStartedAt) {
      throw new BadRequestException('La période d\'essai a déjà été utilisée pour ce centre');
    }

    if (centre.mollieMandatId) {
      throw new BadRequestException('Ce centre a déjà un abonnement actif');
    }

    const now = new Date();
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);

    const updated = await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        planAbonnement: PlanAbonnement.PILOTAGE,
        abonnementStatut: StatutAbonnement.ACTIF,
        abonnementActifJusquAu: expiration,
        trialStartedAt: now,
      },
    });

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
   * Self-service : prolonge l'essai de 14 jours (10.1b-5). Une seule extension
   * par essai — le guard est dérivé des dates existantes (essai frais = 30j,
   * déjà étendu = 44j → seuil 40j), pas de champ dédié.
   */
  async demanderExtension(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Réservé aux essais (pas de mandat Mollie, pas un client payé/virement)
    if (!centre.trialStartedAt || centre.mollieMandatId) {
      throw new BadRequestException("L'extension est réservée aux comptes en période d'essai.");
    }

    // Anti-abus : une seule extension. Essai frais = 30j, déjà étendu = 44j → seuil 40j.
    const trialStart = new Date(centre.trialStartedAt);
    const seuil = new Date(trialStart); seuil.setDate(seuil.getDate() + 40);
    if (centre.abonnementActifJusquAu && new Date(centre.abonnementActifJusquAu) > seuil) {
      throw new BadRequestException('Une extension a déjà été accordée pour cet essai.');
    }

    // Prolonger de 14j depuis max(aujourd'hui, fin actuelle)
    const now = new Date();
    const finActuelle = centre.abonnementActifJusquAu ? new Date(centre.abonnementActifJusquAu) : now;
    const base = finActuelle > now ? finActuelle : now;
    const nouvelleFin = new Date(base); nouvelleFin.setDate(nouvelleFin.getDate() + 14);
    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { abonnementActifJusquAu: nouvelleFin, abonnementStatut: StatutAbonnement.ACTIF },
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, prenom: true, nom: true },
      });
      const dateExp = nouvelleFin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      await this.emailService.sendNotifAdmin(
        `[Admin] Extension d'essai — ${centre.nom}`,
        `<p><strong>${centre.nom}</strong> a demandé une extension d'essai (+14 jours).</p>
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
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const now = new Date();
    const expiration = centre.abonnementActifJusquAu;

    const actif =
      centre.abonnementStatut === 'ACTIF' &&
      !!expiration &&
      expiration >= now;

    const joursRestants =
      actif && expiration
        ? Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // Distinguer trial (pas de mandat) vs abonnement payé (mandat signé)
    const isTrial = actif && !!centre.trialStartedAt && !centre.mollieMandatId;
    const trialExpire = !actif && !!centre.trialStartedAt && !centre.mollieMandatId;

    return {
      type: centre.abonnement,
      statut: centre.abonnementStatut,
      actifJusquAu: centre.abonnementActifJusquAu,
      plan: centre.planAbonnement,
      actif,
      joursRestants,
      mandatActif: !!centre.mollieMandatId,
      mollieSubscriptionId: centre.mollieSubscriptionId ?? null,
      isTrial,
      trialExpire,
      trialUsed: !!centre.trialStartedAt,
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

    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, prenom: true, nom: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const ibanClean = iban.replace(/\s+/g, '').toUpperCase();

    // Si une subscription existe déjà, l'annuler (upgrade/changement)
    if (centre.mollieSubscriptionId && centre.mollieCustomerId) {
      try {
        await mollieClient.customerSubscriptions.cancel(
          centre.mollieSubscriptionId,
          { customerId: centre.mollieCustomerId },
        );
      } catch (err) {
        console.warn('[souscrire] Erreur annulation ancienne subscription:', err);
      }
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: { mollieSubscriptionId: null },
      });
    }

    // Calculer le montant
    const nbCentresActifs = await this.prisma.centreHebergement.count({
      where: { userId, statut: 'ACTIVE' },
    });
    const centresSupp = Math.max(0, nbCentresActifs - 1);
    const prixPlan = frequence === 'ANNUEL' ? PRIX_ANNUEL[plan] : PRIX_MENSUEL[plan];
    const prixCentresSupp = centresSupp * (frequence === 'ANNUEL' ? CENTRE_SUPP_ANNUEL : CENTRE_SUPP_MENSUEL);
    const montantTotal = prixPlan + prixCentresSupp;

    // Créer ou réutiliser le customer Mollie
    let mollieCustomerId = centre.mollieCustomerId;
    if (!mollieCustomerId) {
      const customer = await mollieClient.customers.create({
        name: `${user.prenom} ${user.nom} — ${centre.nom}`,
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
      description: `Abonnement LIAVO ${plan} ${intervalLabel} — ${centre.nom}`,
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
    const currentExp = centre.abonnementActifJusquAu ? new Date(centre.abonnementActifJusquAu) : null;
    const expiration = currentExp && currentExp > gracePeriod ? currentExp : gracePeriod;

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        mollieCustomerId,
        mollieMandatId: mandate.id,
        mollieSubscriptionId: subscription.id,
        planAbonnement: plan as any,
        abonnement: frequence as any,
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: expiration,
      },
    });

    await this.prisma.acceptationCgv.create({
      data: {
        centreId: centre.id,
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

    const centre = await this.prisma.centreHebergement.findFirst({
      where: { mollieCustomerId: customerId },
    });
    if (!centre) {
      console.error('[mollie-webhook] Centre introuvable pour customerId:', customerId);
      return { received: true };
    }

    // ── Paiement récurrent réussi → prolonger l'abonnement ──
    if (payment.status === 'paid' && payment.sequenceType === 'recurring') {
      const factureExistante = await this.prisma.factureLiavo.findFirst({ where: { molliePaymentId: paymentId } });
      if (factureExistante) {
        console.log('[mollie-webhook] Paiement déjà traité (facture', factureExistante.numero, '), skip');
        return { received: true, alreadyProcessed: true };
      }

      const frequence = centre.abonnement;
      const now = new Date();
      const oldExp = centre.abonnementActifJusquAu;
      const base = oldExp && oldExp > now ? oldExp : now;
      const expiration = new Date(base);
      if (frequence === 'ANNUEL') {
        expiration.setFullYear(expiration.getFullYear() + 1);
      } else {
        expiration.setMonth(expiration.getMonth() + 1);
      }

      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          abonnementStatut: StatutAbonnement.ACTIF,
          abonnementActifJusquAu: expiration,
        },
      });
      console.log('[mollie-webhook] Abonnement prolongé centre', centre.id, 'jusqu\'au', expiration.toISOString());

      try {
        const prixPlanFacture = frequence === 'ANNUEL'
          ? PRIX_ANNUEL[centre.planAbonnement] ?? 0
          : PRIX_MENSUEL[centre.planAbonnement] ?? 0;
        const nbCentresFacture = await this.prisma.centreHebergement.count({
          where: { userId: centre.userId!, statut: 'ACTIVE' },
        });
        const centresSuppFacture = Math.max(0, nbCentresFacture - 1);
        const prixSuppFacture = centresSuppFacture * (frequence === 'ANNUEL' ? CENTRE_SUPP_ANNUEL : CENTRE_SUPP_MENSUEL);
        await this.factureLiavoService.emettre(
          centre.id, prixPlanFacture + prixSuppFacture, centre.planAbonnement, frequence ?? 'MENSUEL', paymentId,
        );
        console.log('[mollie-webhook] Facture LIAVO émise pour centre', centre.id);
      } catch (err) {
        console.error('[mollie-webhook] Erreur émission facture LIAVO:', err);
      }

      return { received: true, renewed: true };
    }

    // ── Paiement échoué ou expiré ──
    if (['failed', 'expired', 'canceled'].includes(payment.status)) {
      console.warn(`[mollie-webhook] Paiement ${payment.status} pour centre ${centre.id}`);
      // On ne désactive PAS immédiatement — Mollie retentera automatiquement
      // via la subscription. Désactivation manuelle si besoin.
      return { received: true, status: payment.status };
    }

    return { received: true };
  }

  // ── Annuler l'abonnement ──────────────────────────────────────────────────

  async annuler(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    if (centre.mollieSubscriptionId && centre.mollieCustomerId) {
      try {
        await mollieClient.customerSubscriptions.cancel(
          centre.mollieSubscriptionId,
          { customerId: centre.mollieCustomerId },
        );
      } catch (err) {
        console.error('[annuler] Erreur annulation Mollie:', err);
      }
    }

    // L'abonnement reste actif jusqu'à la fin de la période en cours
    const updated = await this.prisma.centreHebergement.update({
      where: { id: centre.id },
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
        const dateExp = centre.abonnementActifJusquAu
          ? centre.abonnementActifJusquAu.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
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
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Plan actuel</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.planAbonnement}</td></tr>
           </table>`,
        );
      } catch (err) {
        console.error('[annuler] Erreur envoi notif admin:', err);
      }
    }

    return updated;
  }

  async getFactures(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.factureLiavoService.lister(centre.id);
  }
}
