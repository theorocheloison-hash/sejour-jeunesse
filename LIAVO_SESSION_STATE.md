# LIAVO — État session dev
> Dernière mise à jour : 16/06/2026 — Session marathon facturation + UX + conformité

---

## COMMITS SESSION 16/06/2026

| Commit | Description |
|---|---|
| `564a85a` | feat(facturation): découplage émission/envoi factures — suppression email auto DIRECT, notif COLLAB conservée, POST /factures/:id/envoyer avec PDF PJ |
| `6f9f648` | feat(facturation): bouton "Envoyer par email" + modale saisie email/message sur chaque facture |
| *(merged)* | fix(facturation): routage auto versements POST /factures/versements { devisId } + re-balance overflow acompte→solde à l'émission du solde |
| *(merged)* | fix(frontend): suppression short-circuit stale factures + reload devis après versement |
| *(merged)* | refactor(devis-page): cartes facturées simplifiées + suppression code mort suivi paiement (−325 lignes) |
| *(merged)* | fix(factur-x): ajout BT-10 BuyerReference + BG-16 PaymentMeans/IBAN (conformité EN 16931) |

---

## TRAVAUX RÉALISÉS SESSION 16/06/2026

### 1. Découplage émission / envoi factures (backend + frontend)

**Problème** : ~30 clients mariages ont reçu des emails "Facture d'acompte émise" avec bouton "Accéder à la plateforme" alors qu'ils n'ont pas de compte. Causé par l'émission automatique d'emails à chaque facturation.

**Fix** :
- `emettreAcompte`, `emettreFactureSolde`, `emettreFactureTotal` : email auto supprimé pour DIRECT. Notif conservée pour COLLAB (enseignant = user plateforme, texte recadré "facture disponible").
- 3× `void` → `await` sur `generateAndStorePdf` (PDF garanti prêt pour envoi ultérieur)
- Nouveau endpoint `POST /factures/:id/envoyer` { email, message } — envoi manuel avec PDF Brevo en PJ + replyTo centre
- `email.service.ts` : `send()` supporte les pièces jointes Brevo (6e param `attachment`)
- `sendFactureParEmail()` nouvelle méthode : PDF base64, sans bouton plateforme, avec replyTo
- Frontend : bouton "Envoyer par email" à côté de chaque FacturePdfLink (5 instances) + modale email/message pré-remplie
- Log CRM `ENVOI_FACTURE` à chaque envoi

### 2. Routage automatique des versements + re-balance

**Problème** : le bouton "Ajouter un versement" ciblait toujours `factureActive` (dernière facture). Tous les versements saisis avant l'émission du solde restaient sur l'acompte → overflow, PDFs incohérents.

**Fix** :
- Ancien `POST /factures/:id/versements` supprimé → nouveau `POST /factures/versements` { devisId }
- Routage auto : acompte d'abord (première facture avec resteDû > 0), puis solde
- Re-balance à l'émission du solde (`emettreFactureSolde`) : détecte overflow acompte, déplace versements excédentaires vers le solde, recalcule montantVerseTotal, régénère les 2 PDFs
- Frontend : `handleAjouterVersement` passe `activeDevisId` + hint "Montant attendu" sur facture cible
- `emettreFactureTotal` non touché (pas d'acompte préalable)

### 3. Fix state stale après versement

**Problème** : après ajout d'un versement, le versement n'apparaissait pas sans refresh. Un useEffect court-circuitait avec `activeDevisFactures` (données du devis initial).

**Fix** : suppression du short-circuit `if (activeDevisFactures) { setFactures(activeDevisFactures); return; }`. Le useEffect charge toujours via `getFacturesForDevis`. Ajout `reloadAllDirect()` / `onBudgetReload()` après `reloadFactures()` dans `handleAjouterVersement`.

### 4. Refonte page Devis & Facturation (devis/page.tsx)

**Problème** : onglets "Facture acompte" et "Facture solde" affichaient des cartes surchargées (contact enseignant, 2x PDF, suivi paiement, générer solde, Chorus Pro). Bug cascade : `handleAjouterVersement` cassé en prod (passait factureId au lieu de devisId).

**Fix** :
- Cartes facturées (fa || fs) : rendu compact — badge facture + statut paiement + PDF + "Ouvrir le dossier →"
- Cartes sans facture : rendu existant conservé (contact enseignant + émettre acompte)
- Code mort supprimé : modale versement (JSX + state + handler), `handleChorusXml`, `handleFacturerSolde`, imports orphelins (−325 lignes)
- Bug `ajouterVersement(factureId)` éliminé à la source (code supprimé, pas patché)

### 5. Conformité Factur-X EN 16931

**Problème** : le XML CII embarqué manquait BT-10 (BuyerReference) et BG-16 (PaymentMeans/IBAN). Bloquant pour import dans Sage/Pennylane/Cegid.

**Fix** dans `facture-x.ts` (+14 lignes) :
- `<ram:BuyerReference>` : SIRET destinataire ou "SANS OBJET" — premier enfant de ApplicableHeaderTradeAgreement
- `<ram:SpecifiedTradeSettlementPaymentMeans>` : TypeCode 58 (SEPA) + IBANID — conditionné par emetteurIban, positionné AVANT ApplicableTradeTax (conformité séquence XSD CII D16B)
- Validé sur factur-x.org/verifier : "Facture Factur-X valide · Profil détecté : EN16931 · Structure XML valide"

### 6. Data fixes SQL prod

- Re-balance versements Alice et Maxime : versement 6 930 € déplacé FA-0035 → FS-0036
- Re-balance versements Heide GEORGE : versement 3 500 € splitté en 3 150 (acompte) + 350 (solde)
- 5 devis forcés SELECTIONNE + séjours CONVENTION (mariages déjà signés hors plateforme)
- 2 devis additionnels (Gloria et Gyslain, Nadège et Jérôme)

### 7. Roadmap & docs

- `docs/ROADMAP_POST_DEMO.md` : ajout "Envoi facture gestionnaire V2" (token public, pattern tokenSignature) + "Intégrations externes" (iCal 0,5j, export CSV factures 0,5j, webhooks 1-2j)
- Message comptable Yves Massard préparé (conformité Factur-X + import logiciel comptable)
- Audit UX complet : dashboard, planning, CRM, séjours, page séjour

---

## PROMPTS CC EN ATTENTE D'EXÉCUTION

| Prompt | Fichier(s) | Statut |
|---|---|---|
| Tri séjours (à venir d'abord) | sejours/page.tsx | Prêt, pas encore exécuté |
| KPIs dashboard cliquables (impayés + à facturer) | page.tsx + devis/page.tsx | Prêt, pas encore exécuté |

---

## ÉTAT PROD AU 16/06/2026

### Bugs connus
- Aucun bug bloquant identifié
- Les factures émises avant le deploy du routage auto ont potentiellement des overflow non re-balancés (2 cas fixés manuellement, les autres sont OK)

### Infra
- Scalingo : 2× M (512Mo) + PostgreSQL Starter 512M = 36€ HT/mois
- OVH Object Storage : bucket `liavo-uploads`, CORS configuré
- Brevo : DKIM/DMARC configurés, pièces jointes supportées

### Données Sauvageon en prod
- ~63 séjours/événements (mariages + anniversaires + séminaires)
- ~40 factures émises (acompte + solde)
- Factur-X EN 16931 validé
- 7 devis forcés SELECTIONNE (mariages 2026-2027 déjà signés)

### Premier lead inbound
- **Hôtel Les Choucas** (Sixt-Fer-à-Cheval, 74) — demande de démo via LinkedIn
- Doublon dans le catalogue APIDAE à nettoyer
- Compte à créer

---

## ÉCHÉANCES

| Date | Événement | Statut |
|---|---|---|
| **18/06** | Démo Marie Charvolin (CDI LMDJ) | Scénario prêt, prompts UX en attente |
| **30/06** | CA LMDJ — pitch partenariat | Message porté par Marie |
| **01/09/2026** | Obligation réception e-invoicing (toutes entreprises) | Factur-X validé |
| **01/09/2027** | Obligation émission e-invoicing (PME) | Roadmap intégration PA |
| Nov 2026 | PSP paiement récurrent | Roadmap |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU | — |

---

## PROCHAINS CHANTIERS (par priorité)

### Avant le 18/06 (DEMAIN)
- [ ] Exécuter prompt CC tri séjours
- [ ] Exécuter prompt CC KPIs dashboard
- [ ] Commit + deploy les 2
- [ ] Nettoyage catalogue Le Choucas (doublon APIDAE)
- [ ] Préparer démo Le Choucas
- [ ] Run-through complet scénario démo Marie

### Avant le 30/06
- [ ] Préparer les chiffres Pôle Montagne pour Marie
- [ ] Export rapport dashboard réseau

### Opérationnel
- [ ] Finir saisie données Sauvageon sur LIAVO
- [ ] Régénérer les 4 PDFs post-rebalance (FA-0033, FA-0035, FS-0034, FS-0036)
- [ ] Envoyer message comptable Yves Massard

### Post-démo — UX (quick wins identifiés audit 16/06)
- [ ] CRM : onglet "Clients" par défaut (exclut imports massifs)
- [ ] Bandeau "action en attente" : dismiss persistant ou contextuel

### Post-CA — Monétisation
- Doc : `docs/commercial/MONETISATION_PLAN.md`

### Post-CA — Technique
- [ ] Audit sécurité (PLAN_REMEDIATION.md — LOT 1 IDOR prioritaire)
- [ ] Chantier UX séjour (ARCHITECTURE_UX_SEJOUR_FINAL.md — ~7j)
- [ ] Intégrations externes : iCal (0,5j), export CSV factures (0,5j), webhooks (1-2j)
- [ ] Flow "Transmettre au gestionnaire" facture (token public, 2-3j)
- [ ] Intégration PA e-invoicing (Pennylane ou Cegid, quand 5+ centres)

---

## DOCUMENTS STRATÉGIQUES

| Document | Emplacement |
|---|---|
| Positionnement LIAVO × réseaux | `docs/POSITIONNEMENT_LIAVO_RESEAUX.md` |
| Architecture UX séjour | `docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` |
| Plan monétisation | `docs/commercial/MONETISATION_PLAN.md` |
| Scénario démo Marie | `docs/commercial/SCENARIO_DEMO_MARIE_18_06.md` |
| Audit sécurité | `docs/audits/AUDIT_SECURITE_2026-06.md` |
| Plan remédiation | `docs/audits/PLAN_REMEDIATION.md` |
| Roadmap post-démo | `docs/ROADMAP_POST_DEMO.md` |
| Dette technique | `docs/DETTE_TECHNIQUE.md` |
