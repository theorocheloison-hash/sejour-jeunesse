# LIAVO — État du projet
> Dernière mise à jour : 26 mars 2026

---

## Entité juridique

**LIAVO SAS** — créée le 26/03/2026 via le Guichet Unique
- Formalité : **J00228864781**
- Forme : SAS (société par actions simplifiée)
- Capital : **1 000 €**
- Siège : 472 Route du Mas Devant, 74440 Morillon, France
- Président : **Théo Roche-Loison** (né le 27/10/1993 à Roanne)
- Activité démarrée : 23/03/2026
- Nature : Libérale non réglementée
- Régime fiscal : IS réel simplifié, franchise en base TVA
- Publication légale : Eco Savoie Mont-Blanc Web, 24/03/2026

**Statut actuel :** dossier déposé, en attente de traitement par le Greffe et l'INSEE (délai : 5–10 jours ouvrés). Le Kbis et le SIREN arriveront par email.

**Actions à faire dès réception du Kbis :**
- Ouvrir un compte bancaire professionnel au nom de LIAVO SAS
- Céder la marque INPI (personne physique → LIAVO SAS) — formulaire INPI, ~100€
- Mettre à jour les mentions légales sur liavo.fr avec le numéro SIREN

---

## Marque

- **LIAVO** déposée à l'INPI en personne physique (Théo Roche-Loison)
- Classes : **35, 38, 42**
- Numéro de dépôt reçu par email (mars 2026)
- À céder à la SASU après création (voir ci-dessus)

---

## Domaine & infrastructure

- **liavo.fr** — acheté OVH, 3 ans, renouvellement mars 2029
- **www.liavo.fr** — CNAME vers liavo.fr
- Redirect 301 www → apex configuré dans next.config.ts (commit 78d6f3d)
- Hébergement : **Railway EU West** (production)
- Base de données : **PostgreSQL 16** (Railway)
- Stockage fichiers : **Cloudflare R2** (bucket liavo-uploads)
- Emails transactionnels : **Brevo**

---

## SEO & Search Console

- Propriété **liavo.fr** vérifiée en mode "domaine" dans Google Search Console
- Sitemap `https://liavo.fr/sitemap.xml` soumis le 26/03/2026 — 5 pages indexables
- Ancien sitemap `https://www.liavo.fr/sitemap.xml` supprimé (était la cause du problème "page en double sans URL canonique")
- Balise canonical configurée dans `app/layout.tsx`
- robots.txt créé dans `/public/robots.txt`
- **Problème "page en double" en cours de résolution** — Google repassera le crawl dans 1–2 semaines

---

## Email

- **contact@liavo.fr** opérationnel dans Gmail via Zimbra OVH (IMAP/SMTP)

---

## Comptes de test

| Email | Rôle | Mot de passe |
|---|---|---|
| enseignant@test.fr | TEACHER | Test1234! |
| directeur@test.fr | DIRECTOR | Test1234! |
| contact@chalet-sauvageon.fr | VENUE | Test1234! |
| admin@sejour-jeunesse.fr | ADMIN | Admin2026! |

Tous liés à l'établissement UAI `0750001A` (Collège Victor Hugo Paris)

---

## Charte graphique (validée)

- **Couleur primaire :** `#1B4060` (bleu marine)
- **Couleur accent :** `#C87D2E` (ocre)
- **Couleur succès :** `#1E5C42` (vert)
- **Blanc cassé :** `#F5F4F1`
- **Typographie :** Inter 400/500 — jamais 600/700
- **Wordmark :** "Liavo" (L majuscule, iavo minuscule)
- **Tagline logo :** "Coordonnez vos séjours"
- **Baseline communication :** "Du projet pédagogique à la facturation finale."
- Pas d'emojis dans l'interface. Ton direct, factuel, sobre.

---

## Marketing & communication

### LinkedIn
- Profil Théo Roche-Loison mis à jour — titre Fondateur LIAVO, bannière en place
- **Post S1 publié** : "Ce que j'ai appris en 7 ans d'accueil de classes de neige"
- **Post S2 rédigé + visuel prêt** : "Demo enseignant — ce qu'il m'a dit" (François, Collège Lucien Herr, Altkirch)
- **Post S3 rédigé + visuel prêt** : "5 acteurs qui ne se parlent pas — pourquoi ça prend des mois"
- Calendrier éditorial 12 semaines défini (4 phases)

### Decks
- `LIAVO_Pitch_LaMontagne_des_Juniors.pptx` — 10 slides ✅
- `LIAVO_Pitch_Academie_Grenoble.pptx` — 8 slides ✅

### Outreach en cours
- **La Montagne des Juniors** : email envoyé, relance téléphonique à faire (script préparé)
- **Académie de Bourgogne** : email + PDF one-pager prêts à envoyer

---

## Roadmap immédiate

### Cette semaine
- [ ] Relance téléphonique La Montagne des Juniors
- [ ] Publier post LinkedIn S2
- [ ] Attendre Kbis (5–10 jours)

### Dès réception Kbis
- [ ] Ouvrir compte bancaire pro LIAVO SAS
- [ ] Céder marque INPI → LIAVO SAS
- [ ] Mettre à jour mentions légales liavo.fr (SIREN)
- [ ] Envoyer email académie Bourgogne

### Avant l'été 2026
- [ ] Premiers séjours Sauvageon sur LIAVO (cas d'usage réel)
- [ ] Kit démo standardisé (scénario fictif crédible)
- [ ] One-pager hébergeurs
- [ ] Posts LinkedIn S3 à S6
- [ ] 1 article SEO sur liavo.fr

---

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend | NestJS 11, Prisma ORM |
| Base de données | PostgreSQL 16 |
| Auth | JWT |
| Stockage | Cloudflare R2 |
| Emails | Brevo |
| Hébergement | Railway EU West |
| DNS/Domaine | OVH |

**Repo :** `theorocheloison-hash/sejour-jeunesse`
**Local :** `C:\Users\Roche-Loison\Desktop\sejour-jeunesse`
**Déploiement :** automatique sur push `main`

---

## Modèle économique

- **Établissements scolaires :** gratuit
- **Hébergeurs :** abonnement mensuel ou annuel (INACTIF / ACTIF / SUSPENDU)
- **Objectif terme :** contrats B2G avec les académies (modèle Pronote)

**Phase 1 (maintenant → 12 mois) :** gratuit établissements, payant hébergeurs
**Phase 2 (12 → 24 mois) :** freemium établissements
**Phase 3 (24 mois+) :** contrats académies / rectorats, intégration ENT
