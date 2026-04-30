# Brief Claude Design — Landing LIAVO V2

## Qui suis-je

LIAVO est un SaaS B2B français qui digitalise la coordination des séjours collectifs : séjours scolaires (classes vertes, classes de neige, voyages scolaires) et colonies de vacances. La plateforme connecte tous les acteurs d'un séjour : hébergeurs, enseignants, directeurs d'école, organisateurs de colos, parents, réseaux d'hébergeurs.

Je suis fondateur solo, en phase de démarchage commercial. La cible payante prioritaire est les hébergeurs de centres de vacances. Les enseignants et organisateurs de colos accèdent à la plateforme gratuitement.

## Ce que je veux

Une landing page UNIQUE, moderne, tech/startup, avec une structure claire qui parle à 3 personas distincts :
- **Hébergeurs** (cible principale, payante)
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

### 2. Hero — universel mais clair sur la valeur
- Titre court et puissant qui parle de coordination de séjours collectifs (pas d'invention type "rejoignez 500 centres")
- Sous-titre : LIAVO digitalise la coordination des séjours scolaires et colonies de vacances, du devis à la facturation
- 2 CTA : "Je suis hébergeur" (primary, mis en avant) + "Je suis enseignant ou organisateur" (secondary)
- Visuel : un mockup HTML/CSS stylisé d'un dashboard hébergeur montrant un séjour en cours (titre "Classe de montagne — 4ème — Morillon", 48 élèves, planning de la semaine, badges Signé/En attente)

### 3. Section "Pour qui ?" — sélecteur de persona
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
- "Vous organisez des camps d'été, séjours de vacances ou centres de loisirs"
- Icône tente ou soleil
- "Découvrir →"

### 4. Section détaillée HÉBERGEURS (la plus importante, plus longue)
Titre : "Reprenez le contrôle de votre activité séjours"

Sous-titre : "Recevez des demandes qualifiées, créez vos devis depuis votre catalogue, gérez chaque séjour de A à Z."

5 features avec mockups intégrés ou icônes :

1. **Catalogue produits + constructeur de devis** : Hébergement, repas, activités, transport, options. Calcul HT/TTC automatique, conditions d'annulation paramétrables. Fini les devis Excel renvoyés en PDF.

2. **Dashboard collaboratif par séjour** : Pour chaque séjour réservé, un espace partagé avec l'enseignant : messagerie, planning, participants, documents. Vous savez en temps réel où en est chaque dossier.

3. **Planning drag & drop** : Organisez la semaine en glisser-déposer. Les groupes d'élèves tournent automatiquement sur les activités. Export PDF A4 paysage pour l'impression.

4. **CRM clients intégré** : Gérez vos établissements scolaires récurrents, suivez l'historique de chaque client, relancez en un clic.

5. **Facturation Chorus Pro intégrée** : Facturez les établissements publics au format XML UBL 2.1, sans démarche supplémentaire. Conforme aux exigences de la facturation électronique.

CTA : "Essayer gratuitement" + "Voir le pricing"

### 5. Section détaillée ENSEIGNANTS (plus courte)
Titre : "Votre séjour scolaire, sans la paperasse"

Sous-titre : "De l'appel d'offres à la facturation, LIAVO automatise tout le workflow administratif. Gratuit, toujours."

4 features :

1. **Appel d'offres en quelques minutes** : Décrivez votre projet (destination, dates, nombre d'élèves), les centres répondent directement avec leurs devis. Comparez sans relancer par email.

2. **Validation directeur + rectorat intégrée** : Le directeur d'école signe électroniquement, le dossier part automatiquement à la DSDEN. Plus de PDF rempli à la main.

3. **Autorisations parentales numériques** : Importez votre liste d'élèves depuis Pronote ou ONDE en CSV. Les parents signent en ligne (fiche sanitaire, régime alimentaire, paiement échelonné).

4. **Espace collaboratif avec l'hébergeur** : Messagerie, planning, documents, participants. Tout le séjour dans un seul endroit. Les parents suivent même le séjour via un journal photos.

CTA : "Créer mon premier séjour"

### 6. Section détaillée ORGANISATEURS DE COLOS (courte)
Titre : "Organisez vos colonies en toute sérénité"

Sous-titre : "Trouvez le centre idéal, gérez les inscriptions familles, suivez le séjour en direct. Pour les associations, mairies, comités d'entreprise."

3 features :

1. **Recherche d'hébergeur géolocalisée** : Lancez votre demande dans la zone qui vous intéresse, recevez des devis qualifiés des centres disponibles à vos dates.

2. **Espace collaboratif partagé** : Le même outil que pour les séjours scolaires : messagerie, planning, documents, participants.

3. **Suivi familles** : Les parents reçoivent un journal de séjour pendant les vacances : photos, planning du jour, nouvelles. Pas d'app à installer.

Mention discrète : "La gestion BAFA, déclaration TAM et inscriptions familles publiques arrivent prochainement."

CTA : "Tester gratuitement"

### 7. Section RÉSEAUX (plus discrète, encadré)
Titre : "Vous pilotez un réseau d'hébergeurs ?"

Sous-titre : "LIAVO offre un dashboard de pilotage à votre fédération ou association : suivi des adhérents, KPIs réseau, invitation en masse, intégration APIDAE automatique."

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
- Signature directeur électronique
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
- Pas de promesses non vérifiables ("réponse en 48h garantie", "économie de 40%", etc.)
- Pas de mention "allergies par SMS" ou autres détails inventés
- Pas de mention de fonctionnalités qui n'existent pas (TAM, BAFA, inscriptions familles publiques sont en roadmap, pas en prod)

## Principes éditoriaux

- Vocabulaire métier précis : "appel d'offres", "convention de séjour", "autorisation parentale", "fiche sanitaire", "DSDEN", "Chorus Pro", "APIDAE"
- Ton direct et factuel, pas de jargon SaaS générique ("révolutionnaire", "puissant", "intuitif")
- Les bénéfices viennent du gain de temps administratif, pas de promesses commerciales
- La partie hébergeur est la plus développée (cible payante), les autres sont plus synthétiques

## Format de sortie

Un prototype interactif complet exportable en HTML pour intégration dans un projet Next.js 15.
