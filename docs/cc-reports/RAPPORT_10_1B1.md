# Rapport — 10.1b-1 : emettre() — échéance et mention de paiement dynamiques

**08/07/2026 — branche `fix/facture-liavo-echeance-mention` (depuis `main` e962817), commit `86b263d`. Non poussée.**
Fichier unique : `backend/src/facture-liavo/facture-liavo.service.ts`, méthode `emettre()` uniquement — 8 insertions, 2 suppressions.

## Le problème

Les factures LIAVO émises manuellement (virement/BdC, ex. facturation Choucas) sortaient avec deux mensonges hérités du chemin Mollie : une échéance au jour même (alors que rien n'est payé) et la mention en dur « Facture acquittée par prélèvement SEPA » (fausse pour un mandat administratif).

## Les deux corrections (branchées sur `molliePaymentId`, déjà reçu en paramètre)

**1. Échéance** — avant `generateFacturePdf` :

```ts
// Mollie (molliePaymentId) = déjà payé → échéance = émission ;
// facture manuelle (virement/BdC) = à régler → +30 jours.
const echeance = new Date(now);
if (!molliePaymentId) echeance.setDate(echeance.getDate() + 30);
```

et `dateEcheance: echeance.toISOString()` (au lieu de `now.toISOString()`).

**2. Mention de paiement** :

```ts
conditionsAnnulation: molliePaymentId
  ? 'Facture acquittée par prélèvement SEPA.'
  : 'À régler par virement bancaire sous 30 jours à réception.',
```

## Périmètre respecté

- `genererDevisLiavo` non touché (a déjà +30j et pas de mention SEPA).
- `factureLiavo.create`, upload OVH, email, `genererNumero`, `lister` : intacts.
- **Chemin Mollie inchangé** : `molliePaymentId` renseigné (webhook) → échéance = émission, mention SEPA — comportement identique à avant, zéro régression sur les factures Mollie existantes.
- Seul le chemin manuel (`molliePaymentId` null) change : échéance +30j, mention virement.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run build` | 0 erreur |
| `npm test` | 132 verts + 3 todo (inchangés — pas de spec dédiée sur ce service, fix trivial et chemin Mollie immobile) |
