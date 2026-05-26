# Roadmap nouvelles features LIAVO

## SC-PDF-DEVIS-EXTERNE — Affichage PDF devis uploadé depuis outil externe (BUG URGENT)

Contexte : démo Witmer (lycée Charolles). L'enseignant veut uploader un PDF de devis
créé hors LIAVO (Henrri, Word, etc.) et le voir correctement dans l'espace collaboratif.
Actuellement le devis affiché était à 0€ et l'affichage du PDF externe est incorrect.

### Ce qu'il faut faire
1. Identifier pourquoi le devis uploadé externe affiche 0€ — probablement le montant
   est lu depuis les champs Prisma (lignesDevis) et non depuis le PDF brut
2. Corriger l'affichage : si typeDevis='UPLOAD_EXTERNE', afficher le PDF tel quel
   sans tenter de parser les lignes
3. Distinguer clairement dans l'UI : "Devis généré par LIAVO" vs "Devis importé"

### Seuil
Urgent — bloquant pour onboarding Witmer.

---

## SC-NOTIF-COLLABORATIF — Notifications email organisateur sur espace collaboratif

Contexte : démo Witmer. L'organisateur ne va pas sur LIAVO tous les jours.
Quand l'hébergeur poste un message ou met à jour l'espace collaboratif,
l'organisateur doit recevoir un email de notification.

### Ce qu'il faut faire
- À chaque POST /collaboration/:sejourId/messages → envoyer email à tous les ORGANISATEURS du séjour
- À chaque upload document hébergeur → email notif organisateur
- Email sobre : "Le Sauvageon a mis à jour votre espace collaboratif → Voir le séjour"
- Ne pas notifier l'hébergeur (trop de séjours → trop de notifs, confirmé en démo)
- Option "Se désabonner des notifications" dans l'email (lien unsubscribe)

### Seuil
Prioritaire — bloquant pour adoption organisateur.

---

## SC-MULTI-ORGANISATEURS — Invitation collègue organisateur sur un séjour

Contexte : démo Witmer. Plusieurs enseignants co-organisent souvent le même séjour.
Besoin d'inviter un collègue avec accès lecture ou collaboration.

### Ce qu'il faut faire
- Nouveau rôle sur le séjour : CO_ORGANISATEUR (lecture seule) ou CO_ORGANISATEUR_EDIT
- Bouton "Inviter un collègue" dans l'espace collaboratif organisateur
- Email d'invitation → le collègue crée son compte ou se connecte → accès au séjour
- Dans les guards : vérifier sejourId IN (créateur OU co-organisateur)

### Impact schéma
```
model SejourCollaborateur {
  sejourId  String
  userId    String
  role      String // CO_ORGANISATEUR | CO_ORGANISATEUR_EDIT
}
```

### Seuil
Après SC-NOTIF-COLLABORATIF — les deux vont ensemble.

---

## SC-IMPORT-PARTICIPANTS — Import élèves depuis fichier externe (Pronote/CSV)

Contexte : démo Witmer. La gestionnaire et l'académie gèrent les inscriptions via Pronote.
Les enseignants ont besoin d'importer la liste des élèves depuis un export Pronote/CSV.
Actuellement seul l'export CSV est disponible, pas l'import.

### Ce qu'il faut faire
- Bouton "Importer des élèves" dans la section participants du séjour
- Upload d'un fichier CSV (format Pronote à analyser)
- Mapping des colonnes : nom, prénom, date naissance, classe, email parent
- Validation + aperçu avant import définitif
- Gestion des doublons (élève déjà présent)

### Format Pronote à clarifier
Demander à Witmer un export CSV Pronote pour analyser le format exact avant de coder.

### Seuil
Après avoir reçu un exemple de fichier Pronote de Witmer.

---

## SC-PRONOTE-AUTORISATIONS — Autorisations parentales via Pronote

Contexte : démo Witmer. La gestionnaire/académie envoie les autorisations parentales
via Pronote. Les parents signent dans Pronote avec leur accès parent.
LIAVO doit s'adapter à ce flux ou proposer une alternative.

### Options
- Option A : LIAVO reste en parallèle de Pronote — l'enseignant importe les autorisations
  signées depuis Pronote sous forme de PDF et les attache au séjour
- Option B : intégration API Pronote (complexe, accès restreint)
- Option C : LIAVO génère ses propres autorisations parentales indépendamment de Pronote,
  l'établissement choisit quel outil utiliser

### À clarifier avec Witmer
Est-ce que Pronote remplace complètement les autorisations LIAVO, ou est-ce complémentaire ?
Est-ce que d'autres établissements utilisent Pronote de la même façon ?

### Seuil
Après clarification avec plusieurs établissements — ne pas coder sur un seul retour.

---

## SC-DEVIS-LIBRE — Devis sans séjour (gestion libre hébergeur)

Contexte : l'hébergeur gère des événements hors séjours scolaires (mariages, séminaires,
groupes privés, etc.).

### Ce qu'il faut faire
- Rendre Devis.sejourId nullable (migration Prisma)
- Toggle "Séjour libre" dans le formulaire devis → champs libres (nom client, dates, description)
- Badge "Événement libre" dans le dashboard
- Export PDF identique

### Seuil
Confirmé — mariage en gestion libre au Sauvageon.

---

## SC-INVITATIONS-PLANNING — Invitations en attente visibles dans le planning hébergeur

Pré-requis : SC-DEVIS-LIBRE (sejourId nullable).

### Ce qu'il faut faire
- Afficher invitations EN ATTENTE dans le planning avec badge "En attente d'acceptation"
- Bouton "Préparer un devis" → formulaire pré-rempli depuis données invitation
- Rattachement automatique au séjour quand l'enseignant accepte

### Seuil
Après onboarding Charolles.

---

## SC-CRM-SIDEBAR — Sidebar navigation dans le CRM hébergeur

Fix : ajouter liens principaux dans la nav top du CRM (Planning, Devis, Catalogue).
Seuil : prochain chantier UI/UX global.

---

## SC-CHATBOT — Aide contextuelle + onboarding première connexion

### 1. Chatbot d'aide contextuelle
- Widget flottant, Claude API, contextuel à la page courante
- À déclencher : 3+ utilisateurs actifs

### 2. Onboarding première connexion par rôle
- Flag premiereConnexion en base, steps guidés par rôle
- À déclencher : avant ouverture grand public

---

## SC-AGENT-IA — Agent agentique LIAVO

Claude API avec tool use — agit à la place de l'utilisateur.
Seuil : 5-10 enseignants actifs en prod.

---

## SC-MENUS-IA — Proposition automatique de menus par IA

Claude API → planning repas jour par jour depuis allergies + nb personnes + activités.
Seuil : après 1 séjour réel sur l'espace collaboratif.

---

## SC-CRON — Relances trial robustes

pg-boss ou table CronJob. Seuil : 3 hébergeurs inscrits.

---

## SC-IMPORT-HISTORIQUE — Import devis/factures Henrri (Sauvageon)

Format : export PDF Henrri ZIP.
Seuil : quand le Sauvageon veut basculer sur LIAVO comme outil principal.

---

## SC-STRIPE — Paiement abonnement

Stripe Checkout + webhook + portail client.
Seuil : après validation commerciale pricing.

---

## SC-PLANNING-DRAG-CREATE — Création séjour/devis par drag sur le planning hébergeur

Contexte : l'hébergeur reçoit un appel, veut bloquer des dates immédiatement.
Aujourd'hui il doit aller dans le formulaire de création, aucun raccourci depuis le planning.

### Ce qu'il faut faire
- Drag-to-select sur la grille planning (mousedown → mousemove → mouseup sur cellules jour)
- Feedback visuel : surlignage bleu des jours sélectionnés pendant le drag
- Au relâchement : modale de choix → "Créer un séjour" (formulaire rapide) ou "Créer un événement libre" (devis libre)
- Dates pré-remplies depuis la sélection
- Fallback mobile : bouton "+" sur chaque cellule jour (le drag touch est peu fiable)

### Alternative simplifiée
Si le drag est trop lourd : bouton "+" par cellule jour, qui ouvre la même modale de choix.
Le résultat fonctionnel est identique, le coût est 3× moindre.

### Seuil
Après refactor planning UX (SC-PLANNING-UX). Les deux se complètent.

---

## SC-DEVIS-CTA — Bouton "Créer un devis" dans la page Devis & Facturation

Contexte : dans le dashboard hébergeur, section "Devis & Facturation", il n'y a aucun moyen
de créer un devis from scratch. L'hébergeur doit passer par le planning ou l'URL directe.

### Ce qu'il faut faire
- Ajouter un CTA "Nouveau devis" en haut de la page `/dashboard/hebergeur/devis`
- Redirige vers `/dashboard/hebergeur/devis-libres/nouveau`
- Style cohérent avec les autres CTA du dashboard

### Seuil
Rapide (< 1h). À faire dès que SC-PLANNING-UX est livré.
