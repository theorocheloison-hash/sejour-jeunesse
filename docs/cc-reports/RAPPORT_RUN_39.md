# RAPPORT RUN CC #39 — Chantier invitation (les deux faces)

> Branche : `feat/39-invitation` (créée depuis `main` = `f570e79`). **Aucun push, aucun merge.**
> Git log final de la branche :
> ```
> (L4)  feat(rgpd): encart de réassurance données (inscriptions + page parent)
> dd22d2f feat(register): pré-remplit prénom/nom/structure de l'organisateur invité
> 074c597 feat(invitation): expose le contact (prénom/nom/structure) dans findByToken
> 31cf053 feat(sejour): bloc Organisateur (inviter / renvoyer / rattaché) dans l'en-tête
> 79a6580 fix(sejour): libellé badge « en attente du devis » sur séjour rejoint sans devis
> f570e79 (main) docs: clôture #38
> ```
> Baseline tests backend vérifiée en fin de run : **4 failed / 2 todo / 445 passed** (identique au pré-existant — échecs mollie + mock facture.service.spec, hors scope, non touchés).

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

## L3a — Backend : findByToken joint le séjour (contact)

- Fichiers réellement modifiés : `backend/src/invitation-collaboration/invitation-collaboration.service.ts`
- Diff résumé : `invitation-collaboration.service.ts:111-147` — dans `findByToken`, après les deux gardes existantes (NotFound/Conflict), résolution du contact depuis le séjour (`findUnique` par scalaire `sejourId`, pas de relation Prisma) : `clientPrenom/clientNom/clientOrganisation` + `typeStructure` de l'organisation (2ᵉ `findUnique` si `clientOrganisationId`). Retour `{ ...invitation, contact }`. Helper module privé `mapTypeStructure` (`:406-413`) : enum Prisma → valeurs du select register (`COLLECTIVITE_TERRITORIALE`→`MAIRIE`, `ENTREPRISE`/`MICRO_ENTREPRISE`/inconnu→`AUTRE`).
- Gates : tsc backend OK (0 erreur), build backend OK (exit 0).
- Gardes respectées : changement strictement additif (la forme retournée gagne `contact`, tout le reste identique → `rejoindre/[token]` non affecté) ; jamais de téléphone dans `contact` ; séjour absent/supprimé → `contact: null` ; `accepter`, `getPendantesPourUser`, `inviterCentreExterne` non touchées.
- Écarts / points laissés : aucun.

## L3b — Frontend : type + pré-remplissage register

- Fichiers réellement modifiés : `frontend/src/lib/invitation-collaboration.ts`, `frontend/app/register/organisateur/page.tsx`
- Diff résumé :
  - `invitation-collaboration.ts:22-27` — champ `contact?: { prenom, nom, organisation, typeStructure } | null` ajouté à l'interface `InvitationCollaboration`.
  - `register/organisateur/page.tsx:151-164` — dans le useEffect d'invitation existant, après le `setForm` email : pré-remplissage `prenom`/`nom` (sans écraser une saisie, `f.prenom || …`), `etablissementNom` depuis `contact.organisation`, `setTypeStructure` avec fallback `AUTRE` si valeur inconnue.
- Gates : tsc frontend OK (0 erreur), build frontend OK (exit 0).
- Gardes respectées : champs pré-remplis éditables (aucun readOnly ajouté) ; verrou email existant non touché ; logique de reset du useEffect `[typeStructure, invitationToken]` non modifiée ; best-effort (contact absent/null → formulaire vide, aucune régression).
- Écarts / points laissés : fichiers `LIAVO_SESSION_STATE.md` et `docs/ROADMAP_ETE_2026.md` trouvés modifiés dans le working tree (modifications externes au run, non commitées — add ciblé). Également présent non versionné : `docs/CHANTIER_SAISIE_CLIENT_CREATION.md` (externe au run, laissé tel quel).

## L4 — Encart de réassurance données (inscriptions + page parent)

- Fichiers réellement modifiés : `frontend/app/components/ReassuranceDonnees.tsx` (NOUVEAU), `frontend/app/dashboard/sejour/[id]/page.tsx`, `frontend/app/autorisation/[token]/page.tsx`
- Diff résumé :
  - `ReassuranceDonnees.tsx` — composant statique (aucune logique, aucun fetch), texte exact du cadrage, encart sobre `bg-gray-50` / `border-gray-200` / `text-xs text-gray-600` + icône bouclier.
  - `page.tsx:37` import + `page.tsx:605` — montage en tête du `<div className="space-y-6">` du bloc Inscriptions (branche `navBlocs`, `activeTab === 'participants'`), avant le sélecteur de mode.
  - `autorisation/[token]/page.tsx:37` import + `:352` — montage après la section « Votre enfant » (dernier bloc d'infos séjour), avant le bloc Formulaire/Confirmation. `RGPD_TEXT` (bloc légal distinct) conservé tel quel.
- Gates : tsc frontend OK (0 erreur), build frontend OK (exit 0). Tests backend : 4 failed / 2 todo / 445 passed = baseline exacte.
- Gardes respectées : composant sans état, texte non dupliqué (source unique, 2 montages) ; aucune logique existante des 2 pages modifiée (insertion JSX seule).
- Écarts / points laissés : sur la page parent, le point « sous le bloc d'infos du séjour » a été résolu comme « après la section Votre enfant » (dernier bloc d'infos avant le formulaire) — l'encart est ainsi visible aussi dans l'état signé (confirmation), ce qui reste cohérent (réassurance sur données déjà transmises).
