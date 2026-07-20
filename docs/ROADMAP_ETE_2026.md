# LIAVO — Roadmap Été 2026

> **Rédigé le 18/06/2026** — Issue d'un audit exhaustif code × docs.
> **Dernière mise à jour : 16/07/2026 (matin)** — **Accès SQL prod RÉSOLU.** Le `db-tunnel` figeait à cause de la **CLI Scalingo 1.44.1 périmée** — mise à jour en 1.47.0, tunnel OK, `SELECT now()` validé en prod. Fausses pistes écartées : NI la box du bureau, NI psql/PATH, NI la clé SSH. ‼️ Le 🔴 « accès SQL cassé » ci-dessous est **CLÔTURÉ** ; la note du 14/07 « pgsql-console fonctionne » était fausse depuis PowerShell. Procédure réutilisable dans SESSION_STATE 16/07. ⚠️ Reste : **régénérer le mot de passe DB** (il a circulé pendant le debug) — Settings PostgreSQL → Reset password.
> *(15/07/2026)* — **Deux fix UX frontend poussés (Scalingo déploie).** (1) Badge « ✓ Devis envoyé le … » sur la page séjour (onglet Devis, DIRECT), stade Brouillon uniquement — comble le trou « on ne sait pas si le devis est parti sans aller dans Notes & suivi ». `Devis.dateEnvoi` déjà en base + déjà renvoyée par l'API, seuls le type front et l'affichage manquaient (réparation à la source, pas un patch). (2) Tooltip du graphe CA mensuel (Pilotage) : double « Encaissé » corrigé (formatter Recharts 3 par `item.dataKey` → libellé Réalisé/Prévisionnel/Encaissé). tsc + build verts. ⚠️ Recette manuelle prod à faire. Voir SESSION_STATE 15/07.
> *(14/07/2026, soir)* — **TVA sur marge : Lot 1 backend LIVRÉ et déployé (`cf8795d`), chantier GELÉ jusqu'à l'hiver.** Endpoint `GET /rentabilite/tva-marge` en prod, `regime_marge_actif = true` sur Sauvageon. ⚠️ **Découverte : ZÉRO facture prestataire en base — le module Rentabilité du 04/06 n'a JAMAIS été alimenté.** Le moteur est testé unitairement, validé sur aucune donnée réelle. Lots 2→5 parkés (voir § TVA SUR MARGE). **Corrections de statut** : ❌ « Node 20 EOL à planifier » → FAIT (24.x en prod) • ❌ « httpOnly cookies reverté » → EN PROD • ❌ « `pgsql-console` cassé » → FONCTIONNE (pipe stdin). Voir SESSION_STATE 14/07 (soir).
> *(14/07/2026, jour)* — **Journée « activation hébergeur » : 9 commits, tout recetté en prod.** ✅ Bloc 🟠 TRIAL RÉSOLU (source unique + garde centre ACTIVE + alignement multi-centre) • ✅ 🟡 DETTE §1 `createCentre` RÉSOLUE — et le bug réel n'était pas celui écrit ici : le parcours **« ajouter un centre »** créait un centre PENDING **invisible des DEUX listes admin**, donc **jamais activable** • ✅ 🟡 §2 **3 WORKFLOWS ADMIN UNIFIÉS** sur l'écran strict (routes permissives supprimées côté serveur) • ✅ **Node 20 → 24** (🟡 §3 résolu) • ✅ `schemeID` Factur-X (bug préexistant, échéance e-invoicing 01/09) • ✅ Backfill SIREN/SIRET prod • ✅ Recette backend T1→T7 sur base jetable • ✅ Recette manuelle prod validée (17h43). ⚠️ **RECTIFICATION** : la note « correction » que j'avais ajoutée au §2 ce matin était **fausse** — la roadmap avait raison, je n'avais lu qu'un des deux écrans admin. Voir §2. Reste : purger `RECETTE 14-07`, purge S3 `kbis/`, accès `pgsql-console` cassé. Voir SESSION_STATE 14/07.
> *(13/07/2026)* — **Bloc 🔴 ex-nihilo RÉSOLU** (10 commits, recette prod de bout en bout : inscription → justificatif → validation admin → devis ENVOYÉ). L'analyse initiale du bloc était partiellement fausse — corrigée ci-dessous. **Nouveau bloc 🔴** : déploiement frontend silencieusement cassé 12→13/07 (HOSTNAME × Next standalone, résolu `88e49ec`, leçon à retenir). Voir SESSION_STATE 13/07.
> *(12/07/2026)* — **Export ZIP des factures PDF LIVRÉ** (§2.8 ci-dessous) : ZIP + index CSV, avoirs inclus dans le ZIP ET dans l'export CSV comptable, **bug multi-centre des exports réparé** (les `<a href download>` court-circuitaient axios → le header `X-Centre-Id` ne partait jamais → tout hébergeur multi-centre exportait son 1er centre, silencieusement). 3 commits poussés (`6023edc`, `f0f96f8`, `b0a1ed3`), recette prod validée (62 PDF Sauvageon, ~10 s). **Statut corrigé** : `28e364a` (fix SIRET) était noté « non poussé » ici — il est **en prod depuis le 09/07** ; en revanche le SIRET **n'est pas réglé** (cf. 4e cause du bloc 🔴). Voir SESSION_STATE 12/07.
> *(08/07/2026, soir)* — Run dette §4 : 4.6 (escapeHtml) et 4.10 (jspdf) constatés déjà faits → actés ; 4.9 partiel (SequenceService couvert par la suite invariants) ; **4.15 LIVRÉ** (bandeau « nouvelle version » non-destructif dans global-error.tsx, jamais de reload auto) ; **4.11 LIVRÉ** (13 vulns → 3 : audit fix + next 16.2.10 + @types/react-pdf mort supprimé ; xlsx = risque ACCEPTÉ ; postcss vendored Next non actionnable) ; **4.7 étape 1 prête** (`docs/AUDIT_FLOAT_DECIMAL.md`, requêtes prod à exécuter par Théo, migration non engagée). Après-midi : chantier 10.1 livré de bout en bout, deadline 26/09 NEUTRALISÉE (cron exclut VIREMENT + Choucas marqué, facture échéance/mention dynamiques, badge Paiement, relance J-30, self-service +14j) ; edge cases onboarding soldés ; compte de test neutralisé. Soir (tard) : fix page abonnement — libellés neutres (amorce §2.4) + bouton « plan actuel / Nous contacter » dérivé du plan courant (`PricingTable`). Matin : onboarding phase 2 (§10.11) + 3 bugs smoke-test corrigés. Voir §2/§4/§10 + SESSION_STATE 08/07.
> *(07/07 : Refonte planning ↔ groupes m2m livrée. Fix crash boot Scalingo P3015. Refactor PDF extraction dynamic imports. Item dette 4.18 ajouté.)*
> *(03/07 : Sécurité verrouillée, Mollie live, Pilotage livré, conventions configurables, contrat événement. Dette 4.1-4.3 livrée. Responsive mobile livré. Diagnostic dette Fable 5.)*
> **Auteur** : Théo + Claude (sparring partner)
> **Ce document remplace** : ROADMAP_POST_DEMO.md, ROADMAP_COMPLETE.md, TIER1_CHANTIERS.md comme source de priorisation.
> **Règle** : les docs ci-dessus restent comme archives de décision. Celui-ci est le seul qui dit quoi faire et dans quel ordre.

---

## 🗺️ IDÉE PRODUIT — Carte interactive du catalogue (backlog)

> **Carte interactive du catalogue** — afficher les centres sur une carte (recherche géographique visuelle côté organisateur + actif de démo). Prérequis : coordonnées GPS en base → migration `latitude`/`longitude` sur `CentreHebergement` + backfill depuis l'API Éducation nationale (qui les expose déjà, champs `nom_du_lieu_d_accueil_latitude`/`_longitude`). Bonus : dédup GPS infaillible (2 fiches au même point = même bâtiment). Reporté en **Lot 2bis** du chantier catalogue (décision 20/07 : GPS sorti du Lot 2 pour garder le commit propre — le Lot 2 backfille identifiant EN + avis + thématiques + capacité adultes sans toucher au schéma).

---

## ❄️ TVA SUR MARGE — Lot 1 LIVRÉ (14/07), Lots 2→5 GELÉS jusqu'à l'HIVER 2026-2027

### Le problème
Les hébergeurs de montagne **revendent** des prestations achetées à des tiers (ESF, guides, transport, rafting, chiens de traîneau). Ces prestations relèvent du **régime de la marge** (art. 266-1-e CGI) : TVA à 20 % sur `vente TTC − achat TTC`, TVA d'amont **non déductible**. La pension produite en propre reste au régime normal (10 %).

Théo remplit ça **à la main dans un Excel** (3 onglets, ~268 k€ de flux, 15 k€ de marge sur déc→mai) qu'il envoie à son expert-comptable. Objectif : que LIAVO produise ce tableau et que l'Excel devienne un **export**.

### ⚠️ Le piège (à ne jamais oublier)
`rentabilite.getTableau()` calcule `CA du devis ENTIER − charges` = marge **économique**, **pension incluse**. Ce n'est **PAS** la base du régime de la marge. Diviser cette marge par 1,2 = **déclarer de la TVA sur la pension** = sur-imposition. Le trou n'était pas la formule, c'était **le côté vente** : rien ne permettait de dire « cette ligne de devis est une revente tierce ».

### ✅ LOT 1 — Backend (LIVRÉ, `cf8795d`, en prod)
- Migration `20260714120000_tva_sur_marge` : `regime_marge_actif` + `taux_tva_marge` (centre), `revendu_tiers_defaut` + `categorie_marge` (catalogue), `revendu_tiers` + `categorie_marge` (lignes de devis).
- `GET /rentabilite/tva-marge?annee=` → `parMois[12]`, `parPoste[]`, `totaux`, `anomalies[]`. Plan PILOTAGE requis.
- **4 requêtes, aucune en boucle.** TVA dérivée (`baseHT + tva === margeTTC`). Marge négative conservée signée.
- 5 anomalies de données, dont `FACTURE_SOUS_VENTILEE` (**bug existant** : `validateMontantEtVentilations()` ne rejette que la SUR-ventilation — une sous-ventilation crée une charge orpheline en silence).
- 10 tests. `regime_marge_actif = true` sur Sauvageon.

### 🔴 POURQUOI C'EST GELÉ

**Smoke test post-déploiement : `parPoste: []`. ZÉRO facture prestataire en base.**

Le module Rentabilité, livré le **04/06/2026** à la demande de Yves Massard, **n'a jamais été alimenté en production.** Conséquences :
1. Le moteur est testé unitairement, **validé sur zéro donnée réelle**.
2. Le coût réel du projet n'est pas le code, c'est **la saisie des factures prestataires**. Théo ne peut pas la faire avant l'**hiver 2026-2027** (pas de vrais séjours LIAVO au Sauvageon d'ici là).
3. **Aucun client payant n'a demandé cette feature.** Yves / Anne / Alticlub n'ont **jamais été sondés** sur le régime de la marge.

Le Lot 1 est **inerte en prod** : aucun frontend ne le consomme, `regime_marge_actif = false` partout ailleurs. Zéro impact utilisateur, zéro coût à le laisser dormir.

### 🚦 CONDITION DE REPRISE (à vérifier AVANT de coder le Lot 2)
**Poser la question à Yves, Anne et Alticlub** : *« êtes-vous au régime de la marge sur les prestations que vous revendez ? Vous le suivez sur Excel ? »*
- **3/3 oui** → c'est le hook du palier PILOTAGE à 79 €. Prioritaire.
- **1/3** → feature Sauvageon (centre gratuit de Théo). Assumer comme telle, la garder en dernier.

### 📅 LOTS PARKÉS

| Lot | Contenu | Est. |
|---|---|---|
| **2** | **Frontend saisie** : checkbox « revendu (régime marge) » + `categorieMarge` sur le catalogue **et** les lignes de devis. ⚠️ `categorieMarge` doit être un `<input list>` **alimenté par les `typeCharge` déjà utilisés par le centre** — sinon les colonnes vente et achat ne se rejoignent jamais et tout le chantier est inutile. ⚠️ Le flag doit **piloter** la TVA (cocher → force `tva = 0` + mention PDF), jamais l'inverse : deux sources de vérité = TVA fausse sans signal. | 1,5 j |
| **3** | **Export XLSX format EC** (mensuel + par poste, calqué sur l'Excel actuel). C'est **lui** qui fait disparaître le fichier. Le canal `/pilotage/export/*` existe déjà. | 1 j |
| **4** | **Frontend restitution** : onglet « TVA sur marge » + **écran d'anomalies** (non négociable : sans lui, l'Excel ne peut pas disparaître — quand on saisit à la main on VOIT les incohérences, automatisé on ne voit plus rien). | 2 j |
| **5** | **Mention TVA sur les PDF** : le prop `mentionTVA` **existe** dans `FacturePDF.tsx` mais `mapFactureToPdfProps()` ne le renseigne **jamais** → les factures affichent « TVA (0 %) » **sans la mention légale du régime de la marge**. Non fatal aujourd'hui (aucune facture de séjour émise, 1ʳᵉ en décembre), **à corriger avant la 1ʳᵉ facture d'hiver**. | 0,5 j |
| **6 ?** | **OCR facture prestataire** (le PDF est déjà uploadé dans OVH) → pré-remplissage nom/n°/date/montant. Tue la dernière tâche manuelle. **Hors périmètre**, à rediscuter. | — |

### 🔧 BACKFILL (prêt, NON EXÉCUTÉ)
Chez Sauvageon, les lignes revendues sont **déjà saisies à `tva = 0`** (avec mention régime marge sur la facture papier). Donc :
```sql
UPDATE lignes_devis SET revendu_tiers = true WHERE tva = 0;
```
⚠️ **Jamais en aveugle** : `tva = 0` peut aussi désigner une caution, une remise, une taxe de séjour, une erreur. `SELECT` de contrôle obligatoire + écran de vérification derrière.

### 📝 DÉCISIONS DE RÉFÉRENCE (ne pas relitiger)
- **LIAVO ne déclare RIEN.** LIAVO restitue, l'EC déclare. Aucune règle fiscale codée (pas de plancher à zéro, pas de report, pas de compensation inter-mois). Marge négative = conservée signée, pas une anomalie.
- **Rattachement mensuel = `sejour.dateDebut`**, même à cheval sur 2 mois.
- **Ne pas filtrer sur `isComplementaire`** — filtrer sur le flag `revenduTiers`.
- **`categorieMarge` et `typeCharge` en VarChar(50)**, même longueur, clé de rapprochement.
- **Ne PAS toucher à `getTableau()`** : la marge économique reste l'indicateur de Yves. Deux indicateurs, pas un remplacement.

---

## ✅ RÉSOLU 13/07/2026 — Parcours inscription hébergeur ex-nihilo (identifié 09/07, ex-🔴 URGENT)

**Symptôme initial** : un hébergeur qui s'inscrivait seul avec un centre HORS catalogue pouvait finir avec un compte détruit à l'inscription (cas Louise Giard / PULSE SPORTS, rattrapée en SQL), une checklist « Déposer un justificatif » en boucle infinie, et des envois externes bloqués sans issue apparente.

**⚠️ L'analyse initiale de ce bloc racontait une histoire que la session du 13/07 a DÉMENTIE — corrections :**
- ❌ *« ni en self-service, ni par l'admin via l'UI »* : **FAUX**. L'admin POUVAIT déjà valider : le dashboard admin consomme `/centres/admin/claims` → `centreService.validateClaim`, qui **accepte `EN_ATTENTE_DOCUMENT`**. Il n'y a jamais eu de cul-de-sac admin — il y a en revanche trois implémentations divergentes du même workflow (cf. 🟡 DETTE 13/07 §2).
- ❌ *Le SIRET comme cause* : c'était un **SYMPTÔME**. La cause racine était l'**absence d'atomicité** dans `registerHebergeur` : `centre.create` hors transaction → toute erreur en aval laissait un user orphelin et un **email brûlé à vie** (ConflictException à chaque retry). Le SIRET était juste le champ qui a fait tomber Louise.
- ❌ *« 1 CTA cassé »* : il y en avait **TROIS** (OnboardingChecklist + 2 bannières dashboard), tous vers `/documents` — dont l'upload alimente la table `Document`, jamais lue par `getOnboardingStatus`.
- ✅ **5e cause découverte, jamais identifiée** : les emails post-inscription étaient **`await`és après le commit**. Un échec Brevo (timeout, rate-limit) → 500 → compte créé quand même → email brûlé. **Même symptôme que le bug d'atomicité, par une autre porte.** Corrigé (fire-and-forget avec log exploitable).

**Les 5 causes réelles, toutes corrigées le 13/07** :
1. **Atomicité** (`60eb12f`) : transaction interactive user + centre + organisation + membership + consentement RGPD, mapping d'erreurs (P2002 → 409, P2000 → 400 FR actionnable), tous les emails après commit, rollback prouvé sur vraie base.
2. **SIRET `@Length(14,14)`** + strip sur les 3 DTO register/create/update (`b1bbcd4`) — filet de sécurité, PAS la réparation (c'est l'atomicité qui répare).
3. **`motDePasseDefini`** dans `centre.service.register()` (`5e59e28`) — bug dormant corrigé AVANT la correction du routage cas 2 qui l'aurait réveillé.
4. **Écran justificatif** (`ba54a8c`, `c90fd53`, `39aae43`, `6f765fa`, `74adee8`, `81e4315`) : `/dashboard/hebergeur/justificatif` appelle les VRAIS endpoints ((A) `upload-kbis` champ `file` / (B) `upload-justificatif` champ `document`), refetch post-upload (la boucle infinie ne peut plus se reproduire), les 3 CTA rebranchés, boucle résiduelle « centre couvert par un claim en attente » fermée, `/centre/[id]/claim` élargi PDF/JPG/PNG.
5. **Emails non bloquants** (`2a07b7b`) : `sendVerificationEmail` / `sendHebergeurAccountPending` en fire-and-forget, porte de sortie `resendVerification` vérifiée de bout en bout (bouton login inclus).

**Recette prod 13/07, validée de bout en bout** : inscription ex-nihilo (`ZZZ RECETTE 13-07`) → dépôt justificatif (checklist bascule « en cours d'examen » SANS reload) → validation admin → **devis DEV-2026-0001 créé et ENVOYÉ à un destinataire externe**. Le gate `assertEnvoiExterneAutorise` est levé en réel — pas seulement son miroir `envoisBloques`.

**Reste ouvert (hors périmètre du chantier)** : le **routage cas 2** (invitation admin pré-remplie routée vers `/auth/register/hebergeur` → PENDING, au lieu de `/centres/register` → ACTIVE ; le code ACTIVE du cas 2 reste mort côté UI). `motDePasseDefini` a été corrigé en amont précisément pour que ce chantier ne réveille pas le bug de reconnexion. Voir aussi 🟡 DETTE 13/07 §2 (workflow admin) et 🟠 TRIAL 30J.

---

## 🔴 DÉPLOIEMENT FRONTEND SILENCIEUSEMENT CASSÉ 12→13/07 (résolu `88e49ec` — LEÇON À RETENIR)

**Découvert par accident** pendant le chantier ex-nihilo — hors sujet initial, mais bloquait TOUT : plus aucun déploiement frontend ne passait depuis le **12/07 15h42**. Trois deploys consécutifs en `timeout-error` (`ae4c498`, `dc845a2`, `2a07b7b`). **La prod servait du code périmé, SANS ALERTE** : le site répondait 200 (ancien container), les builds réussissaient, seul le boot échouait.

**Cause prouvée** : Next 16 standalone génère `const hostname = process.env.HOSTNAME || '0.0.0.0'` et Scalingo injecte `HOSTNAME=<nom-du-container>`. Next binde donc **uniquement l'IP du container**. Le trafic routé passe (il vise cette IP), mais la sonde de boot Scalingo (loopback) ne voit rien → timeout 60 s → SIGTERM. **Preuve en one-off dans le runtime Scalingo** : `LOOPBACK_REFUSED` / `HOSTNAME_OPEN` ; contre-épreuve `HOSTNAME=0.0.0.0` → `LOOPBACK_OPEN`. (Les 3 commits déclencheurs étaient doc-only : le code n'a jamais été en cause.)

**Fix** (`88e49ec`) : Procfile → `web: HOSTNAME=0.0.0.0 node .next/standalone/server.js`, et les deux `cp -r` sortent du boot (budget 60 s) vers un hook npm `postbuild` (`scripts/prepare-standalone.mjs`, cross-platform). Déploiement suivant : **success**, vérifié.

**⚠️ LEÇON À RETENIR** : un déploiement peut échouer en silence pendant 24 h sans qu'aucun client ne s'en aperçoive — l'ancien container continue de servir — pendant que le backend, lui, continue de se déployer. **Backend et frontend divergent alors sans alerte** (seul signal faible : les erreurs « Failed to find Server Action » des clients au bundle périmé). **VÉRIFIER `scalingo deployments` APRÈS CHAQUE PUSH.**

---

## 🟡 DETTE IDENTIFIÉE LE 13/07 — à traiter à froid (aucun client impacté)

Trois constats issus du chantier inscription ex-nihilo. Aucun ne bloque personne aujourd'hui ; les trois sont des bombes à retardement.

### 1. ✅ RÉSOLU 14/07 — `createCentre` (le bug réel était AILLEURS)

**RÉSOLU par `6b5bb4a` + `9724d2a`.** L'analyse ci-dessous (atomicité) était **exacte mais incomplète** — elle décrivait la moitié du problème. Le vrai bug, trouvé en lisant les deux listes admin :

> Un hébergeur **déjà validé** ajoute son 2e centre. Le SIRET est **optionnel**, il ne le remplit pas. La dédup tombe sur `nom + ville` : le nom du **chalet** ne matche pas le nom de son **organisation** → **organisation neuve** + membership `NON_APPLICABLE`. Le centre PENDING n'apparaît alors ni dans `/admin/claims` (qui ne liste que les `EN_ATTENTE_*`), ni dans `/admin/centres/pending` (qui exige un membership `VALIDE` sur l'org). **Invisible → jamais activable → hébergeur bloqué sans issue.**

**Invariant posé** : *tout centre créé en PENDING est visible dans au moins une liste admin.*

**Fix à la source** (une transaction interactive, calquée sur `registerHebergeur`) :
- l'organisation est résolue **par la DONNÉE, plus par le chemin** : (1) SIRET saisi → dédup SIREN ; (2) sinon membership VALIDE **le plus ancien** (`orderBy claimValidatedAt asc`) ; (3) sinon dédup textuelle / création ;
- `claimStatut` dérivé de la **relation user × organisation résolue** (et non du chemin) ;
- `try/catch` avaleur supprimé → rollback complet ; mapping P2002/P2000 ; email admin via `process.env.ADMIN_EMAIL`.

**Contrôle prod** : **0 centre PENDING en base** → aucun rattrapage. Corollaire : le parcours « ajouter un centre » **n'a jamais servi en production** — le premier vrai utilisateur aurait tout découvert à notre place.

⚠️ **`claimFromCatalogue` porte le MÊME défaut** (membership VALIDE prime sur toute autre résolution, `findFirst` sans `orderBy` → organisation arbitraire si double membership). **NON TOUCHÉ volontairement** : c'est le chemin que Louise emprunte pour Chambéret cette semaine. → **à traiter dans un lot dédié, après recette.**

---

**Analyse d'origine (13/07), conservée pour mémoire :**

`centre.service.ts:295-297` : le `try/catch` autour de `findOrCreateOrganisation` fait `console.error` **puis continue**. C'est exactement le pattern qu'on vient de supprimer de `registerHebergeur` (chantier atomicité du 13/07).

Conséquence : un hébergeur existant qui ajoute un centre peut se retrouver avec un **centre orphelin sans organisation ni membership**. Il n'est pas détruit (le compte existe déjà), mais son centre est dans un état bâtard. Le cas est déjà couvert côté UX par l'endpoint (B) `upload-justificatif`, qui n'exige aucune organisation — mais la donnée reste sale.

**Fix** : même traitement que `registerHebergeur` — transaction interactive `centre.create` + `findOrCreateOrganisation` + `centre.update(organisationId)` + `findOrCreateMembership`. Les helpers acceptent déjà `Prisma.TransactionClient` (fait le 13/07).

### 2. Trois implémentations divergentes du workflow admin de validation

| Source | Méthodes | Exposé par | Règle |
|---|---|---|---|
| `claim.service.ts` | `getClaimsEnAttente`, `validerClaim`, `refuserClaim` | `/admin/claims/*` | **strict** : `validerClaim` refuse `EN_ATTENTE_DOCUMENT` |
| `centre.service.ts` | `getClaimsPending`, `validateClaim`, `getCentresPending`, `validateCentrePending` | `/centres/admin/*` | **permissif** : accepte `EN_ATTENTE_DOCUMENT` |
| `admin.service.ts` | `getCentresPending` (3ᵉ version), `activerCentre` | `/admin/centres/*` | filtre sur `organisation.memberships.some(VALIDE)` |

⚠️ **« CORRECTION 14/07 » — RÉTRACTÉE LE MÊME JOUR. LA ROADMAP AVAIT RAISON, PAS MOI.**

J'ai écrit ici, le 14/07 au matin, que l'affirmation ci-dessus était « FAUSSE », après avoir lu **un seul** des deux écrans admin (`/dashboard/admin/claims`). Je n'avais **jamais lu** `/dashboard/admin/page.tsx`. Claude Code a refusé d'exécuter le lot 3 et a fourni le grep : le dashboard admin PRINCIPAL consommait bien `/centres/admin/*`, via deux onglets entiers (`claims-centres`, `centres-pending`) et 4 helpers de `lib/admin.ts`. **L'affirmation d'origine était exacte.**

→ **Leçon** : une lecture partielle produit une correction fausse, qui corrompt la source de vérité elle-même. Ne jamais « corriger » un doc sans avoir lu **tous** les appelants.

---

## ✅ RÉSOLU 14/07/2026 (après-midi) — UNIFICATION SUR L'ÉCRAN STRICT

**Le problème réel n'était pas « du code mort » : c'était DEUX ÉCRANS ADMIN divergents.**

| | `/dashboard/admin` (principal) | `/dashboard/admin/claims` (sous-page) |
|---|---|---|
| Routes | `/centres/admin/*` (centre.service) | `/admin/*` (claim.service + admin.service) |
| Valider un claim | **PERMISSIF** : accepte `EN_ATTENTE_DOCUMENT` → **validation SANS justificatif** ; `updateMany({ userId, statut: PENDING })` → active **tous** les centres du user, **toutes organisations confondues** | **STRICT** : bouton désactivé tant que le justificatif manque ; limité à l'organisation du membership |

Le justificatif est la **seule barrière anti-usurpation** (revendiquer le centre d'un tiers). L'écran principal permettait de la contourner, sans trace ni avertissement.

**Décision Théo** : un seul écran, le strict. Il confirme n'avoir **jamais** validé de claim sans justificatif → aucune capacité à préserver.

**⚠️ Proposition de CC REFUSÉE** : il suggérait d'« assouplir `claim.service.validerClaim` » pour qu'il accepte `EN_ATTENTE_DOCUMENT` et préserve le comportement existant. **NON** — ce refus n'est pas un bug, c'est le contrôle de sécurité. L'assouplir aurait rouvert le trou fermé cette semaine.

**Livré (3 commits, poussés, recettés en prod) :**
- `3df072c` — **additif** : `admin.service.refuserCentre(centreId, motif?)` + `PATCH /admin/centres/:id/refuser`. **Fix au passage** : le refus d'un centre était **totalement SILENCIEUX** (`validateCentrePending` passait le centre en SUSPENDED sans aucun email). L'hébergeur était bloqué sans savoir pourquoi. Désormais : email motivé, calqué sur `claim.service.refuserClaim`.
- `c1e2dde` — **frontend** : `handleRefuserCentre` aligné sur `handleRefuser` (prompt motif) et rebranché sur la nouvelle route ; **suppression des 2 onglets permissifs** du dashboard principal (~320 lignes) ; remplacés par une carte « N dossier(s) à valider → » (compteur = `/admin/claims` + `/admin/centres/pending`) ; 4 helpers + 2 types supprimés de `lib/admin.ts`.
- `8267482` — **suppression backend** : les 4 routes `/centres/admin/*` et les 4 méthodes de `centre.service` (`getClaimsPending`, `validateClaim`, `getCentresPending`, `validateCentrePending`). **Les routes sont supprimées CÔTÉ SERVEUR**, pas seulement masquées dans l'UI → la surface qui permettait de contourner le justificatif n'existe plus du tout.

⚠️ **PIÈGE — HOMONYMIE** : `admin.service.getCentresPending` porte le **même nom** que la méthode supprimée de `centre.service`, mais c'est une **autre méthode, bien vivante** (consommée par l'écran strict et par le harness d'intégration). À ne jamais confondre.

**Recette prod (14/07, 17h43)** : centre `RECETTE 14-07` créé **sans SIRET** → rattaché à **Chalet Le Sauvageon** (organisation existante, **pas** d'organisation fantôme) → visible dans l'admin → refusé avec motif « TEST » → **email reçu avec le motif**. Les deux fixes de la journée validés d'un coup.

---

**Analyse d'origine (13/07), conservée :**

Différences réelles entre `centreService.validateClaim` et `claimService.validerClaim` : la première ne touche ni `compteValide`, ni `emailVerifie`, ni `isPrimary`, **n'envoie aucun email à l'hébergeur**, et active *tous* les centres PENDING du user (toutes orgs) là où l'autre se limite à l'organisation du membership.

⚠️ Les deux `getCentresPending` (centre.service vs admin.service) **ne renvoient pas la même liste** — c'est pour ça que certains centres apparaissent dans un onglet et pas dans l'autre.

**Décision prise (non exécutée)** : `claim.service` devient la source unique. Ordre impératif : (1) assouplir `claimService.validerClaim` pour accepter `EN_ATTENTE_DOCUMENT` sur action admin explicite — **sinon on supprime la seule capacité de débloquer un hébergeur ex-nihilo** ; (2) rebrancher `/centres/admin/*` en préservant URLs **et** shapes de réponse (le dashboard admin ne doit pas bouger) ; (3) supprimer les méthodes de `centre.service`. Ne jamais inverser cet ordre.

### 3. Node 20 en fin de vie — le build va casser

Le buildpack Scalingo avertit à chaque déploiement :

> *Node.js 20.20.2 is now End-of-Life (EOL). […] In a future buildpack release, this warning will become a build error.*

`frontend/package.json` → `"engines": { "node": "20.x" }`. Le jour où le buildpack durcit, **plus aucun déploiement ne passe**. À planifier avant que ça n'arrive en pleine urgence — vérifier la compat Next 16 / NestJS 11 / Prisma avant de bumper.

---

## ✅ RÉSOLU 14/07/2026 — TRIAL 30J (ex-🟠, identifié 13/07)

**RÉSOLU par `0a23953`** — et le problème était plus large que décrit ci-dessous : il n'y avait pas *un* déclenchement fautif, mais **4 comportements divergents** selon le chemin d'activation :

| Chemin | Avant | Après |
|---|---|---|
| `auth.login` | Pilotage 30j, **sans regarder `centre.statut`** | source unique, **garde `statut ACTIVE`** |
| `admin.validerHebergeur` | **COMPLET** 30j, **sans `trialStartedAt`** (invisible du cron) | source unique |
| `claim.validerClaim` | **aucun essai** | source unique |
| `admin.activerCentre` | **aucun essai** | source unique |

**Fix à la source** : `demarrerOuAlignerTrial(prisma, email, userId)` dans `trial.helper.ts` (fonction pure, `email` typé structurellement → aucun cycle de module), appelée aux 4 sites. Politique validée :
- compte payant (mandat Mollie **ou** `modePaiement VIREMENT`) → aucun essai ;
- abonnement offert / manuel (ACTIF sans trial ni mandat — Sauvageon, Alticlub, Pôle Montagne) → aucun essai ;
- **essai en cours → ALIGNEMENT** du nouveau centre sur la même date de fin (jamais de prolongation) ;
- **essai expiré → le centre suivant est payant** (décision Théo) ;
- sinon → Pilotage 30j.

**Cascade évitée** : sans l'alignement, la revendication du 2e centre de Louise (Chambéret) aurait ouvert un **2e essai** à une date différente de Valloire (08/08). L'essai serait devenu **renouvelable à l'infini** en revendiquant un centre de plus.

**Ni l'option A ni l'option B ci-dessous n'ont été retenues** — les deux traitaient le symptôme sur un seul chemin. Analyse d'origine conservée ci-dessous pour mémoire.

---

**Symptôme (analyse du 13/07)** : le trial 30j Pilotage s'active au **premier login**, alors que le centre est encore `PENDING` et le claim en `EN_ATTENTE_DOCUMENT`. L'hébergeur voit son essai gratuit s'écouler **sans pouvoir rien faire** — `envoisBloques` reste `true` tant que le centre n'est pas `ACTIVE` : ni devis, ni email externe.

**Constaté en recette prod (13/07)** : compte `recette-exnihilo-13-07` — inscription 14h51, **trial démarré 14h54** (email « Nouveau trial », expiration 12/08), justificatif déposé 14h55, claim validé ~15h30. Entre 14h54 et 15h30, le compte à rebours tourne dans le vide. Sur un vrai prospect validé le lundi après une inscription du vendredi soir, c'est **10 % de l'essai perdu** sans avoir touché au produit. Jamais validé → 100 % perdu, sans que le prospect comprenne pourquoi.

**Cause on-code** : `AuthService.activerTrialPremiereConnexion()` (`auth.service.ts`) filtre sur `trialStartedAt: null`, `mollieMandatId: null`, `abonnementStatut: INACTIF`. **Aucune condition sur `centre.statut`.** Un centre `PENDING` déclenche donc son trial au premier login.

**Non détecté avant** : tous les hébergeurs existants (Sauvageon, Choucas, Pôle Montagne, Louise/PULSE) ont été activés à la main, hors du parcours nominal. Le premier ex-nihilo réel sera le premier à le subir.

**Deux options, à trancher à froid** :
- **A. Démarrer le trial à l'activation du centre** (`claim.service.validerClaim` / `admin.service.activerCentre`) plutôt qu'au login. Le plus juste métier. ⚠️ Vérifier d'abord qu'aucun autre chemin ne dépend du déclenchement au login (magic link, refresh token, invitation).
- **B. Ajouter `statut: 'ACTIVE'` au `where` de `activerTrialPremiereConnexion`.** Une ligne. Le trial démarre au premier login **après** activation. Moins élégant (le trial peut ne jamais démarrer si l'hébergeur ne se reconnecte pas), mais quasi sans risque de régression.

**Priorité** : à traiter avant le premier vrai self-signup hébergeur. Pas de client impacté aujourd'hui.

---

## ✅ RECETTE — lots du 14/07 : BACKEND PROUVÉ + PROD VALIDÉE À LA MAIN

**✅ 1. Recette backend automatisée — T1→T7 TOUS VERTS** (harness `backend/scripts/integration-trial-centres.mjs`, commit `8b1f764`).
Postgres 16 **jetable** en Docker (le harness refuse de démarrer si `DATABASE_URL` ne pointe pas la base jetable), schéma via `prisma db push`, **vrais** `CentreService`/`AdminService`/`ClaimService` consommés depuis `dist/`, vraies contraintes SQL. Seul `EmailService` mocké. Container détruit après run.

| Test | Résultat |
|---|---|
| T1 `createCentre` sans SIRET | ✅ centre PENDING rattaché à l'organisation existante ; **aucune org neuve** ; membership VALIDE intact ; aucun essai |
| T2 visibilité admin | ✅ sort dans **`/admin/centres/pending`** |
| T3 activation + alignement | ✅ `trialStartedAt` et `abonnementActifJusquAu` **identiques** au centre existant ; **aucune prolongation** ; aucun essai 30j ouvert |
| T4 essai expiré | ✅ centre ACTIVE **sans essai** (DECOUVERTE / INACTIF) |
| T5 gardes clients | ✅ Mollie / VIREMENT (Choucas) / abonnement offert (Sauvageon) → **aucun essai** posé |
| T6 seconde société | ✅ SIREN différent → organisation **distincte** + `EN_ATTENTE_DOCUMENT` |
| T7 atomicité | ✅ P2000 en transaction → **0 org, 0 centre, 0 membership** : rollback total |

⚠️ **Lecture honnête de T4** : « payant » signifie en réalité **`DECOUVERTE` / `INACTIF`** — le plan gratuit bridé, **pas** une facturation. **Rien ne dit à l'hébergeur qu'il doit souscrire.** À requalifier au premier cas réel.
→ Le harness dépend du `dist/` (build préalable obligatoire) → candidat item **4.8 CI minimale**.

**✅ 2. Recette manuelle prod — FAITE le 14/07 à 17h43**
Centre `RECETTE 14-07` créé depuis l'UI hébergeur, **SIRET laissé VIDE** :
- → rattaché à **« Organisation : Chalet Le Sauvageon »** (affiché à l'écran) — **aucune organisation fantôme** ✅
- → **visible** dans `/dashboard/admin/claims` → section « Nouveaux centres à valider » ✅ *(avant ce matin : invisible, donc jamais activable)*
- → **Refuser** + motif « TEST » → **email reçu avec le motif** ✅ *(avant cet après-midi : refus totalement silencieux)*
- → carte « Dossiers à valider → » du dashboard principal fonctionnelle ✅

**❌ Reste à faire :**
1. **Purger `RECETTE 14-07`** (centre en SUSPENDED, invisible partout, sans impact — mais à nettoyer) :
   `BEGIN; SELECT id, nom, statut FROM centres_hebergement WHERE nom = 'RECETTE 14-07'; DELETE FROM centres_hebergement WHERE nom = 'RECETTE 14-07'; COMMIT;`
   ⚠️ **NE PAS** toucher au membership ni à l'organisation (ceux de Sauvageon).
2. **Purge S3** : objets `kbis/` de la recette ex-nihilo du 13/07 (bucket `liavo-uploads`).
3. **🔴 `scalingo pgsql-console` ne s'ouvre plus** (voir bloc dédié ci-dessous).

---

## ✅ RÉSOLU 16/07/2026 — ACCÈS SQL PROD (c'était la CLI périmée)

**Cause réelle** : CLI Scalingo **1.44.1 périmée** → `db-tunnel` figeait silencieusement. **Fix** : mise à jour 1.47.0 (réinstall manuelle cli.scalingo.com). Tunnel OK, `SELECT now()` validé en prod le 16/07.

**Ni** la box pro du bureau (test 4G négatif), **ni** psql/PATH (17.9 OK), **ni** la clé SSH `id_rsa`. La note du 14/07 « pgsql-console fonctionne (pipe stdin) » était **fausse depuis PowerShell**.

**Procédure réutilisable** (2 fenêtres : `db-tunnel` + `$env:PGPASSWORD` puis `psql -h 127.0.0.1 -p 10000 -U liavo_backe_8243 …`) → détaillée dans SESSION_STATE 16/07.

⚠️ **Reste** : régénérer le mot de passe DB (il a circulé pendant le debug) — dashboard → PostgreSQL → Settings → Reset password.

<details>
<summary>Ancien diagnostic (14/07) — conservé pour archive</summary>

## 🔴 ACCÈS SQL PROD CASSÉ (14/07) — non résolu

**Symptôme** : `scalingo -a liavo-backend pgsql-console` et `db-tunnel` ne renvoient **RIEN** (aucune sortie, aucune erreur). `echo`, `psql --version` et `scalingo login --api-token` fonctionnent.

**Point commun des commandes qui échouent** : elles doivent **contacter le réseau / ouvrir un tunnel SSH**. Celles qui rendent la main immédiatement fonctionnent.

**Cause éliminée** : `psql` était absent du PATH → **corrigé en dur** (PATH utilisateur + `C:\Program Files\PostgreSQL\17\bin`). `psql --version` → 17.9 ✅. **Le problème persiste**.

**Pistes non instruites** : CLI Scalingo en **1.44.1** (warning « out-of-date, update to 1.47.0 » à chaque commande) — la plus probable ; clé SSH `id_ed25519` / agent SSH ; port 22 sortant bloqué ; proxy / antivirus.

**Contournement connu** : la console SQL est aussi accessible **depuis le dashboard Scalingo** (app → Addons → PostgreSQL), sans terminal ni tunnel.

**Bloquant à terme** : tout SQL prod passe par là (rattrapages, backfills, purges).

</details>

---

## 🟠 CONTRE-TEST EN ATTENTE — multi-centre sur les exports (à passer au 2e centre de Louise)

**Contexte** : le 12/07, les 3 exports de Pilotage → Comptabilité (CSV factures, CSV versements, ZIP PDF) sont passés de `<a href download>` à axios, ce qui rétablit l'envoi du header `X-Centre-Id`. **Avant ce fix, tout hébergeur multi-centre exportait TOUJOURS son premier centre, silencieusement** (Pôle Montagne = 2 centres actifs).

**Ce qui est prouvé** : `localStorage['liavo-centre-actif']` est bien renseigné (même en mono-centre) et l'interceptor axios pose le header → le maillon cassé est refait. **Ce qui ne l'est pas** : le changement effectif de contenu quand on bascule de centre — impossible à tester sur Sauvageon (mono-centre : le fallback « premier centre possédé » donne le bon résultat par accident, le test serait aveugle).

**→ Dès que le 2e centre de Louise (Chambéret / Corrèze) existe** : basculer de centre via le `CentreSelector`, relancer les 3 exports, **vérifier que le contenu change**. Si non, le fix n'a pas pris. Ne pas laisser une cliente le découvrir à notre place.

---

## 0. État du produit au 18/06/2026

### Ce qui est en production et fonctionne

**Cœur produit (~90% livré)** : flow séjour DIRECT complet (création → devis → signature → facturation acompte/solde/avoir → envoi email PDF), flow COLLABORATIF (invitation → acceptation → espace partagé), facturation Factur-X EN 16931, arrondi TTC-first systémique, ajustement devis post-acompte, CRM hébergeur (pipeline dérivé automatique du devis le plus avancé, contacts, rappels, activités, kanban), planning couleurs par statut (5 états PMS), page liste séjours avec filtres/recherche/badges non-lus, module rentabilité (factures prestataires, ventilation par séjour, marges), page équipe/collaborateurs (permissions par module), dashboard global multi-centre, dashboard réseau (KPIs, scoring, invitation), import APIDAE (81 LMDJ + 54 IDDJ), catalogue public, landing page, autorisations parentales, journal séjour parents, page abonnement (frontend, non connectée au PSP).

**Architecture UX séjour (~70% livré)** : 4 composants extraits (SejourHeader, TabDevisFacturation, TabNotes, TabParticipantsSaisieDirecte), migrations schema faites (notesInternes sur Sejour, sejourId sur Rappel et ActiviteClient), page liste séjours livrée.

**Infra** : Scalingo Paris (2×M + PG Starter 512M = ~36€ HT/mois), OVH Object Storage Gravelines, Brevo FR, DNS OVH. Stable.

### Ce qui ne fonctionne PAS encore

- **Sécurité** : LOT 0 fait (trust proxy + throttle). LOTs 1 à 5 = 0 ligne de code. IDOR critiques ouverts.
- **Monétisation** : 0€ de revenu. Pas de PSP, pas de gating, pas de PlanGuard. Enum PlanAbonnement manque PILOTAGE.
- **Intégrations** : aucune (pas d'iCal, pas d'export CSV, pas de webhooks, pas de Chorus Pro service).
- **Notifications** : l'hébergeur ne reçoit pas de notification quand l'organisateur poste un message collab.
- **Labels** : termes scolaires encore présents dans le body de page.tsx séjour (TIER1 Ch.4 non terminé).

### Données production

- ~63 séjours/événements (Sauvageon)
- ~40 factures émises
- 1er client signé hors Sauvageon : Les Choucas (2 mois gratuits, plan Complet)
- 3 centres Pôle Montagne actifs (trial 6 mois)
- 81 centres LMDJ importés, 54 centres IDDJ importés
- Compte démo réseau : `demo-lmdj@liavo.fr` / `LMDJ2026!`

### Échéances

| Date | Événement |
|---|---|
| 30/06/2026 | CA LMDJ — Marie porte le dossier LIAVO |
| 01/09/2026 | Obligation réception e-invoicing (toutes entreprises) |
| ~Sept 2026 | Potentiel démarrage pilote LMDJ (si accord CA) |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU |
| 01/09/2027 | Obligation émission e-invoicing (PME) |

---

## 1. Priorités P0 — Bloquant adoption (faire IMMÉDIATEMENT)

### 1.1 ~~Notif hébergeur messages collaboratifs~~ — ✅ LIVRÉ

### 1.2 ~~LOT 1 sécurité — IDOR ownership helper~~ — ✅ LIVRÉ

### 1.3 ~~LOT 3 sécurité — Storage privé + URL signées~~ — ✅ LIVRÉ

**Total P0 : TERMINÉ.**

---

## 2. Priorités P1 — Forte valeur (semaines 2-4, avant ou juste après CA LMDJ)

### 2.1 ~~LOT 2 sécurité — Auth hardening JWT refresh~~ — ✅ LIVRÉ

### 2.2 ~~Migration enum PILOTAGE~~ — ✅ LIVRÉ

### 2.3 ~~PSP Mollie SEPA~~ — ✅ LIVRÉ (mode live, webhook validé, première échéance Choucas ~17/07)

### 2.7 ~~Refonte planning ↔ groupes many-to-many~~ — ✅ LIVRÉ (07/07)

Table de jointure `PlanningActiviteGroupe`, refonte `genererPlanningIA` (1 activité par cluster au lieu de N), UI multi-select dans TabPlanning, PDF adapté. Anne (Choucas) et Yves (Pôle Montagne) peuvent maintenant construire leurs plannings 6 mois avant les inscriptions, avec activités rattachées à plusieurs groupes (ex: "Escalade Groupe 1 + Groupe 3"). Voir SESSION_STATE 07/07 + `docs/audit-planning-cascade.md`.

### 2.4 TIER1 Ch.4 — Labels universels — ~1j (amorcé)

**PARTIEL.** Amorce 08/07 : 2 libellés scolaires neutralisés dans `PricingTable.tsx` (« Signature électronique directeur » → « en ligne », « Espace collaboratif hébergeur + enseignant » → « partagé »). **Reste** : les termes scolaires dans le body de `sejour/[id]/page.tsx` en contexte EVENEMENT.

### 2.5 ~~Export CSV factures~~ — ✅ LIVRÉ (Comptabilité dans module Pilotage, BOM UTF-8)

### 2.8 ~~Export ZIP des factures PDF~~ — ✅ LIVRÉ (12/07)

`GET /pilotage/export/factures-pdf[/preview]` (`@RequirePlan('COMPLET', strict)`). ZIP des PDF Factur-X déjà stockés sur OVH + `_factures.csv` en index + `_PDF_MANQUANTS.txt` si des PDF manquent (deux causes distinguées : jamais généré / introuvable au fetch). `StorageService.zipFromUrls()` **générique** (`{nom, url}`) — l'extension aux **factures prestataires** (`FacturePrestataire.fichierUrl`, le comptable veut les achats autant que les ventes) coûtera ~30 lignes. **Zéro dépendance ajoutée** (`pizzip` déjà présent), compression STORE, fetch par lots de 5, plafond dur 300 factures.

**Effets de bord assumés** : les **avoirs** sont désormais inclus dans l'export CSV factures (un avoir est une pièce comptable — son exclusion rendait le CSV faux) + **colonne `Type`** ajoutée. Les 3 exports passent par axios (fix multi-centre, cf. bloc 🟠 ci-dessus).

**Recette prod** : Sauvageon 62 factures / 62 PDF, ZIP ~10 s. **Non recetté en prod** : les avoirs (0 en base) → couverts par tests unitaires uniquement, à revérifier au premier avoir émis.

### 2.6 LOT 4a — Cookie httpOnly — EN PAUSE

Reverté. Root cause : axios 1.13.6 + turbopack fetch adapter ne forward pas `credentials: 'include'` cross-origin. Solution recommandée : Next.js rewrites. Helmet livré.

**Total P1 restant : 2.4 labels (~1j) + 2.6 httpOnly (~1j quand Next.js rewrites en place).**

---

## 3. Priorités P2 — Nice to have (juillet-août)

| # | Chantier | Effort | Trigger |
|---|---|---|---|
| 3.1 | ~~LOT 5 — Purge IBAN git~~ | ✅ | LIVRÉ |
| 3.2 | Refonte page Devis envoyés (tableau filtrable/triable) | 2-3j | Quand 100+ devis en base |
| 3.3 | Flux iCal lecture seule (`GET /centres/:id/calendar.ics`) | 0.5j | 1er hébergeur qui demande |
| 3.4 | SC7 — Notif centres APIDAE non inscrits | 2-3h | Après validation commerciale LMDJ |
| 3.5 | Concept Réponse PDF (adhérents LMDJ Découverte) | 1j | Si accord CA LMDJ |
| 3.6 | Fix "dont X€ via réseau" (mauvais fichier global→hebergeur) | 0.5j | Quick fix |
| 3.7 | Intégration APIDAE LMDJ (1 ligne dans syncApidae) | 15min | Quand credentials Amandine reçus |
| 3.8 | SSO APIDAE OAuth2 | 0.5j | Quand credentials APIDAE Connect reçus |
| 3.9 | Onboarding première connexion (flag premiereConnexion) | 1-2j | Avant ouverture grand public |
| 3.10 | ~~Responsive mobile~~ | 1 nuit + fixes | — | ✅ LIVRÉ (Fable 5 overnight, drawer mobile, planning responsive, sweep ~60 pages, déployé 03/07) |
| 3.11 | Multi-photos catalogue centre (galerie fiche) | 1-2j | Remonté par Louise/PULSE 16/07. Aujourd'hui `CentreHebergement.imageUrl` = **une seule** photo (pas de table `photos_centre`, pas de champ tableau) → fiche pauvre pour un organisateur qui compare. Option reco = champ `imagesUrls String[]` (`imageUrl` reste la couverture, rétrocompatible, 1 seul ALTER). Candidat Fable 5 overnight. Stopgap zéro-dev à dire au client : mettre les photos dans la **brochure PDF** de la fiche (`brochureUrl` existe). |

---

## 4. Priorités P3 — Dette technique (selon trigger)

| # | Chantier | Effort | Trigger | Statut |
|---|---|---|---|---|
| 4.1 | ~~Modules devis partagés~~ | 1 nuit | — | ✅ LIVRÉ (3 modules extraits : devis-calculs.ts, useDevisLignes.ts, DevisEditor.tsx — 949 ins / 982 del, delta -33 lignes). Les 3 fichiers DevisBuilder restent séparés mais partagent la logique commune. Merge complet → quand prochaine modif devis. |
| 4.2 | ~~DashboardShell unification~~ | 1 nuit | — | ✅ LIVRÉ (HebergeurShell + TopBarShell, dashboard/layout.tsx routeur de shell, 11 commits + 1 fix). Suivi : double bandeau sous-pages organisateur/admin à nettoyer. |
| 4.3 | ~~Découper page.tsx séjour~~ | 1 nuit | — | ✅ LIVRÉ (194KB → 20KB, -86%, 9 composants extraits : TabMessages, TabPlanning, TabGroupes, TabDocuments, TabBudget, TabProjetPedagogique, TabJournal, TabParticipantsCollab, InviteOrganisateurCard). |
| 4.4 | LOT 6 maintenance continue (logs, HTML injection emails, omit Prisma) | Au fil de l'eau | Quand on touche les fichiers | |
| 4.5 | Double bandeau sous-pages organisateur/admin | 0.5-1j | Quand on touche ces sous-pages | Suivi Run 3 DashboardShell |
| 4.6 | ~~escapeHtml notifications.service.ts + collaboration.service.ts~~ | 30min | — | ✅ LIVRÉ (constaté 08/07 : `utils/escape-html.ts` consommé par notifications, collaboration, devis et email.service). Reliquat : supprimer la branche locale `fix/escape-html-emails`. |
| 4.7 | Migration Float→Decimal montants devis/factures | 1-2j | **Audit prod à exécuter** (décision 08/07 : audit seul, sans migrer) | ◐ Étape 1 prête : `docs/AUDIT_FLOAT_DECIMAL.md` (requêtes de contrôle prod lecture seule Q1-Q5 + grille de lecture). Théo exécute en pgsql-console, colle les résultats → décision de migration sur le rapport d'écarts. Coût réel = code (Prisma.Decimal ≠ number). **NE PAS faire en Fable 5 overnight** — données prod en jeu. |
| 4.8 | CI minimale GitHub Actions (tsc + build) | 0.5j | Post-pitch | Diagnostic Fable 5. Actuellement zéro CI, gate = discipline manuelle. Candidat Fable 5 overnight. |
| 4.9 | Tests unitaires code financier (devis-calculs.ts, SequenceService, formule acompte) | 1-2j | Post-pitch | ◐ PARTIEL (08/07) : SequenceService couvert par la suite invariants (13 tests, scopes/monotonie/apercu/P2002) + PlanGuard, centre.helper, trial login, cron alertes — 136 tests backend au total. Reste : devis-calculs.ts (frontend, pas de harness Jest côté front) + formule acompte. |
| 4.10 | ~~Supprimer jspdf (dépendance morte, 0 import)~~ | 5min | — | ✅ FAIT (constaté 08/07 : absent des package.json frontend et backend). |
| 4.11 | ~~npm audit fix ciblé + décision xlsx~~ | 1h | — | ✅ FAIT (08/07) : 13 vulns → 3. `npm audit fix` (axios & co patchés), next 16.1.6→16.2.10 (advisories middleware/cache), `@types/react-pdf` supprimé (dépendance morte, 0 import, portait toute la chaîne pdfjs-dist vulnérable). Résiduel assumé : **xlsx (haute) = risque ACCEPTÉ** (décision Théo 08/07 — parsing limité aux fichiers de l'hébergeur authentifié sur ses propres données) ; postcss (2 modérées) = vendored dans Next, non actionnable sans casser (upstream). |
| 4.12 | ~~Extraction helpers partagés frontend (StatutBadge ×4, KpiCard ×3, formatDate ×35 redéfinitions)~~ | 1 nuit | — | ✅ LIVRÉ (16/07, Fable 5 overnight, **poussé**). 31 définitions dédupliquées, net −55 lignes : formatDate 25/25 → `src/lib/utils.ts` (`formatDate(date, style, fallback?)`, `style` OBLIGATOIRE = pas de défaut silencieux), KpiCard 2/3 → `src/components/KpiCard.tsx`, StatutBadge 4/4 → `src/components/StatutBadge.tsx` (mappings conservés aux sites d'appel). tsc + build verts par famille. Recensement + exceptions : `docs/refacto-helpers-4.12.md`. Sous-fusion assumée (signer T12:00:00 timezone, pilotage/ca KpiCard, ~55 inline JSX, PDF) — exceptions motivées. **2 dettes révélées → 4.22 et 4.23.** |
| 4.22 | Quirk `accent` hex sur KpiCard admin (couleur non appliquée) | 15min | Cosmétique, quand on touche le dashboard admin | Révélé par 4.12. `app/dashboard/admin/page.tsx` passe `accent="#C87D2E"` (couleur hex) là où `KpiCard.accent` attend une **classe CSS** → classe invalide ignorée → la carte censée être ocre s'affiche en gris/noir par défaut. **Pas une régression** (bug préexistant, préservé tel quel par la dédup pure). Fix : soit corriger l'appelant (classe Tailwind au lieu du hex), soit rendre `accent` tolérant au hex (via `style`). |
| 4.23 | Double format de période réseau vs organisateur/hébergeur | 30min | Si besoin d'uniformité visuelle | Révélé par 4.12. `demandePeriode` (`app/dashboard/reseau/page.tsx:26`) et `afficherDatesDemande` (organisateur/hébergeur) produisent des libellés de période légèrement différents (« Janv » vs « Jan », séparateurs, emoji 📅 absent côté réseau, pas de `noteDateFlexible`). Volontairement NON fusionnés par 4.12 (doute → pas de risque). À unifier seulement si l'incohérence visuelle gêne. |
| 4.13 | ~~Extraction DEPT_TO_REGION + statuts devis constants backend~~ | 0.5j | — | ✅ LIVRÉ (16/07, Fable 5 overnight, **poussé**). 3 familles : **Sets statuts devis** 16 littéraux → 3 constantes (`STATUTS_DEVIS_RETENUS` ×9, `STATUTS_DEVIS_ENGAGEANTS` ×5, `STATUTS_DEVIS_EN_COURS` ×2) dans `src/devis/devis-statuts.constants.ts`, composition prouvée identique ; **durée trial** `TRIAL_DUREE_JOURS = 30` dans `trial.helper.ts` (littéral seul, les 2 calculs d'expiration restent distincts) ; **DEPT_TO_REGION** 1/4 copies seulement (voir 4.24). tsc + build + **187 tests** verts par famille (la suite a grandi : 187 + 3 todo, pas 136). Recensement + preuves : `docs/refacto-constantes-4.13.md`. Sous-fusion prudente (modifiables/annulables gardés séparés, faux positifs 30 écartés). **2 suites → 4.24 et 4.25.** |
| 4.24 | Convergence DEPT_TO_REGION Corse/DOM (matching région) | 0.5j | **Décision métier** — avant push national LMDJ/IDDJ | Révélé par 4.13. `public.service.ts` (−Corse −DOM) et `sejour.service.ts` (−DOM) ont une table DEPT_TO_REGION **incomplète** → un centre corse/DOM peut **ne pas être notifié** des demandes ciblées sur sa région. Probablement un **oubli, pas un choix**. NON corrigé par 4.13 (dedup pure ≠ changement de comportement). Impact aujourd'hui **nul** (aucun centre Corse/DOM), mais **trou à combler avant tout réseau national**. Fix = pointer les 2 services sur la table complète centralisée. À arbitrer par Théo. |
| 4.25 | ~~§4.13-bis : dédup Sets de StatutSejour~~ | 15min | — | ✅ LIVRÉ (16/07, Fable 5 overnight, **poussé**). 7 littéraux → **3 constantes** dans `src/sejours/sejour-statuts.constants.ts` : `STATUTS_SEJOUR_CONFIRMES` (CONVENTION, SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM — pilotage ×3 + centre), `STATUTS_SEJOUR_COLLABORATIFS` (CONVENTION, SIGNE_DIRECTION — collaboration ×3), `STATUTS_SEJOUR_DIRECT` (OPTION + COLLABORATIFS, dérivée par spread préservée — collaboration ×2). Le run a trouvé une **3ᵉ composition** non anticipée au recensement §4.13 (DIRECT). tsc + build + 187 tests verts par composition. Sous-fusion prudente (SUBMITTED+CONVENTION+SIGNE_DIRECTION de la rétrogradation, `notIn:['DRAFT']` gardés séparés). Preuves : `docs/refacto-statuts-sejour-4.25.md`. |
| 4.14 | IBAN endpoint public getDevisPublicByToken | — | **Décision : ne pas fixer** | Diagnostic Fable 5. centre.iban exposé via GET /devis/public/:token (sans JWT). Décision 03/07 : le token UUID v4 EST l'auth, l'IBAN est nécessaire pour le PDF devis côté client, le retirer casserait DevisPDFButton sur la page de signature. Risque réel = faible (token indevinable). Le vrai fix IBAN = chiffrement en base (backlog existant). |
| 4.15 | ~~Erreurs `Failed to find Server Action` à chaque deploy~~ | 0.5j | — | ✅ FAIT (08/07, version non-destructive décidée par Théo) : `global-error.tsx` détecte l'erreur Server Action périmée (best-effort sur le message) et affiche « Une nouvelle version de LIAVO a été déployée » + bouton Recharger — **jamais de reload() automatique**. Les autres erreurs gardent le rendu générique. |
| 4.16 | Upgrade @react-pdf/renderer (dépendance fantôme pako) | 0.5j | Post-pitch | 05/07 : @react-pdf/pdfkit 4.1.0 lib/pdfkit.browser.js importe pako/lib/zlib/* sans déclarer pako. Fix actuel = pin pako@1.0.11 exact en dépendance directe (commit 8a60079). Vérifier si release react-pdf récente déclare pako correctement → retirer le pin. NE PAS passer pako en ^2/^3 (exports field bloque les subpaths). |
| 4.17 | Qté 0 affiche "0" dans PDF devis (lignes option Alticlub) | 15min | Si Alticlub s'en plaint | Workaround option = ligne qty 0 avec PU TTC visible (livré 05/07). Résidu cosmétique : "0" et "0,00 €" dans qty/totaux. Fix : afficher "—" quand qty=0 dans DevisPDF/FacturePDF/page signer. 3 lignes × 3 fichiers. |
| 4.19 | `claimFromCatalogue` : résolution d'organisation par le CHEMIN, pas par la DONNÉE | 0.5j | **Après recette du 14/07** | 14/07 : même défaut que `createCentre` (corrigé, cf. 🟡 §1) — le membership VALIDE prime sur toute autre résolution, et le `findFirst` est **sans `orderBy`** → organisation **arbitraire** si l'hébergeur a deux memberships VALIDE. Un hébergeur à deux sociétés verra son centre rattaché à la mauvaise structure. **NON corrigé le 14/07 volontairement** : c'est le chemin que Louise emprunte pour Chambéret cette semaine — pas de modification sans recette. Fix : même ordre que `createCentre` (SIRET → membership VALIDE le plus ancien → dédup). |
| 4.20 | Cron : 2 mails d'alerte le même jour pour un compte multi-centre aligné | 15min | Quand un compte multi-centre atteindra J-21 | 14/07 : l'alignement du trial (`0a23953`) donne la MÊME date de fin à tous les centres d'un compte → le cron enverra une alerte **par centre**. Non bloquant, cosmétique. Fix : grouper les alertes par `userId`. |
| 4.21 | `refreshFacturePdf` régénère le PDF d'une facture **déjà émise** | à arbitrer | — | Dette du 12/07, **reconfirmée le 14/07** : un versement enregistré sur une ancienne facture régénère son PDF **et son XML Factur-X** à partir de l'état courant du code. Le snapshot en base (`emetteur_*`, montants) ne bouge pas → pas de dérive de contenu. Mais **un PDF de facture qui change après émission est douteux** vis-à-vis de l'immuabilité d'une pièce comptable. Question comptable, pas technique. |
| 4.18 | Refonte `regrouperParCreneau` dans journal public | 30min-1h | Si un client se plaint des badges groupes absents dans le journal public | 07/07 : la fonction parse les suffixes de titre ("Escalade — G1") pour afficher les badges groupes. Marchait avec l'ancien schéma (activités dupliquées par groupe, suffixe automatique). Ne marche plus avec la refonte m2m (1 activité par cluster, titre sans suffixe, groupes dans une table de jointure). Impact : dégradation cosmétique du journal public pour les nouveaux plannings. Fix : ajouter `groupes` au select backend `journal-public.controller.ts:39` + refondre `regrouperParCreneau` (page.tsx L89-133) pour lire les groupes structurés. Voir `docs/audit-planning-cascade.md` §C.2. |

---

## 5. Chantiers conditionnels (SI accord CA LMDJ)

Ces chantiers ne sont codés QUE si le CA LMDJ du 30/06 donne un accord de principe.

| # | Chantier | Effort | Source |
|---|---|---|---|
| 5.1 | Validation réseau avant dispatch (statut `EN_VALIDATION_RESEAU`) | 2-3j | Débrief Marie §1 — BLOQUANT pour LMDJ |
| 5.2 | Motif obligatoire refus centre + enseignant | 1j | Débrief Marie §3 |
| 5.3 | Multi-classes (niveauClasse string → string[]) | 0.5j | Débrief Marie §4 |
| 5.4 | Split maternelle/PMI (agrementPMI, filtre findOpen) | 1-1.5j | Débrief Marie §5 |
| 5.5 | Ratio demandes/devis par centre (enrichir KPIs réseau) | 0.5j | Débrief Marie §8 |
| 5.6 | Capture demandes 73/74 hors LMDJ sur dashboard réseau | 0.5-1j | Débrief Marie §2 |
| 5.7 | CRM hébergeurs côté réseau (prospection adhérents) | 2-3j | Débrief Marie §7 |
| 5.8 | Pricing bundlé LMDJ (business decision, pas du code) | — | Débrief Marie §10 |

**Total conditionnel : ~10j si tout est fait. Échelonnable en 3 sprints.**

---

## 6. Chantiers hors scope été (backlog)

Documentés pour mémoire. Ne pas commencer avant PMF.

- ~~Module Pilotage enrichi~~ — ✅ LIVRÉ (CA, remplissage, comparaison N-1, ventilation produit)
- Chorus Pro NestJS service (habilitation AIFE, ChorusProService)
- Webhooks événementiels (1-2j)
- Flow "Transmettre au gestionnaire" facture (token public, 2-3j)
- SC-MULTI-ORGANISATEURS (SejourCollaborateur)
- SC-PDF-DEVIS-EXTERNE (typeDevis UPLOAD_EXTERNE)
- SC-IMPORT-PARTICIPANTS (CSV Pronote)
- Intégration PMS (Mews, Amenitiz) — V2+
- ~~Convention configurable par centre~~ — ✅ LIVRÉ (couverture LIAVO + PDF centre mergé via pdf-lib)
- ~~Contrat événement~~ — ✅ LIVRÉ (guard Sauvageon, contratUrl persisté, exposé client+hébergeur)
- ~~App mobile PWA~~ — Responsive mobile livré 03/07. PWA (manifest + service worker) reste en backlog.
- Marketplace activités
- Appel d'offres transport
- **Grille tarifaire dégressive (besoin Yves/Pôle Montagne, 05/07)** — tarif/élève évoluant selon effectif + gratuités encadrants par palier (cf. fichier Cotation Ste Thérèse : 78 él. = 469€/él. + 6 gratuités → 65 él. = 482€ + 5). Options évaluées : PJ PDF (zéro dev), section grille sur devis (champ structuré + rendu PDF), paliers sur ProduitCatalogue (auto-calcul). Décision 05/07 : reporté, requalifier SI d'autres adhérents LMDJ expriment le besoin. Distinct du besoin "lignes option" Alticlub (résolu autrement).
- Forge française (Gitea OVH) — quand 2e dev ou appel d'offres public

---

## 7. Calendrier cible

```
Semaine 23/06 - 27/06 (avant CA)
├── Jour 1 : TIER1 Ch.1 notif hébergeur (1h) + début LOT 1 IDOR (ownership.helper.ts)
├── Jour 2-3 : LOT 1 IDOR (finir les ~30 call sites + tests)
├── Jour 4-5 : LOT 3 storage privé backend (getSignedUrl, endpoint /files/:key)
│
30/06 ★ CA LMDJ
│
Semaine 30/06 - 04/07
├── LOT 3 storage privé frontend (SecureFile, 14 call sites) + tokens expiration
├── LOT 2 JWT refresh (backend + frontend interceptor)
│
Semaine 07/07 - 11/07
├── Migration PILOTAGE + PSP choix + intégration (3-7j selon PSP)
│
Semaine 14/07 - 18/07
├── PSP fin + PlanGuard + gating frontend
├── Labels universels + export CSV factures
│
Semaine 21/07 - 25/07
├── LOT 4 httpOnly + Helmet
├── Si accord LMDJ : validation réseau (P0 LMDJ)
│
Août
├── P2 au fil de l'eau (iCal, refonte devis envoyés, notif APIDAE)
├── Si LMDJ : chantiers 5.2→5.7
├── LOT 5 purge IBAN
```

---

## 8. Métriques de suivi

| Métrique | Cible fin juillet | Cible fin août |
|---|---|---|
| Findings CRITIQUE restants | 0 | 0 |
| Findings HAUTE restants | ≤ 3 | 0 |
| PSP connecté + 1er paiement test | ✅ | ✅ |
| Centres payants | 1 (Les Choucas) | 3-5 |
| MRR | 49€ | 150-250€ |
| IDOR ownership helper déployé | ✅ | ✅ |
| Storage privé déployé | ✅ | ✅ |

---

## 9. Décisions de référence

| Sujet | Décision | Date |
|---|---|---|
| Grille tarifaire | 0/39/59/79€ HT/mois (Découverte/Essentiel/Complet/Pilotage), remise 17% annuel | 30/06/2026 |
| PSP | Mollie SEPA (EU). Mode live activé. Stripe écarté. | 30/06/2026 |
| CRM pipeline | Dérivé automatique côté frontend, plus de pipeline manuel | 18/06/2026 |
| Sécurité gate dur | LOTs 0-5 TOUS livrés. LOT 6 maintenance au fil de l'eau. | 30/06/2026 |
| Chantiers LMDJ | Conditionnés à l'accord CA 30/06, pas avant | 18/06/2026 |
| Positionnement | LIAVO = infrastructure technique modernisant la centrale, pas remplacement | 10/06/2026 |
| Commission réseau | 10% des abonnements LIAVO dès 2027 | 11/06/2026 |
| IBAN endpoint public | Token UUID v4 = auth suffisante, IBAN nécessaire pour PDF client. Ne pas retirer. Vrai fix = chiffrement en base. | 03/07/2026 |
| Float→Decimal devis | Chantier post-pitch, vérification données prod obligatoire, interdit en Fable 5 overnight | 03/07/2026 |
| TODO abonnement (devis.service:52, sejour.service:981) | Choix commercial conscient : ne pas réactiver tant que flux paiement pas stable (post-17/07 Choucas) | 03/07/2026 |
| Diagnostic dette technique | Source : audit Fable 5 03/07/2026, validé par lecture code MCP. Items intégrés en 4.6–4.14. | 03/07/2026 |
| Lignes option devis (Alticlub) | PAS de champ typeLigne (chantier ~10 fichiers écarté). Solution : ligne qty 0 + colonne PU TTC ajoutée et uniformisée sur DevisPDF, page publique signer, FacturePDF (7 colonnes : Désignation/Qté/PU TTC/TVA%/PU HT/Total HT/Total TTC). PU TTC dérivé du HT stocké, jamais persisté. | 05/07/2026 |
| Build local turbopack (pako) | Root cause : dépendance fantôme pako dans @react-pdf/pdfkit browser build. Fix : pin pako@1.0.11 exact (dépendance directe). 4 boutons PDF restructurés (extraction composant + dynamic import) au passage — amélioration structurelle, pas le fix. Build Scalingo n'a jamais été cassé. | 05/07/2026 |
| Grille tarifaire Yves | Reporté. Découplé du besoin Alticlub. Requalifier si signal d'autres adhérents LMDJ. | 05/07/2026 |
| Planning ↔ groupes m2m | Refonte complète via table de jointure `PlanningActiviteGroupe` (Option A), rejet des Options B (activités dupliquées) et C (array Postgres). `genererPlanningIA` refondu : 1 activité par cluster au lieu de N. Titre simplifié (plus de suffixe " — G1"). Audit exhaustif post-refonte : 0 cascade à fixer. Backfill à 0 confirmé (feature jamais utilisée en prod jusqu'ici). | 07/07/2026 |
| Migration SQL manuelle Prisma | Ne JAMAIS créer de sous-dossier dans `prisma/migrations/` pour autre chose que des migrations Prisma standards (nommage `YYYYMMDDHHMMSS_nom` + fichier `migration.sql`). `prisma migrate deploy` scanne tous les sous-dossiers et plante avec P3015 sinon. Pour les migrations SQL manuelles à référencer dans le repo : `prisma/manual-migrations/` (norme LIAVO) ou `docs/migrations/`. | 07/07/2026 |
| Ordre déploiement SQL + code | Toujours exécuter la migration SQL prod AVANT le push du code correspondant. Sinon fenêtre de risque : le nouveau backend démarre sur une base sans la structure attendue, crash au boot ou au premier `SELECT`. Confirmé 07/07 avec la refonte m2m (crash P3015 pendant ~10 min). | 07/07/2026 |
| xlsx vulnérable (4.11) | Risque ACCEPTÉ, documenté : pas de fix npm, parsing limité aux fichiers uploadés par l'hébergeur authentifié sur ses propres données → exposition réelle faible. Ni migration exceljs ni CDN SheetJS. À requalifier si le parsing s'ouvre à des fichiers tiers. | 08/07/2026 |
| Erreurs deploy Server Actions (4.15) | Version NON-destructive : error boundary (global-error.tsx) détecte l'erreur et propose « Recharger la page » — jamais de reload() automatique (saisie en cours). L'IDDJ n'est pas le trigger, le fix est fait pour lui-même. | 08/07/2026 |
| Float→Decimal (4.7) | Audit d'abord, migration ensuite (ou pas) : requêtes de contrôle prod dans `docs/AUDIT_FLOAT_DECIMAL.md`, décision sur le rapport d'écarts. Jamais en overnight. | 08/07/2026 |
| **Essai gratuit — source unique** | `demarrerOuAlignerTrial` (trial.helper.ts) est le **SEUL** point de démarrage, appelé par les 4 chemins d'activation (login, `validerClaim`, `activerCentre`, `validerHebergeur`). Plus jamais de logique de trial ailleurs. Un centre **PENDING ne consomme jamais** son essai. | 14/07/2026 |
| **Essai multi-centre — alignement** | Un compte = **un** essai. Un nouveau centre s'**aligne** sur la date de fin de l'essai en cours (jamais de prolongation, jamais de 2e essai). Essai **expiré** → le centre suivant est **payant directement**. Empêche l'essai « renouvelable à l'infini » en ajoutant des centres. Le self-service **+14j** (`demander-extension`) reste la seule soupape. | 14/07/2026 |
| **Invariant centre PENDING** | *Tout centre créé en PENDING doit être visible dans au moins une liste admin* (`/admin/claims` **ou** `/admin/centres/pending`). Un centre invisible = un hébergeur bloqué sans issue. À vérifier à chaque modification d'un chemin de création de centre. | 14/07/2026 |
| **Résolution d'organisation** | L'organisation d'un centre se déduit de la **DONNÉE** (SIRET → SIREN), pas du **CHEMIN** (« l'hébergeur est-il validé ? »). Ordre : (1) SIRET saisi → dédup SIREN ; (2) membership VALIDE le plus ancien ; (3) dédup textuelle / création. Le `claimStatut` dérive de la **relation user × organisation résolue**. | 14/07/2026 |
| **SIRET à l'ajout d'un centre** | Reste **OPTIONNEL** (pas de durcissement du formulaire). La règle de résolution ci-dessus suffit à fermer le trou. | 14/07/2026 |
| **Factures Sauvageon à 9 chiffres** | **Option A — ne rien faire.** Les 62 factures (11/06→01/07) portent `emetteur_siret = 953632031` (un SIREN). Le XML les déclarait `schemeID 0002` = SIREN → **cohérent**. Le SIREN identifie correctement l'entreprise, les clients ont payé. Réécrire un snapshot de facture émise (B) ou émettre 62 avoirs (C) : **écartés**. Question posée au comptable. Les **futures** factures sont correctes (backfill + `schemeID` dérivé). | 14/07/2026 |
| **`schemeID` Factur-X** | Dérivé de la **valeur réelle**, jamais codé en dur : 14 chiffres → `0009` (SIRET), 9 chiffres → `0002` (SIREN), longueur aberrante → **bloc omis** (mieux qu'un identifiant mal typé). Échéance réception e-invoicing : **01/09/2026**. | 14/07/2026 |

---

## 10. Chantiers issus du run onboarding backend (07/07 — déployé en prod)

**Livré 07/07** : branche `feat/onboarding-register-trial` (26 commits) mergée et déployée. Compte hébergeur utilisable dès l'inscription (compteValide=true au register, kill switch conservé), trial 30j Pilotage auto à la première connexion (garde `abonnementStatut INACTIF` protège les clients existants), centres PENDING opérables (SUSPENDED seul bloquant), gates anti-phishing `assertEnvoiExterneAutorise` (10 sites, exception destinataire=soi-même), cron alertes branché (`@Cron` 8h Paris, garde `ENABLE_CRON`), justificatif ex-nihilo dans le tunnel claim (membership `EN_ATTENTE_DOCUMENT`), `Devis.dateEnvoi` (migration + backfill), endpoint `GET /centres/onboarding-status`. Recette régression Sauvageon validée 4/4. SQL memberships→VALIDE exécuté (5 clients).

**Livré 08/07** : phase 2 onboarding (§10.11) déployée — branche `feat/onboarding-phase2` (6a `envoisBloques` backend + 6b-1 modale test/réel + 6b-2 encart pré-envoi & message `extractApiError` + 6b-4 « Aller plus loin »). Recette prod 3/3 sur compte ex-nihilo frais. **3 bugs attrapés au smoke-test et corrigés (branches dédiées mergées)** : (1) **permissions PENDING** — `getUserCentrePermissions` gaté sur ACTIVE → proprio d'un PENDING en 403 partout, sidebar cassée pour tout nouvel ex-nihilo ; fix = aligné SUSPENDED-only + spec 6 cas (`fix/permissions-centre-pending`) ; (2) **lien devis** — étape 5 checklist → page suivi sans bouton créer ; fix = `onboarding-status` renvoie `sejour.id`, étape 5 → `/devis/nouveau?sejourDirectId` (`fix/onboarding-devis-link`) ; (3) **double bandeau** claim + PENDING redondants pour ex-nihilo ; fix = masque le claim si un centre PENDING affiche le sien (`fix/onboarding-double-banner`). Le parcours claim (centre catalogue ACTIVE + `userId` posé immédiatement) n'était touché par aucun des trois. **FeatureHint ×4 différé** (code mort sans placement + 4 ancrages diffus 119 KB).

**Livré 08/07 (suite)** : **chantier 10.1 COMPLET, deadline 26/09 NEUTRALISÉE.** Protection Choucas en 2 moitiés — code (enum `ModePaiement`, cron exclut les VIREMENT en null-safe, facture `emettre()` échéance/mention dynamiques, `facturerCentre` prolonge + marque VIREMENT, badge admin, relance admin J-30 virement, self-service `POST /abonnements/demander-extension` +14j + bouton) et données (Choucas marqué `mode_paiement='VIREMENT'` en prod). **Edge cases justificatif soldés** : (a) claim sans fichier et (b) logoUrl null PDF **déjà corrects** (lus sur code, aucun fix) ; (c) pied de checklist **fixé** (`OnboardingChecklist` dérive pied + séparateur d'`envoisBloques` au lieu de `centreValide` → cohérent pour revendication catalogue). **Compte de test 08/07 neutralisé** (`trochenrc@gmail.com`, centre `7882bda3…` : SUSPENDED + INACTIF + `compteValide=false`). Workflow : retour direct sur main (les branches par fix = détour). Détail SESSION_STATE 08/07 (suite).

| # | Chantier | Détail | Priorité / Deadline |
|---|---|---|---|
| 10.1 | ~~**Gestion admin des abonnements (virement/BdC)**~~ ✅ **LIVRÉ + DÉPLOYÉ 08/07** | Enum `modePaiement` + cron exclut les VIREMENT (null-safe), facture `emettre()` échéance/mention dynamiques, `facturerCentre` prolonge depuis fin actuelle + marque VIREMENT, `getAbonnements` + badge admin, relance admin J-30 virement, self-service `demander-extension` +14j (endpoint + bouton). Choucas marqué VIREMENT en prod. | ✅ **DEADLINE 26/09 NEUTRALISÉE** (code + données en place) |
| 10.2 | Onboarding phase 2 — frontend | 4a : messages register, CTA trial obsolète, parsing `CENTRE_EN_VALIDATION`, badge centre PENDING. 4b : checklist activation + welcome modal (consomme `onboarding-status`, repli localStorage). 4c : parcours test guidé (devis à sa propre adresse). 4bis backend : preview facture non-émise (`apercu()`) + `POST /abonnements/demander-extension` (+14j sur demande → notif admin). | Avant démarchage IDDJ |
| 10.3 | Extraction PlanningPDF | Stash `extraction PlanningPDF en cours` à dépiler → `npm run build` frontend → commit dédié si vert. Code actuellement dupliqué (composant inline + fichier extrait commité). | Hygiène, avec 10.2 |
| 10.4 | .gitignore | Ajouter `build-error*.txt` (frontend). | Avec 10.2 |
| 10.5 | Email renouvellement annuel | Montant ignore les suppléments multi-centre (+39€/centre) — faux pour Pôle Montagne (YAKA+Florimont). | Avec 10.1 |
| 10.6 | ~~Compte test recette~~ ✅ **FAIT 08/07** | Compte ex-nihilo `trochenrc@gmail.com` (centre `7882bda3…`) créé pour le smoke-test puis neutralisé en prod : `SUSPENDED` + `abonnement_statut INACTIF` + `compteValide=false` (transaction, réversible, jamais ciblé par le cron). | ✅ |
| 10.7 | CLI Scalingo | 1.44.1 obsolète (timeouts constatés sur `restart`), mettre à jour vers 1.47.0. | Hygiène |
| 10.8 | Vérif cron J1 | Après 8h le 08/07 : `scalingo logs | findstr cronQuotidien` — 3 lignes attendues. Si rien : le restart post-`env-set ENABLE_CRON` n'a pas pris, relancer `restart`. | 08/07 matin |
| 10.9 | **HOTFIX faille claim** | Gate fondé sur le claimStatut du propriétaire (pas le statut centre) — branche fix/gate-claim-validation. Faille prouvée (Brevo 21:31 : devis émis vers tiers par claimant non validé). Re-test ZZTEST à confirmer. | 07/07 nuit — déployé |
| 10.10 | Boîte admin contact@liavo.fr | Notifs délivrées en temps réel par Brevo mais relève avec heures de retard (probable Gmail POP3 sur OVH). Fix : redirection MX ou IMAP. Radar de secours : /dashboard/admin/claims chaque matin. | Avant démarchage |
| 10.11 | ~~Prompt 6 — parcours test + découverte~~ ✅ **LIVRÉ 08/07 (partiel)** | Modale de choix séjour test/réel (client=soi), encart proactif pré-envoi (`envoisBloques`), message revendication via `extractApiError`, « Aller plus loin » (3 liens). **FeatureHint ×4 DIFFÉRÉ** (code mort sans placement + ancrages diffus 119 KB — à poser en amortissant). Recette prod 3/3. | ✅ sauf FeatureHint |
| 10.12 | Nettoyage ZZTEST | Procédure détaillée en session state (UI puis SQL). APRÈS re-test hotfix. | 08/07 |

| Sujet | Décision | Date |
|---|---|---|
| Priorité 1 roadmap invalidée | "Premier paiement Choucas ~17/07 = validation Mollie bout-en-bout" : Choucas paie par BdC mairie (Pilotage annuel 690€), ne passera JAMAIS par Mollie. Extension manuelle posée (17/10). Premier vrai test Mollie = Alticlub (fin trial 10/09) ou Pôle Montagne (01/12). | 07/07/2026 |
| Frontière de sécurité onboarding | L'accès au centre n'est plus la frontière (PENDING opérable) : ce sont les gates d'envoi + le filtre ACTIVE du catalogue public. `compteValide` = kill switch par requête, `SUSPENDED` = kill switch centre. | 07/07/2026 |
| Checklist onboarding | 5 étapes dérivées des données (jamais de flags manuels) : profil, catalogue, conformité (justificatif+IBAN), 1er séjour, 1er devis envoyé. Pas de suppression : repli visuel localStorage. Activation = premier devis envoyé. | 07/07/2026 |
| Cron + deadline 10.1 | Cron laissé ALLUMÉ (option 1). ~~10.1 à livrer avant le 26/09~~ → **10.1 LIVRÉ + DÉPLOYÉ le 08/07, deadline 26/09 NEUTRALISÉE** : le cron exclut désormais les centres `modePaiement=VIREMENT` (dont Choucas, marqué en prod) de toutes les alertes d'essai. Choucas recevra à la place une relance admin J-30 (~17/09) pour ré-émettre la facture BdC. | 08/07/2026 |
| « Démarchage IDDJ » périmé | Le label « avant démarchage IDDJ » (§10.2/10.10) ne reflète plus la réalité : IDDJ est **attentiste/prospectif** (Robin Baladi, CA à consulter), pas un partenaire actif. Réseau actif = **LMDJ** (Théo admin depuis AG 01/06). Cadrage réel des chantiers restants : « rendre le produit solide avant d'ouvrir à de vrais partenaires », pas « pour IDDJ ». | 08/07/2026 |
| permission.helper aligné PENDING | `getUserCentrePermissions` ne gate plus sur `ACTIVE` mais sur `SUSPENDED` (proprio/collab d'un PENDING obtient ses permissions), aligné sur `getCentreForUser`. Bug trouvé au smoke-test 08/07 : sidebar cassée + 403 en masse pour tout nouvel hébergeur ex-nihilo. Envois externes toujours gatés séparément. | 08/07/2026 |

---

**Ce document est la source unique de priorisation pour l'été 2026. Les autres docs restent comme archives de décision.**