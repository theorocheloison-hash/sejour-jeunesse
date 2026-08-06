// Singleton Mollie partagé (resync + futurs appelants admin/claim/centres).
// abonnement.service.ts garde sa copie locale jusqu'au Lot 2a — coexistence voulue.
import createMollieClient from '@mollie/api-client';

export const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY ?? '' });
