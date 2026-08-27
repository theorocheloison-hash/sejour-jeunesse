import type { PrismaService } from '../prisma/prisma.service.js';
import { centsToMollie } from './abonnement.constants.js';
import { montantRecurrentOrganisationCents } from './montant-organisation.helper.js';

/**
 * Réaligne le montant de la subscription Mollie d'une organisation sur son
 * nombre de centres EXPLOITÉS (statut ACTIVE, userId non null — les fiches
 * catalogue APIDAE/LMDJ jamais revendiquées sont exclues du supplément).
 *
 * Helper PUR (patron trial.helper) : aucune dépendance de module NestJS,
 * aucun cycle possible — prisma et le client Mollie sont reçus en paramètres,
 * le client typé structurellement (pas d'import de type @mollie/api-client).
 *
 * À appeler HORS transaction DB, APRÈS commit, en fire-and-forget
 * (`resyncMontantOrganisation(...).catch(...)`) : un échec Mollie ne doit
 * JAMAIS faire échouer une activation/suppression de centre. Pas de paramètre
 * `tx` par construction.
 *
 * NO-OP si l'organisation n'a pas de subscription Mollie complète
 * (trial / offert / virement : rien à patcher).
 *
 * `mandateId` est requis par le TYPE du SDK 4.5.0 (UpdateParameters), pas par
 * l'API Mollie — on passe systématiquement org.mollieMandatId.
 *
 * Idempotent : PATCH du même montant = no-op côté Mollie. Le nouveau montant
 * prend effet au prochain cycle (pas de prorata). Auto-correction résiduelle :
 * le webhook rappelle ce resync à chaque prélèvement — un patch raté ici est
 * réparé au cycle suivant.
 */
export async function resyncMontantOrganisation(
  prisma: PrismaService,
  // Type structurel = la forme EXACTE de l'appel émis (customerId + mandateId
  // requis par le SDK 4.5.0). Ce shape est assignable à UpdateParameters →
  // le vrai client Mollie satisfait ce type sans import ni cast.
  mollie: {
    customerSubscriptions: {
      update: (
        id: string,
        params: { customerId: string; mandateId: string; amount: { currency: string; value: string } },
      ) => Promise<unknown>;
    };
  },
  organisationId: string,
): Promise<void> {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        mollieSubscriptionId: true,
        mollieCustomerId: true,
        mollieMandatId: true,
        planAbonnement: true,
        abonnement: true,
      },
    });
    if (!org || !org.mollieSubscriptionId || !org.mollieCustomerId || !org.mollieMandatId) {
      return;
    }

    // Montant via le point de calcul unique (seam prix négocié). Iso-comportement :
    // même plan, même fréquence, même comptage (statut ACTIVE + userId non null).
    const montantCents = await montantRecurrentOrganisationCents(prisma, organisationId);
    if (montantCents <= 0) {
      // Plan DECOUVERTE/inconnu → 0 : ne jamais patcher une subscription à 0,00 €.
      console.error(
        `[resync] montant nul pour organisation ${organisationId} (plan ${org.planAbonnement}), patch Mollie ignoré`,
      );
      return;
    }

    await mollie.customerSubscriptions.update(org.mollieSubscriptionId, {
      customerId: org.mollieCustomerId,
      mandateId: org.mollieMandatId,
      amount: { currency: 'EUR', value: centsToMollie(montantCents) },
    });
    console.log(
      `[resync] organisation ${organisationId} → subscription réalignée à ${centsToMollie(montantCents)} €`,
    );
  } catch (err) {
    console.error('[resync] échec organisation', organisationId, err);
  }
}
