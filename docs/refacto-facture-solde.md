# Refacto facturation acompte/solde — Phase 1 : recensement (lecture seule)

> Date : 16/07/2026 — Run Fable 5, AUCUNE modification de code, AUCUN commit.
> Bug structurel visé : la réconciliation des paiements est cloisonnée PAR FACTURE alors que le client paie un TOTAL.
> Invariant cible : **reste dû = montant TTC du devis − somme de TOUS les versements du devis.**
> Forme cible : Variante A (facture de solde classique à déduction) — validée par Théo.

---

## 1. CARTOGRAPHIE ACTUELLE

### 1.1 Service — émission (`backend/src/facture/facture.service.ts`)

**`emettreAcompte` (L332-431)**
- `montantTTC = round2(devis.montantTTC ?? devis.montantTotal)` (L359).
- `montantFacture = round2(devis.montantAcompte ?? montantTTC × pourcentage/100)` (L360-361), `pourcentage = devis.pourcentageAcompte ?? 30` (L360).
- Snapshot créé avec `include: { versements: true }` (L400) → le PDF d'émission n'a aucun versement (facture neuve).
- Ne mute PAS le devis (doc L331).

**`emettreFactureSolde` (L433-628)** — le cœur du bug :
- Gates : facture d'acompte existante (L438-443), **`factureAcompte.acompteVerse` requis** (L444-446), pas de solde existant (L447-452).
- `montantTTC` = total **révisé** du devis à l'émission (L454).
- `acompte = factureAcompte.montantFacture` (L455) → **c'est l'acompte FACTURÉ, jamais l'acompte RÉGLÉ**.
- Si `montantTTC <= acompte` : exige un avoir sur l'acompte, `acompteNet = acompte + avoir.montantFacture` (avoir négatif, L456-476).
- **`montantFacture (solde) = round2(max(0, montantTTC − acompteNet))`** (L477).
- Persisté : `factureAcompteId` (L510), **`montantAcompteDejaFacture = acompteNet`** (L511).
- **Re-balance des versements (L554-625)** : parcourt les versements de l'ACOMPTE par date croissante (L555-558) ; tant que `cumul < factureAcompte.montantFacture` le versement reste sur l'acompte, sinon il est **déplacé** vers la facture de solde (L560-576). Nuance : un versement à cheval sur la frontière n'est PAS scindé — il reste entier sur l'acompte (le test `cumul >= montantFacture` se fait AVANT ajout, L563). Puis recalcul `montantVerseTotal` des deux factures avec seuil `acompteVerse = versé ≥ facturé × 0.99` (L579-604), régénération des 2 PDF (L607-622), `resyncMontantVerseDevis` (L624).

**`emettreFactureTotal` (L636-736)** — facture SOLDE à 100 % sans acompte :
- Guard : aucune facture ACOMPTE/SOLDE existante (L651-656).
- `montantFacture = montantTTC` (L689), `pourcentageAcompte: null` (L690), `factureAcompteId: null` (L691), **`montantAcompteDejaFacture: 0`** (L692). C'est ce `0` qui route la branche « Montant dû » du PDF (cf. §1.3).

**`validerAcompte` (L1149-1191)** : pose `acompteVerse: true, dateVersement` **sans créer de versement** (L1172-1176) → c'est le chemin « acompte validé à la main SANS versement » (`montantVerseTotal` de la facture reste 0). Ouvre le gate du solde (L444).

**`ajouterVersement` (L1024-1103)** :
- Routage : **« première facture (tri `dateEmission asc`) dont `montantVerseTotal < montantFacture × 0.99` »**, fallback = dernière facture (trop-perçu) (L1068-1070).
- Le versement est créé avec `devisId` ET `factureId` (L1073-1082).
- Update facture cible : cumul, `acompteVerse` au seuil 0.99, `dateVersement` à la première complétion (L1084-1095).
- `resyncMontantVerseDevis(devisId)` (L1097) puis régénération du PDF de la facture cible (L1100 — dette 4.21 : le PDF « bouge » après émission).

**`supprimerVersement` (L1105-1147)** : delete, recalcul du total de LA facture (L1128-1139), resync devis (L1141), refresh PDF (L1144).

**`resyncMontantVerseDevis` (L1012-1022)** : `devis.montantVerseTotal = Σ versements du devis` — **l'invariant « niveau devis » existe déjà côté Devis**, il n'est simplement pas utilisé par la facturation.

### 1.2 Mapper (`backend/src/facture/pdf/facture-pdf.mapper.ts`)

- `montantFacture` (L61), `montantAcompteDejaFacture` (L63) passés tels quels au PDF.
- `versements` = **uniquement ceux rattachés à la facture** (L70-75) — la restriction vient des requêtes du service (`include: { versements }` de la facture : L91, L121, L400, L524, L610, L618, L705).
- Aucune donnée de la facture d'acompte liée (numéro/date) n'est mappée aujourd'hui.

### 1.3 PDF (`backend/src/facture/pdf/FacturePDF.tsx`)

- `totalVerse = Σ versements (de CETTE facture)` (L192) ; `resteAPayer = montantFacture − totalVerse` (L193).
- `resteBlock` (L194-214) : affiché si `totalVerse > 0` ; « Soldé ✓ » si reste ≤ 0,01 (L207-213).
- Branche ACOMPTE (L303-311) : ligne « Acompte (X %) » = `montantFacture` + resteBlock.
- Branche SOLDE (L313-336) :
  - si `montantAcompteDejaFacture > 0` : ligne **« Acompte déjà versé »** (libellé) = `montantAcompteDejaFacture` (L317-318) — **le libellé dit « versé » mais la valeur est l'acompte FACTURÉ net d'avoir** ; « Montant du solde » = `montantFacture` (L321-322) ; resteBlock (L324).
  - sinon (== 0, cas `emettreFactureTotal`) : « Montant dû » = `montantFacture` (L330-331) + resteBlock.
- Tableau « Règlements reçus » (L357-369) : liste les `versements` reçus en props — donc ceux de la facture seule.

### 1.4 Générateur CII Factur-X (`backend/src/facture/facture-x.ts`)

- `prepaidXml` (L134-138) : `TotalPrepaidAmount = montantAcompteDejaFacture` — **SOLDE uniquement, et seulement si non-null** (un solde à `montantAcompteDejaFacture = 0` émet quand même la balise, valeur 0.00 ; un ACOMPTE n'en émet pas).
- `DuePayableAmount = montantFacture` (L239), `GrandTotalAmount = montantTTC` (L238).
- L'équation EN 16931 (BT-115 = BT-112 − BT-113) boucle à l'émission par construction (`montantFacture = montantTTC − acompteNet`), mais **Prepaid = facturé (pas réglé)** et **Due ne reflète jamais les règlements réels** → dès que réglé ≠ facturé, le XML est économiquement faux (et le PDF étant régénéré à chaque versement, le XML embarqué est re-produit avec les mêmes valeurs figées).

### 1.5 Générateur UBL Chorus (`facture.service.ts::getChorusXml`, L1195-1304)

- `prepaid = typeFacture === 'SOLDE' ? (montantAcompteDejaFacture ?? 0) : 0` (L1231).
- `PrepaidAmount` (L1296), `PayableAmount = montantFacture` (L1297) — mêmes valeurs figées que le CII, mêmes limites.
- Avoirs : refusés (L1202-1206). Gate mandat de facturation (L1207-1211).

### 1.6 Modèle de données (`backend/prisma/schema.prisma`)

- `VersementPaiement` (L984-999) : porte **`devisId` (L986, obligatoire) ET `factureId` (L987, optionnel)** → la requête « tous les versements du devis » est déjà possible sans migration.
- `Facture` (L1006-1063) : `montantFacture` (L1033), `factureAcompteId` (L1036), `montantAcompteDejaFacture` (L1037), `montantVerseTotal` (L1039), `acompteVerse` (L1040), `dateVersement` (L1041), relation `factureAcompte`/`facturesSolde` (L1051-1052).
- `Devis` (L875-961) : `montantVerseTotal` (L934, maintenu par resync) ; champs legacy pré-Lot 1 (`acompteVerse` L907, `estFacture` L911, `numeroFacture` L914, `typeDocument` L922) — non utilisés par le flux Facture actuel.

### 1.7 Chemin de facturation alternatif : AUCUN

`devis.controller.ts` L223-227 confirme : les routes `facturer-acompte` / `facturer-solde` / versements côté devis ont été **supprimées** (Lot 1) et renvoient vers FactureModule. Le seul chemin est `facture.controller.ts` : POST `/factures/acompte` (L22), `/factures/solde` (L34), `/factures/total` (L46), `/factures/avoir` (L58), `/factures/versements` (L87), POST `/factures/:id/envoyer` (L98), GET `/factures/devis/:devisId` (L111), PATCH `/factures/:id/versements/:vid/supprimer` (L122), PATCH `/factures/:id/valider-acompte` (L134), GET `/factures/:id/chorus-xml` (L145), GET `/factures/:id/pdf` (L156), POST `/factures/:id/regenerer-pdf` (L172).
NB : `DevisLibre` (schema L1082) a son propre suivi de paiement (centre.service.ts L588-593) — flux séparé, hors périmètre.

---

## 2. INVENTAIRE DES LECTEURS

| Lecteur | Fichier:ligne | Ce qu'il lit | Impact d'un passage « niveau devis » |
|---|---|---|---|
| CII Factur-X | facture-x.ts:134-138, 239 | `montantAcompteDejaFacture` → Prepaid ; `montantFacture` → Due | À réaligner : Prepaid = total réglé du devis, Due = reste (cf. §3.3). |
| UBL Chorus | facture.service.ts:1231, 1296-1297 | idem | Idem, symétriquement. |
| PDF solde | FacturePDF.tsx:313-336 via mapper:61-63 | `montantAcompteDejaFacture` (« Acompte déjà versé »), `montantFacture` (« Montant du solde ») | Refonte Variante A ; la valeur « acompte facturé » reste utile (ligne −2 970) mais le libellé change. |
| PDF resteBlock | FacturePDF.tsx:192-214 | versements de LA facture | Doit passer aux versements du DEVIS pour le solde. |
| Branche « Montant dû » (facture total) | FacturePDF.tsx:314, 326-335 | `montantAcompteDejaFacture > 0` comme **discriminant** solde-avec-acompte vs facture-total | Si la sémantique du champ change, ce discriminant doit être re-vérifié (le `0` posé par emettreFactureTotal L692 est ce qui route la branche). |
| Routage des versements | facture.service.ts:1068-1070 | `montantVerseTotal < montantFacture × 0.99` PAR facture | Si le reste devient global, le routage par facture perd son sens comptable — mais `factureId` reste nécessaire tant que PDF acompte/exports raisonnent par facture. À statuer (§6). |
| Re-balance | facture.service.ts:554-625 | déplace des versements entre factures | Étape de suppression dédiée (§4) : si le solde lit TOUS les versements du devis, déplacer les versements ne sert plus à rien. |
| KPI « à facturer solde » dashboard | centres/centre.service.ts:525-551 | `montantVerseTotal: f.montantFacture // acompte déjà facturé (= versé)` (L544) — **le postulat « facturé = versé » est codé en dur** ; montant à facturer = `montantTTC − montantFacture(acompte)` (L550) | Même hypothèse fausse que le solde actuel ; à recalculer au niveau devis (suivi, peut rester en l'état au lot 1). |
| KPI « paiements en attente » | centre.service.ts:553-580 | impayé = `montantVerseTotal < montantFacture` PAR facture (L570) | Un versement « global » non rattaché fausserait ce KPI → argument pour GARDER le rattachement versement→facture. |
| Export comptable CSV | pilotage.service.ts:422-474 | `montantVerseTotal`, `montantFacture` par facture ; `Payé = versé ≥ facturé` (L459) ; dernier versement du DEVIS (L433-441) | Même dépendance au rattachement par facture. Testé par pilotage.service.spec.ts:151-167. |
| CRM clients | clients/clients.service.ts:105-107 | `acompteVerse`, `montantFacture` des factures | Lecture d'affichage, peu sensible. |
| Signataire — factures d'acompte à valider | devis/devis.service.ts:1171-1183 | `typeFacture: 'ACOMPTE', acompteVerse: false` | Inchangé si `acompteVerse` garde sa sémantique par facture. |
| Factures LIAVO (SaaS) | facture-liavo/facture-liavo.service.ts:91, 173 | pose `montantAcompteDejaFacture: null` | Flux indépendant (abonnements), non concerné. |
| Tests | facture-x.spec.ts:28 (fixture `montantAcompteDejaFacture: null`) ; pilotage.service.spec.ts:23, 151-167 | fixtures/flag Payé | À étendre en Phase 2, pas à réécrire. |
| Frontend (HORS SCOPE, référence) | TabDevisFacturation.tsx:808-810 | **calcule déjà `resteDu = ad.montantTTC − Σ versements` au niveau devis → tombe juste** ; :382 et :955 raisonnent encore par facture (facture cible, « montant attendu ») | Sert de référence de l'invariant ; liste de suivi en §5.7. |

Faux positif écarté : `autorisations/autorisation.service.ts:322-331` (`montantVerseTotal` de `AutorisationParentale` — paiements familles, modèle sans rapport).

---

## 3. MODÈLE CIBLE (Variante A)

### 3.1 Provenance de chaque ligne du PDF de solde

| Ligne cible | Source | Existe déjà ? |
|---|---|---|
| `Total TTC du séjour ..... 6 600,00` | `facture.montantTTC` (snapshot du total révisé à l'émission du solde) | Oui (mapper L60) |
| `Acompte facturé (FA-2026-XXXX) . −2 970,00` | `factureAcompte.montantFacture` net d'avoir = actuel `montantAcompteDejaFacture` (L511) + **numéro et date de la facture d'acompte via la relation `factureAcompte` (schema L1051)** | Valeur oui ; n° + date : NON mappés aujourd'hui → nouvelles props mapper (`factureAcompteNumero`, `factureAcompteDate`), et inclusion de la relation dans les 4 requêtes de génération (facture.service L87-100, L117-130, L485-525, L607-622) |
| `Montant du solde ........ 3 630,00` | `montantTTC − acompte facturé net` = actuel `facture.montantFacture` du solde | Oui |
| `Règlements reçus (TOUS)` | **`prisma.versementPaiement.findMany({ where: { devisId }, orderBy: { datePaiement: 'asc' } })`** — `devisId` existe sur chaque versement (schema L986), aucune migration requise. À injecter dans le mapper à la place des versements de la seule facture | NON — aujourd'hui versements de LA facture (mapper L70-75) |
| `Total réglé ............. 4 620,00` | `Σ versements du devis` (= `devis.montantVerseTotal`, déjà maintenu par `resyncMontantVerseDevis` L1012-1022 ; à recalculer depuis la liste pour l'auto-cohérence du document) | Donnée oui, affichage non |
| `Reste à payer ........... 1 980,00` | `montantTTC − total réglé` (borné : comportement trop-perçu à trancher, cf. §6.4) | NON (aujourd'hui `montantFacture − versements facture`, L193) |

### 3.2 PDF d'ACOMPTE (recensement, pas de décision)

Aujourd'hui l'acompte liste ses propres versements (L192, L303-311) et son reste = `montantFacture(acompte) − versés(acompte)`. Si les versements ne sont plus déplacés (suppression re-balance), un acompte sur-payé afficherait un reste négatif → « Soldé ✓ » (L207-213), ce qui reste correct. **Question ouverte §6.5 : l'acompte doit-il, lui aussi, lister tous les règlements du devis ou seulement les siens ?**

### 3.3 Mapping XML

**CII (facture-x.ts, SOLDE)** :
- `TotalPrepaidAmount` (BT-113) = **total réglé du devis au moment de la génération** (somme de TOUS les versements du devis) — aujourd'hui L137 = acompte facturé.
- `DuePayableAmount` (BT-115) = `GrandTotalAmount − TotalPrepaidAmount` = reste réel — aujourd'hui L239 = `montantFacture` figé.
- `GrandTotalAmount` (BT-112) inchangé = `montantTTC`. L'équation BR-CO-16 boucle par construction.
- Implication de signature : `buildCiiXml(facture, titreSejour)` (L66) ne reçoit pas les versements → **le type `FactureAvecLignes` (L12-15) devra embarquer les versements du devis** (ou un `totalRegleDevis` pré-calculé). Même donnée à injecter dans `embedFacturX` (L253).

**UBL (getChorusXml L1195-1304)** : symétrique — `PrepaidAmount` (L1296) = total réglé du devis, `PayableAmount` (L1297) = reste. La requête L1197-1200 devra inclure les versements du devis.

**ACOMPTE (les deux XML)** : aujourd'hui prepaid = 0 (UBL L1231) / balise absente (CII L134-138). Si l'acompte reste « prepaid 0, due = montantFacture », il reste conforme (facture d'acompte 386 = demande de paiement). À confirmer en §6.5.

---

## 4. PLAN DE REMPLACEMENT (étapes = commits séparés, gate vert à chaque étape)

> Gate = `npx tsc --noEmit` + `npm run build` + `npm test` (187 tests + 3 todo au 16/07). Les étapes 1-3 n'enlèvent rien : elles ajoutent la donnée puis basculent les affichages ; la re-balance ne tombe qu'en étape 5.

| # | Commit (proposition) | Fichiers | Changement conceptuel | Tests associés |
|---|---|---|---|---|
| 0 | `test(facture): caractérise le comportement actuel du solde` | nouveaux specs `facture.service.spec.ts` (ou dossier `facture/__tests__`) | Tests de caractérisation AVANT toute modif : les 7 cas de §7 contre le comportement ACTUEL (montants émis, re-balance, XML). Ils documentent l'existant et détecteront tout écart involontaire aux étapes suivantes (on les fait évoluer explicitement, cas par cas). | Les cas §7 |
| 1 | `feat(facture): expose les versements du devis + la facture d'acompte aux générateurs` | facture.service.ts (les 4 requêtes de génération L87-100, L117-130, L485-525, L607-622 + getChorusXml L1197-1200), facture-pdf.mapper.ts, facture-x.ts (type L12-15) | Charger `devis.versements` (niveau devis) et `factureAcompte { numero, dateEmission, montantFacture }` ; nouvelles props mapper **optionnelles**, rendu inchangé. | tsc + tests étape 0 inchangés (aucun rendu modifié) |
| 2 | `feat(facture): PDF de solde Variante A (déduction + tous les règlements du devis)` | FacturePDF.tsx (branche SOLDE L313-336, resteBlock L189-214), facture-pdf.mapper.ts | « Acompte facturé (n° + date) », « Montant du solde », règlements = TOUS les versements du devis, « Total réglé », « Reste à payer = TTC − réglé ». Branche ACOMPTE et branche « facture total » : selon décisions §6.4/§6.5. | Cas §7 côté PDF (props calculées) |
| 3 | `fix(facture): CII + UBL — Prepaid = total réglé, DuePayable = reste (LÉGAL 01/09)` | facture-x.ts (L134-138, L239), facture.service.ts::getChorusXml (L1231, L1296-1297) | Réalignement des deux XML sur l'invariant. Étape séparée de l'étape 2 pour un diff XML pur, revue comptable facile. | facture-x.spec.ts étendu : solde sur-payé, solde partiel, acompte (prepaid 0), BR-CO-16 |
| 4 | `refactor(facture): garde du solde et cas acompte validé sans versement` | facture.service.ts (emettreFactureSolde L444-477) | Application de la décision §6.3 (comment le « réputé réglé » d'un acompte validé à la main entre dans le calcul du reste). Le montant JURIDIQUE du solde (§6.1) est aussi appliqué ici. | Cas « acompte validé sans versement », « devis révisé à la baisse » |
| 5 | `refactor(facture): supprime la re-balance des versements` | facture.service.ts (L554-625) | Les versements restent rattachés à leur facture d'origine ; le solde n'a plus besoin de les « récupérer » puisqu'il lit le niveau devis. Étape À PART : c'est elle qui change l'état persisté des données futures. Le routage d'`ajouterVersement` (L1068-1070) est conservé ou ajusté selon §6.6. | Cas « acompte sur-payé » : vérifier que PDF/XML du solde restent justes SANS déplacement ; KPIs centre/pilotage inchangés sur les fixtures |
| 6 | `docs(facture): rapport final + liste de suivi frontend` | docs/refacto-facture-solde.md | Rapport Phase 4 + backlog frontend (§5.7). | — |

Ordre justifié : 0 (filet) → 1 (donnée disponible, zéro rendu) → 2 (PDF) → 3 (XML légal) → 4 (calculs d'émission) → 5 (suppression re-balance, la plus invasive sur les données) → 6.

---

## 5. CASCADES & RISQUES

### 5.1 Factur-X CII + UBL Chorus (LÉGAL, échéance 01/09)
Statut : **à réaligner, étape 3**. Aujourd'hui les deux générateurs publient Prepaid = acompte FACTURÉ et Due = montant figé à l'émission (facture-x.ts L134-138/L239 ; facture.service.ts L1231/L1296-1297). Dès que réglé ≠ facturé, le XML est faux. Après refonte : Prepaid = total réglé du devis, Due = TTC − réglé, BR-CO-16 boucle par construction. Point d'attention : le XML est régénéré avec le PDF à chaque versement (voir 5.3) — la conformité est donc celle « au moment de la dernière génération ».

### 5.2 Acompte validé à la main SANS versement (`montantVerseTotal` acompte = 0)
Statut : **risque identifié, décision §6.3 requise**. `validerAcompte` (L1149-1191) pose `acompteVerse: true` sans versement. Avec le calcul naïf « reste = TTC − Σ versements », le solde réclamerait le TOTAL. Le calcul qui le garantit doit être choisi par Théo parmi (au moins) :
  a) reste = TTC − max(Σ versements du devis, acompte facturé si `factureAcompte.acompteVerse`) — hérite du comportement actuel dans ce cas précis ;
  b) à la validation manuelle, auto-créer un `VersementPaiement` de `montantFacture` (l'argent a bien été reçu, il n'a juste pas été saisi) — rend l'invariant pur, mais crée une écriture « synthétique » ;
  c) interdire `validerAcompte` sans versement (forcer la saisie) — change le parcours utilisateur.
Aucune n'est tranchée ici.

### 5.3 Immuabilité (dette 4.21)
Statut : **assumée aujourd'hui, aggravée demain — à arbitrer**. `refreshFacturePdf` (L85-108) régénère PDF **et XML embarqué** à chaque ajout/suppression de versement (L1100, L1144) ; même remarque roadmap §4.21. La Variante A augmente la surface mouvante (liste des règlements + reste sur le document). Options à trancher (§6.7) : figer le PDF émis et porter les règlements sur un document annexe ; ou assumer la régénération (document « relevé de situation » vivant) ; ou snapshotter les versements antérieurs à l'émission. La refonte n'impose aucun des trois mais l'étape 2 doit connaître la réponse.

### 5.4 Factures de solde DÉJÀ émises en prod
Statut : **CONFIRMÉ — ne pas rétro-régénérer**. Les factures existantes sont des snapshots ; la sémantique de `montantAcompteDejaFacture` qui évoluerait ne doit PAS être réappliquée aux anciennes. Concrètement : aucun script de migration de données, aucune régénération de masse ; seules les factures régénérées par une action utilisateur (nouveau versement, régénération manuelle) reprendront le nouveau rendu — et c'est déjà le comportement de la dette 4.21 (à couvrir dans la décision §6.7 : faut-il exclure les factures antérieures à la mise en prod de la refonte du nouveau rendu ?). NB : la donnée stockée (`montantAcompteDejaFacture` = acompte facturé net) reste vraie dans l'ancien ET le nouveau monde si la décision §6.2 la conserve telle quelle.

### 5.5 `emettreFactureTotal`
Statut : **à préserver, non cassé par construction**. Il pose `montantAcompteDejaFacture: 0` (L692) et `montantFacture = montantTTC` (L689). Invariant cible : reste = TTC − Σ versements → identique au comportement actuel pour ce cas (aucun versement à l'émission). Deux points de vigilance : (1) la branche PDF « Montant dû » est routée par `montantAcompteDejaFacture > 0` (FacturePDF.tsx L314) — le discriminant doit survivre à la refonte (ou passer par `factureAcompteId !== null`, plus robuste) ; (2) le CII d'une facture total émet aujourd'hui `TotalPrepaidAmount 0.00` (L135-138 : `!= null` est vrai pour 0) — après refonte, prepaid deviendrait la somme des versements, ce qui est correct.

### 5.6 `ajouterVersement` / `supprimerVersement` — routage par facture
Statut : **le rattachement versement→facture reste NÉCESSAIRE, le routage devient secondaire**. Lecteurs qui en dépendent encore : KPI « paiements en attente » (centre.service L553-580, impayé par facture), export comptable (pilotage L422-474, flag Payé par facture + spec L151-167), PDF d'acompte (liste de SES versements), `acompteVerse`/`dateVersement` par facture (gate du solde L444, écran signataire devis.service L1171-1183). Si le reste devient global, le routage « première facture non soldée » (L1068-1070) garde un sens de VENTILATION comptable mais plus de sens de CALCUL. Recensé, pas décidé (§6.6) : conserver le routage tel quel (zéro cascade) ou le simplifier. Sans re-balance (étape 5), le routage actuel enverra naturellement les excédents d'acompte vers… l'acompte (fallback L1070 si aucune facture ouverte) tant que le solde n'existe pas — comportement à couvrir par le cas de test « versements dans le désordre ».

### 5.7 Impact FRONTEND (HORS SCOPE de ce lot — liste de suivi)
- `frontend/app/dashboard/sejour/[id]/_components/TabDevisFacturation.tsx:808-810` : calcule déjà `resteDu = montantTTC − Σ versements` au niveau devis — **référence de l'invariant, tombe juste** ; ne pas y toucher.
- `TabDevisFacturation.tsx:382` (choix de la « facture cible » pour saisir un versement, même heuristique 0.99 que le backend) et `:955` (« Montant attendu » = facturé − versé PAR facture) : à revisiter si §6.6 change le routage.
- `frontend/src/lib/devis.ts:55, 186` (types `montantVerseTotal`) : inchangés a priori.
- Écrans qui affichent « payé/impayé » par facture (dashboard global hébergeur, signataire) : sémantique conservée si le rattachement par facture survit (§5.6).
- Si le libellé PDF change (« Acompte facturé » au lieu d'« Acompte déjà versé »), aucune dépendance frontend — le PDF est généré backend.

### 5.8 Autres risques relevés en lecture
- **Seuil 0.99** dupliqué en 5 points (L588, L602, L1069, L1085, L1136) : tolérance ±1 % codée en dur — candidate à une constante lors de la refonte (rien de plus).
- Re-balance : un versement « à cheval » n'est pas scindé (L562-568) — si on la supprime, ce cas disparaît ; s'il faut la conserver transitoirement, le documenter.
- `getFacturesForDevis` (L985-996) renvoie les versements PAR facture au frontend — l'écran les re-agrège lui-même (L808) : pas de cascade.

---

## 6. POINTS DE DÉCISION À TRANCHER PAR THÉO (rien n'est décidé ici)

1. **`montantFacture` du solde : reste réel OU montant du solde juridique ?**
   Proposition qui garde le Factur-X conforme : **conserver `montantFacture` = montant du solde juridique (3 630), figé et immuable**, et faire calculer aux générateurs XML `Prepaid/DuePayable` **au moment de la génération** à partir des versements du devis (BT-113 = réglé, BT-115 = TTC − réglé, BR-CO-16 boucle). Ainsi le montant juridique de la pièce ne bouge jamais, et le XML dit la vérité économique. L'alternative (montantFacture = reste réel à l'émission) rendrait le champ dépendant de l'ordre de saisie des versements et re-poserait la question 4.21 en pire.
2. **Renommer `montantAcompteDejaFacture` ?** Sa valeur actuelle est déjà « acompte FACTURÉ net d'avoir » — c'est le libellé PDF (« Acompte déjà versé », FacturePDF.tsx L317) qui ment, pas le champ. Options : (a) garder le nom (aucune migration, la Variante A l'affiche comme « Acompte facturé ») ; (b) renommer via migration + `@map` (coût : migration SQL + tout lecteur). La (a) est la moins risquée ; décision Théo.
3. **Cas « acompte validé sans versement »** : option a / b / c du §5.2.
4. **Trop-perçu sur le document** : reste négatif → afficher « Soldé ✓ » (comportement actuel L207-213), afficher « Trop-perçu : X € », ou borner à 0 ? (Impacte aussi DuePayable : EN 16931 admet un BT-115 négatif ? — à vérifier en Phase 2 ; sinon borner le XML à 0 et signaler l'avoir à émettre.)
5. **PDF d'acompte** : liste-t-il TOUS les règlements du devis (cohérence avec le solde) ou seulement les siens (pièce autonome) ? Et son XML : prepaid reste 0 ?
6. **Routage `ajouterVersement`** : conserver l'heuristique « première facture non soldée » (zéro cascade sur KPIs/exports) ou la simplifier ? (§5.6).
7. **Immuabilité 4.21** : figer le PDF à l'émission (les règlements vivent ailleurs) ou assumer la régénération ? Et faut-il exclure les factures antérieures à la refonte du nouveau rendu lors d'une régénération ?

---

## 7. CAS DE TEST à écrire en Phase 2 (étape 0 du plan)

1. **Acompte sur-payé** : acompte facturé 2 970, versements 1 980 + 1 320 (= 3 300) avant émission du solde → solde : montant juridique 3 630 ; total réglé 3 300 ; reste 3 300 → 6 600 − 3 300 = 3 300 ; XML Prepaid 3 300 / Due 3 300 ; sans re-balance, les 2 versements restent sur l'acompte.
2. **Devis révisé à la baisse après l'acompte** (cas métier du brief) : acompte facturé sur TTC 8 000 (2 400), devis révisé à 6 600, acompte réglé 2 400 → solde juridique = 6 600 − 2 400 = 4 200 ; reste = 6 600 − 2 400 = 4 200 ; PAS de surfacturation même si l'acompte réglé diffère du facturé.
   2b. Variante : baisse SOUS l'acompte (TTC 2 000 < acompte 2 400) → exige l'avoir (comportement actuel L456-476 à préserver).
3. **Acompte validé à la main SANS versement** : `validerAcompte` puis solde → le solde ne réclame PAS le total (selon décision §6.3 ; le test fige l'option choisie).
4. **Versements dans le désordre** : versement saisi APRÈS l'émission du solde avec une date ANTÉRIEURE ; versement pendant qu'aucune facture n'est « ouverte » (fallback L1070) ; suppression d'un versement puis re-saisie → total réglé, reste, PDF et XML restent cohérents (l'ordre d'affichage = `datePaiement asc`).
5. **Total < acompte (avoir requis)** : comportement existant préservé — refus sans avoir (L462-468), acompteNet avec avoir (L470), avoir > acompte rejeté (L471-475).
6. **Facture total sans acompte** (`emettreFactureTotal`) : montantFacture = TTC, discriminant PDF « Montant dû », prepaid = Σ versements (0 à l'émission), non cassé par la refonte.
7. **Solde partiellement réglé** (cas nominal de la maquette) : 6 600, acompte facturé 2 970, versements 1 980 + 1 320 + 1 320 = 4 620 → PDF : total réglé 4 620, reste 1 980 ; CII/UBL : Prepaid 4 620, Due 1 980 ; BR-CO-16 vérifié.
8. **Non-régression XML** : facture-x.spec.ts existant (schemeID, well-formed) inchangé ; ajouter l'assertion BR-CO-16 (Due = Grand − Prepaid) sur chaque cas.

---

**Critère de fin Phase 1 atteint** : recensement complet, aucun fichier de code modifié, aucun commit. Prochaine étape : validation de ce document + réponses aux 7 points de décision (§6) avant toute Phase 2.

---
---

# PHASE 2 — RAPPORT D'IMPLÉMENTATION (16/07/2026)

> Décisions actées appliquées : montants légaux figés à l'émission ; solde = TTC − acompte ENCAISSÉ ; `montantAcompteDejaFacture` change de sens (nom conservé, documenté) ; auto-versement à la validation manuelle ; PDF Variante A ; « Trop-perçu » affiché, Due XML borné à 0 ; rattachement versement→facture conservé ; re-balance supprimée ; acompte inchangé.
> Gate (tsc + build + npm test) VERT à chacun des 7 commits. AUCUN push — HEAD local prêt pour revue.

## P2.1 Commits (dans l'ordre)

| # | Commit | Contenu |
|---|---|---|
| 0 | `f6085c9` test(facture): caractérisation du comportement actuel | 19 tests figeant l'existant (nouveau `facture.service.spec.ts` + extension `facture-x.spec.ts`) : solde = TTC − facturé (bug documenté), re-balance, validerAcompte sans versement, avoirs, facture total, UBL/CII Prepaid-Due, BR-CO-16. Suite passée de 187 à 206 tests. |
| 1 | `5ed6e08` feat(facture): expose versements du devis + facture d'acompte | Additif, rendu inchangé. 6 requêtes enrichies (refreshFacturePdf, regenererPdf, create solde, ×2 re-balance, create total, getChorusXml) : `devis.versements` (tri date asc) + `factureAcompte { numero, dateEmission, montantVerseTotal }`. Types étendus (generateAndStorePdf, FactureAvecLignes, mapper). Props mapper optionnelles : `factureAcompteNumero/Date`, `versementsDevis[]`, `totalRegleDevis`. |
| 2 | `f64522e` feat(facture): solde sur l'acompte ENCAISSÉ + auto-versement | **Change les montants.** `emettreFactureSolde` : `montantFacture = round2(max(0, TTC − factureAcompte.montantVerseTotal))` ; `montantAcompteDejaFacture` = encaissé net d'avoir (nouveau sens documenté dans schema.prisma, commentaire seul — zéro migration). Garde-fou avoir conservé, seuil sur l'encaissé. `validerAcompte` : versement de régularisation du complément (référence « Régularisation — acompte validé manuellement », mode null), jamais de doublon ; recalcul `montantVerseTotal` + resync devis + régénération PDF acompte. Tests §7.1/§7.3 évolués cas par cas. |
| 3 | `d43753c` feat(facture): PDF de solde Variante A | « Acompte déjà encaissé (FA-AAAA-XXXX du jj/mm/aaaa) −X » (fin du libellé mensonger), « Montant du solde » figé, bloc « Règlements reçus » = TOUS les versements du devis + « Total réglé » + « Reste à payer » informatif (TTC − réglé) ; « Trop-perçu : X € » si négatif ; « Soldé ✓ » conservé à 0. Discriminant facture total : `factureAcompteNumero != null` avec repli `montantAcompteDejaFacture > 0` (snapshots sans relation). ACOMPTE/AVOIR inchangés. |
| 4 | `498a7fa` fix(facture): CII + UBL bornage trop-perçu (LÉGAL 01/09) | `Prepaid = min(montantAcompteDejaFacture, montantTTC)` dans buildCiiXml ET getChorusXml → `Due = TTC − Prepaid ≥ 0`, BR-CO-16 boucle en trop-perçu. facture-x.spec : partiel, sur-payé, trop-perçu, facture total, assertion BR-CO-16 systématique (hors acompte 386 : Due = montant demandé). |
| 5 | `d317793` refactor(facture): suppression de la re-balance | Bloc « déplacer les versements overflow » + double régénération PDF retirés (−107 lignes). Versements immuables sur leur facture d'origine. Routage `ajouterVersement` NON touché. |
| 6 | `3138776` fix(dashboard): KPI « à facturer solde » sur l'encaissé réel | `centre.service.ts` : `devis.montantVerseTotal` (Σ versements, déjà dans le select) remplace le postulat « facturé = versé », même repli legacy que l'étape 2. |
| 7 | (ce commit) docs(facture): rapport final | — |

## P2.2 Cas de test couverts (nouveau modèle)

1. Acompte sur-payé (2 970 facturés / 3 300 encaissés) → solde 3 300, CII Prepaid 3 300 / Due 3 300, aucun versement déplacé ✅
2. Devis révisé à la baisse (8 000 → 6 600, 2 400 encaissés) → solde 4 200 ✅ · 2b. révisé sous l'acompte → avoir requis ✅
3. Acompte validé sans versement → régularisation créée (totale ou complément), pas de doublon si couvert ✅
4. Versements immuables (3 versements dont overflow → tous restent sur l'acompte, solde juste 2 800) ✅
5. Total < acompte : avoir requis, acompteNet, avoir > acompte rejeté ✅
6. Facture total sans acompte : montantFacture = TTC, `montantAcompteDejaFacture 0`, prepaid 0.00 ✅
7. Trop-perçu global : montantFacture 0, Prepaid borné au TTC, Due 0, BR-CO-16 ✅ (PDF « Trop-perçu » : logique testée via les seuils du composant, pas de snapshot de rendu)
8. Non-régression : facture-x.spec historique intact (schemeID, well-formed), BR-CO-16 asserté ✅

Suite finale : **211 tests + 3 todo, verts** (187 avant le chantier).

## P2.3 Exceptions et choix consignés (sous-fusion assumée)

1. **Garde legacy dans `emettreFactureSolde` ET le KPI** (non prévue par les étapes, nécessaire) : un acompte validé AVANT la refonte a `acompteVerse=true` et **0 versement en base** — l'auto-versement de l'étape 2 ne couvre que les validations futures. Sans garde, le solde de ces dossiers réclamerait le TOTAL. Repli : encaissé = `montantVerseTotal > 0 ? montantVerseTotal : montantFacture`. Limite documentée : un acompte legacy PARTIELLEMENT saisi (ex. 1 000 sur 2 970) déduit 1 000 — indécidable sans savoir si l'argent manquant a été reçu ; à régulariser à la main dans l'UI le cas échéant.
2. **`validerAcompte` régénère le PDF de l'acompte** (fire-and-forget) après la régularisation — non demandé explicitement, mais aligné sur le comportement d'`ajouterVersement` (le PDF liste le versement de régularisation). À signaler en revue.
3. **Étape 6 sans test dédié** : `getDashboardGlobal` n'a pas de harness ; un mock complet pour un mapping d'une ligne serait disproportionné. Couvert par tsc/build + cohérence avec les tests d'émission.
4. **« Soldé ✓ » conservé pour reste ≈ 0** sur le solde (la décision ne visait que le trop-perçu) ; trop-perçu < −0,01 → « Trop-perçu : X € » en rouge.
5. **`f.montantTTC` du KPI « à facturer solde »** reste le TTC snapshoté à l'émission de l'ACOMPTE (pas le TTC révisé du devis — le select ne le charge pas). Écart pré-existant, hors périmètre de l'étape 6 ; à corriger avec le TTC du devis dans un sous-lot si souhaité.
6. **Aucune rétro-régénération** : les factures émises avant la refonte gardent leur PDF/XML et l'ancien sens de `montantAcompteDejaFacture` (documenté dans schema.prisma). Toute régénération déclenchée par une action utilisateur (nouveau versement, régénération manuelle) reprendra le nouveau rendu — comportement 4.21 assumé, inchangé.

## P2.4 Backlog FRONTEND (hors scope de ce lot, à suivre)

- `TabDevisFacturation.tsx:382` : sélection de la « facture cible » pour la saisie de versement (heuristique 0.99 par facture) — toujours alignée sur le routage backend conservé, mais à revisiter si le routage évolue.
- `TabDevisFacturation.tsx:955` : « Montant attendu » = facturé − versé PAR facture — avec un acompte sur-payé, ce montant diverge du reste global (déjà le cas avant) ; à faire converger vers l'invariant devis.
- Lecteur `getFacturesForDevis` : renvoie désormais les mêmes données (le rattachement est conservé) — l'écran continue d'agréger lui-même au niveau devis (L808-810, la référence de l'invariant).
- Libellés UI : si l'écran affiche quelque part « Acompte déjà versé » en reprenant `montantAcompteDejaFacture`, aligner sur « Acompte déjà encaissé ».
- KPI « paiements en attente » (backend `centre.service.ts:553-580`) : raisonne toujours par facture (voulu — rattachement conservé) ; avec un acompte sur-payé, l'excédent n'apparaît sur aucune facture « impayée », comportement à valider à l'usage.
