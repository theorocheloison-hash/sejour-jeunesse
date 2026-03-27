# LIAVO — État session dev (27 mars 2026)

## DÉPLOYÉ AUJOURD'HUI

### Mise à jour juridique KBIS
- SIREN 102 994 910 RCS Annecy dans toutes les pages légales
- Mandat de facturation v1.0 → v1.1
- Footer : © 2026 LIAVO SASU · 102 994 910 RCS Annecy

### Fix catalogue hébergeurs
- Persistance arrays Prisma (set explicite) pour thematiquesCentre, activitesCentre, equipements
- Région déduite depuis département dans mapCentre()
- Interface Centre dans frontend/src/lib/centre.ts mise à jour (6 nouveaux champs catalogue)

### Dashboard réseau partenaire — complet
- Rôle RESEAU ajouté à l'enum Role (migration 20260327_add_role_reseau)
- Champ reseauNom + reseauNomComplet sur User (migrations add_reseau_nom_user + add_reseau_nom_complet_user)
- Champ reseau sur CentreHebergement (migration 20260327_add_reseau_centre)
- Endpoint GET /reseau/stats (ReseauController, protégé RESEAU+ADMIN)
- Page /dashboard/reseau : 6 KPIs, filtre période (30j/90j/saison/tout), tableau centres
- Invitation centres depuis le dashboard réseau (POST /reseau/inviter)
- Fiche détaillée centre en slide-over (GET /reseau/centres/:id)
- Onboarding score (0-4 ronds) par centre avec tooltip
- Export CSV côté client avec BOM UTF-8
- Nom complet réseau dans JWT et affichage dashboard

## ÉTAT COMPTES DE DÉMO

### Compte réseau LMDJ
- Email : demo-lmdj@liavo.fr / LMDJ2026!
- reseauNom : LMDJ
- reseauNomComplet : La Montagne des Juniors
- Dashboard : /dashboard/reseau

### Compte hébergeur Sauvageon
- Email : resa@lesauvageon.com / Test1234!
- Centre ID : 3a710674-d580-4ffd-9d9a-f739bae82154
- reseau : LMDJ ✅
- accessiblePmr : true, avisSecurite : Favorable
- Mandat facturation : accepté via nouvelle modale ✅

### Autres comptes test
- enseignant@test.fr / directeur@test.fr (Test1234!)
- admin@sejour-jeunesse.fr / Admin2026!

## CHECKLIST DÉMO LMDJ + IDDJ (dans 1 mois)

### Dashboard réseau — à améliorer avant démo
- [ ] Corriger KPI "Demandes reçues" : inclure les demandes publiques auxquelles le centre a répondu
- [ ] Créer compte démo IDDJ (demo-iddj@liavo.fr, reseauNomComplet=Isère Drôme Junior)
- [ ] Créer 4-5 centres fictifs LMDJ avec devis pour rendre le dashboard représentatif
- [ ] Préparer scénario démo : invitation d'un centre en live depuis le dashboard LMDJ

### Gel du code 1 semaine avant la démo

## CHECKLIST LANCEMENT RÉEL

### Administratif
- [ ] SIRET LIAVO (en attente attribution INSEE — surveiller sirene.fr SIREN 102994910)
- [ ] Dès SIRET actif : créer compte Chorus Pro (chorus-pro.gouv.fr) + inscription OD sur PISTE
- [ ] Acte de cession IP pré-incorporation (code → LIAVO SASU)
- [ ] Mettre à jour mentions légales avec SIRET définitif

### Technique
- [ ] Railway Pro au premier client payant
- [ ] Rapprochement bancaire Phase 1 : CSV Crédit Agricole
- [ ] Invitation en masse hébergeurs depuis dashboard réseau (upload CSV)
- [ ] Génération projet pédagogique par IA (post-démo, prioritaire)

## BACKLOG TECHNIQUE
- IA génération projet pédagogique (cas d'usage prioritaire post-démo)
- Rapprochement bancaire Phase 2 : API Bridge
- Import CSV hébergeurs en masse depuis dashboard réseau
- transportSurPlace dans formulaire invitation hébergeur
- Boîte email connectée au CRM

## LEÇONS RETENUES
- Arrays Prisma : toujours { set: [...] } pour les mises à jour
- EmailModule doit être importé explicitement dans chaque module NestJS
- BREVO_SENDER_EMAIL : domaine vérifié DKIM+DMARC obligatoire en prod
- Railway Hobby : SLA zéro → Pro au premier client
- Mandat facturation : IP + modale lecture obligatoire pour valeur juridique
- Chorus Pro : immatriculation OD post-SIRET, pas d'agrément
