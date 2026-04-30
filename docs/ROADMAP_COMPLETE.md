# LIAVO — Feuille de route produit complete
> Derniere mise a jour : 28 avril 2026
> Post-demo LMDJ/IDDJ — LMDJ interessee (visio suivi a caler), IDDJ attentiste (CA a consulter)

---

## ETAT ACTUEL — Ce qui est en production

### Flows fonctionnels
- Inscription enseignant (recherche etablissement API Education Nationale, UAI)
- Creation sejour + appel d'offres ouvert (matching geographique centres)
- Flow invitation hebergeur → enseignant (pre-remplissage etablissement)
- Reception demandes cote hebergeur + constructeur devis avec catalogue produits
- Selection devis → statut CONVENTION
- Soumission directeur (recherche auto par UAI, invitation si non inscrit)
- Signature electronique directeur
- Soumission rectorat (email DSDEN)
- Dashboard collaboratif (planning drag-drop, messagerie, documents, participants)
- Autorisations parentales numeriques (fiche sanitaire, regime, paiement echelonne)
- Import CSV eleves depuis Pronote/ONDE (sans email auto, envoi invitations selectif)
- Accompagnateurs / ordres de mission
- CRM hebergeur (clients, contacts, rappels)
- Dashboard reseau (KPIs, scoring centres, filtres, export CSV)
- Export Chorus Pro XML (UBL 2.1)
- Import APIDAE automatique (IDDJ 54 centres en prod)
- Planning PDF A4 paysage (export/telechargement)
- Journal de sejour parents (posts + photos R2, page publique /sejour/[token]/journal)
- Lien journal depuis page autorisation parentale
- Planning parent regroupe par creneau avec badges groupes

### Roles existants
TEACHER, DIRECTOR, RECTOR, PARENT, VENUE, ADMIN, RESEAU

### Stack
Next.js 15 / NestJS 11 / Prisma / PostgreSQL 16 / Railway EU / Cloudflare R2 / Brevo

---

## PHASE 1 — Quick wins post-demo (mai 2026)

### 1.1 Landing page — screenshots produit
- 3-4 screenshots reels du dashboard dans les sections de la landing
- Bases sur retours de 3-5 personnes cibles
- Estime : 4h

### 1.2 Notification centres APIDAE non inscrits
- Notifier par email les centres APIDAE sans compte quand une demande matche leur zone
- Rate limit 7j via dernierEmailDemandeAt
- Prompt CC prepare et valide
- Estime : 2-3h

### 1.3 Integration APIDAE LMDJ
- Une ligne dans syncApidae() une fois credentials Anaitis recus
- Estime : 15 min

### 1.4 Nettoyage dette technique critique
- Resoudre les 15 erreurs TypeScript backend (Prisma schema decale)
- Prerequis avant tout deploiement backend
- Estime : 1-2 jours

---

## PHASE 2 — Features a forte valeur (juin-juillet 2026)

### 2.1 Pop-up aide IA contextuelle
- Assistant integre dans chaque page du dashboard
- Detecte le contexte (page, role, statut du sejour) et propose les actions pertinentes
- Exemples : "Vous avez 5 autorisations en attente — relancer les parents ?" / "Votre planning est vide — generer avec l'IA ?"
- Brief deja discute dans conversation precedente
- Estime : 3-5 jours

### 2.2 Planning IA — generation automatique
- Generer le planning semaine depuis le catalogue produits + contraintes
- Contraintes : capacite par groupe (8 en rafting, 12 en rando), nombre de moniteurs, rotation groupes, repas fixes
- Partiellement implemente — valider avec vrais produits Sauvageon
- Estime : 2-3 jours

### 2.3 Menu IA auto-genere
- Generer les menus de la semaine a partir des regimes/allergies des autorisations parentales
- Input : autorisations parentales signees (regime_alimentaire + infos_medicales)
- Output : planning repas jour par jour avec variantes par regime
- Integration avec catalogue repas (REPAS DU MIDI 12EUR, REPAS DU SOIR 12EUR, PETIT DEJEUNER 4.30EUR, GOUTER 2.50EUR, PANIER REPAS 10EUR)
- Cas reels du sejour demo : vegetarienne, sans gluten, allergie arachides, allergie lait, allergie fruits a coque, diabete
- Estime : 3-5 jours

### 2.4 Appel d'offres transport
- L'enseignant/organisateur lance un appel d'offres transport en parallele de l'hebergement
- Nouveau type de fournisseur : autocariste (extension du role VENUE ou nouveau role TRANSPORTEUR)
- Champs specifiques : ville depart, ville arrivee, nombre de passagers, date/heure, type vehicule
- Devis transport separe mais lie au meme sejour
- Impact schema : nouveau type dans DemandeDevis ou nouvelle table
- Estime : 2-3 semaines

---

## PHASE 3 — Marche colonie de vacances (septembre-decembre 2026)

### Analyse du gap scolaire → colo

Le marche colo en France represente ~270 000 departs/an (source JPA 2024).
LAMDJ traite deja 269 colos + 51 groupes adultes en 2024 (vs 244 scolaires).
L'hebergeur est le MEME — le Sauvageon accueille scolaires ET colos.
Le catalogue produits, le devis, le planning, le CRM sont identiques.

CE QUI EST REUTILISABLE TEL QUEL (~70%) :
- Dashboard hebergeur (demandes, devis, catalogue, planning, messagerie, CRM)
- Dashboard reseau (KPIs, centres, scoring)
- Constructeur de devis + lignes detaillees
- Planning collaboratif
- Autorisations parentales (fiche sanitaire, regime, paiement)
- Messagerie sejour
- Export Chorus Pro
- Import APIDAE

CE QUI DOIT CHANGER :

### 3.1 Nouveau role : ORGANISATEUR
- Remplace TEACHER pour les colos
- Peut etre : association loi 1901, comite d'entreprise, mairie, organisme agree JS
- Champs specifiques : numero organisateur TAM, agrement JS, SIRET organisme
- Pas d'UAI, pas d'etablissement EN
- Pas de directeur d'ecole, pas de rectorat
- Schema : nouveau role dans enum Role, ou role TEACHER etendu avec un champ typeOrganisateur
- DECISION A PRENDRE : role separe ORGANISATEUR vs TEACHER polymorphe
  - Option A (role separe) : plus propre, pas de regression scolaire, duplication de code
  - Option B (TEACHER polymorphe) : moins de code, risque de regression, complexite conditionnelle
  - Recommandation : Option A (role separe), quitte a factoriser plus tard
- Estime : 1 semaine

### 3.2 Flow de validation colo (remplace directeur + rectorat)
- En scolaire : enseignant → directeur ecole → rectorat (DSDEN)
- En colo : organisateur → declaration TAM (SDJES) → pas de directeur d'ecole
- Nouveau statut sejour : DECLARE_TAM (equivalent de SOUMIS_RECTORAT)
- Supprimer l'etape directeur pour les sejours colo
- Ajouter un champ numeroDeclarationTAM sur le sejour
- L'organisateur declare manuellement dans TAM (LIAVO ne remplace pas TAM, mais stocke le numero)
- A TERME : API TAM si elle existe (a investiguer — probablement pas d'API publique)
- Estime : 1 semaine

### 3.3 Gestion des animateurs BAFA/BAFD
- En scolaire : accompagnateurs = enseignants/parents benevoles, pas de diplome requis
- En colo : animateurs doivent avoir BAFA (ou stagiaire BAFA), directeur BAFD
- Obligations : declaration individuelle dans TAM, verification casier judiciaire (FIJAISV)
- Extension du modele AccompagnateurMission : ajout champs diplome (BAFA/BAFD/stagiaire/autre), numeroDiplome, dateValidite, declareeTAM (boolean)
- Taux d'encadrement legal : 1 animateur pour 8 enfants <6 ans, 1 pour 12 enfants >6 ans
- LIAVO peut verifier automatiquement le ratio et alerter si non conforme
- Estime : 1 semaine

### 3.4 Inscription directe des familles
- En scolaire : l'enseignant cree le sejour et envoie les autorisations aux parents
- En colo : les familles s'inscrivent DIRECTEMENT aupres de l'organisateur
- Nouveau flow : page publique d'inscription au sejour (lien partageable par l'organisateur)
- Formulaire famille : coordonnees parent, fiche sanitaire enfant, choix sejour, paiement
- Le parent a un espace de suivi (documents, paiement, infos pratiques)
- Activation du role PARENT (existe dans l'enum mais non utilise actuellement)
- Estime : 2-3 semaines

### 3.5 Moyens de paiement colo
- Cheques vacances ANCV (integration ANCV Connect si API disponible)
- Bons CAF (reference bon, numero allocataire)
- Pass Colo (dispositif national, convention avec l'Etat — probablement pas d'API)
- Paiement echelonne (deja supporte dans autorisations parentales : nombre_mensualites)
- Phase 1 : champs declaratifs (le parent declare son moyen de paiement, l'organisateur gere en back-office)
- Phase 2 : integration paiement en ligne (Stripe) si volume le justifie
- Estime : 1 semaine (declaratif) / 3-4 semaines (integration paiement)

### 3.6 Adaptation landing + onboarding
- Landing page : ajouter section colo avec wording adapte (organisateur, animateur, familles)
- Onboarding : flow d'inscription separe pour ORGANISATEUR vs TEACHER
- SEO : pages dediees "logiciel colonie de vacances", "gestion colo"
- Estime : 1 semaine

---

## PHASE 4 — Extensions fonctionnelles (2027)

### 4.1 Blog parent/prof/eleve (journal de bord sejour)
- Espace de publication lie a un sejour
- Parents suivent le sejour en temps reel (photos, textes, activites du jour)
- Profs/animateurs publient, moderent
- Eleves contribuent (exercice pedagogique en scolaire, souvenir en colo)
- Notifications push aux parents (nouvelle publication)
- Galerie photos securisee (pas de partage public, acces par token unique)
- Estime : 2-3 semaines

### 4.2 Gestion RH integree hebergeur (planning equipe)
- Planning des equipes du centre : cuisine, menage, animation, encadrement
- Affectation du personnel par sejour/activite/journee
- Vue semaine/mois pour le directeur du centre
- Gestion des qualifications (BAFA, BAFD, PSC1, permis, etc.)
- Alertes taux d'encadrement
- Extension naturelle du dashboard venue
- Estime : 3-4 semaines

### 4.3 Marketplace activites
- Les prestataires d'activites (moniteurs rafting, guides montagne, ESF) ont leur propre compte
- L'hebergeur ou l'organisateur reserve directement dans LIAVO
- Disponibilites temps reel, confirmation automatique
- Necessite un nouveau role PRESTATAIRE
- Estime : 4-6 semaines

### 4.4 Integration paiement en ligne
- Stripe Connect pour encaisser au nom de l'hebergeur
- Paiement echelonne automatise (prelevement SEPA)
- Reconciliation automatique avec les devis
- Estime : 3-4 semaines

### 4.5 Application mobile (PWA)
- Progressive Web App pour parents et animateurs
- Notifications push (nouveau message, publication blog, rappel paiement)
- Mode hors-ligne pour les zones montagne sans reseau
- Estime : 4-6 semaines

---

## PHASE 5 — Dette technique et infrastructure

### 5.1 Refactoring DashboardShell
- Migrer teacher/page.tsx, director/page.tsx, venue/page.tsx vers composant unique
- Ajouter ORGANISATEUR dans le meme shell
- Estime : 4-6 jours

### 5.2 JWT httpOnly cookie migration
- Risque regression auth — faire apres stabilisation features
- Estime : 1-2 jours

### 5.3 Chorus Pro production
- Finaliser habilitation AIFE (tiers mandate)
- ChorusProService NestJS
- Variables Railway PISTE_CLIENT_ID + PISTE_CLIENT_SECRET
- Questions TVA sejours scolaires + valeur probatoire eIDAS

### 5.4 RC Pro + Cyber insurance
- Hiscox ~500-700 EUR/an

---

## PHASE 6 — Financement

Sequence validee :
1. Initiative Faucigny Mont-Blanc (membre CA, pret taux zero) — immediat
2. Start-up & Go Emergence post-SIREN — en cours
3. Reseau Entreprendre Haute-Savoie — 6 mois avec traction LMDJ/IDDJ
4. BPI — 12-18 mois avec pilote rectorat

---

## RESUME EFFORT PAR PHASE

| Phase | Perimetre | Effort estime | Periode cible |
|---|---|---|---|
| Phase 1 | Quick wins | 1 semaine | Mai 2026 |
| Phase 2 | Features haute valeur | 4-6 semaines | Juin-Juillet 2026 |
| Phase 3 | Marche colo | 8-10 semaines | Sept-Dec 2026 |
| Phase 4 | Extensions | 15-20 semaines | 2027 |
| Phase 5 | Dette technique | 2-3 semaines | En continu |

---

## DECISIONS EN ATTENTE

- Role ORGANISATEUR : separe ou TEACHER polymorphe ?
- Paiement en ligne : Stripe des le lancement colo ou declaratif d'abord ?
- API TAM : existe-t-elle ? Investigation necessaire avant de promettre une integration
- Pass Colo : convention avec l'Etat necessaire ? Quel volume pour justifier l'effort ?
- Blog sejour : stockage photos (R2 actuel suffit-il pour du volume media ?)
