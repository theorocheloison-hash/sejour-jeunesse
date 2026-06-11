# LIAVO — État session dev
> Dernière mise à jour : 11/06/2026 — Session stratégie + dev (branding LMDJ, logo PDF, SIRET fix, départements multi-valeur)

---

## COMMITS SESSION 11/06/2026

| Commit | Description |
|---|---|
| `819d859` | feat(source-reseau): tag source réseau sur User + DemandeDevis, téléphone /appel-offres (backend) |
| `dc8fdfa` | feat(source-reseau): bandeau réseau + téléphone + badge « via LMDJ » hébergeur (frontend) |
| `6226a0e` | feat(appel-offres): branding réseau complet LMDJ — header co-brandé, titre, couleurs |
| `0750663` | feat(appel-offres): bloc contact réseau plus visible (accroche + numéro cliquable) |
| `7651a78` | feat(logo-hebergeur): logo centre sur devis et factures PDF |
| `33618cc` | fix(infra): PutBucketCors sur bucket OVH liavo-uploads (CORS pour react-pdf Image) |
| *(fix siret)* | fix(devis-facture): champs émetteur (SIRET/TVA/IBAN) depuis le centre sur tous les PDF |
| *(fix dates)* | fix(appel-offres): canAdvance() accepte dates flexibles (moisSouhaite + dureeNuits) |
| *(departements)* | feat(appel-offres): départements multi-valeur full-stack + skip step Destination réseau |

---

## TRAVAUX RÉALISÉS SESSION 11/06/2026

### Stratégie — Positionnement LIAVO × LMDJ

**Document de référence créé : `docs/POSITIONNEMENT_LIAVO_RESEAUX.md`**

Positionnement validé suite à l'analyse du rapport d'activité LMDJ 2025 et de la note AG cotisations 2026 :

- **LIAVO = infrastructure technique qui modernise la centrale LMDJ**, pas un remplacement du rôle humain
- La centrale LMDJ reste payante (28 051€/an de revenus préservés). LIAVO ne touche pas à ce flux
- L'enseignant arrive via lamdj.com → redirigé vers LIAVO (self-service) → demande taggée "lmdj" → hébergeur voit badge "via LMDJ"
- Les salariées LMDJ passent du rôle de saisie/dispatch au rôle de support/accompagnement (gain de temps)
- Le badge "via LMDJ" rend la valeur du réseau mesurable (KPIs : taux de réponse, conversion, CA réseau)
- Canaux organiques LIAVO développés en parallèle (catalogue, SEO) — non mentionnés au CA LMDJ
- **Démo Marie Charvolin : 18/06. CA LMDJ : 30/06. Message porté par Marie, pas par Théo.**

Chiffres clés LMDJ (rapport activité 2025) :
- 190 adhérents, 107 hébergements, 522 demandes/an (-7%), classes de neige -38% sur 2 ans
- Budget : 260K€ produits dont 71% subventions, 28K€ centrale, 42K€ cotisations. Déficit 6 530€
- Subvention Savoie en baisse de 20K€ en 2026
- Nouveau modèle cotisation 2027 voté : 152€ fixe + 3€/lit (plafonné 150 lits), Centrale corrélée à l'adhésion

### Source réseau — Tag + Badge + Téléphone (commits 819d859, dc8fdfa)

- Migration `20260611_source_reseau_telephone` : `source_reseau VARCHAR(50)` sur `utilisateurs` ET `demandes_devis`
- `User.sourceReseau` : first-touch attribution, persiste à vie (fidélité trackable même en DIRECT)
- `DemandeDevis.sourceReseau` : traçabilité par demande
- Backfill non destructif sur User existant (jamais écrasé si déjà renseigné)
- Frontend : champ téléphone (optionnel) dans le step Coordonnées
- Badge "🏔️ via La Montagne des Juniors" dans la vue hébergeur des demandes ouvertes
- Mapping partagé `src/data/reseaux-partenaires.ts` (lmdj, iddj)

### Branding réseau complet (commits 6226a0e, 0750663)

- Header co-brandé : logo LMDJ dominant (h-12) + "PROPULSÉ PAR Liavo" discret + contact réseau à droite
- Logo LMDJ servi statiquement depuis `frontend/public/logos/lmdj.png`
- Titre conditionnel : "Confiez-nous votre recherche d'hébergement" (wording lamdj.com)
- Sous-titre : "Notre réseau compte plus de 100 centres de vacances agréés en Savoie et Haute-Savoie"
- Accent couleur cyan LMDJ (#2BB5D4) via override CSS variable `--color-primary` sur `<main>`
- Bloc contact : "Une question ? On vous accompagne" + 📞 04 50 45 69 54 (cliquable tel:) + email
- Fallback : `?reseau=nimportequoi` ou sans param → page LIAVO standard inchangée

### Logo hébergeur sur PDFs (commit 7651a78 + 33618cc)

- `CentreHebergement.logoUrl` : upload endpoint `POST /centres/:id/logo` (jpeg/png, max 2Mo)
- `DevisPDF` (frontend, react-pdf browser) : Image conditionnelle à gauche de l'émetteur (maxWidth 120, maxHeight 60)
- `FacturePDF` (backend, react-pdf server) : même rendu
- 8 points d'appel câblés passant `logoUrl` (TabDevisFacturation ×2, signer, invitation-direction, signataire, hébergeur/devis, organisateur/demandes, organisateur/sejours/offres)
- **CORS OVH S3** : PutBucketCors appliqué sur bucket `liavo-uploads` (AllowedOrigins: liavo.fr + localhost:3000, GET/HEAD)
- Upload restreint jpeg/png (pas de webp — react-pdf ne supporte pas)

### Fix SIRET/TVA/IBAN émetteur (fix siret)

- **Cause racine 1** : TVA/IBAN absents du select centre dans `collaboration.service.ts` (budget collab) → jamais affichés sur devis PDF collaboratifs
- **Cause racine 2** : SIRET non pré-rempli dans le formulaire de création devis collab (`hebergeur/devis/nouveau/page.tsx`)
- **Cause racine 3** : Fallback `??` au lieu de `||` — `siretEntreprise: ''` (chaîne vide) ne basculait pas sur `centre.siret`
- Fix : `||` sur tous les fallbacks snapshot→centre (nom/adresse/siret/email/tel) dans TabDevisFacturation + facture.service.ts

### Fix dates flexibles canAdvance()

- **Bug** : le bouton "Suivant" du step 2 (Informations) était bloqué quand "Je n'ai pas encore de dates précises" était coché
- **Cause** : `canAdvance()` exigeait inconditionnellement `form.dateDebut && form.dateFin`, mais les dates flexibles vident ces champs
- **Fix** : `datesOk = form.datesFlexibles ? !!(form.moisSouhaite && form.dureeNuits) : !!(form.dateDebut && form.dateFin)`
- Vérification payload handleSubmit : moisSouhaite/dureeNuits/noteDateFlexible transmis correctement

### Départements multi-valeur (feat departements)

- Migration `20260611_demande_departements_cibles` : `ADD COLUMN departements_cibles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]` sur `demandes_devis`
- Backend : `departementsCibles` dans DTO + création + `matchesDemandeZone()` (prime sur `regionCible`) dans `findOpen` + notifier
- Frontend : `departementsDefaut: ['73', '74']` sur LMDJ dans reseaux-partenaires.ts
- Skip step Destination quand `reseauInfo.departementsDefaut` est renseigné : 5 steps → 4 steps
- Auto-remplissage `departementsCibles` + `typeZone: 'DEPARTEMENT'`
- Récapitulatif affiche "Département(s) : 73, 74"
- Rétro-compatible : `regionCible` conservé, défault `[]` pour les autres flux

---

## ÉTAT PROD AU 11/06/2026

### Features livrées et déployées

Tout ce qui est listé dans la session 10/06 + la session 11/06 ci-dessus.

### 0 bug connu

Le bug dates flexibles canAdvance() et le bug SIRET/TVA/IBAN ont été corrigés dans cette session.

### URL de test

- `liavo.fr/appel-offres` → page LIAVO standard
- `liavo.fr/appel-offres?reseau=lmdj` → branding complet LMDJ (4 steps, départements 73+74 auto)
- Compte démo réseau : `demo-lmdj@liavo.fr` / LMDJ2026!

### Préparation démo Marie 18/06

- [ ] Créer 3-4 demandes test via `?reseau=lmdj` (zone Ville:Morillon pour cibler Sauvageon uniquement)
- [ ] Vérifier les KPIs Pôle Montagne dans le dashboard réseau
- [ ] Préparer le scénario de démo (3 actes : parcours enseignant, vue hébergeur badge, dashboard réseau)

---

## DOCUMENTS STRATÉGIQUES

| Document | Emplacement | Contenu |
|---|---|---|
| Positionnement LIAVO × réseaux | `docs/POSITIONNEMENT_LIAVO_RESEAUX.md` | Architecture flux, valeur par acteur, modèle éco, risques, plan d'exécution |
| Architecture UX séjour | `docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` | Page séjour unifiée, CRM dérivé, planning couleurs, facturation |
| Business model | `docs/commercial/BUSINESS_MODEL.md` | Grille tarifaire, seuil rentabilité |
| Proposition partenariat | `docs/partenariat_liavo_v2_1.pdf` | One-pager LMDJ + IDDJ (version pré-stratégie 11/06) |

---

## ÉCHÉANCES

| Date | Événement | Statut |
|---|---|---|
| **18/06** | Démo Marie Charvolin (CDI LMDJ) | À préparer |
| **30/06** | CA LMDJ — pitch partenariat | Message porté par Marie |
| Nov 2026 | Stripe Checkout | Roadmap |
| 31/12/2026 | Clôture 1er exercice LIAVO SASU | — |

---

## PROCHAINS CHANTIERS (par priorité)

### Avant le 18/06
- [ ] Créer demandes test LMDJ (via ?reseau=lmdj, zone Morillon)
- [ ] Vérifier dashboard réseau avec données réelles

### Avant le 30/06
- [ ] KPIs réseau enrichis (stats par source : nb demandes, taux conversion, CA) dans le dashboard réseau
- [ ] Préparer les chiffres Pôle Montagne pour Marie (conversion, élèves, fidélisation)

### Post-CA (roadmap validée)
- Notifier centres APIDAE non inscrits sur nouvelle demande
- Freemium hébergeur (gratuit = profil + dispo + aperçu ; payant = détail + répondre + devis)
- SSO APIDAE (quand credentials reçus d'Amandine Chatain)
- Rôle RESEAU : création demande au nom d'un enseignant (fallback téléphone)
- Branding réseau dans le parcours enseignant (logo LMDJ dans les emails de confirmation)
- Convention configurable par centre (phase 2, quand 2e centre actif)
- DashboardShell refactoring (4-6j, risque moyen, NE PAS faire avant démos)
- Audit sécurité global (RGPD, sessions JWT, données mineurs)
- DevisBuilder composant partagé (3 fichiers dupliqués)

---

## COMMITS SESSION 10/06/2026

| Commit | Description |
|---|---|
| `47a34e9` | fix(sejour): signature/convention/participants fonctionnels en mode DIRECT **et** COLLABORATIF |
| `c5751df` | docs: maj LIAVO_SESSION_STATE |
| `32332d1` | fix(frontend): `outputFileTracingRoot` → restaure sortie standalone (déploiement Scalingo) |
| `12c7669` | chore: trigger redeploy |
| `724fe2f` | fix(participants): total élèves + accompagnateurs partout via `formatParticipants` |
| `b0c6b94` | feat(appel-offres): sélection établissement via annuaire EN/SIRENE public |
| `10a0a35` | feat(auth): auto-validation organisateurs/signataires + notification admin |
| `466631d` | feat(convention): aperçu PDF avant envoi + CGV Sauvageon |

---

## ACTEURS CLÉS (mis à jour)

- **Yves Massard** (Pôle Montagne) : 1er client externe, 3 centres actifs prod, adhérent LMDJ 20 ans
- **Marie Charvolin** (CDI LMDJ) : démo 18/06, CA 30/06, veut data (conversion, élèves, fidélisation)
- **Anaïtis Mangeon** : directrice LMDJ
- **Violaine Villette** : présidente LMDJ
- **Eric Bothorel** : trésorier LMDJ
- **Alticlub** (Samoëns) : hébergeur inscrit sur LIAVO, a soulevé l'objection "pourquoi payer LMDJ + LIAVO"
- **Frédéric Chevalier** (Lycée Les Bruyères) : 1er utilisateur flow DIRECT→COLLABORATIF
- **Maëva Roche-Loison** : gestionnaire Sauvageon
- **Théo** : admin LMDJ depuis AG 01/06/2026, fondateur LIAVO

---

## MAPPING TABLES PRISMA → POSTGRESQL

| Model Prisma | Table PostgreSQL |
|---|---|
| User | utilisateurs |
| CentreHebergement | centres_hebergement |
| Devis | devis |
| LigneDevis | lignes_devis |
| Facture | factures |
| SequenceNumero | sequence_numero |
| DemandeDevis | demandes_devis |
| Sejour | sejours |
| Client | clients |
| ActiviteClient | activites_client |
| SejourClient | sejours_clients |
| Rappel | rappels |
| ContactClient | contacts_clients |
| Message | messages |
| PlanningActivite | planning_activites |
| GroupeSejour | groupes_sejour |
| DocumentSejour | documents_sejour |
| AutorisationParentale | autorisations_parentales |
| AccompagnateurMission | accompagnateurs_missions |
| InvitationCollaboration | invitations_collaboration |

---

## NOTES TECHNIQUES

- **Migrations SQL** : manuelles uniquement (`ALTER TABLE` via Scalingo psql), jamais `prisma migrate dev` en prod. Vérifier systématiquement que CC crée le fichier migration dans `backend/prisma/migrations/`.
- **TypeScript** : 0 erreurs au build (`npx tsc --noEmit`) avant tout commit.
- **`window.location.href` vs `router.push`** : pour les redirects post-registration nécessitant un rechargement complet de l'AuthProvider (cookies), `window.location.href` est correct.
- **Scalingo psql multi-statements** : passer dans un seul `BEGIN;...COMMIT;` sans lignes vides.
- **Body limit NestJS** : 5mb configuré.
- **JWT_SECRET** : sécurisé en prod depuis 29/05/2026, aucun fallback faible.
- **OG tag "649 centres"** : donnée réelle, ne jamais supprimer.
- **CORS OVH S3** : policy appliquée sur bucket `liavo-uploads` (AllowedOrigins: liavo.fr + localhost:3000). Si un nouveau domaine est ajouté, mettre à jour via le script `backend/scripts/set-cors.ts`.
- **react-pdf Image** : jpeg/png uniquement (pas de webp). URLs OVH S3 publiques (public-read ACL).
- **Fallback `??` vs `||`** : dans les mappings snapshot→centre (DevisPDF/FacturePDF), utiliser `||` pour que les chaînes vides basculent sur le centre. `??` ne bascule que pour null/undefined.
- **Tables Prisma** : les noms réels PostgreSQL sont en snake_case pluriel (ex: `utilisateurs`, `demandes_devis`). Ne JAMAIS utiliser les noms Prisma (User, DemandeDevis) dans les migrations SQL.
