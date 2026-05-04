# LIAVO — Feuille de route produit complète
> Dernière mise à jour : 04/05/2026
> Post-démo LMDJ/IDDJ — LMDJ intéressée (visio suivi à caler), IDDJ attentiste (CA à consulter)

---

## ÉTAT ACTUEL — Ce qui est en production

### Stack
Next.js 15 / NestJS 11 / Prisma / PostgreSQL 17 / Scalingo Paris / OVH Object Storage Gravelines / Brevo

> ⚠️ Railway et Cloudflare R2 = OBSOLÈTES depuis 29/04/2026. Ne plus référencer.

### Rôles existants (noms français post-SC4)
ORGANISATEUR, SIGNATAIRE, AUTORITE, PARENT, HEBERGEUR, ADMIN, RESEAU

### Flows fonctionnels
- Inscription organisateur (recherche établissement API Éducation Nationale, UAI)
- Création séjour + appel d'offres ouvert (matching géographique centres)
- Flow invitation hébergeur → organisateur (pré-remplissage établissement, magic link)
- Réception demandes côté hébergeur + constructeur devis avec catalogue produits
- Sélection devis → statut CONVENTION
- Soumission signataire (recherche auto par UAI, invitation si non inscrit)
- Signature électronique signataire
- Soumission rectorat (email DSDEN)
- Dashboard collaboratif (planning drag-drop, messagerie, documents, participants)
- Autorisations parentales numériques (fiche sanitaire, régime, paiement échelonné)
- Import CSV élèves depuis Pronote/ONDE (sans email auto, envoi invitations sélectif)
- Accompagnateurs / ordres de mission PDF
- CRM hébergeur (clients, contacts, rappels)
- Dashboard réseau (KPIs, scoring centres, filtres, export CSV)
- Export Chorus Pro XML (UBL 2.1)
- Import APIDAE automatique (IDDJ 54 centres en prod)
- Planning PDF A4 paysage
- Journal de séjour parents (posts + photos OVH R2, page publique /sejour/[token]/journal)
- Lien journal depuis page autorisation parentale

### SC8 — À déployer (commit + push en attente)
- Suppression colonnes `etablissement*` sur User → données portées par Organisation/Membership
- Build backend + frontend : exit 0, 0 erreur TypeScript
- Migration SQL prête : `migrations/20260504_sc8_drop_etablissement_columns/migration.sql`

---

## PHASE 1 — Quick wins post-démo (mai 2026)

### 1.1 Commit + push SC8
Voir ROADMAP_POST_DEMO.md — priorité 0.

### 1.2 Sécurité JWT_SECRET
Voir ROADMAP_POST_DEMO.md — priorité 0.

### 1.3 Visio suivi LMDJ
Adapter pitch au pivot positionnement. Objectif : engagement écrit daté.

### 1.4 Landing page — screenshots produit
- 3-4 screenshots réels du dashboard dans les sections de la landing
- Basés sur retours de 3-5 personnes cibles
- Estimé : 4h

### 1.5 Notification centres APIDAE non inscrits (SC7)
- Rate limit 7j via dernierEmailDemandeAt
- Prompt CC préparé et validé
- Suspendu : validation commerciale LMDJ/IDDJ requise
- Estimé : 2-3h

### 1.6 Intégration APIDAE LMDJ
- Une ligne dans syncApidae() une fois credentials Anaïtis reçus
- Estimé : 15 min

---

## PHASE 2 — Features à forte valeur (juin-juillet 2026)

### 2.1 Pop-up aide IA contextuelle
- Assistant intégré dans chaque page du dashboard
- Détecte le contexte (page, rôle, statut du séjour) et propose les actions pertinentes
- Estimé : 3-5 jours

### 2.2 Planning IA — génération automatique
- Générer le planning semaine depuis le catalogue produits + contraintes
- Partiellement implémenté — valider avec vrais produits Sauvageon
- Estimé : 2-3 jours

### 2.3 Menu IA auto-généré
- Générer les menus de la semaine à partir des régimes/allergies des autorisations parentales
- Intégration avec catalogue repas (REPAS DU MIDI 12€, REPAS DU SOIR 12€, PETIT DÉJEUNER 4,30€, GOÛTER 2,50€, PANIER REPAS 10€)
- Estimé : 3-5 jours

### 2.4 Appel d'offres transport
- L'organisateur lance un appel d'offres transport en parallèle de l'hébergement
- Nouveau type de fournisseur : autocariste (nouveau rôle TRANSPORTEUR ou extension HEBERGEUR)
- Impact schéma : à évaluer
- Estimé : 2-3 semaines

---

## PHASE 3 — Marché colonie de vacances (septembre-décembre 2026)

### Analyse du gap scolaire → colo

Le marché colo en France représente ~270 000 départs/an (source JPA 2024).
LMDJ traite déjà 269 colos + 51 groupes adultes en 2024 (vs 244 scolaires).
L'hébergeur est le MÊME — le Sauvageon accueille scolaires ET colos.
Le catalogue produits, le devis, le planning, le CRM sont identiques.

**CE QUI EST RÉUTILISABLE TEL QUEL (~70%) :**
- Dashboard hébergeur (demandes, devis, catalogue, planning, messagerie, CRM)
- Dashboard réseau (KPIs, centres, scoring)
- Constructeur de devis + lignes détaillées
- Planning collaboratif
- Autorisations parentales
- Messagerie séjour
- Export Chorus Pro
- Import APIDAE

**CE QUI DOIT CHANGER :**

### 3.1 Flow de validation colo (remplace signataire + rectorat)
- En scolaire : organisateur → signataire (directeur école) → rectorat (DSDEN)
- En colo : organisateur → déclaration TAM (SDJES) → pas de signataire obligatoire
- Nouveau statut séjour : DECLARE_TAM (équivalent SOUMIS_RECTORAT)
- L'organisateur déclare manuellement dans TAM — LIAVO stocke le numéro
- À terme : API TAM si elle existe (à investiguer)
- Estimé : 1 semaine

### 3.2 Gestion des animateurs BAFA/BAFD
- En colo : animateurs doivent avoir BAFA/BAFD, déclaration individuelle TAM
- Extension AccompagnateurMission : ajout champs diplôme (BAFA/BAFD/stagiaire/autre), numeroDiplome, dateValidite, declareTAM
- Taux d'encadrement légal : 1 animateur pour 8 enfants <6 ans, 1 pour 12 enfants >6 ans
- LIAVO peut vérifier automatiquement le ratio et alerter
- Estimé : 1 semaine

### 3.3 Inscription directe des familles
- En colo : les familles s'inscrivent directement auprès de l'organisateur
- Page publique d'inscription au séjour (lien partageable)
- Formulaire famille : coordonnées parent, fiche sanitaire enfant, choix séjour, paiement
- Activation rôle PARENT (existe dans l'enum, non utilisé actuellement)
- Estimé : 2-3 semaines

### 3.4 Moyens de paiement colo
- Chèques vacances ANCV (intégration ANCV Connect si API disponible)
- Bons CAF (référence bon, numéro allocataire)
- Pass Colo (convention avec l'État — probablement pas d'API)
- Paiement échelonné (déjà supporté dans autorisations parentales)
- Phase 1 : champs déclaratifs
- Phase 2 : intégration paiement en ligne (Stripe) si volume le justifie
- Estimé : 1 semaine (déclaratif) / 3-4 semaines (intégration paiement)

### 3.5 Adaptation landing + onboarding
- Section colo avec wording adapté (organisateur, animateur, familles)
- Onboarding : flow d'inscription séparé pour ORGANISATEUR vs inscription scolaire
- SEO : pages dédiées "logiciel colonie de vacances", "gestion colo"
- Estimé : 1 semaine

---

## PHASE 4 — Extensions fonctionnelles (2027)

### 4.1 Journal de bord séjour (déjà livré partiellement)
- Posts + photos côté hébergeur/animateurs ✅
- Notifications push aux parents — À FAIRE
- Galerie photos sécurisée (accès par token unique) — À FAIRE
- Estimé : 2-3 semaines (pour la complétion)

### 4.2 Gestion RH intégrée hébergeur
- Planning des équipes du centre (cuisine, ménage, animation, encadrement)
- Affectation du personnel par séjour/activité/journée
- Vue semaine/mois pour le directeur du centre
- Estimé : 3-4 semaines

### 4.3 Marketplace activités
- Prestataires d'activités (moniteurs rafting, guides montagne, ESF) avec leur propre compte
- Réservation directe dans LIAVO, disponibilités temps réel
- Nouveau rôle PRESTATAIRE
- Estimé : 4-6 semaines

### 4.4 Intégration paiement en ligne
- Stripe Connect pour encaisser au nom de l'hébergeur
- Prélèvement SEPA, réconciliation avec les devis
- Estimé : 3-4 semaines

### 4.5 Application mobile (PWA)
- Notifications push (nouveau message, publication, rappel paiement)
- Mode hors-ligne pour zones montagne sans réseau
- Estimé : 4-6 semaines

---

## PHASE 5 — Dette technique et infrastructure

### 5.1 Refactoring DashboardShell
- Migrer organisateur/page.tsx, signataire/page.tsx, hebergeur/page.tsx → composant unique
- Estimé : 4-6 jours

### 5.2 JWT httpOnly cookie migration
- Risque régression auth — faire après stabilisation features
- Estimé : 1-2 jours

### 5.3 Chorus Pro production
- Finaliser habilitation AIFE (tiers mandaté)
- ChorusProService NestJS
- Variables Scalingo PISTE_CLIENT_ID + PISTE_CLIENT_SECRET
- Questions TVA séjours scolaires + valeur probatoire eIDAS

### 5.4 Résiliation Railway + Cloudflare R2
- Après confirmation stabilité Scalingo+OVH (06/05 au plus tôt)

### 5.5 RC Pro + Cyber insurance
- Hiscox ~500-700€/an

---

## PHASE 6 — Financement

Séquence validée :
1. Initiative Faucigny Mont-Blanc (membre CA, prêt taux zéro) — immédiat
2. Start-up & Go Emergence post-SIREN — en cours
3. Réseau Entreprendre Haute-Savoie — 6 mois avec traction LMDJ/IDDJ
4. BPI — 12-18 mois avec pilote rectorat

---

## RÉSUMÉ EFFORT PAR PHASE

| Phase | Périmètre | Effort estimé | Période cible |
|---|---|---|---|
| Phase 0 | SC8 + JWT + visio LMDJ | < 1h | 04-05/05/2026 |
| Phase 1 | Quick wins | 1 semaine | Mai 2026 |
| Phase 2 | Features haute valeur | 4-6 semaines | Juin-Juillet 2026 |
| Phase 3 | Marché colo | 8-10 semaines | Sept-Déc 2026 |
| Phase 4 | Extensions | 15-20 semaines | 2027 |
| Phase 5 | Dette technique | 2-3 semaines | En continu |

---

## DÉCISIONS EN ATTENTE

- Role ORGANISATEUR : séparé ou TEACHER polymorphe ? (recommandation : séparé)
- Paiement en ligne : Stripe dès le lancement colo ou déclaratif d'abord ?
- API TAM : existe-t-elle ? Investigation nécessaire avant de promettre une intégration
- Pass Colo : convention avec l'État nécessaire ? Quel volume pour justifier l'effort ?
- Éditeur devis colonnes configurables : déclencher après combien de centres actifs ?
