# Run overnight quick-fixes — 20/07/2026

> Règles du run : AUCUN push, AUCUNE suppression de fichier, un commit atomique par fix,
> gate `tsc --noEmit` + `build` par côté touché, périmètre fermé aux 5 fix.
> Ce doc : recensement phase 1 (lecture seule) puis récap d'exécution.

## Phase 1 — Recensement (avant toute écriture)

### 4.17 — qty 0 dans les PDF → « — »
**Diagnostic CONFIRMÉ, 3 fichiers, même tableau 7 colonnes :**
- `frontend/src/components/pdf/DevisPDF.tsx:242` (Qté), `:246` (Total HT), `:247` (Total TTC)
- `backend/src/facture/pdf/FacturePDF.tsx:296` (Qté), `:300` (Total HT), `:301` (Total TTC)
- `frontend/app/devis/signer/[token]/page.tsx:288` (Qté), `:292` (Total HT), `:293` (Total TTC)

Fix : `quantite === 0` → « — » sur Qté, Total HT, Total TTC. PU TTC, TVA %, PU HT inchangés
(le PU TTC est la raison d'être de la ligne option). Aucun calcul touché, affichage pur.
Cascade : aucune — `quantite` est déjà un `number` aux 3 sites. Gate frontend ET backend.

### 4.20 — mails d'alerte trial dupliqués multi-centre
**⚠️ Diagnostic PARTIELLEMENT FAUX, fix conservé :** `sendTrialExpirationAlert`
(`email.service.ts:501-527`) est envoyé à **l'ADMIN** (`ADMIN_ALERT_EMAIL ?? contact@liavo.fr`),
PAS à l'hébergeur. Ce n'est donc pas « un compte client reçoit N mails » mais « l'admin reçoit
N mails pour un même compte » (un par centre aligné, chacun nommant son centre). L'intention
roadmap 4.20 (« grouper par userId ») reste valable : réduire le bruit admin.

Fix : dans `cron-alertes.service.ts`, `envoyerAlertes()` (boucle L93) : regrouper par
`userId + joursRestants` (clé de repli `centre.id` si `userId` absent → comportement
par-centre préservé pour un cas dégénéré), UN mail par groupe avec les noms de centres
joints (« YAKA, Florimont »), tampon `dernierEmailAlerteAt` posé sur TOUS les centres du
groupe seulement si l'envoi réussit. **Même traitement pour `envoyerAlertesExpires()`
(L138)** : même email, même destinataire admin, même duplication — c'est le même défaut,
pas une amélioration au passage.
`envoyerAlertesRenouvellement` et `envoyerRelanceVirement` : NON touchés par 4.20
(les mandats/subscriptions Mollie ne vivent que sur le centre souscripteur → pas de
duplication constatée ; noté, hors périmètre).

Tests : la spec (`cron-alertes.service.spec.ts:178-194`) dépend du comportement par-centre
via 2 centres **sans `userId`** → la clé de repli `centre.id` la laisse passer telle quelle.
Ajout d'un test de regroupement (2 centres même userId → 1 mail, 2 tampons).
Signature de `sendTrialExpirationAlert` inchangée (seul appelant = ce cron).

### 4.22 — KpiCard accent hex
**⚠️ Diagnostic INEXACT sur la localisation :** la ligne 1038 d'`admin/page.tsx` est un
bouton sans rapport. Les vrais sites sont **`admin/page.tsx:1177-1180`** : QUATRE KpiCard
avec un hex dans `accent` (`#C87D2E`, `#9C2B2B`, `#1E5C42`, `#1B4060`) → concaténés dans
`className` (`KpiCard.tsx:19`) → classe invalide → les 4 cartes s'affichent en gris.

Choix : **corriger les appelants** avec des classes Tailwind arbitraires
(`text-[#C87D2E]`, etc.) — cohérent avec les autres appelants (`text-[var(--color-…)]`
aux lignes 836/838 et dans reseau/page.tsx), zéro changement de `KpiCard.tsx` donc zéro
risque pour les 8 autres appelants. Rendre `accent` tolérant au hex (style inline)
aurait modifié le composant partagé pour un seul écran : écarté.
(Le `accent` d'`OnboardingChecklist.tsx:206` est une prop locale d'un autre composant
`Pastille`, sans rapport.)

### 10.4 — .gitignore build-error*.txt
Vérifié : **aucun** fichier `build-error*.txt` tracké (`git ls-files` vide), aucun présent
sur le disque, motif absent des .gitignore racine/frontend/backend. Ajout dans
`frontend/.gitignore` (origine du motif, roadmap §10.4). Backend : motif jamais apparu →
non ajouté (périmètre fermé).

### 10.5 — montant email renouvellement multi-centre
**Diagnostic CONFIRMÉ :** `cron-alertes.service.ts:181` utilise `PRIX_ANNUEL_MAP`
(euros : 290/490/690, plan seul) alors que la vérité est dans `abonnement.service.ts` :
constantes en **centimes** (`PRIX_ANNUEL`, `CENTRE_SUPP_ANNUEL = 39000` = 390 €/an/centre
supp) + logique `souscrire` L246-252 et webhook L406-413 :
`montant = PRIX[plan] + max(0, nbCentresActifs-1) × CENTRE_SUPP`.

Fix : extraction propre (pas de duplication) → nouveau fichier
`backend/src/abonnements/abonnement.constants.ts` exportant les 4 constantes de prix +
helper `calculerMontantAbonnementCents(plan, frequence, nbCentresActifs)` ;
`abonnement.service.ts` consomme le helper aux 2 sites (souscrire + webhook — remplacement
à l'identique, preuve par relecture du diff) ; le cron compte les centres ACTIVE du
`centre.userId` (même requête que le webhook L409-411) et affiche le total en euros.
`PRIX_ANNUEL_MAP` supprimée du cron (remplacée par la source unique — c'est LE fix,
pas un refacto opportuniste). Garde : `centre.userId` null → pas de comptage, plan seul.
Concrétise le `it.todo` existant (`spec:273-275`) + ajoute `count` au mock prisma.

### Hors périmètre — vu pendant la lecture, NON touché
- `envoyerAlertesRenouvellement` boucle aussi par centre ; pas de duplication avérée
  (mandat sur le seul centre souscripteur) mais non prouvé en base → à regarder un jour.
- Le commit `f6516a1` (trust proxy / signature_ip_address) a déjà traité une partie du
  chantier X-Forwarded-For notes session — rien à faire dans ce run.
- `railway.toml` / Dockerfiles legacy : interdits de toucher par les règles du run. RAS.

---

## Phase 2 — Exécution

**Les 5 fix sont FAITS, 0 reverté. AUCUN push (5 commits locaux sur `main`, à relire).**
Gates : tsc + build verts frontend ET backend à chaque commit ; suite Jest backend
complète après 4.20 et 10.5 : **16 suites, 217 tests verts + 2 todo** (base avant run :
211 + 3 todo — le todo 10.5 est devenu 2 vrais tests, +3 tests 4.20).

| Fix | Statut | Commit | Notes |
|---|---|---|---|
| 4.17 | ✅ FAIT | `7b568ab` | 3 fichiers (DevisPDF, FacturePDF backend, page signer). Qté/Total HT/Total TTC → « — » si qty 0 ; PU TTC/TVA/PU HT inchangés. Affichage pur. |
| 4.22 | ✅ FAIT | `7556db9` | 4 cartes corrigées côté appelant (`text-[#…]`), PAS 1 : le bug était lignes 1177-1180, pas 1038. `KpiCard.tsx` non modifié. |
| 10.4 | ✅ FAIT | `02a9d3d` | `frontend/.gitignore` seul (motif jamais apparu côté backend, rien de tracké). |
| 4.20 | ✅ FAIT | `d441929` | Regroupement par `userId + palier` dans `envoyerAlertes` ET `envoyerAlertesExpires` (même défaut, même destinataire admin — assumé). Noms joints, tampon par centre après envoi réussi. +3 tests. |
| 10.5 | ✅ FAIT | `1e64c9a` | Extraction `abonnement.constants.ts` (prix en centimes + `calculerMontantAbonnementCents`), consommée par souscrire, webhook Mollie et le cron. `PRIX_ANNUEL_MAP` supprimée. +2 tests (690 € / 1080 €). |

### Cascades et doutes à relire (aucun bloquant)
1. **4.20 — correction de diagnostic** : les alertes trial partent à l'**admin**
   (`ADMIN_ALERT_EMAIL ?? contact@liavo.fr`), pas à l'hébergeur. Le regroupement réduit
   ton bruit de boîte mail ; aucun mail client touché. Le sujet du mail devient
   « Relance essai — YAKA, Florimont — J-21 » pour un compte multi-centre.
2. **4.20 — périmètre** : `envoyerAlertesExpires` regroupé aussi (même mail, même
   duplication). `envoyerAlertesRenouvellement`/`envoyerRelanceVirement` NON touchés par
   le regroupement (mandat sur le seul centre souscripteur → pas de duplication avérée).
3. **10.5 — micro-changement de comportement dans `souscrire`** : plan inconnu donnait
   `NaN` (crash Mollie), donne maintenant `0` via le helper (`?? 0`, comportement que le
   webhook avait déjà). Le plan est validé par DTO en amont → cas théorique.
4. **10.5 — garde** : `centre.userId` null → pas de comptage, prix du plan seul.
5. **4.17** : `DevisPDF.tsx` sert aussi aux factures côté client (typeDocument
   FACTURE_*) → une facture avec ligne option hérite du même « — ». Voulu (cohérent
   FacturePDF backend).
6. **Recette visuelle à faire par Théo** : un PDF devis avec ligne option (Alticlub)
   + les 4 KpiCard de l'onglet abonnements admin (couleurs ocre/rouge/vert/bleu).

### Vu pendant le run, NON touché (périmètre fermé)
- `railway.toml` + Dockerfiles legacy (backend/frontend) : interdits par les règles du run.
- Le commit `f6516a1` (session précédente) couvre déjà trust proxy + `signature_ip_address`.
- `envoyerAlertesRenouvellement` boucle par centre à mandat — si un jour plusieurs centres
  d'un compte portent chacun un mandat, la duplication reviendra par cette porte.
