# Rapport — 10.1b-3 frontend : colonne « Paiement » dans la vue admin abonnements

**08/07/2026 — branche `feat/10-1b-badge-frontend` (depuis `main` 7652cbf), commit `22bf346`. Non poussée.**
2 fichiers, 14 insertions, 0 suppression. Aucun backend.

## Champ ajouté au type

`frontend/src/lib/admin.ts`, interface `CentreAbonnement`, juste après `mollieMandatId` :

```ts
modePaiement: string | null;
```

(Le backend l'expose depuis 10.1b-2 via le select de `getAbonnements`.)

## Colonne ajoutée

`frontend/app/dashboard/admin/page.tsx`, composant `AbonnementsTab` : colonne « Paiement » placée entre **Fréquence** et **Statut** (près du plan/statut) — un `<th>` dans le thead + un `<td>` par ligne.

## Dérivation du badge

```ts
const modePaiementLabel = a.mollieMandatId ? 'Mollie' : (a.modePaiement === 'VIREMENT' ? 'Virement' : '—');
```

Le mandat Mollie prime (source de vérité du prélèvement) ; sinon le flag admin `VIREMENT` ; sinon « — » (essais et centres sans abonnement payé). Badge en pastille arrondie, mêmes classes que le badge Statut existant (`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`) :

- **Mollie** : `bg-blue-50 text-blue-700`
- **Virement** : `bg-amber-50 text-amber-700`
- **—** : `bg-gray-100 text-gray-500`

## Périmètre respecté

Aucun autre onglet, aucune autre colonne (Mandat ✅/❌ conservée telle quelle), aucun fetch modifié.

## Gates

| Gate | Résultat |
|---|---|
| `npx tsc --noEmit` (frontend) | 0 erreur |
| `npm run build` (frontend) | 0 erreur |

## Note recette

Choucas s'affichera « — » tant que l'UPDATE SQL du stock (RAPPORT_10_1A) n'est pas exécuté ; il passera « Virement » ensuite, ou automatiquement à la prochaine facturation manuelle via l'admin.
