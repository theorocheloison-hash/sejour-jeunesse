# LIAVO — État session dev (26 mars 2026)

## DÉPLOYÉ AUJOURD'HUI

### Fix image catalogue hébergeurs LIAVO
- mapCentre() dans hebergement.service.ts : image: null → image: c.imageUrl ?? null
- Le Chalet Le Sauvageon apparaît maintenant avec sa photo dans le catalogue

### Flux invitation centre externe — chaînon manquant
- Nouvelle table invitations_centre_externe (migration 20260326_add_invitation_centre_externe)
- inviterCentreExterne() stocke en DB + passe invitationToken dans le lien
- register/venue/page.tsx : lit invitationToken depuis query params, lie le centre à l'invitation à l'inscription
- validerHebergeur() : crée séjour DRAFT + DemandeDevis privée automatiquement + notifie l'enseignant

### Bandeau thématiques manquantes
- PATCH /sejours/:id/thematiques (TEACHER)
- Bandeau amber conditionnel dans sejour/[id]/page.tsx si thematiquesPedagogiques vide
- Formulaire inline : select niveau → checkboxes thématiques → save

### Notifications devis
- DELAI_RELANCE_DEVIS_JOURS : 7 → 20 jours (relance enseignant)
- Nouveau CRON 9h : relance hébergeur à 30 jours si devis EN_ATTENTE sans réponse

### Mandat de facturation Chorus Pro — sécurisé
- Migration 20260326_add_mandat_ip_ua : mandatFacturationIpAddress + mandatFacturationUserAgent
- centre.controller.ts : capture IP (x-forwarded-for) + User-Agent à l'acceptation
- centre.service.ts : persiste IP/UA uniquement à la première acceptation (idempotent)
- EmailModule injecté dans CentreModule
- email.service.ts : sendMandatFacturationConfirmation() avec résumé 4 points + tableau métadonnées
- Page statique /legal/mandat-facturation : 9 articles exacts du mandat v1.0

### Pages légales complètes
- /legal/mentions-legales : éditeur, hébergeur, PI, données, cookies, droit applicable
- /legal/cgu : 9 articles, gratuit pour établissements, signature électronique eIDAS
- /legal/cgv-hebergeurs : 11 articles, mandat facturation intégré, tarifs "en cours"
- /legal/confidentialite : RGPD complet, données mineurs renforcées, droits, CCT Railway
- Footer liavo.fr : 6 liens légaux opérationnels

### DNS et branding
- BREVO_SENDER_NAME : "Séjour Jeunesse" → "LIAVO"
- www.liavo.fr → liavo.fr (redirect Next.js next.config.ts)

## ÉTAT COMPTE SAUVAGEON (démo LMDJ)
- Email : resa@lesauvageon.com / Test1234!
- Centre ID : 3a710674-d580-4ffd-9d9a-f739bae82154
- Statut : ACTIVE, compte_valide=t, email_verifie=t
- Image : présente (Cloudflare R2) ✅ — visible dans le catalogue depuis le fix d'aujourd'hui
- Description actuelle : "Chalet de montagne" → À COMPLÉTER avant démo
- Types séjours : scolaire, colo, classe_neige ✅
- contact@chalet-sauvageon.fr : n'existe pas en DB (jamais créé) — utiliser uniquement resa@lesauvageon.com

## CHECKLIST DÉMO LMDJ (semaine prochaine)

### Bloquant avant jeudi soir (gel du code)
- [ ] Compléter description Sauvageon depuis dashboard resa@lesauvageon.com
- [ ] Créer compte enseignant démo rattaché à un vrai collège Haute-Savoie
- [ ] Tester flux complet en prod : enseignant → Sauvageon → devis → sélection
- [ ] Gel du code jeudi soir — plus de push en prod jusqu'après la démo

### Non bloquant mais visible
- [ ] transportSurPlace dans formulaire hébergeur inviter-enseignant (30 min)

## CHECKLIST LANCEMENT RÉEL HÉBERGEURS

### Avant premier client payant
- [ ] Immatriculation SASU LIAVO → obtenir SIRET → mettre à jour mentions légales + mandat
- [ ] Immatriculation OD sur Chorus Pro via API PISTE (2-4 semaines post-SIRET)
- [ ] Railway Pro (SLA 99.9%) au premier établissement signé
- [ ] Tarification hébergeurs à finaliser (CGV section 3 marque "en cours")

### Post-démo LMDJ
- [ ] Rapprochement bancaire Phase 1 : import CSV Crédit Agricole + matching automatique
- [ ] Rapprochement bancaire Phase 2 : API Bridge (post premier cash)
- [ ] Boîte email connectée au CRM (Gmail/Outlook OAuth)

## BACKLOG TECHNIQUE

### Flux invitations — edge case restant
- Lier invitation externe à une demande existante si hébergeur crée compte sans token (edge case)

### Notifications
- Emails automatiques Brevo la veille des rappels CRM (volontairement déprioritisé)

## DONNÉES TEST EN BASE
- resa@lesauvageon.com (Test1234!) — 270 clients + 268 contacts importés
- enseignant@test.fr / directeur@test.fr (Test1234!)
- theo@nunayak.com (Test1234!) — compte enseignant test
- admin@sejour-jeunesse.fr (Admin2026!)
- Séjour ID test : 32842d6a-24d5-44b4-ab36-aae594e8fe00
- UAI établissement test : 0750001A (Collège Victor Hugo Paris)

## LEÇONS RETENUES
- Migrations manuelles : toujours vérifier @@map() dans schema.prisma (model User → table "utilisateurs")
- Modifier une migration après deploy casse le checksum Prisma
- EmailModule doit être explicitement importé dans chaque module NestJS qui l'utilise
- Railway Hobby : SLA zéro → passer Pro au premier client réel
- Mandat de facturation : IP + email confirmation obligatoires pour valeur juridique (art. 1366 CC)
- Chorus Pro : pas d'agrément, juste immatriculation OD sur portail AIFE post-SIRET
