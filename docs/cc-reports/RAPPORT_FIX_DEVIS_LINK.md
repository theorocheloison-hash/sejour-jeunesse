# Rapport — Fix : l'étape 5 de la checklist mène à la création du devis du séjour

**08/07/2026 — branche `fix/onboarding-devis-link` (depuis `main` à jour b31cab8), commits `b6586fc` (backend) + `c35c376` (frontend). Non poussée.**

## Le problème

L'étape 5 « Envoyez votre premier devis » pointait en dur vers `/dashboard/hebergeur/devis` (le hub d'alerte), où un nouvel hébergeur sans devis ne trouve aucune action de création évidente. Le bon parcours est la création de devis sur le séjour qu'il vient de créer à l'étape 4 — mais la checklist ne connaissait pas l'id de ce séjour.

## Volet backend (`b6586fc`) — `centre.service.ts`, `getOnboardingStatus`

Dans le `$transaction` existant, le `sejour.count` est remplacé par un `findFirst` (même transaction, **aucune requête ajoutée**) :

```ts
this.prisma.sejour.findFirst({
  where: { hebergementSelectionneId: centre.id, deletedAt: null },
  orderBy: { createdAt: 'desc' },
  select: { id: true },
}),
```

Variable `sejoursCount` → `sejourRecent` ; étape du retour : `sejour: { ok: !!sejourRecent, id: sejourRecent?.id ?? null }`. Rien d'autre touché : counts produits/devis, membership, `envoisBloques`, `centreValide`, `complete` intacts. `complete` lit `etapes.sejour.ok` — sémantique identique (`!!findFirst` ≡ `count > 0`). Aucune migration.

## Volet frontend (`c35c376`) — `OnboardingChecklist.tsx`

- Interface `OnboardingStatus` : `sejour: { ok: boolean }` → `sejour: { ok: boolean; id: string | null }`.
- Href de l'étape 5 dérivé :

```ts
const devisHref = status.etapes.sejour.id
  ? `/dashboard/hebergeur/devis/nouveau?sejourDirectId=${status.etapes.sejour.id}`
  : '/dashboard/hebergeur/planning';
```

Fallback `/planning` si aucun séjour (l'étape 4 le crée). **Vérifié avant d'écrire** : `devis/nouveau/page.tsx` consomme bien `searchParams.get('sejourDirectId')` (ligne 37) et bascule en mode DIRECT — le lien atterrit sur le formulaire pré-câblé au séjour. Rien d'autre touché : autres étapes, « Aller plus loin », logique localStorage/repli/célébration intacts.

## Cascade

Nulle. Backend : le champ `id` est additif ; le seul autre consommateur frontend de `etapes.sejour` est ce composant (en `.ok`). Frontend : href dynamique avec fallback, aucun flux modifié.

## Gates

| Gate | Résultat |
|---|---|
| Backend `npx tsc --noEmit` | 0 erreur |
| Backend `npm run build` | 0 erreur |
| Backend `npm test` | 128 verts + 3 todo (inchangés) |
| Frontend `npx tsc --noEmit` | 0 erreur |
| Frontend `npm run build` | 0 erreur |
