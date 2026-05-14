# LIAVO — État session dev
> Dernière mise à jour : 13/05/2026 — Session complète DevisLibre + CRM pipeline mariage

## RÉFÉRENCE SQL — NOMS DE TABLES POSTGRESQL
> Lire cette section en premier avant toute requête SQL sur Scalingo.

| Modèle Prisma             | Table PostgreSQL réelle         |
|---------------------------|---------------------------------|
| User                      | utilisateurs                    |
| Organisation              | organisations                   |
| Membership                | memberships                     |
| CentreHebergement         | centres_hebergement             |
| InvitationHebergement     | invitations_hebergement         |
| ProduitCatalogue          | produits_catalogue              |
| Disponibilite             | disponibilites                  |
| Document                  | documents                       |
| Devis                     | devis                           |
| LigneDevis                | lignes_devis                    |
| DemandeDevis              | demandes_devis                  |
| Sejour                    | sejours                         |
| Message                   | messages                        |
| PlanningActivite          | planning_activites              |
| GroupeSejour              | groupes_sejour                  |
| EleveGroupe               | eleves_groupes                  |
| DocumentSejour            | documents_sejour                |
| AutorisationParentale     | autorisations_parentales        |
| AccompagnateurMission     | accompagnateurs_missions        |
| Client                    | clients                         |
| LigneBudgetComplementaire | lignes_budget_complementaires   |
| RecetteBudget             | recettes_budget                 |
| DevisLibre                | devis_libres                    |
| LigneDevisLibre           | lignes_devis_libre              |
| VersementDevisLibre       | versements_devis_libre          |
| ActiviteClient            | activites_client (À CRÉER)      |

### StatutDevis — valeurs actuelles
EN_ATTENTE | EN_ATTENTE_VALIDATION | SELECTIONNE | SIGNE_DIRECTION | NON_RETENU

### StatutDevisLibre — valeurs (string, pas enum)
BROUILLON | ENVOYE | ACCEPTE | REFUSE | PAYE

### StatutSejour — valeurs actuelles
DRAFT | SUBMITTED | APPROVED | REJECTED | CONVENTION | SOUMIS_RECTORAT | SIGNE_DIRECTION | DECLARE_TAM

---

## REGLE ABSOLUE — PROCESS CC
**Prompts longs : découper en parties numérotées.**
**git add/commit/push passent par CC. PowerShell uniquement pour les requêtes SQL Scalingo.**
**Lire les fichiers source avant toute proposition. Ne jamais écrire de prompt sans avoir lu.**

---

## STACK TECHNIQUE

| Composant | Technologie | URL |
|---|---|---|
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind 4 | liavo.fr (Scalingo Paris) |
| Backend | NestJS 11 / Prisma / PostgreSQL 17 | api.liavo.fr (Scalingo Paris) |
| Stockage | OVH Object Storage Gravelines | s3.gra.io.cloud.ovh.net |
| Emails | Brevo | contact@liavo.fr (fromName configurable) |

**Repo :** theorocheloison-hash/sejour-jeunesse
**Local :** C:\Users\Roche-Loison\Desktop\sejour-jeunesse (copie UNIQUE)
**Scalingo CLI :** C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe
**PROJECT_DIR :** backend=backend / frontend=frontend

---

## COMMANDES SCALINGO

```bash
scalingo --app liavo-backend --region osc-fr1 pgsql-console
scalingo --app liavo-backend --region osc-fr1 logs --lines 100
scalingo --app liavo-backend --region osc-fr1 deployments
scalingo --app liavo-backend --region osc-fr1 env-set NOM_VAR=valeur
```

---

## COMPTES DE RÉFÉRENCE

| Email | Rôle | MDP |
|---|---|---|
| contact@liavo.fr | ADMIN | Admin2026! |
| resa@lesauvageon.com | HEBERGEUR (Sauvageon) | [réinitialisé 13/05] |
| demo-lmdj@liavo.fr | RESEAU (LMDJ) | LMDJ2026! |

Centre Sauvageon ID : 3a710674-d580-4ffd-9d9a-f739bae82154
INTERDIT : contact@chalet-sauvageon.fr = INEXISTANT

---

## MODULE DEVIS LIBRES — 13/05/2026 (COMPLET ET VALIDÉ EN PROD)

### Flux complet validé
1. Création devis depuis planning/CRM/direct ✅
2. Email client avec lien contrat PDF + bouton signature ✅
3. Page signature publique (sans auth) ✅
4. Contrat PDF généré côté backend (react-pdf, @react-pdf/renderer v4.5.1) ✅
5. Upload contrat sur OVH S3 ✅
6. Signature électronique eIDAS niveau simple ✅
7. Email confirmation après signature ✅
8. Suivi versements + barre de progression ✅
9. Intégration planning (blocs orange/vert/bleu) ✅
10. Intégration CRM fiche client (Section 5b) ✅

### Fichiers clés
- `backend/src/devis-libres/contrat-sauvageon.pdf.tsx` — contrat react-pdf complet
- `backend/src/devis-libres/devis-libres.service.ts` — génération PDF + envoi email
- `backend/src/devis-libres/dto/create-devis-libre.dto.ts` — DTOs avec décorateurs class-validator
- `frontend/app/dashboard/hebergeur/devis-libres/nouveau/page.tsx` — formulaire + mode edit
- `frontend/app/dashboard/hebergeur/devis-libres/[id]/page.tsx` — page détail
- `frontend/app/devis-libre/signer/[token]/page.tsx` — page publique

### Contrat mariage — données fixes Sauvageon
- Signataire bailleur : Maëva Roche-Loison, Directrice SAS LE SAUVAGEON
- IBAN : FR76 1810 6000 2796 7820 4408 470 / BIC : ***REDACTED***
- Banque : Crédit Agricole des Savoie — Samoens
- Tribunal : Annecy
- Acompte : 30% fixe
- Accès : vendredi 17h00 → dimanche 16h00 (chambres 11h00)
- Paliers annulation : 9 mois remboursé / 9-6 mois 50% / <6 mois intégralité due
- RGPD : 5 ans conservation

### Email expéditeur
- Adresse : contact@liavo.fr (domaine vérifié Brevo)
- Nom d'affichage : "Chalet Le Sauvageon" pour emails client DevisLibre
- Nom d'affichage : "Liavo" pour emails internes hébergeur
- email.service.ts accepte fromName? optionnel (4e arg)

### Points d'attention / bugs connus
- **Quantité catalogue à 0** : quand ajout depuis catalogue, quantité pré-remplie à 0
  → Fix simple dans `nouveau/page.tsx` : pré-remplir à 1 au lieu de 0
- **Mode édition** : `?edit=id` fonctionne ✅
- **Bloquer signature** si contrat non téléchargé ✅
- **Arrondis** : round2() appliqué sur tous les montants avant génération PDF ✅

### Commits session 13/05
- `feat(devis-libres): backend module complet`
- `feat(devis-libres): frontend lib + page signature + planning + CRM` (096ac54)
- `feat(devis-libres): formulaire création + page détail` (1f52ba3)
- `fix(backend): retire buildpack LibreOffice` (25a8e86)
- `feat(devis-libres): contrat PDF react-pdf côté backend` (pushé)
- `feat(email): fromName configurable` (33ecfaf)
- `fix(devis-libres): arrondis + paliers + blocage signature + heures` (e38ccfe)

---

## CRM PIPELINE MARIAGE — PROCHAINE FEATURE (À IMPLÉMENTER)

### Vision validée
La page CRM fiche client est le HUB commercial. La page détail devis est le détail transactionnel pur.
La page devis a juste un lien "← Voir la fiche client" en haut. Pas de fil d'Ariane sur la page devis.

### Process commercial mariage Sauvageon
```
1. Premier contact (appel/mail)
   → Créer fiche client CRM
   → Bouton "Envoyer les infos" → email Brevo avec brochure PDF en PJ
   → Tracé automatique dans Activité : "Brochure envoyée le XX/XX"

2. Visite programmée
   → Bouton "Planifier une visite" → lien Google Agenda (URL construite côté frontend)
   → Note manuelle dans Activité : "Visite effectuée le XX/XX"

3. Confirmation post-visite
   → Bouton "+ Nouveau devis événement" → formulaire pré-rempli
   → Tracé automatique dans Activité : "Devis DL-2026-XXX envoyé"

4. Signature
   → Tracé automatique : "Devis DL-2026-XXX signé le XX/XX"

5. Acompte + versements
   → Tracé automatique : "Versement reçu — 2100€"
```

### Ce qui est à construire

#### A — Model ActiviteClient (migration Prisma)
```prisma
model ActiviteClient {
  id          String   @id @default(uuid())
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  centreId    String
  type        String   // APPEL / EMAIL / VISITE / DEVIS / SIGNATURE / VERSEMENT / NOTE
  description String
  metadata    Json?    // { devisId, montant, numeroDevis, etc. }
  createdAt   DateTime @default(now())
  userId      String?
}
```
Relation inverse sur Client : `activites ActiviteClient[]`

#### B — Backend
- `POST /clients/:id/activites` — créer une activité manuelle (HEBERGEUR)
- `GET /clients/:id/activites` — liste chronologique (HEBERGEUR)
- Appels automatiques dans `devis-libres.service.ts` :
  - `envoyer()` → créer activité type=DEVIS description="Devis XX envoyé"
  - `signer()` → créer activité type=SIGNATURE
  - `ajouterVersement()` → créer activité type=VERSEMENT

#### C — Frontend fiche client CRM (`clients/page.tsx`)
Section "Activité" sous la Section 5b DevisLibres :
- Log chronologique : icon + type + description + date
- Bouton "Ajouter une note" → modal simple (type + texte)
- Bouton "Envoyer la brochure" → POST /clients/:id/activites + appel email Brevo
- Bouton "Planifier une visite" → URL Google Agenda construite côté frontend

#### D — Frontend page détail devis (`devis-libres/[id]/page.tsx`)
Ajouter en haut : lien "← Voir la fiche client" si devis.clientId présent
→ router.push(`/dashboard/hebergeur/clients?selected=${devis.clientId}`)

#### E — Brochure
Fichier : `backend/assets/brochure-sauvageon.pdf` (déjà uploadé ce jour)
Email brochure : même pattern que contrat, uploadBuffer sur S3 au premier envoi
puis URL réutilisée (stocker dans CentreHebergement.brochureUrl)

### Ordre d'implémentation recommandé
1. Migration Prisma ActiviteClient
2. Backend routes + appels automatiques dans service DevisLibres
3. Frontend section Activité dans fiche client
4. Frontend bouton "Envoyer la brochure" + upload brochure S3
5. Frontend bouton Google Agenda
6. Frontend lien retour fiche client sur page devis

---

## AUTRES CHANTIERS ROADMAP

### Court terme
- Fix quantité catalogue à 0 (DevisLibre formulaire)
- CloudConvert PDF contrat → remplacé par react-pdf ✅

### Moyen terme
- SC-TRIAL : essai 30 jours hébergeur
- SC-STRIPE : paiement abonnement
- SC-CRON : relances trial (pg-boss)
- Type 3 : séjour gré-à-gré sans enseignant

### Long terme / Vision
- Agent IA traitement email : webhook → Claude API → extraction entités →
  création client CRM → génération devis → human-in-the-loop → envoi
  Stack : Brevo webhook + NestJS + claude-sonnet-4-6 + LIAVO CRM

### Chantiers suspendus
- SC7 : notifications APIDAE
- APIDAE LMDJ (credentials Anaïtis Mangeon)
- Résilier Railway + Cloudflare R2 (URGENT)
- Chorus Pro production
- Refactoring DashboardShell

---

## LEÇONS RETENUES

- DTOs NestJS : décorateurs class-validator OBLIGATOIRES si whitelist:true global
- LibreOffice sur Scalingo : IMPOSSIBLE (2.9 GiB) → react-pdf Node.js
- Routes NestJS : statiques AVANT paramétriques
- Prompts CC longs : découper en parties numérotées
- StorageService : uploadBuffer() pour Buffer, upload() pour Multer.File
- DevisLibre.statut : String → BROUILLON/ENVOYE/ACCEPTE/REFUSE/PAYE
- Floating point : toujours round2() avant affichage/PDF montants
- Email fromName : 4e arg optionnel sur sendGenericNotification()
- Planning LIAVO : séjours/événements physiques uniquement (pas visites)
- CRM = hub commercial / Page devis = détail transactionnel pur
- str_replace non fiable Windows → utiliser write_file
- Railway : OBSOLÈTE depuis 29/04
