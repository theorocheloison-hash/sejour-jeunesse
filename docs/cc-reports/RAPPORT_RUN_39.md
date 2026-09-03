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

## L2 — Bloc « Organisateur » dans l'en-tête du séjour (3 états)

- Fichiers réellement modifiés : `frontend/app/dashboard/sejour/[id]/_components/BlocOrganisateur.tsx` (NOUVEAU), `frontend/app/dashboard/sejour/[id]/_components/SejourHeader.tsx`
- Diff résumé :
  - `BlocOrganisateur.tsx` — composant compact (une ligne + boutons text-xs), 3 états dérivés dans l'ordre imposé : invitation en attente (Renvoyer / Modifier l'email), rattaché (« Rattaché : {prenom} {nom} ({email}) », lecture seule), aucun (bouton → champ email pré-rempli `clientEmail`). State local `showForm/email/sending/sentTo/error` au patron d'`InviteOrganisateurCard`, sans l'importer. Appelle `inviterOrganisateurDirect` de `@/src/lib/collaboration` (aucune logique métier dupliquée).
  - `SejourHeader.tsx:6` — import ; `SejourHeader.tsx:244-251` — montage dans la colonne gauche `<div className="min-w-0">`, après le paragraphe client, avant le bloc `editingInfos`, gate strict `isHebergeur && (isDirect || !!clientEmail || !!clientNom)` (même marqueur « ex-direct » que `peutEditerContact`).
- Gates : tsc frontend OK (0 erreur), build frontend OK.
- Gardes respectées : `InviteOrganisateurCard.tsx`, `TabMessages.tsx`, `TabJournal.tsx` non touchés ; aucune prop existante de `SejourHeader` modifiée, aucune signature changée ; gate `isHebergeur` (jamais affiché ORGANISATEUR/SIGNATAIRE) ; boutons de droite (Planifier visite, badge) intacts.
- Écarts / points laissés : la date « depuis le … » de l'état rattaché est volontairement omise — elle n'est pas dans le payload `getSejourInfo` (l'invitation acceptée sort du filtre `acceptedAt:null`). L'ajouter demanderait un changement backend hors périmètre. À décider séparément.
