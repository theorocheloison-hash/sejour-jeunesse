# LIAVO — Cartographie concurrentielle du marché français

> **Rédigé le 3 août 2026** — Benchmark des logiciels de gestion pour hébergements collectifs accueillant groupes scolaires et colonies.
> **Statut** — Document de référence. Aucune décision produit ou pricing actée à ce stade.
> **Déclencheur** — Réponse d'Estelle (Cap France Le Salvagny, 03/08/2026) révélant la migration Hestia/Adequat → Osmozis, et l'existence d'acteurs installés majeurs absents des benchmarks précédents.
> **Référence complémentaire** — `docs/commercial/MONETISATION_PLAN.md`, `docs/commercial/PROSPECT_TEREVA.md`

---

## 0. Avertissement méthodologique — pourquoi les benchmarks précédents ont échoué

Les benchmarks réalisés en mars, mai et juillet 2026 ont conclu que Venue360 était le seul concurrent direct. **Cette conclusion était fausse**, pour une raison mécanique : les recherches utilisaient un vocabulaire startup/SaaS (« SaaS », « dashboard », « PMS », « prix abonnement »), qui ne fait remonter que les acteurs à forte présence web/SEO.

Les acteurs dominants de ce marché sont des éditeurs français historiques (années 1980-1990), souvent régionaux, avec des sites web datés, sans SEO, sans pricing en ligne, vendant du logiciel installé avec de l'infogérance. **Le marché visible en ligne ≠ le marché installé.**

**Règle à conserver** : tout benchmark futur doit sourcer par les canaux suivants, pas par Google seul :
- Offres d'emploi (Indeed, APEC, France Travail, LinkedIn) — les annonces « agent de réservation » / « responsable groupes » en village vacances citent le logiciel exigé. C'est la source la plus fiable pour mesurer la base installée.
- Marchés publics (BOAMP, marchés-publics.gouv.fr, AWS-achat) — avis d'attribution nommant les titulaires.
- Réseaux et fédérations (UNAT, Cap France, VVF, Ethic Étapes, FUAJ, LMDJ, IDDJ, JPA, PEP, UCPA) — partenaires techniques référencés.
- Salons pro (congrès UNAT, SETT Montpellier).
- Données entreprises (Pappers, Societe.com, Infogreffe, SIRENE code NAF 5829C).
- **Le terrain** : la question « quel outil utilisez-vous aujourd'hui ? » posée à chaque prospect. Un seul email à Estelle a produit plus d'intelligence concurrentielle que trois benchmarks desk.

---

## 1. Synthèse

**Le marché n'est pas un désert.** Trois familles d'acteurs coexistent :

| Famille | Acteurs | Point de vue | Force | Faiblesse |
|---|---|---|---|---|
| **Progiciels historiques hébergement** | Hestia (Adéquat Système), OsmoGestion (Osmozis/Logmis), Resalys (Sequoiasoft/Septeo) | Hébergeur | Cœur métier hôtelier solide (planning, rooming, facturation, restauration, stats) | Aucun collaboratif externe, aucune conformité jeunesse, client lourd ou grands comptes |
| **ERP associatifs / collectivités** | Aiga iNoé, Noethys, Technocarte Loisiciel | Collectivité / organisateur | Conformité ACM, espace famille, marchés publics | Pas de gestion d'hébergement de groupes |
| **Nouvelle vague SaaS jeunesse** | Vackelys, Koloni, MonEspaceACM, AlloColo, Venue360 | Organisateur (sauf Venue360) | Web moderne, portail familles, inscriptions en ligne, TAM/SDJES | Faibles sur la gestion hôtelière du bâtiment |

**Aucun acteur ne combine encore gestion d'hébergement professionnelle + coordination collaborative web multi-acteurs souveraine.** Venue360 est le seul à chevaucher les deux mondes — mais héberge hors France.

---

## 2. Panorama détaillé des acteurs

| Solution | Éditeur | Création / siège | Techno | Données | Cible | Pricing |
|---|---|---|---|---|---|---|
| **Hestia** | Adéquat Système | 1989, Pisany (17), ~20 sal., CA ~2,1 M€ (2023) | Client lourd Windows + infogérance | France | Villages vacances, séjours jeunes, classes découverte, colos, AJ, FJT, centres religieux, centres sportifs | Devis (licence + maintenance) |
| **OsmoGestion** (ex-Campmis/Résidmis/Hôtelmis) | Osmozis (ALOSM, groupe Passman), ex-Logmis | Logmis Perpignan racheté 2017 ; Osmozis Clapiers (34), CA 14,6 M€ (2024) | PMS certifié NF203 + bundle hardware | France | Camping/HPA, villages vacances, résidences | Devis, bundlé matériel |
| **Resalys (neo)** | Sequoiasoft / Septeo Hospitality | ~20 ans, France | CRS+PMS 100 % cloud | France | Grands groupes tourisme social | Devis grands comptes |
| **Venue360** | Advanced BusinessLink Corp. (US), entité FR Guyancourt (RCS 443 515 143) | Kirkland WA, 35+ ans | 100 % cloud modulaire | **Hors France** | Camps, centres de séjour, classes découverte, colos + portail organisateur | ~16 000 €/an (11 centres, non confirmé) |
| **Vackelys** | Cubiq (groupe Axaltis), SIREN 499 383 347 | 2007, Vaulx-en-Velin (69) | Full-web / mode hébergé | Non précisé | Organisateurs/distributeurs colos, classes découverte, stages, séjours linguistiques | Devis |
| **Koloni** | Koloni | Lyon, récent | SaaS web + app | France | ACM, colos, centres de loisirs (organisateur) | 49/99/149 €/mois |
| **MonEspaceACM** | Digital Invest Group / KIDnKOD | Récent | SaaS web | France | 6 types d'ACM + classes découverte (organisateur) | 49/99/149 €/mois + Entreprise |
| **AlloColo** | AlloColo | Récent | SaaS web | France | Centres de loisirs, colos | À l'usage (frais Stripe) |
| **Noethys / Noethysweb** | Association (C. Demay), open source | >10 ans | Client Windows/Linux + version web | Auto-hébergé | ALSH, séjours avec hébergement | Gratuit (libre) |
| **iNoé / Icéo** | Aiga | 1980, Lyon/Paris/Poitiers/Toulouse | Web + espace famille | « espace sécurisé » | Petite enfance, ALSH, périscolaire, séjours, collectivités | Devis |
| **Loisiciel** | Technocarte | — | Modulaire, kiosque web | — | Collectivités : ALSH, périscolaire, séjours | Devis (marché public) |
| **Gestion CVL** | Gaillard & Martini | — | — | — | Séjours enfants/jeunes, classes vertes, groupes | Devis |
| **Gestion2colo** | Gestion2colo | — | Web | — | Séjours de vacances (organisateur) | Devis |

### 2.1 Hestia (Adéquat Système) — le concurrent le plus sérieux du monde hébergeur

**Factuel** : éditeur créé en 1989, basé à Pisany (Charente-Maritime), ~20 salariés (4 devs, 3 formateurs, 11 techniciens selon LinkedIn), CA 2023 ≈ 2,1 M€ (–3 %). Revendique « plus de 450 sites installés sur 61 départements et plus de 2500 utilisateurs » et se dit « leader sur le marché de l'hébergement ». Cible explicitement « l'accueil de groupes, de classes de découverte ou de mer, de colonies de vacances ». Fonctions annoncées : édition de conventions, listes effectifs restaurant, listes transport, listes des présents, statistiques par typologie, taux d'occupation, CA par centre de profit, channel manager. Autres produits : Bacchus (économat), Antheus. L'éditeur vend aussi de l'infogérance, du cloud, de la téléphonie, du parc informatique.

**Interprétation** : progiciel client lourd Windows installé, modèle intégrateur régional. Aucune preuve d'un portail collaboratif externe sur la branche hébergement. La « version web » (Hestia Système Web) concerne la restauration collective — entité distincte, ne pas confondre.

**Incertain** : existence d'une version web/cloud de la branche hébergement, pricing réel, gestion Chorus Pro / facturation électronique, module rooming. À vérifier par démo ou captures.

**Point d'attaque** : Adéquat revendique une « expérience de migration de progiciel, récupération et intégration de données » — la migration DEPUIS Hestia n'est donc pas verrouillée techniquement.

### 2.2 OsmoGestion (Osmozis) — pas un concurrent direct

**Factuel** : Osmozis (Euronext Growth FR0013231180 - ALOSM, Clapiers 34) a racheté Logmis (Perpignan, ~300 clients, ~300 k€ CA) en 2017. CA total Osmozis 14,6 M€ en 2024 (+16,4 %), mais l'essentiel provient des abonnements WiFi/IoT. Osmozis a rejoint le groupe Passman. OsmoGestion est certifié NF203, bundlé avec OsmoKey (serrures) et OsmoPay.

**Interprétation** : orienté camping/HPA. Couverture groupes/scolaires faible et non revendiquée. **Le choix de Cap France Le Salvagny s'explique probablement par le bundle hardware et le prix global, pas par la finesse du module groupes.** C'est la fenêtre de reconquête à 12-18 mois.

### 2.3 Resalys (Sequoiasoft / Septeo) — le second incumbent

**Factuel** : CRS+PMS 100 % cloud, développé et supporté en France. Clients : USSIM Vacances, Odesia, Madame Vacances, Eden Villages, REVEA/Somival. Migration documentée : Vacances ULVF vers Resalys neo début 2020.

**Preuve terrain déterminante** : les offres d'emploi d'agents de réservation en villages vacances exigent « la maîtrise du logiciel HESTIA ou RESALYS ». **Hestia + Resalys = le duo incumbent du tourisme social français.**

### 2.4 Venue360 — le concurrent qui contredit le plus notre thèse

**Factuel** : édité par Advanced BusinessLink Corporation (Kirkland, Washington, USA), 35+ ans, 12 brevets, présence revendiquée dans 13 pays dont la France ; entité française Advanced BusinessLink France, RCS 443 515 143, Guyancourt (78).

**Point critique** : le module « Group Self-Service » permet au responsable de groupe de se connecter à son propre portail pour gérer sa réservation — consulter les factures, payer en ligne, gérer les régimes alimentaires, le rooming, consulter son planning, signer électroniquement son contrat, télécharger des ressources. **C'est exactement la brique collaborative que LIAVO revendique comme différenciante.**

**Faiblesse décisive** : hébergement des données hors France (maison-mère US). C'est notre angle d'attaque frontal.

**Incertain** : le tarif ~16 000 €/an (source : Pierre/Tereva) et la localisation exacte des données des clients français ne sont pas confirmés par source primaire. **À vérifier avant la démo Tereva — c'est le point de bataille commercial central.**

### 2.5 La vague SaaS jeunesse française — le vrai front

**Vackelys** (Cubiq, groupe Axaltis, Vaulx-en-Velin) : full-web, cible « colonies de vacances, stages sportifs, séjours linguistiques ou encore classes de découverte », inscriptions en ligne, paiements, modules « Connect » (synchronisation partenaires, CSE). Localisation des données non trouvée ; comptes déposés en confidentialité.

**Koloni** (Lyon), **MonEspaceACM** (Digital Invest Group / KIDnKOD) : 49/99/149 €/mois, portail parents, fiches sanitaires, déclaration TAM/SDJES, hébergement en France.

**AlloColo** : facturation à l'usage (frais Stripe uniquement), données en France.

**Ces acteurs sont centrés ORGANISATEUR/ACM, pas HÉBERGEUR.** C'est la ligne de démarcation à tenir dans notre positionnement.

---

## 3. Couverture fonctionnelle comparée

| Fonction | Hestia | OsmoGestion | Resalys | Venue360 | Vackelys | Koloni / MonEspaceACM |
|---|---|---|---|---|---|---|
| Planning d'occupation | ✅ | ✅ | ✅ | ✅ | ✅ | partiel |
| Devis / convention / contrat | ✅ | ✅ | ✅ | ✅ | ✅ | partiel |
| Facturation acompte/solde | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Facturation électronique / Chorus Pro | ? | ? | ? | ? | ? | ? |
| Plan des chambres / rooming | ✅ | ✅ | ✅ | ✅ | ? | ❌ |
| Effectifs restauration / régimes / allergies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-centres | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CRM / pipeline | partiel | ✅ | ✅ | ✅ | ✅ | partiel |
| **Accès collaboratif externe** | ❌ | ❌ | espace propriétaire | **✅ Group Self-Service** | ✅ Connect/CSE | ✅ portail familles |
| Inscription en ligne participants | ? | ❌ | ✅ | ✅ | ✅ | ✅ |
| Fiches sanitaires / autorisations parentales | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Projet pédagogique | ❌ | ❌ | ❌ | ? | ? | partiel |
| Workflow autorisation sortie scolaire DSDEN | ❌ | ❌ | ❌ | ❌ | ? | ? |
| Déclaration TAM / SDJES | ❌ | ❌ | ❌ | ❌ | ? | ✅ (MonEspaceACM) |
| Encadrement BAFA/BAFD | ❌ | ❌ | ❌ | ❌ | partiel | ✅ |
| Rentabilité par séjour | ✅ | ✅ | ✅ | ✅ | ✅ | partiel |
| Channel manager | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Mobile / responsive | partiel | partiel | ✅ | ✅ | ✅ | ✅ |
| API / interopérabilité | export compta | interfaces PMS | 90+ connecteurs | modulaire | interfaçable | partiel |

> `?` = non confirmé. L'absence de preuve n'est pas preuve d'absence : plusieurs éditeurs ne documentent pas publiquement ces briques. Une démo produit serait nécessaire pour trancher.

**Lecture stratégique** : les incumbents sont forts sur le cœur hébergeur, absents sur le collaboratif externe et la conformité jeunesse. Les SaaS jeunesse sont l'inverse. **Venue360 est le seul à chevaucher — avec des données hors France.**

---

## 4. Évaluation critique de la thèse LIAVO

**Thèse initiale** : « personne ne fait la coordination collaborative multi-acteurs en web moderne pour scolaire et colonies ».

**Verdict : partiellement fausse dans sa version absolue, juste dans sa version nuancée.**

Ce qui invalide la version forte :
- Venue360 fait déjà du portail organisateur collaboratif complet et cible classes découverte/colos.
- Vackelys fait de la synchronisation multi-acteurs et de l'inscription famille.
- Koloni et MonEspaceACM font portail familles + conformité TAM/SDJES.

Ce qui reste réellement peu couvert — **l'interstice exploitable** :
1. Un outil pensé **du point de vue de l'HÉBERGEUR collectif** ouvrant simultanément un accès à l'ORGANISATEUR, au DIRECTEUR de séjour ET aux FAMILLES. Les autres choisissent un seul point de vue.
2. La **souveraineté** (données en France) comme argument frontal contre Venue360.
3. La chaîne **séjour scolaire avec nuitée** (autorisation DSDEN/rectorat, projet pédagogique) qu'aucun incumbent hébergeur ne traite.

**Conclusion sans complaisance** : le trou n'est pas un océan bleu vide, c'est un **interstice** entre deux mondes que plusieurs acteurs commencent à combler. **L'avantage estimé est de 12 à 24 mois, pas davantage.** La fenêtre doit être exploitée vite.

---

## 5. Taux d'équipement du marché

**Factuel (INJEP, données 2023-2024)** : ~9 441 structures organisatrices d'ACM avec hébergement, à l'origine de 47 000 séjours et 1,3 million de départs (61 % associatifs, 35 % collectivités, 2 % sociétés commerciales). **52 % des structures ne proposent qu'un à deux séjours par an** ; seulement 8 % en proposent plus de 10, mais réalisent la moitié des séjours.

**Côté hébergeurs** : de l'ordre de 1 500 à 1 600 établissements dans le tourisme social (UNAT/Avise, 2018).

**Interprétation** : le parc réellement équipé d'un logiciel métier professionnel se concentre sur les gros opérateurs (Hestia ~450 sites, Resalys grands groupes). **La longue traîne travaille massivement sur Excel/papier.**

**Conséquence commerciale directe** : le cycle de vente sur la longue traîne est un cycle de **première équipement** (court, sans migration) — c'est là qu'il faut concentrer l'effort. Le cycle de **remplacement** d'un incumbent est long (12-36 mois), avec contrat en cours et migration de données.

---

## 6. Dynamiques de marché 2023-2026

- **Consolidation** : Logmis → Osmozis (2017) → groupe Passman ; Sequoiasoft → Septeo Hospitality. Le mid-market se concentre autour de gros groupes logiciels, ce qui **laisse le petit hébergeur collectif orphelin d'un outil adapté et abordable**.
- **Facturation électronique obligatoire** (loi de finances 2024 art. 91, calendrier confirmé octobre 2024) : réception obligatoire pour toutes les entreprises au **1er septembre 2026**, émission obligatoire pour les PME/TPE au **1er septembre 2027** (GE/ETI dès 2026). Les clients publics sont déjà à Chorus Pro depuis 2020. **Puissant déclencheur de renouvellement d'outils et fenêtre pour un entrant nativement conforme.**
- **Nouveaux entrants** : la vague SaaS jeunesse (Koloni, MonEspaceACM, AlloColo) est très récente. D'autres ont identifié le même besoin. La course est engagée.

---

## 7. Pricing du marché

| Segment | Prix constaté |
|---|---|
| SaaS ACM récents (Koloni, MonEspaceACM) | 49 / 99 / 149 €/mois par paliers |
| AlloColo | À l'usage (frais Stripe seulement) |
| Estimation tierce de marché | 50 à 500 €/mois selon éditeur |
| Incumbents (Hestia, Resalys, OsmoGestion) | Pas de prix public — devis, licence + maintenance, plusieurs k€/an |
| Venue360 | ~16 000 €/an pour 11 centres (non confirmé) |

**Aucun avis d'attribution de marché public** nommant un titulaire ET un montant pour un logiciel de gestion de centre de vacances n'a été trouvé (les marchés publics « séjours » concernent l'achat de séjours, pas de logiciel). Source à explorer manuellement.

**Verdict pour LIAVO** : le plafond actuel de 79 €/mois/centre est **en dessous du plancher des SaaS ACM comparables** (49-149 €). Contre un incumbent installé, un prix bas ne rassure pas : il ne permet pas de justifier un changement d'outil à une direction. **Nous capturons mal la valeur.**

---

## 8. Reprise de données

- Adéquat Système revendique une expérience de migration et récupération de données → la sortie de Hestia n'est pas verrouillée. Aucun format d'export documenté identifié.
- Cas de migration documenté côté Resalys : Vacances ULVF → Resalys neo, début 2020.
- **Priorité pour LIAVO : un import Excel/CSV** (format universel de la longue traîne non équipée), avant tout connecteur Hestia spécifique. Sans capacité d'import, tous les deals de remplacement sont perdus d'avance.

---

## 9. Recommandations — à trancher

| # | Recommandation | Seuil / critère de décision |
|---|---|---|
| 1 | **Cibler en priorité la longue traîne non équipée** (Excel/papier), pas les centres équipés | Si le taux de conversion « Excel → LIAVO » dépasse « incumbent → LIAVO », concentrer 80 % de l'effort commercial sur le premier |
| 2 | **Repricer à la hausse** : passer d'un plafond 79 € vers une grille 49-149 €/mois/centre | Si le taux de refus pour cause de prix reste < 20 % à 99 €/mois, la valeur était sous-capturée |
| 3 | **Souveraineté des données comme argument frontal** contre Venue360 + conformité facturation électronique 2026/2027 comme accélérateur | À intégrer au pitch avant la démo Tereva |
| 4 | **Positionner le double point de vue hébergeur + collaboratif** ; éviter de se présenter comme « encore un logiciel de colo » (segment organisateur déjà encombré) | Réécriture du template de démarchage avant septembre |
| 5 | **Prioriser un import Excel/CSV** avant tout connecteur Hestia | Prérequis à tout deal de remplacement |
| 6 | **Surveiller Venue360 France et Vackelys comme concurrents prioritaires** — pas Hestia (paradigme technologique et commercial différent, pivot lent) | Veille trimestrielle |

---

## 10. Angles morts et vérifications à faire

- **Localisation exacte des données Venue360 pour ses clients français** — point de bataille central, non confirmé.
- **Tarif réel Venue360** — à confirmer auprès de Pierre (Tereva).
- **Hestia** : existe-t-il une version web de la branche hébergement ? un portail client ? Chorus Pro ? À vérifier par démo ou captures d'écran.
- **Vackelys** : localisation de l'hébergement des données inconnue.
- **Solutions internes sur mesure** dans les grands réseaux (VVF, UCPA, Ligue de l'enseignement, PEP, Cap France, Ethic Étapes) : non confirmées, angle mort à investiguer directement auprès des têtes de réseau. **Marie Charvolin (LMDJ) et Yves Massard peuvent répondre en une conversation.**
- **Marchés publics** : source potentiellement riche non exploitée (BOAMP, AWS-achat), exploration manuelle à faire.
- **Nos propres clients** : Sauvageon, Choucas, Alticlub, Pôle Montagne venaient-ils d'Excel ou d'un logiciel ? Si l'un a quitté Hestia pour LIAVO, c'est notre meilleure preuve de remplacement pour septembre. **À documenter.**
- Cette liste (13+ solutions) ne prétend pas à l'exhaustivité du marché installé discret.

---

## 11. Sources principales

- Adéquat Système / Hestia : adequat-systeme.com, LinkedIn ADEQUAT SYSTEME, manageo.fr (bilan 2023)
- Osmozis / Logmis : osmozis.com, TendanceHotellerie (communiqué acquisition Logmis), societe.com
- Resalys : resalys.com ; offres d'emploi AEC Villages Vacances (Glassdoor)
- Venue360 : venue360.io/about-us, venue360.io/gss, venue360.com
- Vackelys : vackelys.fr ; Cubiq SIREN 499 383 347
- Koloni, MonEspaceACM, AlloColo : sites éditeurs (grilles tarifaires publiques)
- INJEP : « Les organisateurs d'accueils collectifs de mineurs avec hébergement (ACMH) en 2023-2024 »
- UNAT / Avise : « Tourisme social et solidaire : de quoi parle-t-on ? »
- Facturation électronique : loi de finances 2024 art. 91, communiqué ministère du Budget 15/10/2024

---

**Aucune décision produit, pricing ou roadmap actée dans le cadre de ce document.**
