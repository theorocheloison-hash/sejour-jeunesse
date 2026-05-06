# LIAVO — Journal d'avancement

> Fichier de référence pour les sessions de développement.
> `ARCHITECTURE_ORGANISATIONS.md` reste le doc de référence architectural.
> Ce fichier documente uniquement **ce qui a été fait, décidé et déployé** session par session.

---

## État global (06/05/2026 — fin de journée)

| SC | Statut | Détail |
|---|---|---|
| SC0 | ✅ PROD | Scalingo Paris, OVH Gravelines, Brevo FR — Railway + R2 résiliés |
| SC1→SC9 | ✅ PROD | Voir sessions précédentes |
| CRM legacy | ✅ PROD | Pont RelationCommerciale sur Rappel+ContactClient |
| HORS_SCOLAIRE | ✅ PROD | typeContexte propagé, formulaire bifurqué, récapitulatif TAM |
| Landing | ✅ PROD | Refactor complet — voir session 06/05 |
| Légal | ✅ PROD | Railway→Scalingo/OVH, RGPD, Morillon |
| /appel-offres | ✅ PROD | Choix scolaire/colo step 1, géographie optionnelle, champs conditionnels |
| /register | ✅ PROD | Page orientation hébergeur/organisateur (2 blocs, sans carte directeur) |

**Prochaine étape prioritaire : visio LMDJ de suivi (email envoyé à Anaïtis le 06/05)**

---

## Session 06/05/2026 — Landing complète + infra + commercialisation

### Infra résiliée
- Railway supprimé (projet + services + compte)
- Cloudflare R2 bucket `liavo-uploads` vidé et supprimé
- DNS Cloudflare nettoyé : CNAME Railway → `liavo-frontend.osc-fr1.scalingo.io`
- Variables `R2_*` → `S3_*` sur Scalingo + `storage.service.ts`
- Compte Cloudflare conservé (gère DNS liavo.fr)

### Landing — changements majeurs (nombreux commits)
- **Hero** : titre "Vos séjours, sans la paperasse." / sous-titre "Hébergeurs et organisateurs de séjours jeunesse — fini les échanges d'email, LIAVO centralise tout." / 3 blocs trust (Né du terrain / Données en France / Pour tous les acteurs) / bulle flottante catalogue bas-droite
- **Features** : numéros remplacés par icônes SVG (hébergeurs 6, enseignants 4, colonies 5, collaboratif 3)
- **Actors-flow** : animation fill-mode + nth-child delays pour trait animé séquentiel
- **Footer** : tagline "Du projet pédagogique à la facturation finale." / showTagline=false sur Logo
- **Nav** : "Espace collaboratif" supprimé, "À propos" déplacé en dernier
- **ps-cta** : fond supprimé, boutons centrés sans encadré
- **Catalogue section** : barre de recherche supprimée, vidéo OVH intégrée avec overlay hover
- **Vidéo catalogue** : `catalogue-liavo-final.mp4` uploadé sur OVH Object Storage (ACL public-read via AWS CLI container Scalingo), URL : `https://liavo-uploads.s3.gra.io.cloud.ovh.net/Video%20catalogue%20liavo.mp4`
- **btn-primary** : `background: #C87D2E !important` pour éviter transparence sur fond beige

### Pages légales
- `mentions-legales` : Railway → Scalingo SAS, R2 → OVH Object Storage + Brevo
- `confidentialite` : sous-traitants mis à jour, section 4 "Aucun transfert hors UE"
- `cgu` : "649+ centres" → "catalogue national"

### /a-propos
- Nouvelle page créée : mission, fait en France, Pourquoi LIAVO (3 blocs icônes), contact
- Texte corrigé : "haut-savoyard", "propriétaire du Chalet Le Sauvageon", tirets → virgules
- Lien ajouté dans nav + footer

### /register
- Refonte complète : 2 blocs (hébergeur / organisateur) sans carte directeur
- Hébergeur : "Trouver mon centre" → /catalogue?claim=1 + "Créer un centre" → /register/hebergeur
- Organisateur : Catalogue + Appel d'offres + Créer un compte

### /appel-offres
- Step 1 : choix scolaire/colo en premier (radio cards)
- Champs conditionnels : niveau de classe (SCOLAIRE) / âge min-max (HORS_SCOLAIRE)
- Label "Nombre d'élèves" conditionnel (participants / élèves / participants-élèves)
- Step 2 géographie : vraiment optionnelle (return true dans canAdvance)
- Message : "Si vous ne précisez pas de zone, votre demande sera envoyée à tous les centres référencés en France."

### Docs créés
- `docs/visio_suivi_LMDJ_support.html` — support pendant la visio LMDJ
- `docs/visio_suivi_LMDJ_email.html` — email post-visio (2 pages, 4 perspectives)
- `docs/ROADMAP_NOUVELLES_FEATURES.md` — mis à jour avec A.5, A.6, A.7

### Email envoyé à LMDJ
- Destinataires : Anaïtis Mangeon, Isabelle Louat, Marie Charvolin
- Depuis : contact@liavo.fr
- Objet : "Suite à notre démo — visio de suivi LIAVO × LMDJ"
- Créneaux proposés : lundi 11, mardi 12, mercredi 13 mai

---

## Points ouverts (06/05/2026 — fin de journée)

| Point | Priorité | Détail |
|---|---|---|
| Visio LMDJ de suivi | 🔴 URGENT | Attendre réponse Anaïtis — créneaux 11/12/13 mai proposés |
| Onboarder enseignants Sauvageon | 🔴 ACTION THÉO | Inviter via resa@lesauvageon.com → /dashboard/venue/inviter-enseignant |
| Test flow complet en prod | 🟠 Avant démo | Invitation hébergeur → enseignant → séjour → devis → convention |
| Page complétion après magic link | 🟠 Roadmap | Quand organisateur arrive via magic link, compléter les infos manquantes du séjour (ageMin/ageMax, zone, typeAccueilACM) |
| Icônes features landing | 🟡 À vérifier | Vérifier que les SVG s'affichent bien en prod sur toutes les sections |
| btn-primary transparent | 🟡 À vérifier | Vérifier que le fix !important résout le problème sur toutes les sections |
| SC7 widget signalement | ⏸ SUSPENDU | Attente validation commerciale LMDJ/IDDJ |
| JWT httpOnly cookie | ⏸ DIFFÉRÉ | Post-validation commerciale |
| DashboardShell unifié | ⏸ DIFFÉRÉ | 4-6 jours, risque moyen |
| Chorus Pro AIFE inscription | 🔵 Futur | Vérifier getChorusXml() fonctionnel, inscription SIRET |
| DECLARE_TAM enum BDD | 🔵 Info | Statut conservé en BDD mais non atteignable via UI |
| SSO APIDAE + co-branding LMDJ | 🔵 Post-accord | Voir A.7 dans ROADMAP_NOUVELLES_FEATURES.md |
| Disponibilités calendrier hébergeur | 🔵 Post-accord | Voir A.5 |
| Grille tarifaire hébergeur | 🔵 Post-accord | Voir A.6 |
| Espace ressources LMDJ | 🔵 Post-accord | Section alimentée par LMDJ pour leurs adhérents |

---

## Roadmap fonctionnalités nouvelles (voir ROADMAP_NOUVELLES_FEATURES.md)

- A.5 — Disponibilités calendrier hébergeur (post-accord LMDJ)
- A.6 — Grille tarifaire hébergeur (post-accord LMDJ)
- A.7 — SSO APIDAE + co-branding LMDJ (à discuter en visio)
- B.1 — Pop-up aide IA contextuelle
- B.2 — Menu intelligent IA
- A.0 — Phase commercialisation
- C.0 — Flow colonie complet
- A.4 — Intégration APIDAE sans partenariat réseau
- A.3bis — Récupération emails centres EN

---

## Infra de référence (état 06/05/2026)

| Composant | Service | Détail |
|---|---|---|
| Backend | Scalingo Paris | liavo-backend, Node 20, NestJS |
| BDD | Scalingo PostgreSQL 17.9 | liavo-backend-db |
| Frontend | Scalingo Paris | liavo-frontend, Next.js 15, standalone |
| Stockage | OVH Object Storage Gravelines | liavo-uploads, S3 compatible, ACL public activé |
| Emails | Brevo FR | contact@liavo.fr |
| DNS | Cloudflare | CNAME → liavo-frontend.osc-fr1.scalingo.io |
| Registrar | OVH | dns14/ns14.ovh.net |
| Repo | GitHub | theorocheloison-hash/sejour-jeunesse |
| CI/CD | Push main → Scalingo auto | Procfile: prisma migrate deploy + start:prod |

**URLs prod :** https://liavo.fr | https://api.liavo.fr
**Admin prod :** contact@liavo.fr
**Compte Sauvageon :** resa@lesauvageon.com
**Compte démo réseau :** demo-lmdj@liavo.fr / LMDJ2026!
**Scalingo CLI :** `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
**SQL prod :** `scalingo --app liavo-backend --region osc-fr1 pgsql-console`

---

## Règles de développement (rappel permanent)

1. **Fix at source, never patch** — règle absolue
2. **Lire les fichiers avant toute proposition** — via filesystem MCP, jamais depuis hypothèses
3. **Anticiper les bugs cascade** avant d'écrire le moindre code
4. **Ne jamais push sans confirmation explicite** de Théo
5. **Pattern** : lire → proposer → valider → CC exécute → vérifier build → Théo confirme → push
6. **PostgreSQL Scalingo** : noms de tables snake_case, modèles Prisma PascalCase entre guillemets dans SQL
7. **`str_replace` non fiable sur chemins Windows** → utiliser `write_file`
8. **`search_files` filesystem** = matching sur noms de fichiers uniquement (jamais sur le contenu)
9. **Migrations Prisma** : vérifier que CC a bien créé le fichier migration dans `backend/prisma/migrations/` — sinon `ALTER TYPE` manuel sur Scalingo + créer le fichier à la main
10. **Scalingo CLI** : `C:\Users\Roche-Loison\scalingo\scalingo_1.44.1_windows_amd64\scalingo.exe`
11. **Commande SQL prod** : `scalingo --app liavo-backend --region osc-fr1 pgsql-console`
