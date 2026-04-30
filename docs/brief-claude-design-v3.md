# Brief Claude Design — Landing LIAVO V3 (post-démo LMDJ + ajustements colos)

## Qui suis-je

LIAVO est un SaaS B2B français qui digitalise la coordination des séjours collectifs : séjours scolaires (classes vertes, classes de neige, voyages scolaires) et colonies de vacances. La plateforme connecte hébergeurs, enseignants, directeurs, organisateurs de colos, parents, et réseaux d'hébergeurs.

Je suis fondateur solo, en phase de démarchage commercial. La cible payante prioritaire est les **hébergeurs de centres de vacances**. Les enseignants et organisateurs de colos accèdent à la plateforme gratuitement.

## Positionnement

LIAVO ne remplace pas la mise en relation faite par les réseaux comme La Montagne des Juniors ou IDDJ. **LIAVO digitalise tout ce qui se passe après la mise en relation** : devis, planning, autorisations parentales, journal parent, facturation. Le pitch n'est pas "remplacer la centrale", c'est "compléter la chaîne avec un outil moderne pour les hébergeurs et leurs clients".

**Pour les hébergeurs**, l'argument décisif : ils accueillent autant de séjours scolaires que de colos. LIAVO doit couvrir les deux types, sinon ils ne signent pas.

## Ce que je veux

Une landing page UNIQUE, moderne, tech/startup, structurée par persona avec 3 sections détaillées :
- **Hébergeurs** (cible principale, payante) — section la plus développée
- **Enseignants** (utilisateurs gratuits)
- **Organisateurs de colos** (utilisateurs gratuits)

Plus une section dédiée aux **réseaux d'hébergeurs** (partenariats).

Carte blanche sur la typographie, les couleurs, et la direction créative.

## Logo

Voici le SVG exact du logo Liavo (à utiliser tel quel, ne pas le modifier) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" fill="none">
  <rect width="42" height="42" rx="10" fill="#1B4060"/>
  <polygon points="21,4 30,13 21,22 12,13" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round" opacity="0.9"/>
  <circle cx="21" cy="13" r="2.2" fill="#C87D2E"/>
  <line x1="21" y1="22" x2="21" y2="32" stroke="white" stroke-width="1.5" opacity="0.9" stroke-linecap="round"/>
  <line x1="14" y1="32" x2="28" y2="32" stroke="white" stroke-width="1.5" opacity="0.9" stroke-linecap="round"/>
</svg>
```

Le wordmark est "Liavo".

## Structure de la landing

### 1. Navigation fixe
- Logo Liavo à gauche
- Liens : Hébergeurs, Enseignants, Colonies, Tarifs
- Boutons : "Se connecter" (outline) + "Commencer gratuitement" (primary)

### 2. Hero
- Titre court et puissant qui parle de coordination des séjours collectifs
- Sous-titre : LIAVO digitalise vos séjours collectifs : devis, planning, autorisations parentales, facturation. Du devis à la facturation, tout dans un seul outil.
- 2 CTA : "Je suis hébergeur" (primary, mis en avant) + "Je suis enseignant ou organisateur" (secondary)
- Visuel : un mockup HTML/CSS stylisé d'un dashboard hébergeur montrant un séjour en cours (titre "Classe de montagne — 4ème — Morillon", 48 élèves, planning de la semaine, badges Signé/En attente)

### 3. Section "Pour qui ?"
3 cards égales, cliquables/scrollables vers les sections détaillées plus bas :

**Card 1 — Hébergeurs de centres de vacances**
- "Vous gérez un centre de vacances et accueillez des séjours scolaires ou des colos"
- Icône bâtiment ou montagne
- "Découvrir →"

**Card 2 — Enseignants**
- "Vous organisez un séjour pour votre classe (classe verte, voyage scolaire, classe de neige)"
- Icône cartable ou école
- "Découvrir →"

**Card 3 — Organisateurs de colonies**
- "Vous organisez des camps d'été, séjours de vacances ou centres de loisirs (mairies, associations, comités d'entreprise)"
- Icône tente ou soleil
- "Découvrir →"

### 4. Section détaillée HÉBERGEURS (la plus importante)
Titre : "Tous vos types de séjours, dans un seul outil"

Sous-titre : "Recevez les demandes — séjours scolaires, colos, groupes — créez vos devis depuis votre catalogue, suivez chaque dossier de A à Z."

5 features avec mockups intégrés ou icônes :

1. **Catalogue produits + constructeur de devis** : Hébergement, repas, activités, transport, options. Calcul HT/TTC automatique, conditions d'annulation paramétrables. Adapté aussi bien aux séjours scolaires qu'aux colos.

2. **Dashboard collaboratif par séjour** : Pour chaque séjour réservé, un espace partagé avec l'enseignant ou l'organisateur : messagerie, planning, participants, documents. Visibilité temps réel sur chaque dossier.

3. **Planning drag & drop** : Organisez la semaine en glisser-déposer. Les groupes tournent automatiquement sur les activités. Export PDF A4 paysage pour l'impression.

4. **CRM clients intégré** : Gérez vos établissements scolaires et organisateurs récurrents, suivez l'historique de chaque client, relancez en un clic.

5. **Facturation Chorus Pro intégrée** : Facturez les établissements publics au format XML UBL 2.1, sans démarche supplémentaire. Conforme aux exigences de la facturation électronique.

CTA : "Essayer gratuitement" + "Voir le pricing"

### 5. Section détaillée ENSEIGNANTS
Titre : "Votre séjour scolaire, sans la paperasse"

Sous-titre : "De l'appel d'offres à la facturation, LIAVO automatise tout le workflow administratif. Gratuit, toujours."

4 features :

1. **Appel d'offres en quelques minutes** : Décrivez votre projet (destination, dates, nombre d'élèves), les centres répondent directement avec leurs devis. Comparez sans relancer par email.

2. **Signature électronique de la convention** : Le directeur d'école signe en ligne. Téléchargez ensuite le dossier de déclaration que vous transmettez vous-même au rectorat ou à la DSDEN.

3. **Autorisations parentales numériques** : Importez votre liste d'élèves depuis Pronote ou ONDE en CSV. Les parents signent en ligne (fiche sanitaire, régime alimentaire, paiement échelonné).

4. **Espace collaboratif avec l'hébergeur** : Messagerie, planning, documents, participants. Tout le séjour dans un seul endroit. Les parents suivent le séjour via un journal photos.

CTA : "Créer mon premier séjour"

### 6. Section détaillée ORGANISATEURS DE COLOS
Titre : "Organisez vos colonies en toute sérénité"

Sous-titre : "Pour les associations, mairies, comités d'entreprise et centres de loisirs. Trouvez le centre, gérez les inscriptions, suivez le séjour en direct."

3 features :

1. **Recherche d'hébergeur géolocalisée** : Lancez votre demande dans la zone qui vous intéresse, recevez des devis qualifiés des centres disponibles à vos dates.

2. **Espace collaboratif partagé** : Le même outil que pour les séjours scolaires : messagerie, planning, documents, participants, autorisations parentales numériques.

3. **Suivi familles** : Les parents reçoivent un journal de séjour pendant les vacances : photos, planning du jour, nouvelles. Pas d'app à installer.

Mention discrète : "Les fonctionnalités spécifiques colo (intégration TAM, gestion BAFA, inscriptions familles directes) sont sur la roadmap. Vos retours nous aident à les prioriser."

CTA : "Tester gratuitement"

### 7. Section RÉSEAUX (encadré, plus discret)
Titre : "Vous pilotez un réseau d'hébergeurs ?"

Sous-titre : "LIAVO offre un dashboard de pilotage à votre fédération ou association : suivi des adhérents, KPIs réseau, invitation en masse, intégration APIDAE automatique. **Votre rôle de mise en relation reste central** — LIAVO gère l'administratif après la mise en relation que vous orchestrez."

3 fonctionnalités :
- Dashboard temps réel avec KPIs (demandes, devis, taux de réponse, CA généré)
- Onboarding score par centre adhérent
- Invitation en masse + import APIDAE

CTA : "Demander une démo réseau"

### 8. Pricing (uniquement hébergeurs)
Titre : "Tarifs hébergeurs — Enseignants et organisateurs : toujours gratuit"

3 plans :

**Découverte — Gratuit**
- Profil public du centre
- Visibilité des demandes de séjour
- Aperçu des demandes (sans coordonnées)

**Essentiel — 29€ HT/mois** (290€/an, 2 mois offerts) — Marqué "Recommandé"
- Tout Découverte
- Réponse aux demandes avec coordonnées
- Constructeur de devis avec catalogue
- Signature électronique de la convention
- Génération facture
- Export Chorus Pro

**Complet — 59€ HT/mois** (590€/an, 2 mois offerts)
- Tout Essentiel
- Dashboard collaboratif par séjour
- Planning collaboratif drag & drop
- Messagerie intégrée
- Journal de séjour pour les parents
- CRM clients hébergeur
- Import CSV élèves depuis Pronote/ONDE

### 9. Section "Conforme et sécurisé"
3 colonnes :
- **Données hébergées en France** — RGPD, données personnelles d'élèves protégées
- **Facturation électronique** — Chorus Pro intégré pour les marchés publics
- **Signature électronique** — Conforme eIDAS pour les autorisations parentales et conventions

### 10. CTA final
- Fond sombre
- Titre : "Prêt à digitaliser vos séjours ?"
- 2 boutons : "Je suis hébergeur" (primary) + "Je suis enseignant ou organisateur" (secondary)

### 11. Footer
- Logo + copyright "© 2026 LIAVO SASU · 102 994 910 RCS Annecy"
- Liens : Mentions légales, CGU, CGV Hébergeurs, Confidentialité, Mandat de facturation, contact@liavo.fr

## Ce que tu ne dois PAS faire

- Pas d'emojis dans les titres ou le corps de texte (icônes SVG OK)
- Pas de chiffres inventés (pas de "10 000 utilisateurs", pas de "+500 centres", pas de "649 centres référencés")
- Pas de témoignages ou citations inventés
- Pas de promesses non vérifiables ("réponse en 48h garantie", "économie de 40%")
- **Pas de mention "déclaration TAM/SDJES automatique"** — ce n'est pas implémenté et il n'y a pas d'API publique
- **Pas de mention "soumission rectorat automatique"** — l'utilisateur télécharge le dossier et l'envoie lui-même
- **Pas de mention BAFA/BAFD, inscriptions familles directes, paiement ANCV** — pas en prod
- Pas de mention "allergies par SMS" ou autres détails inventés

## Principes éditoriaux

- Vocabulaire métier précis : "appel d'offres", "convention de séjour", "autorisation parentale", "fiche sanitaire", "dossier de déclaration", "Chorus Pro", "APIDAE", "signature électronique"
- Ton direct et factuel, pas de jargon SaaS générique ("révolutionnaire", "puissant", "intuitif")
- Les bénéfices viennent du gain de temps administratif, pas de promesses commerciales
- Le pitch hébergeur doit clairement signaler que LIAVO couvre **tous types de séjours** (scolaires + colos + groupes)
- La partie hébergeur est la plus développée, les autres sont plus synthétiques

## Format de sortie

Un prototype interactif complet exportable en HTML pour intégration dans un projet Next.js 15.
