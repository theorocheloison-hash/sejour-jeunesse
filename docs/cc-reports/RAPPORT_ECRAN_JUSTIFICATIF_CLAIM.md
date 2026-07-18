# Rapport — Écran de dépôt du justificatif de claim (fin de la boucle infinie)

**Date :** 13/07/2026 · **4 commits locaux, non poussés**

| Commit | Périmètre |
|---|---|
| `ba54a8c` | Backend : `organisationId` du centre actif dans onboarding-status (1 ligne additive) |
| `c90fd53` | Écran `/dashboard/hebergeur/justificatif` + helpers `src/lib/justificatif.ts` |
| `39aae43` | Rebranchement des 3 CTA vers le nouvel écran |
| `6f765fa` | (Optionnel) `/centre/[id]/claim` accepte PDF/JPG/PNG comme le backend |

## Le bug fermé

Les 3 CTA « Déposer un justificatif » envoyaient vers `/documents`, dont l'upload
crée une ligne `Document` — table jamais lue par `getOnboardingStatus`. Checklist
rouge à vie → redépôt en boucle → `envoisBloques` permanent. Les deux endpoints
backend fonctionnels ((A) `upload-kbis`, (B) `upload-justificatif`) n'étaient
appelés par aucun écran hébergeur.

## L'écran (détermination du cas, ordre strict)

a) `conformite.justificatif === 'ABSENT'` **et** `claimStatut === 'EN_ATTENTE_DOCUMENT'`
   → **(A)** `POST /organisations/:id/upload-kbis`, champ multipart **`file`**,
   organisationId = **onboarding-status (centre actif)**, mon-claim-statut en fallback.
b) sinon centre PENDING sans `claimDocumentUrl` → **(B)**
   `POST /centres/:id/upload-justificatif`, champ multipart **`document`**.
   Multi-centre : préselection du centre actif, sinon choix radio explicite.
   Couvre aussi le centre sans organisation (B n'en exige pas).
c) sinon état explicite : « déjà transmis, en cours d'examen » ou « aucun
   justificatif attendu ». Jamais de formulaire mort.

Validation client PDF/JPG/PNG 10 Mo (alignée backend). Race admin gérée : le 400
« Ce claim n'attend pas de document » devient « Votre justificatif a déjà été
traité » + redétermination du cas. **Refetch de l'état après upload réussi** +
écran de succès explicite.

## Contre-tests — TOUS PASSÉS, en e2e réel

Stack locale complète : Postgres 16 + MinIO (S3, `forcePathStyle` compatible) +
backend `dist` + frontend `next dev`, parcours au navigateur (Chrome piloté).

1. **Parcours complet ex-nihilo** : inscription (formulaire 4 étapes) → base :
   user + centre PENDING + membership EN_ATTENTE_DOCUMENT + organisation liée +
   consentement RGPD (la transaction du chantier A au travail) → login → CTA
   checklist → écran cas (a) → upload PDF → **succès + retour dashboard en
   navigation client : la checklist affiche « 🕐 Justificatif en cours d'examen »
   SANS rechargement manuel**. Base : membership EN_ATTENTE_VALIDATION, fichier
   dans `kbis/` (MinIO). La boucle est fermée.
2. **Les 3 CTA** pointent vers `/dashboard/hebergeur/justificatif` (vérifié en
   grep : plus aucun CTA claim vers `/documents` ; restent les 3 références
   légitimes de la sidebar) et testés au clic pour la checklist + bannière
   par centre PENDING.
3. **/documents fonctionne toujours** : ajout d'un agrément avec PDF → listé
   « Agrément DSDEN Test E2E — Ajouté le 13/07/2026 — Télécharger ».
4. **/centre/[id]/claim non-régression** : centre catalogue ACTIVE créé en base,
   flux complet revendication → étape Kbis → **upload d'un PNG** (élargissement
   du commit 6f765fa validé de bout en bout) → « Demande envoyée ».
5. **Cas (c)** : après dépôt → « Justificatif déjà transmis, en cours d'examen » ;
   après validation admin simulée (SQL : VALIDE + ACTIVE) → « Aucun justificatif
   attendu ». Jamais de formulaire.

Bonus vérifié au passage : le cas (b) réel — après le dépôt (A), la bannière par
centre PENDING (toujours affichée car `centre.claimDocumentUrl` null) mène à
l'écran qui bascule correctement en (B) « pour l'activation du centre » ; upload →
`claimDocumentUrl` posé, fichier dans `claims/` (MinIO), bannière CTA éteinte.

## Vérifications techniques

- Backend : `tsc --noEmit` + `npm run build` → 0 erreur (avant commit ba54a8c).
- Frontend : `tsc --noEmit` + `npm run build` → 0 erreur avant chaque commit ;
  route `○ /dashboard/hebergeur/justificatif` générée.
- Aucun changement de contrat API (ajout de champ purement additif).
- Les 4 méthodes admin de centre.service.ts et routes `/centres/admin/*` : intouchées.
- Point 4 du brief : l'état EN_ATTENTE_VALIDATION de la checklist s'affiche
  (vérifié en e2e) ; le pied de checklist dit déjà « Centre en cours de validation
  par l'équipe LIAVO — testez tout en vous envoyant vos documents à vous-même »
  (aucune invitation à redéposer) — inchangé.

## Observation UX à trancher (hors périmètre, non codée)

Après un dépôt (A) réussi, la bannière ambre par centre PENDING continue de
proposer « Déposer un justificatif » tant que le centre n'a pas son PROPRE
`claimDocumentUrl` (condition pré-existante `!c.claimDocumentUrl`,
`page.tsx:283`). Ce n'est plus une impasse — le clic mène au cas (b), qui
fonctionne — mais c'est redondant pour un ex-nihilo dont le membership est déjà
EN_ATTENTE_VALIDATION. Option 1 ligne : masquer aussi ce CTA quand
`claimStatut === 'EN_ATTENTE_VALIDATION'`. À toi de décider.

**Non poussé** — relecture Théo puis push.

---

# Addendum 13/07 — Fermeture de la boucle résiduelle (centre couvert par un claim)

**2 commits supplémentaires, non poussés :**

| Commit | Périmètre |
|---|---|
| `74adee8` | Backend : `organisationId` dans `mes-centres-pending` (additif) |
| `81e4315` | Frontend : filtre « centre couvert par claim » (écran + bannière) + garde non-HEBERGEUR |

## Le problème fermé

Après un dépôt (A), le centre restait PENDING sans `claimDocumentUrl` → la bannière
et l'écran (test (b) avant « examen ») proposaient de REdéposer : double dépôt,
double email admin. Règle métier appliquée : `validerClaim` active tous les centres
PENDING de l'organisation — le justificatif de société couvre ses centres.

- `centreCouvertParClaim(centre, claim)` (`src/lib/justificatif.ts`) : vrai si
  l'organisation du centre porte un claim EN_ATTENTE_VALIDATION.
- `determinerCas()` : `sansDocument` exclut les centres couverts → cas « examen ».
- Bannière par centre PENDING : CTA masqué si couvert (reste informative).
- Garde non-HEBERGEUR sur l'écran (le layout hébergeur redirige déjà vers /login ;
  la page ne rend plus le skeleton pendant la redirection).

## Contre-tests — TOUS PASSÉS (e2e réel, Postgres + MinIO + navigateur)

1. **Ex-nihilo (Marc)** : dépôt (A) → bannière du centre PENDING **sans CTA**
   (informative seule), checklist « en cours d'examen », **URL directe de l'écran →
   « Justificatif déjà transmis, en cours d'examen »** — aucun second dépôt possible.
2. **Cas (b) légitime (le test qui compte)** : Marc validé (SQL) + nouveau centre
   créé via l'UI (« Gite E2E des Aravis », PENDING, claimStatut null) → la bannière
   **a** son CTA, l'écran détecte le cas (b) « pour l'activation du centre »,
   dépôt réussi (`claimDocumentUrl` posé). Non-régression confirmée.
3. **Validation admin (SQL : centre ACTIVE)** → écran « Aucun justificatif attendu ».

Vérifications : `tsc --noEmit` + `npm run build` à 0 erreur (backend et frontend)
avant chaque commit ; contrat API inchangé (champ additif).
