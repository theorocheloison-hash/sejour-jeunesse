# LIAVO — Cadrage : Unification de l'invitation, découplage « rejoindre / signer », création de séjour en 3 étapes

> **Rédigé le 01/09/2026** — Cadrage issu d'une session sparring (audit code réel), puis **exécution suivie** (§13). Recette §14.
> **Statut** — Lot backend + C4 commités en local, **rien de poussé**. Recette locale en cours.
> **Roadmap** : #41 *tranché*, #40 *tranché (C3)*, #36 *connexe (T3)*, #2 *caduc*, #38 *séparé — big picture dashboard organisateur à ouvrir après ce lot*.
> **Réf.** : `ARCHITECTURE_SEJOUR_DIRECT.md`, `ARCHITECTURE_UX_SEJOUR_FINAL.md`, `CHANTIER_RECHERCHE_ETABLISSEMENT.md`, `cc-reports/RAPPORT_DIAGNOSTIC_BOOT_SCALINGO.md`.

---

## 0. Problème à résoudre
1. Deux chemins d'invitation, deux créations dupliquées. 2. « Rejoindre » vaut acte contractuel sans signature. 3. Pas de signature depuis l'espace connecté. 4. Création de séjour peu guidée.

---

## 1. Constat (prouvé sur le code)
- **1.1** Flux B (page « Inviter », sans séjour) — **supprimé** front + back (C1).
- **1.2** `accepter()` : `CONVENTION` + auto-sélection + branche DRAFT + fallback silencieux — **corrigé** (C2).
- **1.3** Signature publique DIRECT-only (`sejourDirectId`), aucun geste connecté pour un devis DIRECT/rejoint `EN_ATTENTE` — **comblé** (C3/C4). `updateStatut` = sélection COLLAB sans signature (T4).
- **1.4** `tokenSignature` persistant. **1.5** Convention = document formel. **1.6** `CreateSejourModal` séjour→client, DTO sans qualification — C5-back livré.
- **1.7** Côté organisateur, l'onglet « Devis » affichait « Aucun devis sélectionné » (fetch HEBERGEUR-only, 403 avalé) ; le devis n'était visible que dans Budget/dashboard/lien public. Source unique = `/collaboration/:sejourId/budget` (filtrait RETENUS). Le dashboard organisateur n'avait **aucune action** pour `OPTION`. Les deux **corrigés** (C2c, C4c, C4e).

---

## 2. Principes (figés)
P1 un seul chemin de création d'invitation · P2 rejoindre ≠ signer · P3 signature unifiée, **JWT depuis l'espace** · P4 séjour naît côté hébergeur · P5 CGV simple, convention formelle · P6 création rapide/complète · **P7 deux niveaux de garantie** : token public (nom+IP+UA+hash) vs connecté (JWT + rôle + ownership R4 + identité tracée).

---

## 3-7. Chantiers (décisions inchangées, cf. versions précédentes du doc dans git)
- **C1** flux B supprimé (T1/T5 = suppression). **C2** rattachement seul + throws 400/404/409 + notif corrigée + constante `STATUTS_DEVIS_VISIBLES_ORGANISATEUR` sur 3 lecteurs. **C3** R4 + `signataireUserId?` + routes `signature/`. **C4** extraction `SignatureDevisPanel`, page publique rebranchée, source `devisAffiche` par rôle, panneau 3 états conditionné `sejourDirectId`, bandeau global (idem), carte dashboard OPTION. **C5-back** 8 champs optionnels. **C5-front** wizard 3 étapes — **à faire**.
- **D8** : un composant, deux mécanismes (token/JWT pour DIRECT/rejoint ; sélection + directeur pour COLLAB pur, T4).
- Hors lot : re-auth explicite à la signature (JWT + ownership + trace jugés suffisants).

---

## 8. À border après le lot
| # | Sujet |
|---|---|
| T3 | #36 devis signé invisible côté signataire. |
| T4 | `updateStatut` COLLAB sans signature ; statut final `CONVENTION` vs `SIGNE_DIRECTION`. |
| T6 | Résidu `{error && …}` mort en bas de la page publique de signature. |
| T7 | `findByToken` ne vérifie pas l'éligibilité du séjour (erreur seulement au clic Confirmer). |
| — | **Big picture dashboard organisateur (#38)** : matrice parcours (invité / catalogue / appel d'offres / demande directe) × stade (`OPTION`→`EN_ATTENTE_VALIDATION`→`CONVENTION`→`SIGNE_DIRECTION`→rectorat/TAM) × écran (arrivée, dashboard, espace, états vides). État vide « créez votre premier séjour » et 3 CTA du haut inadaptés à l'invité. |

---

## 9. Déploiement

**Mécanique Scalingo (vérifiée, `RAPPORT_DIAGNOSTIC_BOOT_SCALINGO.md`)** : `liavo-backend` et `liavo-frontend` ont chacun un `PROJECT_DIR` sur le **même repo** ; **un push `main` redéploie les deux apps en parallèle**. L'ordre « front puis back » des versions précédentes de ce doc est donc **inapplicable sans rebase** — abandonné.

**Décision : un seul push, en heure creuse.** Sûr dans les deux ordres d'arrivée :
- Front prêt avant back : panneau C4 inerte (pas de devis `EN_ATTENTE` visible sans C2c), carte OPTION inerte (pas de séjour OPTION organisateur sans C2), page Inviter supprimée mais endpoint encore là et plus appelé ; `devisAffiche` montre déjà le devis SELECTIONNE (amélioration).
- Back prêt avant front : fenêtre de quelques minutes où un enseignant qui rejoint **à cet instant** verrait un onglet Devis vide et une carte sans bouton, jusqu'à la fin du build front. Se résout seul.

**Prérequis avant push** : recette §14 verte. **Après push** : vérifier les deux déploiements Scalingo (logs), puis le parcours B de la recette sur un séjour test prod (Le Sauvageon, `resa@lesauvageon.com`).

**Garde-fous gravés** : census = lister TOUS les endpoints lus par le front du chemin (leçon `/budget`) **et** les conditions d'affichage front par statut (leçon carte OPTION) ; relecture du doc contre P1-P7 avant chaque Phase 2 ; relecture MCP des fichiers réels, jamais du récap CC ; aucun push par CC.

---

## 10. Vigilance
10.1 lecteurs élargis (résolu). 10.2 `invitations-directeur:155`, `updateStatut`, `getMesNonLus`, `findByToken` (T7). 10.3 aucun test sur `accepter()`, signatures, `createDirect`, page publique → recette manuelle. 10.4 budget prévisionnel s'appuie sur le devis même non signé (assumé). 10.5 `PlanGuard` sur ORGANISATEUR — à confirmer en recette (B, étape signature).

---

## 11. Hors scope
Onboarding organisateur (#38, à cadrer via la matrice §8) ; multi-org ; vidéo/doc ; re-auth.

---

## 12. Census global backend — exécuté 01/09.

---

## 13. Suivi des livraisons (tous relus MCP)

| Chantier | Commit | Notes |
|---|---|---|
| C3 endpoints signature | `286a9be` | `PlanGuard` à confirmer en recette |
| C5-back DTO enrichi | `8a5f793` | — |
| C1-front page Inviter | `ba4caf4` | grep source + backend vides |
| Prod DELETE 4 invitations test | — | prérequis C2 |
| C1-back `create()` + route + DTO | `49de22e` | — |
| C2a `accepter()` | `05665e0` | — |
| C2b lecteurs | `f51e6f0` | — |
| C2c constante + `getBudgetData` | `b991bd9` | cascade `/budget` hors census |
| C4a lib connectée + `DevisBudget` | `c6582e8` | — |
| C4b `SignatureDevisPanel` + page publique | `1659f6b` | comportement public identique |
| C4c source `devisAffiche` + panneau | `f31d336` | corrige le bug « Aucun devis sélectionné » |
| C4d bandeau + refresh | `0f1bf72` | écart `sejourDirectId` → C4f |
| C4e carte dashboard OPTION | `0f59503` | — |
| C4f bandeau limité `sejourDirectId` | `846be82` | — |
| C4g panneau sous l'aperçu + gate onboarding hébergeur-only | `5cee0ad` | dep `[user.role]` stable ; erreur HMR = artefact hot reload |
| chore prisma.config (dotenv + seed) | `35278ad` | inerte en prod ; nécessaire pour la recette locale |
| Recette locale B (invit→rejoindre→signer espace), B6, A (lien public), C2-C3 (délégation) | — | ✅ 01/09 14:24-14:55 — `PlanGuard` ORGANISATEUR OK, `EN_ATTENTE_VALIDATION` visible (bandeau bleu, panneau upload seul), emails loggés | Upload (C4) non testé, accepté ; vérifier badge bleu dashboard |

**Rien de poussé.**

---

## 14. Recette locale (prérequis : `migrate deploy` + `db seed` verts ; back 4000 / front 3000 ; emails loggés, tokens dans les logs backend)

Comptes seed : `hebergeur@test.local` / `Hebergeur1!` — `organisateur@test.local` / `Organisateur1!`.

**B — Espace connecté, bout en bout (C2 + C3 + C4)** *(à faire en premier)*
1. Hébergeur → Séjours → « Séjour test local » → onglet Messages → « Inviter l'organisateur » → `organisateur@test.local`. Logs backend : récupérer `/rejoindre/{token}`.
2. Login organisateur (autre navigateur/onglet privé) → dashboard : bandeau « invitation en attente » → ou coller le lien → **Confirmer et rejoindre** → retour dashboard.
3. **Dashboard** : carte « À confirmer » (pas « Convention ») + badge « Devis à signer — {centre} » + bouton **Espace collaboratif**. ✔ C2 (OPTION) + C4e.
4. Clic Espace collaboratif → **bandeau ambre** « Ce devis n'est pas encore signé… » ✔ C4d. Onglet Devis → **le devis est affiché** (récap + PDF) + encart « Signer ce devis » (3 onglets) ✔ C4c.
5. Signer en ligne : nom + case → **Network : `POST /devis/{id}/signature/signer` = 200** (pas 403) ✔ C3 + `PlanGuard`. Puis : bandeau disparu, span « Signé — {nom} », séjour `CONVENTION` (header), dashboard carte « Convention ».
6. Cas limite : recoller le lien `/rejoindre` → « Cette invitation a déjà été acceptée ».

**A — Lien public (protège C4b)**
7. Hébergeur → créer un 2ᵉ séjour DIRECT (client `hebergeur@test.local`, seule adresse autorisée en centre non validé) → créer un devis → Devis → « Envoyer ». Logs : `/devis/signer/{token}`.
8. Ouvrir en navigation privée (sans session) → **signer en ligne** → « Devis signé ! Merci {nom} ». ✔ page publique rebranchée.
9. 3ᵉ séjour/devis → lien public → **Upload** d'un PDF → « Document signé reçu ! ».

**C — Délégation**
10. 4ᵉ séjour/devis, inviter + rejoindre (comme B) → espace → « Envoyer à la direction » avec `hebergeur@test.local` → devis `EN_ATTENTE_VALIDATION`, **bandeau bleu**, onglet Devis = upload seul, dashboard badge bleu.

**Verdict** : B1-6 verts = lot déployable ; A et C verts = confiance complète.
