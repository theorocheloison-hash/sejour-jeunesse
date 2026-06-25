import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TypeAbonnement, StatutAbonnement, PlanAbonnement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import createMollieClient, { SequenceType } from '@mollie/api-client';

const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY ?? '',
});

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://liavo.fr';
const BACKEND_URL = process.env.BACKEND_URL ?? 'https://api.liavo.fr';

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
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        planAbonnement: PlanAbonnement.PILOTAGE,
        abonnementStatut: StatutAbonnement.ACTIF,
        abonnementActifJusquAu: expiration,
        trialStartedAt: now,
      },
    });
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

  // ── Checkout (première étape — capture du mandat SEPA) ────────────────

  async creerCheckout(userId: string, plan: string, frequence: string, centreId?: string | null) {
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

    // Si une subscription existe déjà, l'annuler avant d'en créer une nouvelle
    // (upgrade ou changement de fréquence). L'accès reste actif jusqu'à la fin
    // de la période en cours, la nouvelle subscription prendra le relais.
    if (centre.mollieSubscriptionId && centre.mollieCustomerId) {
      try {
        await mollieClient.customerSubscriptions.cancel(
          centre.mollieSubscriptionId,
          { customerId: centre.mollieCustomerId },
        );
      } catch (err) {
        console.warn('[checkout] Erreur annulation ancienne subscription:', err);
        // Non bloquant : on continue avec la nouvelle subscription
      }
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: { mollieSubscriptionId: null },
      });
    }

    // Calculer le montant : plan + centres supplémentaires
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

    // Stocker le plan + fréquence choisis AVANT le redirect (le webhook les lira)
    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        mollieCustomerId,
        planAbonnement: plan as PlanAbonnement,
        abonnement: frequence as TypeAbonnement,
        // Statut reste INACTIF jusqu'à confirmation webhook
      },
    });

    // Créer le premier paiement (capture le mandat SEPA)
    const intervalLabel = frequence === 'ANNUEL' ? 'annuel' : 'mensuel';
    const payment = await mollieClient.payments.create({
      amount: { value: centsToMollie(montantTotal), currency: 'EUR' },
      description: `Abonnement LIAVO ${plan} ${intervalLabel} — ${centre.nom}`,
      sequenceType: SequenceType.first,
      customerId: mollieCustomerId,
      redirectUrl: `${FRONTEND_URL}/dashboard/hebergeur/abonnement?checkout=success`,
      webhookUrl: `${BACKEND_URL}/abonnements/webhook`,
    });

    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) throw new BadRequestException('Impossible de créer le lien de paiement Mollie');

    return { checkoutUrl, montant: montantTotal, plan, frequence };
  }

  // ── Webhook Mollie ────────────────────────────────────────────────────────

  async handleWebhook(paymentId: string) {
    if (!paymentId) return { received: true };

    let payment: any;
    try {
      payment = await mollieClient.payments.get(paymentId);
    } catch (err) {
      console.error('[mollie-webhook] Erreur fetch payment:', err);
      return { received: true };
    }

    const customerId = payment.customerId;
    if (!customerId) return { received: true };

    const centre = await this.prisma.centreHebergement.findFirst({
      where: { mollieCustomerId: customerId },
    });
    if (!centre) {
      console.error('[mollie-webhook] Centre introuvable pour customerId:', customerId);
      return { received: true };
    }

    // ── Premier paiement réussi → activer + créer l'abonnement récurrent ──
    if (payment.status === 'paid' && payment.sequenceType === 'first') {
      const mandatId = payment.mandateId ?? null;
      const frequence = centre.abonnement; // MENSUEL ou ANNUEL, stocké dans creerCheckout
      const now = new Date();
      const expiration = new Date(now);
      if (frequence === 'ANNUEL') {
        expiration.setFullYear(expiration.getFullYear() + 1);
      } else {
        expiration.setMonth(expiration.getMonth() + 1);
      }

      // Activer l'abonnement
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          mollieMandatId: mandatId,
          abonnementStatut: StatutAbonnement.ACTIF,
          abonnementActifJusquAu: expiration,
        },
      });

      // Créer l'abonnement récurrent Mollie (démarre après la 1ère période)
      try {
        const startDate = new Date(now);
        if (frequence === 'ANNUEL') {
          startDate.setFullYear(startDate.getFullYear() + 1);
        } else {
          startDate.setMonth(startDate.getMonth() + 1);
        }

        const nbCentresActifs = await this.prisma.centreHebergement.count({
          where: { userId: centre.userId!, statut: 'ACTIVE' },
        });
        const centresSupp = Math.max(0, nbCentresActifs - 1);
        const prixPlan = frequence === 'ANNUEL'
          ? PRIX_ANNUEL[centre.planAbonnement] ?? 0
          : PRIX_MENSUEL[centre.planAbonnement] ?? 0;
        const prixCentresSupp = centresSupp * (frequence === 'ANNUEL' ? CENTRE_SUPP_ANNUEL : CENTRE_SUPP_MENSUEL);
        const montant = prixPlan + prixCentresSupp;

        const interval = frequence === 'ANNUEL' ? '12 months' : '1 month';
        const subscription = await mollieClient.customerSubscriptions.create({
          customerId,
          amount: { value: centsToMollie(montant), currency: 'EUR' },
          interval,
          description: `Abonnement LIAVO ${centre.planAbonnement} — ${centre.nom}`,
          startDate: startDate.toISOString().split('T')[0],
        });

        await this.prisma.centreHebergement.update({
          where: { id: centre.id },
          data: { mollieSubscriptionId: subscription.id },
        });
      } catch (err) {
        console.error('[mollie-webhook] Erreur création subscription:', err);
        // L'abonnement est activé mais la récurrence a échoué — sera géré manuellement
      }

      return { received: true, activated: true };
    }

    // ── Paiement récurrent réussi → prolonger l'abonnement ──
    if (payment.status === 'paid' && payment.sequenceType === 'recurring') {
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
    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        mollieSubscriptionId: null,
        // abonnementStatut reste ACTIF jusqu'à expiration naturelle
        // Le cron ou une vérif au login basculera en INACTIF à l'expiration
      },
    });
  }
}
