# LIAVO — État session dev
> Dernière mise à jour : 16/06/2026 soir — Session marathon facturation + UX + catalogue + arrondi

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
| `399b598` | docs: ajout docs architecture, commercial, juridique, roadmaps, prompts CC — gitignore audits sécu |
| `60f1396` | feat(sejours): tri par date — séjours à venir en premier |
| *(batch)* | feat(dashboard): KPIs cliquables — onglets À facturer et Impayés |
| *(batch)* | fix(catalogue): dédup searchPublic par apidaeId + garde-fou materialiserCentreEN |
| *(batch)* | fix(impayés): exclure les acomptes validés du filtre impayés (3 sites) |
| `7816beb` | feat(facturation): ajustement devis après acompte — lien Ajuster avant solde + bandeau + garde-fou |
| `abc2191` | fix(arrondi): TTC-first + round2 payload dans tous les builders devis + facture.service — 5 fichiers |

---

## TRAVAUX RÉALISÉS SESSION 16/06/2026 (suite après-midi/soir)

### 8. Fix doublon catalogue Le Choucas

**Problème** : "Centre de vacances Le Choucas" (LMDJ_WEB en base) + "centre de montagne le choucas" (API EN live) = doublon affiché dans le catalogue. La dédup searchPublic ne matchait que par nom+ville normalisés (noms différents). Risque : un enseignant clique le résultat API EN → materialiserCentreEN crée un vrai doublon en base.

**Fix** (centre.service.ts, 2 modifications) :
- searchPublic : dédup par apidaeId en plus de nom+ville (nouveau Set prismaApidaeIds)
- materialiserCentreEN : retrait du filtre `source: 'API_EN'` + garde-fou ville (évite collision d'IDs APIDAE/EN)
- Data : UPDATE apidae_id = '89512731' sur la fiche Le Choucas (identifiant EN récupéré via API)

### 9. Fix impayés faux positifs

**Problème** : Marie BRIENNE apparaissait dans "Impayés" (FA-2026-0013, 2102.10€ facturé, 2100€ versé, acompteVerse=true). Écart 2.10€ = arrondi bancaire. Le filtre comparait strictement montantVerseTotal < montantFacture sans tenir compte du flag acompteVerse.

**Fix** (3 fichiers) : exclure les factures ACOMPTE dont acompteVerse === true du calcul impayés.
- devis/page.tsx : helper resteImpaye
- page.tsx : KPI Impayés  
- centre.service.ts : getDashboardGlobal facturesImpayees (ajout acompteVerse au select)

### 10. Ajustement devis après acompte (avant solde)

**Problème** : le frontend masquait le bouton "Modifier" dès qu'une facture existait. L'hébergeur ne pouvait pas ajuster les lignes du devis (ex: 72 personnes au lieu de 80) avant de facturer le solde. Le backend supportait déjà la modification (updateDevis accepte SELECTIONNE/SIGNE_DIRECTION).

**Fix** (3 fichiers frontend) :
- devis/page.tsx : lien "Ajuster avant solde" (amber) sur cartes facturées si fa && !fs && statut signé
- TabDevisFacturation.tsx : même lien aux 2 emplacements (direct l.1272 + collab l.1601)
- modifier/page.tsx : bandeau ⚠️ "facture acompte émise" + garde-fou rouge si total < acompte

### 11. Fix arrondi monétaire TTC-first (systémique)

**Problème** : 6 devis sur 74 avaient des artéfacts float (12312.802, 22019.38..., 6000.01). Cause : sommes de lignes non round2'd avant envoi + certains builders calculaient TTC depuis HT au lieu de TTC saisi.

**Fix** (5 fichiers, +70 −43) :
- nouveau/page.tsx : round2 sur montantHT/montantTTC accumulés dans le payload
- modifier/page.tsx : idem + pré-remplissage prix via round2(totalTTC/quantite) pour idempotence
- TabDevisFacturation.tsx : complémentaires basculés TTC-first (label PU HT → PU TTC, formule inversée)
- inviter-enseignant/page.tsx : brouillon devis basculé TTC-first
- facture.service.ts : helper round2 + arrondi sur montantFacture dans emettreAcompte/Solde/Total/Avoir

Convention confirmée : l'hébergeur saisit TTC partout. HT = dérivé. prixUnitaire stocké HT en base (inchangé).

### 12. Data fixes SQL prod (arrondi)

- 3 devis corrigés : DEV-2026-003 (12312.80), DEV-2026-0003 (22019.38), DEV-2026-0004/Juliette (6000.00)
- Facture FS-2026-0038 + lignes associées corrigées (Juliette)

---

## ÉTAT PROD AU 16/06/2026 SOIR

### Bugs connus
- Aucun bug bloquant identifié
- Impayés : 1 vrai (Jean-Baptiste et Amélie, acompte en attente de paiement)

### Infra
- Scalingo : 2× M (512Mo) + PostgreSQL Starter 512M = 36€ HT/mois
- OVH Object Storage : bucket `liavo-uploads`, CORS configuré
- Brevo : DKIM/DMARC configurés, pièces jointes supportées

### Données Sauvageon en prod
- ~63 séjours/événements (mariages + anniversaires + séminaires)
- ~40 factures émises (acompte + solde)
- Factur-X EN 16931 validé
- 7 devis forcés SELECTIONNE (mariages 2026-2027 déjà signés)
- Données arrondies propres (6 devis corrigés)

### Lead inbound — Hôtel Les Choucas
- **Contact** : directrice, appel téléphonique direct
- **Besoin** : devis, facturation, planning
- **Démo** : 17/06 à 14h AU SAUVAGEON (en personne)
- **Centre en base** : ID `507d5133-23d2-42e5-8900-9e748e62bf98`, apidaeId `89512731`, source LMDJ_WEB, pas de userId
- **Doublon catalogue fixé** : searchPublic dédup par apidaeId + materialiserCentreEN garde-fou
- **Invitation** : à créer le matin du 17/06 via dashboard admin (CAS 1, centreExistantId) — email contact@choucashotel.fr ou email perso directrice

---

## ÉCHÉANCES

| Date | Événement | Statut |
|---|---|---|
| **17/06 14h** | Démo Les Choucas (directrice, au Sauvageon) | Prêt — données propres, features déployées |
| **18/06** | Démo Marie Charvolin (CDI LMDJ) | Scénario prêt dans docs/commercial/SCENARIO_DEMO_MARIE_18_06.md |
| **30/06** | CA LMDJ — pitch partenariat | Message porté par Marie |
| **01/09/2026** | Obligation réception e-invoicing (toutes entreprises) | Factur-X validé |
| **01/09/2027** | Obligation émission e-invoicing (PME) | Roadmap intégration PA |
| Nov 2026 | PSP paiement récurrent | Roadmap |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU | — |

---

## PROCHAINS CHANTIERS (par priorité)

### Matin 17/06 (avant démo 14h)
- [ ] Créer invitation Les Choucas (CAS 1, centreExistantId)
- [ ] Run-through rapide démo Marie (scénario dans docs/commercial/)
- [ ] Vérifier planning Sauvageon (données visibles prochaines semaines)
- [ ] Vérifier qu'un dossier Sauvageon a le parcours complet (signé + acompte, pas de solde) pour montrer "Ajuster avant solde"

### Avant le 18/06 (démo Marie)
- [ ] Run-through complet scénario démo Marie
- [ ] Vérifier dashboard réseau avec données test LMDJ

### Avant le 30/06
- [ ] Préparer les chiffres Pôle Montagne pour Marie
- [ ] Export rapport dashboard réseau

### Opérationnel
- [ ] Finir saisie données Sauvageon sur LIAVO
- [ ] Régénérer les 4 PDFs post-rebalance (FA-0033, FA-0035, FS-0034, FS-0036)
- [ ] Envoyer message comptable Yves Massard

### Post-démo — UX quick wins
- [ ] CRM : onglet "Clients" par défaut (exclut imports massifs)
- [ ] Bandeau "action en attente" : dismiss persistant ou contextuel
- [ ] Modale ajustement montant avant facture de solde (parcours complet — devis builder réutilisé)

### Post-CA — Refonte page Devis envoyés
- Titre trompeur, compteurs inutiles à l'échelle, pas de tri/filtre, tooltips manquants
- Cible : tableau filtrable/triable, recherche, pagination, export CSV
- Estimation : 2-3j — doc : docs/ROADMAP_POST_DEMO.md

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
