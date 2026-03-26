# LIAVO — État session dev (26 mars 2026)

## DÉPLOYÉ AUJOURD'HUI

### Fix image catalogue
- mapCentre() : image: null → image: c.imageUrl ?? null

### Flux invitation centre externe — complet
- Table invitations_centre_externe (migration 20260326_add_invitation_centre_externe)
- Token dans le lien, centreId lié à l'inscription, séjour DRAFT + DemandeDevis créés à la validation admin

### Bandeau thématiques manquantes (enseignant)
- PATCH /sejours/:id/thematiques (TEACHER)
- Bandeau amber + formulaire inline niveau → checkboxes → save

### Notifications devis
- Relance enseignant : 7 → 20 jours
- Relance hébergeur : nouveau CRON 9h à 30 jours

### Mandat de facturation — entièrement verrouillé
- IP + User-Agent capturés (migration 20260326_add_mandat_ip_ua)
- Modale obligatoire avec lien + checkbox "J'ai lu et j'accepte"
- Email confirmation depuis contact@liavo.fr (DKIM + DMARC)
- Page /legal/mandat-facturation : 9 articles v1.0
- BREVO_SENDER_EMAIL : theo.rocheloison@gmail.com → contact@liavo.fr

### Pages légales complètes
- /legal/mentions-legales, /legal/cgu, /legal/cgv-hebergeurs, /legal/confidentialite
- Footer liavo.fr : 6 liens opérationnels

### Champs catalogue centre — uniformisation avec API EN
- Migration 20260326_add_centre_catalogue_fields : accessiblePmr, avisSecurite, thematiquesCentre, activitesCentre, capaciteAdultes, periodeOuverture
- mapCentre() lit les vrais champs (plus de valeurs hardcodées)
- Section "Informations catalogue" dans le formulaire profil hébergeur
- Interface Centre dans frontend/src/lib/centre.ts mise à jour

## EN COURS (CC vient de pousser, pas encore déployé)
- fix: persistance arrays centre (set explicite Prisma pour thematiquesCentre, activitesCentre, equipements)
- fix: région déduite depuis département dans mapCentre()

## ÉTAT COMPTE SAUVAGEON (démo LMDJ)
- Email : resa@lesauvageon.com / Test1234!
- Centre ID : 3a710674-d580-4ffd-9d9a-f739bae82154
- Statut : ACTIVE, compte_valide=t, email_verifie=t
- accessiblePmr : true, avisSecurite : Favorable
- thematiquesCentre : {} (vide — fix en cours, à re-sauvegarder après déploiement)
- Mandat facturation : réinitialisé — à accepter via nouvelle modale

## CHECKLIST DÉMO LMDJ (semaine prochaine)

### À faire dès que le fix arrays est déployé
- [ ] Reconnexion resa@lesauvageon.com → Mon profil → re-sauvegarder thématiques et activités
- [ ] Vérifier l'affichage dans le catalogue (badges PMR, Avis favorable, thématiques, région)
- [ ] Accepter le mandat via la nouvelle modale

### Gel du code jeudi soir — plus de push en prod jusqu'après la démo

## CHECKLIST LANCEMENT RÉEL HÉBERGEURS
- [ ] Immatriculation SASU LIAVO → SIRET → mettre à jour mentions légales + mandat
- [ ] Immatriculation OD Chorus Pro via API PISTE (2-4 semaines post-SIRET)
- [ ] Railway Pro au premier établissement signé
- [ ] Tarification hébergeurs à finaliser

## BACKLOG POST-DÉMO
- Rapprochement bancaire Phase 1 : import CSV Crédit Agricole
- Rapprochement bancaire Phase 2 : API Bridge post-premier cash
- transportSurPlace dans formulaire hébergeur inviter-enseignant
- Boîte email connectée au CRM (Gmail/Outlook OAuth)

## DONNÉES TEST EN BASE
- resa@lesauvageon.com (Test1234!) — 270 clients + 268 contacts
- enseignant@test.fr / directeur@test.fr (Test1234!)
- theo@nunayak.com (Test1234!)
- admin@sejour-jeunesse.fr (Admin2026!)
- Séjour ID test : 32842d6a-24d5-44b4-ab36-aae594e8fe00
- UAI test : 0750001A (Collège Victor Hugo Paris)

## LEÇONS RETENUES
- Migrations manuelles : vérifier @@map() dans schema.prisma
- EmailModule doit être importé explicitement dans chaque module NestJS
- Railway Hobby : SLA zéro → Pro au premier client
- Mandat : IP + email + modale lecture obligatoire pour valeur juridique
- Chorus Pro : immatriculation OD post-SIRET, pas d'agrément
- BREVO_SENDER_EMAIL : domaine vérifié DKIM+DMARC obligatoire en prod
- Arrays Prisma : utiliser { set: [...] } pour les mises à jour de tableaux
