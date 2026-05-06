**État au 06/05/2026**

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
| CRM legacy | ✅ | Pont RelationCommerciale sur Rappel+ContactClient |
| HORS_SCOLAIRE | ✅ | typeContexte propagé, formulaire bifurqué, récapitulatif TAM |
| Landing | ✅ | Refactor complet + /a-propos + titre tarifs + ps-cta |
| Légal | ✅ | Railway→Scalingo/OVH, RGPD, Morillon |

**Prochaine étape : accord partenariat LMDJ → débloquer A.5, A.6, SC7**

---

## Backlog fonctionnalités nouvelles

### B.1 — Pop-up aide IA contextuelle

Widget flottant sur toutes les pages, tous rôles. Réponses limitées au périmètre LIAVO + séjours jeunesse/scolaires. Stack probable : composant React client, streaming backend NestJS → API Claude avec system prompt étanche. V1 sans persistance BDD. **Estimé : 3-5 jours. Ne pas coder avant validation commerciale.**

### B.2 — Menu intelligent IA

Dans l'espace collaboratif d'un séjour : génération automatique de menus journaliers adaptés aux allergies/régimes déclarés dans les fiches sanitaires. Output : planning repas + liste de courses, export PDF. **Estimé : 3-5 jours. Dépend validation commerciale.**

### A.0 — Phase de commercialisation (priorité haute)

- Onboarding hébergeur guidé : séjour démo pré-créé au 1er login, checklist 5 étapes, emails séquencés J+1/J+3/J+7
- CRM commercial Théo : tracker Notion/Airtable prospects/démos/statuts (outil externe)
- LinkedIn LIAVO SASU : page entreprise + calendrier éditorial 12 semaines

### C.0 — Flow colonie complet

Benchmark concurrents (Odoo Nonprofit, Anim'action) avant de coder. Manque : gestion animateurs BAFA/BAFD, ratio encadrement automatique, déclaration sanitaire.

### A.4 — Intégration APIDAE sans partenariat réseau

Contacter support@apidae-tourisme.com avant de coder. Credentials LMDJ en attente d'Anaïtis. Credentials IDDJ déjà en prod.

### A.3bis — Récupération emails centres EN

Options : scraping, enrichissement manuel, prestataire B2B (50-200€), inscription volontaire. Valider cadre légal opt-out avant envoi de masse.

### A.5 — Disponibilités calendrier hébergeur (ajouté 06/05/2026)

**Contexte :** LMDJ utilise APIDAE pour la gestion des disponibilités hébergeurs. La page `/dashboard/hebergeur/disponibilites` existe avec un formulaire de saisie (date début/fin, capacité, commentaire) et les routes backend `getDisponibilites`, `createDisponibilite`, `deleteDisponibilite`. Ce qui manque : une vue calendrier cliquable.

**Ce qui manque :**
- Vue calendrier mensuel cliquable (bloquer/débloquer des jours directement sur le planning)
- Synchronisation avec APIDAE via credentials réseau (à spécifier avec LMDJ — nécessite accord partenariat)
- Affichage des dispos dans le catalogue public (l'organisateur voit si le centre est disponible sur ses dates)

**Contexte LMDJ :** un adhérent LMDJ gère aujourd'hui ses dispos depuis l'extranet LMDJ via APIDAE. Si LIAVO synchronise ces dispos, l'hébergeur n'a plus à double-saisir. Argument fort pour remplacer l'extranet LMDJ côté appels d'offres.

**Estimé :** 3-5 jours frontend + investigation API APIDAE dispos. **Ne pas coder avant accord partenariat LMDJ.**

### A.6 — Grille tarifaire hébergeur (ajouté 06/05/2026)

**Contexte :** LMDJ a une section "Tarifs" dans son extranet adhérent. LIAVO n'a pas de page dédiée à la saisie des tarifs par l'hébergeur.

**Ce qui manque :**
- Page `/dashboard/hebergeur/tarifs` : saisie de grilles tarifaires par période, capacité, type de prestation
- Exposition dans le catalogue public (l'organisateur voit les tarifs indicatifs avant de contacter)
- Pré-remplissage du constructeur de devis depuis la grille tarifaire (évite la ressaisie à chaque devis)

**Estimé :** 2-3 jours. **À faire après A.5 disponibilités calendrier.**

---

*Document à maintenir à jour. Toute déviation documentée ici avec date et raison.*
