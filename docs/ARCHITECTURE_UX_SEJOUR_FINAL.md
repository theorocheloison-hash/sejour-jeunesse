# LIAVO — Architecture UX : Page séjour unifiée + Facturation + Planning + CRM simplifié

> **Rédigé le 28 mai 2026** — Document de cadrage UX final.
> **Statut** — Validé par Théo. Aucune ligne de code modifiée.
> **Référence complémentaire** — `docs/ARCHITECTURE_SEJOUR_DIRECT.md` (modèle de données)
> **Volume cible** — 60 séjours/an + 35 mariages/an (Sauvageon). 95 dossiers actifs/an.
> **Conformité facturation** — Hors scope ce doc. Chantier dédié (numérotation séquentielle, mentions légales, PDF non modifiable, annulation par avoir).

---

## 0. Problème à résoudre

Gérer un dossier (séjour ou mariage) de bout en bout oblige l'hébergeur à naviguer entre trois silos (Planning, Page séjour, CRM). La facturation n'existe nulle part côté UI. Le planning utilise une palette de couleurs illisible au-delà de 8 séjours. Le pipeline CRM (PROSPECT → CONTACTE → INTERESSE → EN_NEGOCIATION → CLIENT) est un vocabulaire de commercial B2B que personne ne maintient, décorrélé de la progression réelle des devis.

---

## 1. Principes directeurs

| # | Principe |
|---|---|
| P1 | **La page séjour est le centre de gestion d'UN dossier.** Devis, facturation, notes, docs, planning, rappels liés — tout accessible sans quitter la page. |
| P2 | **Le CRM est la vue transversale (tous clients, tous dossiers).** Il ne gère pas un dossier individuel — il renvoie vers la page séjour. |
| P3 | **Les couleurs planning = statut, pas identité.** Convention PMS. |
| P4 | **Un événement et un séjour partagent le modèle mais pas l'UX.** Onglets conditionnels. |
| P5 | **Extraction ciblée, pas de big bang.** On extrait en composants uniquement ce qu'on touche (Devis/Facturation, Notes, Header). Le reste du fichier 5000 lignes ne bouge pas. |
| P6 | **Le statut client CRM est dérivé automatiquement du devis le plus avancé.** Plus de pipeline manuel. |

---

## 2. Pipeline CRM — Statut dérivé (remplace le pipeline manuel)

### 2.1 Suppression du pipeline manuel

Les statuts PROSPECT / CONTACTE / INTERESSE / EN_NEGOCIATION / CLIENT / INACTIF en tant que valeurs manuelles sont supprimés. Le statut affiché du client est **calculé dynamiquement** à partir de ses dossiers (séjours + devis).

### 2.2 Règles de dérivation

Le statut affiché est déterminé par le devis le plus avancé parmi tous les séjours liés au client :

| Condition | Statut affiché | Couleur |
|---|---|---|
| Aucun séjour lié, pas marqué PERDU | **Prospect** | Gris |
| Au moins un séjour en OPTION sans devis | **En cours** | Bleu |
| Au moins un devis EN_ATTENTE | **Devis envoyé** | Orange |
| Au moins un devis SELECTIONNE ou SIGNE_DIRECTION | **Confirmé** | Bleu foncé |
| Au moins un devis FACTURE_ACOMPTE | **Acompte versé** | Vert |
| Tous les devis = FACTURE_SOLDE (aucun en cours) | **Soldé** | Gris |
| Tous les devis = NON_RETENU (aucun en cours) | **Perdu** | Rouge |
| Marqué manuellement PERDU (override) | **Perdu** | Rouge |

### 2.3 Override manuel : PERDU uniquement

L'hébergeur peut marquer manuellement un client comme **Perdu** (prospect qui ne rappelle jamais, sans qu'il y ait eu de devis). Cet override persiste tant qu'aucun nouveau dossier n'est créé pour ce client. Si un nouveau séjour est créé → le statut re-dérive automatiquement.

**Use case clé** : un client appelle, l'hébergeur est plein → il note les dates souhaitées dans les notes du client et le laisse en Prospect. Si annulation d'un autre séjour, il peut filtrer les clients Prospect pour retrouver celui qui voulait ces dates.

### 2.4 Impact sur la vue kanban CRM

Le kanban passe de 6 colonnes à 5 colonnes auto-alimentées :

```
Prospect | Devis envoyé | Confirmé | Acompte versé | Soldé
```

Colonne "Perdu" affichable via toggle (comme aujourd'hui).

### 2.5 Implémentation

**Option retenue : calcul côté frontend.** `getMesClients()` retourne déjà les séjours et devis liés. Le calcul du statut dérivé est une fonction pure côté client. Pas de nouveau champ en base, pas de migration.

Le champ `Client.statut` en base reste pour l'override PERDU. Si `statut = 'PERDU'` ET aucun dossier actif → afficher Perdu. Sinon → dériver.

```typescript
function deriveClientStatus(client: Client): string {
  if (client.statut === 'PERDU' && !hasActiveDossier(client)) return 'PERDU';
  const bestDevis = getBestDevisStatus(client);
  if (!bestDevis && client.sejours.length === 0) return 'PROSPECT';
  if (!bestDevis) return 'EN_COURS';
  // ... mapping statut devis → statut affiché
}
```

---

## 3. Architecture des vues

### 3.1 La page séjour : `/dashboard/sejour/[id]`

**Barre contextuelle (header) — `SejourHeader.tsx` (nouveau composant extrait) :**

```
┌───────────────────────────────────────────────────────────────────────┐
│  [← Séjours]   Mariage Dupont-Martin         [OPTION]  [MARIAGE]    │
│  12-14 juin 2026 · 80 personnes · Chalet Le Sauvageon               │
│  Client : Marie Dupont · marie@dupont.fr · 06 12 34 56 78  [✏️]     │
│                                                                       │
│  [📅 Planifier visite]  [📄 Contrat PDF]  [Fiche CRM]               │
└───────────────────────────────────────────────────────────────────────┘
```

- **[← Séjours]** : lien vers `/dashboard/hebergeur/sejours` (page liste séjours)
- **[✏️]** : infos client éditables inline en mode DIRECT
- **[📅 Planifier visite]** : lien Google Calendar `render?action=TEMPLATE` avec `centre.nom` dynamique (plus de "Chalet Le Sauvageon" hardcodé). Visible en mode DIRECT uniquement.
- **[📄 Contrat PDF]** : lien téléchargement `contratUrl` si `natureSejour === 'EVENEMENT'` ET contrat généré. L'hébergeur peut retrouver son contrat sans fouiller ses emails.
- **[Fiche CRM]** : lien vers `/dashboard/hebergeur/clients?selected={clientId}`

**Onglets — matrice par mode × nature :**

| Onglet | Séjour COLLAB | Séjour DIRECT | Événement DIRECT | Événement COLLAB |
|---|---|---|---|---|
| **Devis & Facturation** | ✅ | ✅ | ✅ | ✅ |
| **Programme** | ✅ "Planning" | ✅ (hébergeur seul) | ✅ "Programme" | ✅ "Programme" |
| **Participants** | ✅ | ✅ | ❌ masqué | ❌ masqué |
| **Groupes** | ✅ | ✅ | ❌ masqué | ❌ masqué |
| **Documents** | ✅ (partagé) | ✅ (hébergeur seul) | ✅ | ✅ |
| **Messages** | ✅ | 🔒 CTA "Inviter" | 🔒 CTA "Inviter" | ✅ |
| **Journal** | ✅ | 🔒 CTA "Inviter" | ❌ masqué | ✅ (optionnel) |
| **Budget prévisionnel** | ✅ | ✅ | ❌ masqué | ❌ masqué |
| **Projet pédagogique** | ✅ | ✅ | ❌ masqué | ❌ masqué |
| **Notes & suivi** | ✅ (NEW) | ✅ (NEW) | ✅ (NEW) | ✅ (NEW) |

### 3.2 Onglet "Devis & Facturation" — `TabDevisFacturation.tsx`

Composant extrait. Divisé en 3 sections verticales.

#### Section A — Devis

Identique à aujourd'hui (lignes, montants, numéro, conditions). Boutons : Créer / Modifier / Supprimer / Envoyer / PDF. Pas de changement structurel.

#### Section B — Pipeline facturation

**Nouveau côté UI.** Backend existant.

Affichage dynamique selon StatutDevis :

**Devis signé (SELECTIONNE ou SIGNE_DIRECTION) :**
```
Statut : 🟡 En attente d'acompte
Montant TTC : 4 800,00 €   Acompte (30%) : 1 440,00 €
Déjà versé : 0,00 €        Reste dû : 4 800,00 €

[📄 Facturer l'acompte]

── Versements ──
(aucun versement enregistré)
[+ Ajouter un versement]
```

**Acompte facturé (FACTURE_ACOMPTE) :**
```
Statut : 🔵 Acompte facturé
Facture acompte : FA-2026-001 du 15/03/2026

── Versements ──
15/03/2026 · 1 440,00 € · Virement · Réf: VIR-2026-001

Déjà versé : 1 440,00 € / 4 800,00 €
[██████████░░░░░░░░░░] 30%

[+ Ajouter un versement]  [📄 Facturer le solde]
```

**Solde facturé (FACTURE_SOLDE) :**
```
Statut : 🟢 Soldé
Facture solde : FS-2026-001 du 20/06/2026

── Versements ──
15/03/2026 · 1 440,00 € · Virement
20/06/2026 · 3 360,00 € · Virement

Déjà versé : 4 800,00 € / 4 800,00 €
[████████████████████] 100%
```

**Machine à états :**
```
SELECTIONNE ──[Facturer acompte]──→ FACTURE_ACOMPTE ──[Facturer solde]──→ FACTURE_SOLDE
SIGNE_DIRECTION ──[Facturer acompte]──→ idem
```

> Signature non bloquante pour facturer (décision ARCHITECTURE_SEJOUR_DIRECT.md).
> Conformité facturation française (numérotation, mentions, verrouillage) = chantier dédié séparé.
> Chorus Pro intégré pour séjours scolaires (collectivités publiques), pas pour événements privés. `getChorusXml()` existant, à auditer dans le chantier conformité.

**Endpoints existants utilisés :**

| Action | Endpoint | Rôle actuel | Fix nécessaire |
|---|---|---|---|
| Facturer acompte | `PATCH /devis/:id/facturer-acompte` | HEBERGEUR | ✅ OK |
| Facturer solde | `PATCH /devis/:id/facturer-solde` | HEBERGEUR | ✅ OK |
| Ajouter versement | `POST /devis/:id/versements` | HEBERGEUR, SIGNATAIRE | ✅ OK |
| Supprimer versement | `PATCH /devis/:id/versements/:vid/supprimer` | ⚠️ SIGNATAIRE only | **BUG — ajouter HEBERGEUR** |
| Valider acompte | `PATCH /devis/:id/valider-acompte` | HEBERGEUR, SIGNATAIRE | ✅ OK |

#### Section C — Contrat PDF (événements)

Visible si `natureSejour === 'EVENEMENT'` ET `centre.iban` renseigné ET `contratUrl` existe sur le devis.

Bouton **[📄 Télécharger le contrat]** → lien direct vers le fichier OVH Object Storage.

Le même lien est aussi dans le header (cf. 3.1) pour un accès rapide.

### 3.3 Onglet "Notes & suivi" — `TabNotes.tsx`

**Deux sections :**

**Section A — Notes internes (textarea)**

Champ texte libre, visible uniquement par l'hébergeur. Sauvegarde auto (debounce). Stocké sur `Sejour.notesInternes`.

Use case : "Client difficile sur le vin", "Arrhes versées en 2 fois", "Traiteur confirmé : X".

**Section B — Timeline d'activités liées au séjour**

Liste chronologique des `ActiviteClient` filtrées par `sejourId`. Les activités auto-générées (création devis, signature, versement, envoi brochure) y apparaissent avec horodatage automatique. L'hébergeur peut aussi ajouter manuellement une activité liée à ce séjour (type NOTE/APPEL/EMAIL/VISITE + description).

**Section C — Rappels liés au séjour**

Liste des `Rappel` filtrés par `sejourId`. L'hébergeur peut créer un rappel directement depuis la page séjour (type, date, description) — il sera lié au client ET au séjour. Badges "En retard" / "Aujourd'hui" comme dans le CRM.

---

### 3.4 Page liste séjours hébergeur (NEW)

Route : `/dashboard/hebergeur/sejours`

Point d'entrée principal pour accéder aux dossiers. Le planning reste un accès complémentaire (vue calendaire), mais la liste est le hub de navigation.

**Maquette :**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Séjours                                          [🔍 Rechercher]    │
│                                                                      │
│  Filtres : [Tous ▾] [En cours ▾] [Séjours | Événements ▾]          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 Mariage Dupont-Martin     12-14 juin 2026    🟧 Option      │ │
│  │    Marie Dupont · 80 pers · Devis en attente                   │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │    4ème Morillon APPN         03-07 mars 2027    🟦 Confirmé   │ │
│  │    François Croquette · 48 él · 2 messages non lus             │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │    Séminaire TechCorp         20-21 sept 2026    🟩 Acompte    │ │
│  │    Jean Martin · 30 pers · Reste 2 400€                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

🔴 = badge "non lu" (endpoint `mes-non-lus` existant). Clic → `/dashboard/sejour/[id]`.

**Item sidebar** : "Séjours" entre "Planning" et "CRM". Badge non-lu se déplace de "Planning" vers "Séjours".

### 3.5 Le CRM — Ce qui reste, ce qui change

**Ce qui reste dans le CRM uniquement :**
- Liste de TOUS les clients (vue transversale)
- Création d'un prospect SANS dossier
- Rappels transversaux (non liés à un séjour)
- Envoi de brochure à un prospect
- Vue kanban avec statuts dérivés (section 2)
- Bouton "📅 Planifier visite" (lien Google Calendar, `centre.nom` dynamique)

**Ce qui change :**
- Pipeline kanban : 5 colonnes auto-alimentées au lieu de 6 manuelles
- Section "Séjours liés" : affiche titre + dates + badge statut (plus d'UUID tronqué)
- **Boutons `[+ Nouveau séjour]` / `[+ Nouvel événement]`** dans la section Séjours liés → `POST /sejours/direct` avec infos client pré-remplies → redirige vers page séjour
- Activités et rappels affichent le séjour lié s'il existe

**Liens croisés :**

| Depuis | Vers | Comment |
|---|---|---|
| Page séjour (header) | Fiche CRM client | Lien `[Fiche CRM]` |
| Fiche CRM / séjours liés | Page séjour | Clic sur titre du séjour |
| Fiche CRM | Création séjour/événement | Boutons `[+ Nouveau séjour/événement]` |
| Planning | Page séjour | Clic sur un bloc |
| Page liste séjours | Page séjour | Clic sur une ligne |
| Dashboard hébergeur | Page séjour | Cartes "À traiter" / "À facturer" |

---

## 4. Planning — Couleurs par statut

### 4.1 Palette

| Statut affiché | Source | Couleur | Style | Hex |
|---|---|---|---|---|
| **Option** | Sejour.statut = OPTION | Orange | Hachures | `#F59E0B` |
| **Confirmé** | Sejour.statut = CONVENTION ou SIGNE_DIRECTION, devis pas encore facturé | Bleu | Plein | `#2563EB` |
| **Acompte versé** | Devis.statut = FACTURE_ACOMPTE | Vert | Plein | `#16A34A` |
| **Soldé** | Devis.statut = FACTURE_SOLDE | Gris | Plein | `#6B7280` |
| **Indisponibilité** | Disponibilite | Rouge | Hachures | `#DC2626` |

Pas de distinction SEJOUR vs EVENEMENT par couleur. Le titre + icône (📋/🎉) suffisent.

CONVENTION et SIGNE_DIRECTION = même couleur bleu. Badge ✓ pour distinguer visuellement si besoin.

### 4.2 Légende

```
🟧 Option    🟦 Confirmé    🟩 Acompte versé    ⬜ Soldé    🟥 Indisponible
```

### 4.3 Source de données

`mes-sejours-planning` doit retourner en plus le statut du devis associé (`devisDirect[0].statut` ou `demandes[0].devis[0].statut`) pour que le frontend dérive la couleur. Pas de nouveau champ en base — dérivation côté frontend (Option A validée).

---

## 5. Parcours complets

### 5.1 Parcours mariage (événement privé)

```
1. PREMIER CONTACT (CRM)
   └─ Appel/email → créer fiche Client → statut dérivé : Prospect
   └─ Optionnel : Rappel "Envoyer brochure"

2. BROCHURE (CRM)
   └─ Bouton "Envoyer la brochure" → email Brevo
   └─ ActiviteClient auto "Brochure envoyée"

3. VISITE (CRM ou Page séjour)
   └─ Bouton "📅 Planifier visite" → Google Calendar (centre.nom dynamique)
   └─ Log ActiviteClient type VISITE

4. CRÉATION ÉVÉNEMENT (CRM ou Planning)
   └─ Depuis CRM : [+ Nouvel événement] → pré-remplit client
   └─ OU depuis Planning : clic date → [🎉 Nouvel événement]
   └─ → Séjour DIRECT + EVENEMENT + OPTION
   └─ → Client CRM auto-créé/lié + ActiviteClient (sejourId renseigné)
   └─ Planning : 🟧 orange hachures
   └─ Statut client dérivé : En cours

5. DEVIS + CONTRAT (Page séjour — Devis & Facturation)
   └─ Créer devis → [📨 Envoyer] → email avec contrat PDF Sauvageon
   └─ ActiviteClient auto "Devis envoyé" (sejourId lié)
   └─ Statut client dérivé : Devis envoyé

6. SIGNATURE (Page publique /devis/signer/[token])
   └─ Client signe → SELECTIONNE → CONVENTION
   └─ Planning : 🟦 bleu
   └─ Statut client dérivé : Confirmé

7. ACOMPTE (Page séjour — Devis & Facturation)
   └─ [📄 Facturer l'acompte] → FACTURE_ACOMPTE
   └─ [+ Ajouter un versement] quand paiement reçu
   └─ Planning : 🟩 vert
   └─ Statut client dérivé : Acompte versé

8. MARIAGE (jour J)

9. FACTURE SOLDE (Page séjour — Devis & Facturation)
   └─ [📄 Facturer le solde] → FACTURE_SOLDE
   └─ Versement enregistré
   └─ Planning : ⬜ gris
   └─ Statut client dérivé : Soldé
```

### 5.2 Parcours séjour scolaire (appel entrant)

```
1. APPEL ENTRANT
   └─ Enseignant appelle le centre directement (recherche Google)
   └─ L'hébergeur renseigne au téléphone

2. CRÉATION SÉJOUR (Planning)
   └─ Si intéressé → clic sur planning → [📋 Nouveau séjour]
   └─ StructureSearch : recherche l'établissement (SIRENE/API EN/LIAVO)
   └─ → Séjour DIRECT + SEJOUR + OPTION
   └─ → Client CRM auto-créé + ActiviteClient

3. DEVIS (Page séjour — Devis & Facturation)
   └─ Créer devis → Envoyer par email
   └─ L'enseignant reçoit le lien de signature

4-9. IDENTIQUE AU PARCOURS MARIAGE (signature, acompte, facturation)

VARIANTE : si l'enseignant veut collaborer → Bouton "Inviter l'organisateur"
→ DIRECT → COLLABORATIF, onglets Messages/Journal déverrouillés
```

### 5.3 Parcours client récurrent

```
1. L'enseignant rappelle un an plus tard
2. L'hébergeur le retrouve dans le CRM (recherche par nom)
3. Fiche client : séjours liés affichent "Séjour Morillon 2026 — ✅ Soldé"
4. Bouton [+ Nouveau séjour] → pré-remplit les infos client
5. → Nouveau séjour créé, lié au même client
6. Statut client dérivé repasse à "En cours"
```

---

## 6. Schema — Modifications

### 6.1 Nouveau champ `notesInternes` sur Sejour

```sql
ALTER TABLE sejours ADD COLUMN notes_internes TEXT;
```

### 6.2 `sejourId` optionnel sur Rappel et ActiviteClient

```sql
ALTER TABLE rappels ADD COLUMN sejour_id UUID REFERENCES sejours(id) ON DELETE SET NULL;
CREATE INDEX idx_rappels_sejour ON rappels (sejour_id) WHERE sejour_id IS NOT NULL;

ALTER TABLE activites_client ADD COLUMN sejour_id UUID REFERENCES sejours(id) ON DELETE SET NULL;
CREATE INDEX idx_activites_client_sejour ON activites_client (sejour_id) WHERE sejour_id IS NOT NULL;
```

Les rappels/activités existants gardent `sejour_id = NULL` (rattachés au client uniquement, vue transversale CRM). Les nouveaux créés depuis la page séjour auront le `sejourId` renseigné.

### 6.3 Aucune modification du champ `Client.statut`

Le champ reste en base pour l'override PERDU. La dérivation est côté frontend.

---

## 7. Structure de composants

```
frontend/app/dashboard/sejour/[id]/
├── page.tsx                          ← orchestrateur (existant, ~4200 lignes après extraction)
├── _components/
│   ├── SejourHeader.tsx              ← NEW — barre contextuelle, infos client, liens
│   ├── TabDevisFacturation.tsx       ← NEW — code devis extrait + pipeline facturation + contrat
│   ├── TabNotes.tsx                  ← NEW — textarea + timeline activités + rappels liés
│   ├── VersementsPanel.tsx           ← NEW — liste versements + ajout (sous-composant)
│   └── FacturationPipeline.tsx       ← NEW — machine à états visuelle (sous-composant)

frontend/app/dashboard/hebergeur/sejours/
├── page.tsx                          ← NEW — page liste séjours avec badges non-lus
```

Les 8 autres onglets existants restent dans `page.tsx`. Extraction au fil de l'eau quand on les touche.

---

## 8. Bugs à corriger dans ce chantier

| Bug | Fichier | Fix |
|---|---|---|
| `supprimerVersement` @Roles SIGNATAIRE only | `devis.controller.ts` | Ajouter `Role.HEBERGEUR` |
| "Visite du Chalet Le Sauvageon" hardcodé | `clients/page.tsx` | Remplacer par `centre.nom` dynamique |
| Section "Séjours liés" CRM : UUID tronqué | `clients/page.tsx` | Afficher titre + dates + badge statut |
| `mes-sejours-planning` ne retourne pas statut devis | `collaboration.service.ts` | Inclure `devisDirect[0].statut` dans la réponse |
| Palette 8 couleurs planning (OPTION×nature) | `planning/page.tsx` | Remplacer par palette 5 statuts |

---

## 9. Sous-chantiers — Ordre d'exécution

| # | Sous-chantier | Estimation | Dépendances |
|---|---|---|---|
| 1 | **Fix `supprimerVersement` @Roles + "Sauvageon" hardcodé** | 15 min | Aucune |
| 2 | **Migration Prisma** : `notesInternes` + `sejourId` sur Rappel/ActiviteClient | 0.5j | Aucune |
| 3 | **Extraction `TabDevisFacturation.tsx`** (code devis existant déplacé) | 1j | Aucune |
| 4 | **Pipeline facturation UI** (Section B de l'onglet) | 1j | #3 |
| 5 | **`TabNotes.tsx`** : textarea + timeline activités + rappels filtrés par séjour | 1j | #2 |
| 6 | **`SejourHeader.tsx`** : header extrait, infos client éditables, liens agenda/contrat/CRM | 0.5j | Aucune |
| 7 | **Planning couleurs par statut** + include devis dans `mes-sejours-planning` | 0.5j | Aucune (parallélisable) |
| 8 | **Pipeline CRM dérivé** : suppression pipeline manuel, calcul frontend, kanban 5 colonnes | 1j | Aucune (parallélisable) |
| 9 | **Enrichir section "Séjours liés" CRM** : titre/dates/badge + boutons `[+ Nouveau séjour/événement]` | 0.5j | #8 |
| 10 | **Page liste séjours** `/dashboard/hebergeur/sejours` + item sidebar + badge non-lu | 1j | #7 (couleurs) |

**Total estimé : 7j**

**Chemin critique : 2 → 3 → 4 → 5 (facturation fonctionnelle en 3.5j)**

Parallélisable : #7 (planning) + #8 (CRM) dès le début, indépendants du chemin critique.

---

## 10. Décisions de référence

| Sujet | Décision |
|---|---|
| Pipeline CRM | Statut dérivé du devis le plus avancé, plus de pipeline manuel |
| Override manuel | PERDU uniquement, reset si nouveau dossier |
| Couleur planning | 5 statuts, pas de distinction nature (séjour/événement) |
| Source couleur facturation | Dérivation frontend depuis statut devis (Option A) |
| Refactor page.tsx | Extraction ciblée (Option B) : Devis/Facturation + Notes + Header |
| Notes internes | Textarea simple sur Sejour + timeline ActiviteClient horodatée |
| Contrat PDF | Visible et téléchargeable depuis header page séjour (vue hébergeur) |
| Rappels/Activités | `sejourId` optionnel ajouté dans ce chantier |
| Bouton Retour | Page liste séjours (point d'entrée principal) |
| Planifier visite | Bouton dans CRM (existant) + header page séjour (nouveau), `centre.nom` dynamique |
| Conformité facturation | Chantier dédié séparé (numérotation, mentions, verrouillage, avoir) |
| Chorus Pro | Séjours scolaires uniquement, audit `getChorusXml()` dans chantier conformité |
| Bouton CRM → séjour | `[+ Nouveau séjour]` / `[+ Nouvel événement]` dans fiche client, pré-remplit infos |

---

## 11. Ce que ce doc NE couvre PAS

- **Conformité facturation française** — chantier dédié
- **PDF facture** (génération côté Node) — dans le chantier conformité
- **Stripe / paiement en ligne** — freemium hébergeur
- **Multi-centre** — livré séparément
- **Widget embeddable** — feature marketing
- **Import Excel participants** — feature collaboratif
- **Drag & drop lignes de devis** — cosmétique
- **Opportunités CRM / liste d'attente** — V2 post-stabilisation (use case "client appelle, on est plein, annulation plus tard"). Le champ `notes` du client suffit court terme.

---

**Aucun code modifié dans le cadre de ce document.**
