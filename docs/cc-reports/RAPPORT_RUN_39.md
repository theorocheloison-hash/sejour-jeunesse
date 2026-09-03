# RAPPORT RUN CC #39 — Chantier invitation (les deux faces)

> Branche : `feat/39-invitation` (créée depuis `main` = `f570e79`). **Aucun push, aucun merge.**
> Git log (mis à jour au fil des commits) :
> ```
> (voir section finale)
> ```

## L1 — Libellé badge « en attente du devis » sur séjour rejoint sans devis

- Fichiers réellement modifiés : `frontend/app/dashboard/sejour/[id]/page.tsx`
- Diff résumé : `page.tsx:278-279` — insertion d'une branche dans le useMemo `badgeEngagement`, avant le fallback `sejour?.statut === 'OPTION'` : si `!ds && budgetData && !budgetData.devis && statut === 'OPTION'` → badge gris « En attente du devis de l'hébergeur ». La condition `budgetData && !budgetData.devis` distingue « chargé sans devis » de « pas encore chargé » (pas de flash).
- Gates : tsc frontend OK (0 erreur), build frontend OK (standalone préparé).
- Gardes respectées : aucun autre cas du useMemo modifié (`ds === …`, `if (!navBlocs)`, dépendances `[navBlocs, budgetData, sejour]` intactes) ; `OrganisateurNav.tsx` non touché.
- Écarts / points laissés : aucun.
