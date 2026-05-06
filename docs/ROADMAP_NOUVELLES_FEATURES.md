**État au 05/05/2026**

| SC | Statut | Détail |
|---|---|---|
| SC0 | ✅ | Scalingo Paris, OVH Gravelines, Brevo FR |
| SC1 | ✅ | Schéma, backfill BDD, doublons nettoyés |
| SC1bis | ✅ | findOrCreateOrganisation, helpers |
| SC2 | ✅ | GET /organisations/search |
| SC3 | ✅ | StructureSearch.tsx |
| SC4 | ✅ | Rôles français, passe A+B |
| SC4bis | ✅ | claim.service.ts, page admin claims |
| SC4ter | ✅ | getAllSejoursSignataire() via Membership+email, champs etablissement* supprimés |
| SC5 | ✅ | Dashboards, routes françaises |
| SC5bis | ✅ | 6 routes hébergeur, /centre/[id]/claim, admin invitations |
| SC6 | ✅ | /appel-offres, magic link |
| SC7 | ⏸ SUSPENDU | Validation commerciale |
| SC8 | ✅ | Colonnes etablissement* supprimées |
| SC9 | ✅ | StatutDevis FACTURE_ACOMPTE+SOLDE, backfill SQL prod |
| Landing | ✅ | Refactor complet — commit 0010a50 |

**Ordre prochains chantiers :** CRM legacy (section 3.7) → HORS_SCOLAIRE/DECLARE_TAM → SC7 post-validation commerciale

---

## Backlog fonctionnalités nouvelles (ajoutées le 05/05/2026)

### B.1 — Pop-up aide IA contextuelle

Widget flottant sur toutes les pages, tous rôles. Réponses limitées au périmètre LIAVO + séjours jeunesse/scolaires. Stack probable : composant React client, streaming backend NestJS → API Claude avec system prompt étanche. V1 sans persistance BDD. **Estimé : 3-5 jours. Ne pas coder avant validation commerciale.**

Questions ouvertes : accès au contexte utilisateur (séjour ouvert, rôle) ? Historique session ou one-shot ? Position UI (bouton fixe bas-droite ou intégré nav) ? Tous rôles ou subset ?

### B.2 — Menu intelligent IA

Dans l'espace collaboratif d'un séjour : génération automatique de menus journaliers adaptés aux allergies/régimes déclarés dans les fiches sanitaires. Output : planning repas + liste de courses, export PDF. Stack : appel claude-sonnet-4 en backend, prompt structuré avec contraintes alimentaires, réponse JSON → affichage frontend. **Estimé : 3-5 jours. Dépend validation commerciale.**

Questions ouvertes : visible hébergeur uniquement ou partagé organisateur ? Menu modifiable après génération ? Format export ?

### A.0 — Phase de commercialisation (priorité haute, avant prochaine démo)

Actions immédiates :
- Onboarding hébergeur guidé : séjour démo pré-créé au 1er login, checklist 5 étapes, emails séquencés J+1/J+3/J+7. Estimé : 2-3 jours tech.
- CRM commercial Théo : tracker Notion/Airtable prospects/démos/statuts. Outil externe, à créer maintenant.
- Deck réseaux : 10 slides pour pitch LMDJ post-démo (positionnement post-mise-en-relation). Avant visio LMDJ de suivi.
- LinkedIn LIAVO SASU : page entreprise + premier post (calendrier 12 semaines à reprendre).
- Page /a-propos sur liavo.fr : qui est LIAVO, qui est Théo, pourquoi, références Sauvageon.

### C.0 — Flow colonie complet (HORS_SCOLAIRE/DECLARE_TAM — déjà roadmap, à préciser)

`typeContexte=HORS_SCOLAIRE` est en BDD depuis SC4ter. Ce qui manque : choix scolaire/colonie dans le formulaire de création séjour, conditionnel dashboard organisateur (masquer rectorat, afficher TAM), statut `DECLARE_TAM`, génération dossier déclaration (Cerfa 13605*03 pré-rempli ou export données brutes — à valider).

Fonctionnalités spécifiques colos absentes de LIAVO à benchmarker avant de coder : gestion animateurs BAFA/BAFD (ratio encadrement), déclaration sanitaire, assurance RC/annulation, inscription directe familles (Phase C), ratio encadrement automatique.

**Action préalable : benchmark 2-3 concurrents (Odoo Nonprofit, Anim'action, logiciels colo marché).**

### A.4 — Intégration APIDAE sans partenariat réseau

**Question :** peut-on accéder à des données APIDAE sans être partenaire réseau ?

Réponse probable (à confirmer) : les catalogues LMDJ/IDDJ sont dans des projets APIDAE privés — leurs credentials sont nécessaires. Il existe une API APIDAE publique mais elle ne couvre pas les centres jeunesse labellisés des réseaux.

**Action avant de coder :** contacter support@apidae-tourisme.com pour confirmer l'existence d'un accès générique aux établissements d'hébergement collectif pour mineurs. **Ne pas supposer.**

Note : les credentials IDDJ sont déjà en prod (apiKey=mr8RQgOh, projetId=3217, selectionId=67523 — 54 centres). Les credentials LMDJ sont en attente d'Anaïtis Mangeon.

### A.3bis — Récupération emails centres EN pour notification géographique

**Objectif :** notifier les hébergeurs labellisés EN (catalogue data.education.gouv.fr) quand une demande de séjour correspond à leur zone géographique.

**Problème :** l'API EN n'expose pas les emails, uniquement nom/adresse/département/site web.

**Options enrichissement email :**
- Scraping sites web (fragile, scalable) — estimé 1 semaine dev + maintenance
- Enrichissement manuel pour 200-300 centres prioritaires — estimé 2-3 jours
- Prestataire data B2B (Kaspr, Dropcontact) — estimé 50-200€, meilleur ratio qualité/temps
- Inscription volontaire via landing (opt-in légal, croissance lente)

**Cadre légal :** envoi B2B en France soumis à opt-out (LCEN) — intérêt légitime + mention désinscription obligatoire. **Valider avec juriste avant envoi de masse.**

**Mécanique technique** déjà spécifiée en SC6bis : rate limit 7j via `dernierEmailDemandeAt`, filtre géographique département, fire-and-forget depuis `demande.service.ts`.

**Prérequis avant de coder :** télécharger CSV EN + compter le volume, valider cadre légal opt-out, valider commercialement post-LMDJ.

---

*Document à maintenir à jour. Toute déviation documentée ici avec date et raison.*
