# Extract lot 3

## 1. Contenu intégral de docs/census-devis-service-4b.md

# Census 4b — DevisService (Lots 3 & 4) — annulerDevis · updateStatut · signerDevis · signerSansCompte

> **Rédigé le 22/07/2026 — CONSTAT UNIQUEMENT, lecture seule.** Aucune recommandation, aucun refactor.
> Fichiers lus en entier : `backend/src/devis/devis.service.ts` (2628 lignes), `backend/src/invitations-directeur/invitations-directeur.service.ts` (276 lignes) + vérifications croisées : `occupations.service.ts`, `clients.service.ts`, `invitation.service.ts`, `notifications.service.ts`, contrôleurs devis / devis-public / invitations-directeur / admin, `update-statut-devis.dto.ts`, `email.service.ts`.
> Périmètre transactionnel de référence (design acté 21/07) : DANS = `{devis, séjour, demande, rivaux, invitation}` ; HORS = sync occupations, emails (Brevo), CRM (`activiteClient`, auto-rattach client).

---

## A. Graphe d'appel

### A.1 — annulerDevis appelle-t-elle updateStatut ?

**NON.** `annulerDevis` (`devis.service.ts:2523-2627`) n'appelle pas `updateStatut`. Elle exécute son propre `this.prisma.devis.update({ where: { id: devisId }, data: { statut: StatutDevis.NON_RETENU } })` (`devis.service.ts:2568-2571`).

**Ce n'est pas non plus une duplication de la logique d'updateStatut.** Seule l'écriture `devis.update → NON_RETENU` est commune. Tout le reste diverge :
- `annulerDevis` a ses propres gardes (statuts annulables `devis.service.ts:2539-2549`, exigence d'avoir sur facture émise `2553-2566`), rétrograde conditionnellement le séjour → `OPTION` via `devis.count` + `sejour.updateMany` (`2576-2597`) — ce que la branche NON_RETENU d'`updateStatut` ne fait **pas** (commentaire explicite `devis.service.ts:736-737` : « Le séjour n'est PAS muté »).
- La branche NON_RETENU d'`updateStatut` envoie un email à l'enseignant (`devis.service.ts:747-753`) — `annulerDevis` n'envoie **aucun** email.

### A.2 — Appels croisés et services écrivains

**Les 4 méthodes ne s'appellent jamais entre elles.** Vérifié sur l'intégralité des deux fichiers : aucun `this.updateStatut(`, `this.signerDevis(`, `this.annulerDevis(` dans `devis.service.ts` ; `invitations-directeur.service.ts` n'importe pas `DevisService` (imports `invitations-directeur.service.ts:1-5`).

Appels sortants vers des services qui écrivent en base :

| Méthode appelante | Ligne d'appel | Cible | Fichier cible | Écritures de la cible |
|---|---|---|---|---|
| `updateStatut` | `devis.service.ts:717` | `clientsService.autoRattacherDepuisDevis` | `clients.service.ts:299` | `client.create` (:306), `client.update` (:310), `sejourClient.upsert` (:313), `relationCommerciale.upsert` (:326, dans un try/catch interne) |
| `updateStatut` | `devis.service.ts:760` | `occupations.syncOccupationsSejourSafe` | `occupations.service.ts:222` | `occupationChambre.update` (:190, :198, :205, :209) via `syncOccupationsSejour` (:178) |
| `signerDevis` | `devis.service.ts:843` | `occupations.syncOccupationsSejourSafe` | `occupations.service.ts:222` | idem |
| `annulerDevis` | `devis.service.ts:2600` | `occupations.syncOccupationsSejourSafe` | `occupations.service.ts:222` | idem |
| `signerSansCompte` | `invitations-directeur.service.ts:246` | `occupations.syncOccupationsSejourSafe` | `occupations.service.ts:222` | idem |

Autres appels sortants (sans écriture base) : `EmailService` (Brevo — `@getbrevo/brevo`, `email.service.ts:2`) depuis `updateStatut` (:704, :747), `signerDevis` (:849), `signerSansCompte` (`invitations-directeur.service.ts:258`). `annulerDevis` n'appelle pas le mailer.

Écritures CRM directes (via `this.prisma`, pas un service) : `activiteClient.create` dans `signerDevis` (`devis.service.ts:870`) et `annulerDevis` (`devis.service.ts:2611`), chacune dans un try/catch best-effort. `updateStatut` et `signerSansCompte` n'écrivent **pas** d'`activiteClient`.

---

## B. Structure d'updateStatut

### B.3 — Signature et bornes

```ts
async updateStatut(id: string, statut: StatutDevis, userId: string, userRole: string) {
```
Début : `devis.service.ts:629`. Fin (accolade fermante) : `devis.service.ts:764`. Retour : `return updated;` (`devis.service.ts:763`).

Entrée contrôleur : `PATCH /devis/:id/statut`, rôles ORGANISATEUR + SIGNATAIRE (`devis.controller.ts:176-184`). Le DTO valide seulement `@IsEnum(StatutDevis)` (`dto/update-statut-devis.dto.ts:4-7`) → **n'importe quelle valeur de l'enum peut arriver dans la méthode** ; la seule restriction par rôle est côté service (SIGNATAIRE limité à NON_RETENU, `devis.service.ts:656-658`).

### B.4 — Le devis.update pré-switch

**Il existe** — `devis.service.ts:661-664` :

```ts
    const updated = await this.prisma.devis.update({
      where: { id },
      data: { statut },
    });
```

**Exécuté sur TOUTES les branches.** Il est inconditionnel : placé après les gardes (throw possibles aux lignes 634, 636, 644, 653-654, 657) et **avant** tout bloc conditionnel sur `statut`. Tout appel qui franchit les gardes l'exécute, quelle que soit la valeur de `statut`.

### B.5 — Branches du « switch »

Il n'y a **pas de `switch` littéral** : le dispatch est une séquence de 3 blocs `if` sur `statut`, tous au même niveau, exécutés dans l'ordre :

| Bloc | Lignes | Condition | Écritures base |
|---|---|---|---|
| 1 | 667-733 | `statut === SELECTIONNE` | `devis.updateMany` rivaux → NON_RETENU (:669-676) ; `demandeDevis.update` → FERMEE (:679-682) ; `sejour.update` → appel d'offres FERME + `hebergementSelectionneId` + CONVENTION (:685-692) ; puis email (:704) ; puis try{auto-rattach CRM : écritures listées en A.2 + `client.update` :726-729} (:712-732) |
| 2 | 738-755 | `statut === NON_RETENU && userRole === SIGNATAIRE` | **AUCUNE** — une lecture (`demandeDevis.findUnique` :739-745) + un email (:747-753) |
| 3 | 759-761 | `statut === SELECTIONNE \|\| statut === NON_RETENU` | `syncOccupationsSejourSafe` (:760) — écrit `occupationChambre`, HORS-PÉRIMÈTRE |

**Branches qui écrivent en base (au-delà du pré-switch)** : une seule dans le périmètre — SELECTIONNE (bloc 1). NON_RETENU déclenche uniquement le sync (bloc 3, hors périmètre) et, si SIGNATAIRE, un email.

**Valeurs de statut qui ne font RIEN d'autre que le changement de statut** : toute valeur ∉ {SELECTIONNE, NON_RETENU} — par exemple `EN_ATTENTE_VALIDATION` (soumission organisateur, cf. commentaire `devis.service.ts:641`, :649) ou `EN_ATTENTE`. Pour ces valeurs, le pré-switch :661-664 est l'unique écriture, puis `return updated`.

### B.6 — Extractibilité du pré-switch + dispatch

Le bloc `devis.service.ts:661-763` (pré-switch + les 3 `if` + `return updated`) présente les propriétés structurelles suivantes (constat, pas de proposition) :

- **Aucun early return** entre 661 et 763 — l'unique `return` de la méthode après les gardes est :763.
- **Aucun try/catch englobant** — les seuls try/catch sont internes et best-effort : auto-rattach CRM (:712-732) et le try/catch interne de `relationCommerciale` dans `clients.service.ts:320-344`.
- **Variables externes référencées par le bloc** : `id`, `statut`, `userRole` (paramètres) ; `devis` (fetch :630-633, utilisé pour `devis.demandeId` :671, `devis.centreId` :689, :696, :719) ; `demande` (= `devis.demande`, posé :638 ; utilisé :685-687, :700, :713-714, :718, :760) ; `demandeId` (posé :639 ; utilisé :680, :740). `userId` n'est **pas** utilisé après :661 (seulement dans les gardes :643, :652). Aucune fermeture sur une variable mutée ailleurs.
- La valeur `updated` produite à :661 est celle retournée à :763 — toute extraction doit **faire remonter cette valeur** (même contrainte que celle notée dans `run-chambres-4b.md` §2bis pour la Phase 2).

Rien dans la structure du code (early return, closure, try/catch englobant) n'empêche l'extraction du bloc :661-763 dans une méthode privée prenant `{id, statut, userRole, devis (avec demande incluse)}` en paramètres. **Réserve** : le bloc contient deux emails (:704, :747) et le sync (:760) — l'équivalence sémantique d'une extraction dépend de ce qu'on met dans la méthode extraite, ce qui relève de la Phase 2, pas de ce census.

---

## C. Écritures

### C.7 — Liste ordonnée des écritures Prisma par méthode

**`updateStatut`** (`devis.service.ts:629-764`) :

| # | Ligne | Écriture | Condition | Périmètre |
|---|---|---|---|---|
| 1 | 661 | `devis.update` (statut) | toujours (post-gardes) | **DANS** (devis) |
| 2 | 669 | `devis.updateMany` (rivaux → NON_RETENU) | SELECTIONNE | **DANS** (rivaux) |
| 3 | 679 | `demandeDevis.update` (→ FERMEE) | SELECTIONNE | **DANS** (demande) |
| 4 | 685 | `sejour.update` (FERME + hebergementSelectionneId + CONVENTION) | SELECTIONNE | **DANS** (séjour) |
| 5 | 717 | `autoRattacherDepuisDevis` → `client.create`/`client.update`/`sejourClient.upsert`/`relationCommerciale.upsert` (`clients.service.ts:306/310/313/326`) | SELECTIONNE, try/catch | HORS (CRM) |
| 6 | 726 | `client.update` (organisationId) | SELECTIONNE, même try | HORS (CRM) |
| 7 | 760 | `syncOccupationsSejourSafe` → `occupationChambre.update` | SELECTIONNE ou NON_RETENU | HORS (sync) |

**`signerDevis`** (`devis.service.ts:766-892`) :

| # | Ligne | Écriture | Condition | Périmètre |
|---|---|---|---|---|
| 1 | 787 | `devis.update` (→ SELECTIONNE) | statut initial EN_ATTENTE_VALIDATION | **DANS** (devis) |
| 2 | 791 | `devis.updateMany` (rivaux → NON_RETENU) | idem | **DANS** (rivaux) |
| 3 | 799 | `demandeDevis.update` (→ FERMEE) | idem | **DANS** (demande) |
| 4 | 804 | `sejour.update` (FERME + hebergementSelectionneId + CONVENTION) | idem + `devis.demande?.sejour?.id` | **DANS** (séjour) |
| 5 | 821 | `devis.update` (→ SIGNE_DIRECTION + métadonnées signature + hash) | toujours | **DANS** (devis) |
| 6 | 838 | `sejour.update` (→ SIGNE_DIRECTION) | `devis.demande?.sejour` | **DANS** (séjour) |
| 7 | 843 | `syncOccupationsSejourSafe` | idem | HORS (sync) |
| 8 | 870 | `activiteClient.create` | try/catch, si sejourClient trouvé | HORS (CRM) |

C'est le « double paquet » du run doc : écritures 1-4 (promotion EN_ATTENTE_VALIDATION → SELECTIONNE) puis 5-6 (signature). Les écritures 1-4 dupliquent la séquence du bloc SELECTIONNE d'`updateStatut` (669/679/685) au détail près : :804 est conditionné à `devis.demande?.sejour?.id` alors que :685 est inconditionnel dans son bloc.

**`annulerDevis`** (`devis.service.ts:2523-2627`) :

| # | Ligne | Écriture | Condition | Périmètre |
|---|---|---|---|---|
| 1 | 2568 | `devis.update` (→ NON_RETENU) | toujours (post-gardes) | **DANS** (devis) |
| — | 2578 | `devis.count` (**lecture**, statuts `STATUTS_DEVIS_ENGAGEANTS`) | si `sejourCibleId` | lit l'état **post**-écriture #1 — conditionne #2 (cf. `run-chambres-4b.md` §2bis : « doit entrer dans la tx ») |
| 2 | 2590 | `sejour.updateMany` (→ OPTION, filtré sur SUBMITTED/CONVENTION/SIGNE_DIRECTION) | si `autresActifs === 0` | **DANS** (séjour) |
| 3 | 2600 | `syncOccupationsSejourSafe` | si `sejourCibleId` (hors du if `autresActifs === 0`) | HORS (sync) |
| 4 | 2611 | `activiteClient.create` | try/catch | HORS (CRM) |

Note : la boucle de garde sur les avoirs (`facture.findUnique`, `devis.service.ts:2557`) est une **lecture** pré-écriture, pas une écriture.

**`signerSansCompte`** (`invitations-directeur.service.ts:192-275`) :

| # | Ligne | Écriture | Condition | Périmètre |
|---|---|---|---|---|
| 1 | 214 | `invitationDirecteur.update` (nomSignataire, signeAt, signatureIp, utilisedAt) | toujours (post-gardes) | **DANS** (invitation) |
| 2 | 226 | `devis.update` (→ SIGNE_DIRECTION + métadonnées + hash) | toujours | **DANS** (devis) |
| 3 | 240 | `sejour.update` (→ SIGNE_DIRECTION) | toujours | **DANS** (séjour) |
| 4 | 246 | `syncOccupationsSejourSafe` | toujours | HORS (sync) |

Aucune écriture CRM dans cette méthode. La lecture `devis.findUnique` (:248-254) après le sync ne sert qu'à l'email.

### C.8 — $transaction existantes

**`devis.service.ts` : 4 occurrences, toutes de forme INTERACTIVE** (callback `async (tx) => …`), aucune forme tableau :

| Lignes | Méthode | Contenu | Remontée de valeur |
|---|---|---|---|
| 925-945 | `uploadSignatureDocument` | `tx.devis.update` (:926) + `tx.sejour.update` (:938) | `return devisMaj;` (:944) → `const updated = await this.prisma.$transaction(…)` (:925) |
| 1051-1078 | `marquerDevisSigneHebergeur` | `tx.devis.update` (:1052) + `tx.sejour.update` (:1068) | `return devisMaj;` (:1077) → `const updated = …` (:1051) |
| 2220-2241 | `signerDevisDirect` | `tx.devis.update` (:2221) + `tx.sejour.update` (:2234) | résultat **jeté** (`await this.prisma.$transaction(…)` sans affectation) |
| 2454-2472 | `uploadSignaturePublic` | `tx.devis.update` (:2455) + `tx.sejour.update` (:2468) | résultat **jeté** |

**Pattern de passage du client tx** : le client `tx` est utilisé **directement** sur les modèles (`tx.devis.update`, `tx.sejour.update`) à l'intérieur du callback. Il n'est **jamais passé à un appel interne ni à un autre service** — `syncOccupationsSejour` accepte un `tx?` optionnel (`occupations.service.ts:178`, commentaire :176 : « aucun site ne le passe encore ») et tous les sites appellent le wrapper `Safe` **après** le commit, hors transaction.

Pattern reproduit textuellement (Lot 2, `uploadSignatureDocument:925-945`) :

```ts
    const updated = await this.prisma.$transaction(async (tx) => {
      const devisMaj = await tx.devis.update({
        where: { id: devisId },
        data: { … },
      });

      if (devis.demande?.sejourId) {
        await tx.sejour.update({
          where: { id: devis.demande.sejourId },
          data: { statut: 'SIGNE_DIRECTION' },
        });
      }

      return devisMaj;
    });
```

**`invitations-directeur.service.ts` : AUCUNE `$transaction`.** Les 3 écritures de `signerSansCompte` (:214, :226, :240) sont trois appels `this.prisma.*` séquentiels non transactionnels.

---

## D. Emails et effets de bord

### D.9 — Points d'appel du mailer (Brevo via `EmailService`, `email.service.ts:2`)

| Méthode | Ligne | Email | Position vs écritures | try/catch |
|---|---|---|---|---|
| `updateStatut` (SELECTIONNE) | `devis.service.ts:704` | `sendDevisSelectionne` (hébergeur) | **APRÈS** les 4 écritures :661/:669/:679/:685 — **AVANT** l'auto-rattach CRM (:712) et **AVANT** le sync (:760) | **NON protégé** |
| `updateStatut` (NON_RETENU + SIGNATAIRE) | `devis.service.ts:747` | `sendGenericNotification` « Devis refusé par la direction » (enseignant) | **APRÈS** la seule écriture :661 — **AVANT** le sync (:760) | **NON protégé** |
| `signerDevis` | `devis.service.ts:849` | `sendGenericNotification` « Devis signé par la direction » (hébergeur) | **APRÈS** toutes les écritures (:821, :838) et **APRÈS** le sync (:843) | **NON protégé** |
| `annulerDevis` | — | **aucun email** | — | — |
| `signerSansCompte` | `invitations-directeur.service.ts:258` | `sendGenericNotification` « Devis signé par la direction » (hébergeur) | **APRÈS** les 3 écritures (:214/:226/:240) et **APRÈS** le sync (:246) | **NON protégé** |

Conséquence factuelle (déjà notée `run-chambres-4b.md` §2bis) : un échec Brevo dans ces 4 points remonte en exception au contrôleur alors que les écritures sont déjà persistées. Cas particulier `updateStatut` SELECTIONNE : un échec à :704 court-circuite aussi l'auto-rattach CRM (:712) **et le sync occupations (:760)**, situés après lui dans le flux.

### D.10 — Renvoi MANUEL d'un email de signature

Recherche sur tout le backend (`renvoyer|resend|relance|renvoi`, + traçage de `sendDevisSelectionne` / des notifications de signature).

**Pour les emails de CONFIRMATION post-signature : NON.** Aucun endpoint, méthode de service ou tâche admin ne permet de renvoyer :
- `sendDevisSelectionne` (`devis.service.ts:704`) — unique point d'appel dans tout le backend ;
- « Devis signé par la direction » (`devis.service.ts:849` et `invitations-directeur.service.ts:258`) ;
- « Confirmation de réservation » / « Devis signé » de `signerDevisDirect` (`devis.service.ts:2253`, :2273) ;
- « Document signé reçu » de `uploadSignaturePublic` (`devis.service.ts:2480`).

Si l'un de ces envois échoue après persistance, il n'existe aucun chemin de renvoi.

**Pour les emails de DEMANDE de signature (pré-signature) : OUI, partiellement** :
- `POST /devis/:id/envoyer-direct` (`devis.controller.ts:230` → `envoyerDevisDirect`, `devis.service.ts:1630`) : rappelable manuellement à volonté, renvoie l'email contenant le lien de signature. Constat annexe : si `devis.statut !== 'EN_ATTENTE'`, il **remet le statut à EN_ATTENTE** (`devis.service.ts:1686-1691`) — un renvoi sur un devis déjà signé le dé-signerait au niveau statut.
- `POST /invitations-directeur` (`invitations-directeur.controller.ts:33` → `creer`, `invitations-directeur.service.ts:114`) : rappelable tant que le devis est `SELECTIONNE` (garde `invitations-directeur.service.ts:147`) — crée une **nouvelle** invitation + renvoie l'email : renvoi de fait pour le chemin COLLAB.
- `POST /devis/public/:token/envoyer-direction` (`devis-public.controller.ts:52` → `envoyerADirection`, `devis.service.ts:2315`) : **NON rappelable** après le premier envoi — garde `statut === 'EN_ATTENTE'` (`devis.service.ts:2342-2344`) alors que l'appel fait passer le devis à `EN_ATTENTE_VALIDATION` (:2371-2374).

**Hors sujet mais homonymes** (pour éviter une fausse piste) : `POST /admin/invitations/:id/renvoyer` (`admin.controller.ts:203` → `invitation.service.ts:60`) concerne `InvitationHebergement` (onboarding hébergeur), pas la signature. Le cron `relancerDevisEnAttente` (`notifications.service.ts:93`) relance automatiquement les devis EN_ATTENTE (lien de signature) — automatique, pas manuel.

---

## E. Idempotence

### E.11 — Deuxième appel sur un devis déjà signé

**`signerDevis`** — garde en début de méthode : **OUI** (`devis.service.ts:775-777`) :

```ts
    if (devis.statut !== 'SELECTIONNE' && devis.statut !== StatutDevis.EN_ATTENTE_VALIDATION) {
      throw new ForbiddenException('Seul un devis sélectionné ou en attente de validation peut être signé');
    }
```
Après une première signature, `statut = SIGNE_DIRECTION` ∉ {SELECTIONNE, EN_ATTENTE_VALIDATION} → 2e appel séquentiel = **403**. Limite factuelle : la garde lit hors transaction et l'update :821 ne re-vérifie pas le statut dans son `where` ({ id: devisId } seul) → deux appels **concurrents** peuvent tous deux passer la garde (même classe TOCTOU que le backlog `run-chambres-4b.md` §6bis).

**`signerSansCompte`** — garde en début de méthode : **OUI, mais sur l'invitation, pas sur le devis** (`invitations-directeur.service.ts:211`) :

```ts
    if (invitation.signeAt) throw new ForbiddenException('Cette invitation a déjà été signée');
```
2e appel via la **même** invitation → 403. En revanche, **aucun contrôle du statut du devis** : l'update :226-238 (`where: { id: invitation.devisId }` sans condition de statut) écraserait la signature d'un devis déjà signé par un autre chemin ; et `creer` étant rappelable (garde `SELECTIONNE` seulement, `invitations-directeur.service.ts:147`), deux invitations distinctes sur le même devis peuvent chacune signer. Même TOCTOU concurrent que ci-dessus (garde :211 lue hors tx).

**`uploadSignatureDocument`** — garde en début de méthode : **OUI mais elle ACCEPTE le re-passage** (`devis.service.ts:914-916`) :

```ts
    if (devis.statut !== 'SELECTIONNE' && devis.statut !== 'SIGNE_DIRECTION') {
      throw new ForbiddenException('Le devis doit être sélectionné pour uploader un document');
    }
```
`SIGNE_DIRECTION` est explicitement admis → un 2e appel sur un devis **déjà signé** est accepté et ré-exécute tout le flux : nouvel upload storage (:921), ré-écriture de `signatureDocumentUrl` / `signatureDirecteur` / `dateSignatureDirecteur` dans la tx (:925-945 — les métadonnées de la 1re signature sont écrasées, la date re-posée), re-update séjour (:938), re-sync (:949), **ré-envoi de l'email hébergeur** (:960). Aucune garde anti-ré-exécution.

---

*Fin du census. Aucun fichier de code modifié.*

## 2. Commits d6e27d0 et 32e0279

### git show --stat d6e27d0
````
commit d6e27d066b138bd352206ef2b235c27d02717c69
Author: theorocheloison-hash <theo.rocheloison@gmail.com>
Date:   Tue Jul 21 17:14:43 2026 +0200

    4b Lot 1: transactionalise signerDevisDirect + uploadSignaturePublic (devis+séjour atomiques, sync/emails hors tx)
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

 backend/src/devis/devis.service.ts | 70 ++++++++++++++++++++------------------
 1 file changed, 37 insertions(+), 33 deletions(-)
````
### git show d6e27d0
````diff
commit d6e27d066b138bd352206ef2b235c27d02717c69
Author: theorocheloison-hash <theo.rocheloison@gmail.com>
Date:   Tue Jul 21 17:14:43 2026 +0200

    4b Lot 1: transactionalise signerDevisDirect + uploadSignaturePublic (devis+séjour atomiques, sync/emails hors tx)
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

diff --git a/backend/src/devis/devis.service.ts b/backend/src/devis/devis.service.ts
index 6025157..593b67e 100644
--- a/backend/src/devis/devis.service.ts
+++ b/backend/src/devis/devis.service.ts
@@ -2203,25 +2203,27 @@ export class DevisService {
       .update(`${token}${body.nomSignataire}${now.toISOString()}${devis.montantTTC ?? '0'}`)
       .digest('hex');
 
-    await this.prisma.devis.update({
-      where: { id: devis.id },
-      data: {
-        statut: StatutDevis.SELECTIONNE,
-        signatureDirecteur: `Signé électroniquement par ${body.nomSignataire}${body.fonctionSignataire ? ` (${body.fonctionSignataire})` : ''} — ${now.toLocaleDateString('fr-FR')}`,
-        nomSignataireDirecteur: body.nomSignataire.trim(),
-        dateSignatureDirecteur: now,
-        signatureIpAddress: req.ip ?? null,
-        signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
-        signatureHash: hash,
-      },
-    });
+    await this.prisma.$transaction(async (tx) => {
+      await tx.devis.update({
+        where: { id: devis.id },
+        data: {
+          statut: StatutDevis.SELECTIONNE,
+          signatureDirecteur: `Signé électroniquement par ${body.nomSignataire}${body.fonctionSignataire ? ` (${body.fonctionSignataire})` : ''} — ${now.toLocaleDateString('fr-FR')}`,
+          nomSignataireDirecteur: body.nomSignataire.trim(),
+          dateSignatureDirecteur: now,
+          signatureIpAddress: req.ip ?? null,
+          signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
+          signatureHash: hash,
+        },
+      });
 
-    await this.prisma.sejour.update({
-      where: { id: devis.sejourDirect.id },
-      data: {
-        statut: StatutSejour.CONVENTION,
-        hebergementSelectionneId: devis.centreId,
-      },
+      await tx.sejour.update({
+        where: { id: devis.sejourDirect!.id },
+        data: {
+          statut: StatutSejour.CONVENTION,
+          hebergementSelectionneId: devis.centreId,
+        },
+      });
     });
 
     // Sync occupations chambres (site 7 du §3.1, run-chambres-4a) — page
@@ -2435,22 +2437,24 @@ export class DevisService {
 
     const nomSignataireClean = nomSignataire?.trim().slice(0, 255) || null;
 
-    await this.prisma.devis.update({
-      where: { id: devis.id },
-      data: {
-        statut: StatutDevis.SELECTIONNE,
-        signatureDocumentUrl: documentUrl,
-        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
-        ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
-        dateSignatureDirecteur: new Date(),
-        signatureIpAddress: req.ip ?? null,
-        signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
-      },
-    });
+    await this.prisma.$transaction(async (tx) => {
+      await tx.devis.update({
+        where: { id: devis.id },
+        data: {
+          statut: StatutDevis.SELECTIONNE,
+          signatureDocumentUrl: documentUrl,
+          signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
+          ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
+          dateSignatureDirecteur: new Date(),
+          signatureIpAddress: req.ip ?? null,
+          signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
+        },
+      });
 
-    await this.prisma.sejour.update({
-      where: { id: devis.sejourDirect.id },
-      data: { statut: StatutSejour.CONVENTION },
+      await tx.sejour.update({
+        where: { id: devis.sejourDirect!.id },
+        data: { statut: StatutSejour.CONVENTION },
+      });
     });
 
     // Sync occupations chambres (site 8 du §3.1, run-chambres-4a).
````
### git show --stat 32e0279
````
commit 32e0279fe1f1045df77eb5442364be309f8e40d3
Author: theorocheloison-hash <theo.rocheloison@gmail.com>
Date:   Tue Jul 21 17:41:42 2026 +0200

    4b Lot 2: transactionalise uploadSignatureDocument + marquerDevisSigneHebergeur (devis+séjour atomiques, remontée du callback, sync/emails hors tx)
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

 backend/src/devis/devis.service.ts | 80 ++++++++++++++++++++++----------------
 1 file changed, 47 insertions(+), 33 deletions(-)
````
### git show 32e0279
````diff
commit 32e0279fe1f1045df77eb5442364be309f8e40d3
Author: theorocheloison-hash <theo.rocheloison@gmail.com>
Date:   Tue Jul 21 17:41:42 2026 +0200

    4b Lot 2: transactionalise uploadSignatureDocument + marquerDevisSigneHebergeur (devis+séjour atomiques, remontée du callback, sync/emails hors tx)
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

diff --git a/backend/src/devis/devis.service.ts b/backend/src/devis/devis.service.ts
index 593b67e..a422255 100644
--- a/backend/src/devis/devis.service.ts
+++ b/backend/src/devis/devis.service.ts
@@ -922,22 +922,29 @@ export class DevisService {
 
     const nomSignataireClean = nomSignataire?.trim().slice(0, 255) || null;
 
-    const updated = await this.prisma.devis.update({
-      where: { id: devisId },
-      data: {
-        signatureDocumentUrl: url,
-        statut: 'SIGNE_DIRECTION',
-        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
-        ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
-        dateSignatureDirecteur: new Date(),
-      },
+    const updated = await this.prisma.$transaction(async (tx) => {
+      const devisMaj = await tx.devis.update({
+        where: { id: devisId },
+        data: {
+          signatureDocumentUrl: url,
+          statut: 'SIGNE_DIRECTION',
+          signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
+          ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
+          dateSignatureDirecteur: new Date(),
+        },
+      });
+
+      if (devis.demande?.sejourId) {
+        await tx.sejour.update({
+          where: { id: devis.demande.sejourId },
+          data: { statut: 'SIGNE_DIRECTION' },
+        });
+      }
+
+      return devisMaj;
     });
 
     if (devis.demande?.sejourId) {
-      await this.prisma.sejour.update({
-        where: { id: devis.demande.sejourId },
-        data: { statut: 'SIGNE_DIRECTION' },
-      });
       // Sync occupations chambres (site 5 du §3.1, run-chambres-4a).
       await this.occupations.syncOccupationsSejourSafe(devis.demande.sejourId, 'devis.uploadSignatureDocument');
     }
@@ -1041,29 +1048,36 @@ export class DevisService {
     const targetStatut = isClientSignature ? StatutDevis.SELECTIONNE : StatutDevis.SIGNE_DIRECTION;
     const targetSejourStatut = isClientSignature ? StatutSejour.CONVENTION : StatutSejour.SIGNE_DIRECTION;
 
-    const updated = await this.prisma.devis.update({
-      where: { id: devisId },
-      data: {
-        statut: targetStatut,
-        ...(signatureDocumentUrl ? { signatureDocumentUrl } : {}),
-        signatureDirecteur: nomSignataireClean
-          ? `Signé par ${nomSignataireClean} — enregistré le ${new Date().toLocaleDateString('fr-FR')}`
-          : isClientSignature
-            ? `Signature enregistrée le ${new Date().toLocaleDateString('fr-FR')}`
-            : `Signature direction enregistrée le ${new Date().toLocaleDateString('fr-FR')}`,
-        ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
-        dateSignatureDirecteur: new Date(),
-      },
-    });
-
-    if (sejourId) {
-      await this.prisma.sejour.update({
-        where: { id: sejourId },
+    const updated = await this.prisma.$transaction(async (tx) => {
+      const devisMaj = await tx.devis.update({
+        where: { id: devisId },
         data: {
-          statut: targetSejourStatut,
-          ...(isClientSignature ? { hebergementSelectionneId: devis.centreId } : {}),
+          statut: targetStatut,
+          ...(signatureDocumentUrl ? { signatureDocumentUrl } : {}),
+          signatureDirecteur: nomSignataireClean
+            ? `Signé par ${nomSignataireClean} — enregistré le ${new Date().toLocaleDateString('fr-FR')}`
+            : isClientSignature
+              ? `Signature enregistrée le ${new Date().toLocaleDateString('fr-FR')}`
+              : `Signature direction enregistrée le ${new Date().toLocaleDateString('fr-FR')}`,
+          ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
+          dateSignatureDirecteur: new Date(),
         },
       });
+
+      if (sejourId) {
+        await tx.sejour.update({
+          where: { id: sejourId },
+          data: {
+            statut: targetSejourStatut,
+            ...(isClientSignature ? { hebergementSelectionneId: devis.centreId } : {}),
+          },
+        });
+      }
+
+      return devisMaj;
+    });
+
+    if (sejourId) {
       // Sync occupations chambres (site 6 du §3.1, run-chambres-4a).
       await this.occupations.syncOccupationsSejourSafe(sejourId, 'devis.marquerDevisSigneHebergeur');
     }
````

## 3. annulerDevis et ses helpers

### grep -n "annulerDevis" backend/src/devis/devis.service.ts
````
2523:  async annulerDevis(devisId: string, userId: string, centreId?: string | null) {
2600:      await this.occupations.syncOccupationsSejourSafe(sejourCibleId, 'devis.annulerDevis');
````
### Corps intégral de annulerDevis (backend/src/devis/devis.service.ts, lignes 2523–2627)
````ts
2523	  async annulerDevis(devisId: string, userId: string, centreId?: string | null) {
2524	    const centre = await getCentreForUser(this.prisma, userId, centreId);
2525	
2526	    const devis = await this.prisma.devis.findUnique({
2527	      where: { id: devisId },
2528	      include: {
2529	        sejourDirect: { select: { id: true } },
2530	        demande: { select: { sejourId: true } },
2531	        factures: { select: { id: true, typeFacture: true } },
2532	      },
2533	    });
2534	    if (!devis) throw new NotFoundException('Devis introuvable');
2535	    if (devis.centreId !== centre.id) {
2536	      throw new ForbiddenException('Ce devis ne vous appartient pas');
2537	    }
2538	
2539	    const statutsAnnulables: StatutDevis[] = [
2540	      StatutDevis.EN_ATTENTE,
2541	      StatutDevis.SELECTIONNE,
2542	      StatutDevis.SIGNE_DIRECTION,
2543	    ];
2544	    if (!statutsAnnulables.includes(devis.statut)) {
2545	      throw new ForbiddenException(
2546	        'Ce devis ne peut pas être annulé à ce stade. ' +
2547	        'Si une facture a déjà été émise, utilisez la procédure d\'avoir.'
2548	      );
2549	    }
2550	
2551	    // Toute facture émise (acompte OU solde) doit être couverte par un avoir avant
2552	    // l'annulation (flux 2 étapes conforme : émettre l'avoir, puis annuler).
2553	    const facturesEmises = devis.factures.filter(
2554	      (f) => f.typeFacture === 'ACOMPTE' || f.typeFacture === 'SOLDE',
2555	    );
2556	    for (const f of facturesEmises) {
2557	      const avoir = await this.prisma.facture.findUnique({
2558	        where: { factureAnnuleeId: f.id },
2559	      });
2560	      if (!avoir) {
2561	        throw new ForbiddenException(
2562	          'Une facture a été émise pour ce devis. Émettez d\'abord un avoir ' +
2563	          'depuis l\'onglet Devis & Facturation avant d\'annuler.'
2564	        );
2565	      }
2566	    }
2567	
2568	    await this.prisma.devis.update({
2569	      where: { id: devisId },
2570	      data: { statut: StatutDevis.NON_RETENU },
2571	    });
2572	
2573	    // Transition séjour → OPTION s'il ne reste plus aucun devis actif (sélectionné
2574	    // ou signé) sur le séjour (DIRECT ou COLLABORATIF). updateMany filtré pour ne
2575	    // rétrograder que les statuts pilotés par le devis (pas DRAFT/OPTION/TAM/rectorat).
2576	    const sejourCibleId = devis.sejourDirectId ?? devis.demande?.sejourId ?? null;
2577	    if (sejourCibleId) {
2578	      const autresActifs = await this.prisma.devis.count({
2579	        where: {
2580	          id: { not: devisId },
2581	          isComplementaire: false, // les complémentaires ne pilotent pas le statut du séjour
2582	          statut: { in: STATUTS_DEVIS_ENGAGEANTS },
2583	          OR: [
2584	            { sejourDirectId: sejourCibleId },
2585	            { demande: { sejourId: sejourCibleId } },
2586	          ],
2587	        },
2588	      });
2589	      if (autresActifs === 0) {
2590	        await this.prisma.sejour.updateMany({
2591	          where: {
2592	            id: sejourCibleId,
2593	            statut: { in: [StatutSejour.SUBMITTED, StatutSejour.CONVENTION, StatutSejour.SIGNE_DIRECTION] },
2594	          },
2595	          data: { statut: StatutSejour.OPTION },
2596	        });
2597	      }
2598	      // Sync occupations chambres (site 9 du §3.1, run-chambres-4a) — hors du
2599	      // if (autresActifs === 0) : le sync recalcule lui-même l'état dérivé.
2600	      await this.occupations.syncOccupationsSejourSafe(sejourCibleId, 'devis.annulerDevis');
2601	    }
2602	
2603	    // Log CRM non bloquant
2604	    try {
2605	      if (sejourCibleId) {
2606	        const sejourClient = await this.prisma.sejourClient.findFirst({
2607	          where: { sejourId: sejourCibleId },
2608	          select: { clientId: true },
2609	        });
2610	        if (sejourClient) {
2611	          await this.prisma.activiteClient.create({
2612	            data: {
2613	              clientId: sejourClient.clientId,
2614	              centreId: centre.id,
2615	              sejourId: sejourCibleId,
2616	              type: 'ANNULATION',
2617	              description: `Devis ${devis.numeroDevis ?? devisId} annulé`,
2618	              metadata: { devisId },
2619	              userId,
2620	            },
2621	          });
2622	        }
2623	      }
2624	    } catch { /* non bloquant */ }
2625	
2626	    return { success: true };
2627	  }
````
### Helpers appelés depuis annulerDevis

- getCentreForUser — backend/src/centres/centre.helper.ts:4
- syncOccupationsSejourSafe — backend/src/chambres/occupations.service.ts:222 (appelle syncOccupationsSejour du même fichier → niveau 2 extrait ci-dessous)

### getCentreForUser (backend/src/centres/centre.helper.ts, lignes 4–48)
````ts
4	export async function getCentreForUser(
5	  prisma: PrismaService,
6	  userId: string,
7	  centreId?: string | null,
8	) {
9	  if (centreId) {
10	    const centre = await prisma.centreHebergement.findUnique({ where: { id: centreId } });
11	    // SUSPENDED = kill switch : 404 pour tout le monde, propriétaire compris.
12	    // 404 (et non 403) pour ne pas distinguer inexistant / suspendu.
13	    if (!centre || centre.statut === 'SUSPENDED') throw new NotFoundException('Centre introuvable');
14	
15	    // Un centre PENDING est opérable par son propriétaire et ses collaborateurs
16	    // acceptés : la frontière de sécurité n'est plus l'accès au centre mais les
17	    // gates d'envoi (assertEnvoiExterneAutorise) — le catalogue public filtre
18	    // statut ACTIVE par ses propres requêtes, indépendamment de ce helper.
19	    // L'appartenance est vérifiée AVANT de révéler quoi que ce soit.
20	    if (centre.userId === userId) return centre;
21	
22	    const collab = await prisma.collaborateurCentre.findFirst({
23	      where: { centreId, userId, acceptedAt: { not: null } },
24	    });
25	    if (collab) return centre;
26	
27	    // Tiers : un centre PENDING ne doit pas être sondable par ID → 404.
28	    // Centre ACTIVE : 403 conservé (comportement historique attendu des appelants).
29	    if (centre.statut !== 'ACTIVE') throw new NotFoundException('Centre introuvable');
30	    throw new ForbiddenException('Ce centre ne vous appartient pas');
31	  }
32	
33	  // Sans centreId : chercher d'abord en propriétaire, puis en collaborateur.
34	  // PENDING inclus (opérable) — seul SUSPENDED est exclu.
35	  const ownCentre = await prisma.centreHebergement.findFirst({
36	    where: { userId, statut: { not: 'SUSPENDED' } },
37	  });
38	  if (ownCentre) return ownCentre;
39	
40	  // Fallback : premier centre où l'user est collaborateur accepté
41	  const collab = await prisma.collaborateurCentre.findFirst({
42	    where: { userId, acceptedAt: { not: null }, centre: { statut: { not: 'SUSPENDED' } } },
43	    include: { centre: true },
44	  });
45	  if (collab) return collab.centre;
46	
47	  throw new NotFoundException('Centre introuvable');
48	}
````
### syncOccupationsSejourSafe (backend/src/chambres/occupations.service.ts, lignes 222–228)
````ts
222	  async syncOccupationsSejourSafe(sejourId: string, site: string): Promise<void> {
223	    try {
224	      await this.syncOccupationsSejour(sejourId);
225	    } catch (err) {
226	      this.logger.error(`[sync] échec — site=${site} sejourId=${sejourId}`, err as Error);
227	    }
228	  }
````
### Niveau 2 — syncOccupationsSejour (backend/src/chambres/occupations.service.ts, lignes 178–215)
````ts
178	  async syncOccupationsSejour(sejourId: string, tx?: Prisma.TransactionClient): Promise<void> {
179	    const db: Db = tx ?? this.prisma;
180	    const cible = await this.deriverCible(db, sejourId);
181	    const occupations = await db.occupationChambre.findMany({
182	      where: { sejourId, source: 'SEJOUR' },
183	      select: { id: true, chambreId: true, dateDebut: true, dateFin: true, statut: true },
184	    });
185	
186	    for (const occ of occupations) {
187	      if (occ.statut === 'A_REPLACER' || occ.statut === cible) continue;
188	
189	      if (cible === 'OPTION') {
190	        await db.occupationChambre.update({ where: { id: occ.id }, data: { statut: 'OPTION' } });
191	        continue;
192	      }
193	
194	      const conflits = await this.chevauchementsFermes(
195	        db, [occ.chambreId], occ.dateDebut, occ.dateFin, occ.id,
196	      );
197	      if (conflits.length > 0) {
198	        await db.occupationChambre.update({
199	          where: { id: occ.id },
200	          data: { statut: 'A_REPLACER' },
201	        });
202	        continue;
203	      }
204	      try {
205	        await db.occupationChambre.update({ where: { id: occ.id }, data: { statut: 'FERME' } });
206	      } catch (err) {
207	        // Course entre le check et l'update : le filet 23P01 pose A_REPLACER.
208	        if (!isConflitExclusion(err)) throw err;
209	        await db.occupationChambre.update({
210	          where: { id: occ.id },
211	          data: { statut: 'A_REPLACER' },
212	        });
213	      }
214	    }
215	  }
````

## 4. backend/src/prisma/prisma.service.ts (intégral)
````ts
1	import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
2	import { PrismaClient } from '@prisma/client';
3	import { PrismaPg } from '@prisma/adapter-pg';
4	
5	@Injectable()
6	export class PrismaService
7	  extends PrismaClient
8	  implements OnModuleInit, OnModuleDestroy
9	{
10	  constructor() {
11	    const adapter = new PrismaPg({
12	      connectionString: process.env.DATABASE_URL,
13	    });
14	    super({ adapter });
15	  }
16	
17	  async onModuleInit() {
18	    await this.$connect();
19	  }
20	
21	  async onModuleDestroy() {
22	    await this.$disconnect();
23	  }
24	}
````
Recherche extension/middleware Prisma : grep -rn "\$extends\|\$use" backend/src --include=*.ts
````
(aucun résultat)
````
INTROUVABLE : fichier d'extension/middleware Prisma ($extends/$use) — aucun résultat.

## 5. grep -rn "maxWait\|timeout" backend/src --include=*.ts | grep -i transaction
````
(aucun résultat)
````
40792 docs/extract-lot3.md
