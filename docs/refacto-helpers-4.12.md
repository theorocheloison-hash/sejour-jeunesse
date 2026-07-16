# §4.12 — Recensement helpers partagés frontend (avant dédup)

> Date : 16/07/2026 — Run Fable 5 overnight. Périmètre : `frontend/` uniquement, dédup pure, zéro changement de rendu.
> Livrable de revue pour Théo. Les phases 2-4 (helpers + remplacement + rapport) suivent dans des commits séparés.

## 0. Existant vérifié (Phase 1a)

- `src/lib/utils.ts` : **aucun** `formatDate` existant (seul `formatParticipants`). → C'est la cible canonique à créer.
- `src/lib/planning-statut.ts` : palette planning (`PLANNING_COULEURS`) + dérivation de statut planning. **Pas un badge de statut** — palette hex pour blocs de planning, hors famille StatutBadge. Non touché.
- `src/components/sejour/shared.tsx` : contient déjà un `formatDate` **exporté** (long : `05 juin 2026`, null→`—`), consommé par `EtapeRecapitulatif.tsx` et `buildPeriodeLabel`. Sera migré vers le helper unifié de `utils.ts`.

## 1. Famille `formatDate`

### 1.1 Note sur le chiffre « ~35 » de la roadmap

Le grep exhaustif donne **87 occurrences de `toLocaleDateString` dans 45 fichiers**, qui se répartissent en :
- **25 définitions locales** (fonctions/consts nommées `formatDate`, `fmt`, `fmtDate`, `fmtCtx`, `formatDateFr`, `fmtDateFr`, `formatDateRelative`, `afficherDatesDemande`…) → **c'est le périmètre du remplacement**.
- **~55 usages inline en JSX** (`{new Date(x).toLocaleDateString('fr-FR', …)}` directement dans le rendu) → **hors périmètre volontairement** : ce ne sont pas des redéfinitions, et les convertir un par un multiplierait le risque de régression sans réduire la duplication de code (chaque appel resterait un appel). Consignés en §1.4.
- 5 occurrences dans `src/components/pdf/*` → **interdiction absolue, non touchées**.

### 1.2 Tableau des définitions locales (25)

| # | Fichier:ligne | Nom | Format de sortie | Null/vide | Entrée |
|---|---|---|---|---|---|
| 1 | `src/components/sejour/shared.tsx:93` | `formatDate` | `2-digit`/`long`/`numeric` → « 05 juin 2026 » | `!iso` → `—` | string |
| 2 | `app/rejoindre/[token]/page.tsx:52` | `fmt` | idem long | aucun | string |
| 3 | `app/ordre-mission/[token]/page.tsx:70` | `fmt` | idem long | aucun | string |
| 4 | `app/autorisation/[token]/page.tsx:215` | `fmt` | idem long | aucun | string |
| 5 | `app/dashboard/hebergeur/abonnement/page.tsx:17` | `formatDateFr` | idem long | `!iso` → `''` | string\|null |
| 6 | `app/dashboard/hebergeur/disponibilites/page.tsx:13` | `fmtDate` | idem long | aucun | string |
| 7 | `app/dashboard/sejour/[id]/_components/TabProjetPedagogique.tsx:49` | `fmtDate` | idem long | aucun | string |
| 8 | `app/dashboard/organisateur/sejours/[id]/modifier/page.tsx:81` | `fmt` | idem long | aucun | string |
| 9 | `app/dashboard/sejour/[id]/_components/InviteOrganisateurCard.tsx:32` | `fmtDate` | idem long | aucun | string |
| 10 | `app/dashboard/sejour/[id]/_components/TabBudget.tsx:64` | `fmtDate` | idem long | `!iso` → `Dates à définir` | string\|null |
| 11 | `app/dashboard/admin/claims/page.tsx:43` | `formatDate` | `2-digit`/`short`/`numeric` → « 05 juin 2026 » | `!d` → `—` | string\|null |
| 12 | `app/dashboard/admin/invitations/page.tsx:36` | `formatDate` | idem court | `!d` → `—` | string\|null |
| 13 | `app/dashboard/signataire/page.tsx:122` | `fmtDate` | idem court | aucun | string |
| 14 | `app/dashboard/hebergeur/devis/_components/DevisCard.tsx:160` | `fmtDate` | idem court | aucun | string |
| 15 | `app/dashboard/hebergeur/global/page.tsx:119` | `fmtDate` | idem court | aucun | string |
| 16 | `app/dashboard/admin/page.tsx:79` | `formatDate` | `fr-FR` défaut → « 05/06/2026 » | aucun | string |
| 17 | `app/dashboard/reseau/page.tsx:18` | `formatDate` | idem numérique | aucun | string |
| 18 | `app/dashboard/hebergeur/pilotage/comptabilite/page.tsx:23` | `fmtDateFr` | idem numérique | aucun | string |
| 19 | `app/dashboard/sejour/[id]/_components/SejourHeader.tsx:100` | `fmtCtx` | `2-digit`/`short` (sans année) → « 05 juin » | aucun | string |
| 20 | `app/dashboard/hebergeur/rentabilite/page.tsx:58` | `fmtDate` | idem sans année | aucun | string |
| 21 | `app/dashboard/sejour/[id]/_components/TabJournal.tsx:10` | `formatDateRelative` | relatif (« à l'instant » … « il y a N jours »), chute sur `numeric`/`short` | aucun | string |
| 22 | `app/sejour/[token]/journal/page.tsx:23` | `formatDateRelative` | **byte-identique au #21** | aucun | string |
| 23 | `app/dashboard/sejour/[id]/_components/TabNotes.tsx:64` | `formatDateRelative` | idem #21 **mais chute avec `year: 'numeric'`** | aucun | string |
| 24 | `app/dashboard/organisateur/demandes/page.tsx:15` | `afficherDatesDemande` | « JJ/MM/AAAA → JJ/MM/AAAA » ou « 📅 Mois · Année · note · ~Nn » ou « Dates à définir » | intégré | objet demande |
| 25 | `app/dashboard/hebergeur/demandes/page.tsx:41` | `afficherDatesDemande` | **byte-identique au #24** | intégré | objet demande |

### 1.3 Regroupement en variantes réellement distinctes

| Variante | Options Intl | Sites | Fallback null rencontrés |
|---|---|---|---|
| `long` | `{ day: '2-digit', month: 'long', year: 'numeric' }` | #1-10 (10) | `—`, `''`, `Dates à définir`, aucun |
| `court` | `{ day: '2-digit', month: 'short', year: 'numeric' }` | #11-15 (5) | `—`, aucun |
| `numeric` | aucune (défaut fr-FR) | #16-18 (3) | aucun |
| `jourMoisCourt` | `{ day: '2-digit', month: 'short' }` | #19-20 (2) | aucun |
| relative | corps identique, seule la chute finale diffère (± année) | #21-23 (3) | aucun |
| `afficherDatesDemande` | fonction copiée-collée à l'identique | #24-25 (2) | intégré |

### 1.4 Signatures des helpers unifiés proposés (dans `src/lib/utils.ts`)

```ts
export type FormatDateStyle = 'numeric' | 'court' | 'long' | 'jourMoisCourt';

export function formatDate(
  date: string | Date | null | undefined,
  style: FormatDateStyle = 'long',
  fallback?: string,          // si omis : PAS de garde null (reproduit les sites non gardés)
): string;

export function formatDateRelative(iso: string, opts?: { avecAnnee?: boolean }): string;

export function afficherDatesDemande(d: { dateDebut?: string | null; … }): string; // déplacée verbatim
```

Point de fidélité clé : la garde `!date → fallback` n'est active **que si `fallback` est passé** — les 18 sites sans garde null gardent le comportement natif de `new Date()` (aucun ne peut recevoir null d'après ses types, mais on ne change rien par principe).

### 1.5 Exceptions NON fusionnées (formatDate)

| Fichier:ligne | Quoi | Raison |
|---|---|---|
| `app/devis/signer/[token]/page.tsx:17` | `fmt` avec injection `T12:00:00` si date sans heure | Comportement timezone spécifique (anti-décalage J-1) absent partout ailleurs. Fusionner = risque silencieux sur la page de signature client. |
| `app/dashboard/hebergeur/planning/page.tsx:39` | `fmtMonth` (mois+année, entrée `Date`) | Occurrence unique, pas une duplication. |
| `app/dashboard/hebergeur/planning/page.tsx:328` | `f` imbriquée (jour numeric + mois short) | Occurrence unique imbriquée dans une closure ; `day: 'numeric'` ≠ `2-digit` des variantes unifiées. |
| `app/sejour/[token]/journal/page.tsx:40` | `formatDateRange` | Occurrence unique (logique same-month/same-year). |
| `app/dashboard/reseau/page.tsx:26` | `demandePeriode` | Proche d'`afficherDatesDemande` mais PAS identique (tableau MOIS différent : « Janv » vs « Jan », `join(' ')` vs `' · '`, pas d'emoji 📅, pas de `noteDateFlexible`). Doute → non fusionnée. |
| `src/components/sejour/shared.tsx:100` | `buildPeriodeLabel` | Logique formulaire spécifique, non dupliquée (continuera d'appeler le helper unifié en interne). |
| ~55 usages inline JSX (45 fichiers) | `new Date(x).toLocaleDateString(…)` dans le rendu | Usages, pas des redéfinitions. Les convertir n'enlève aucune duplication de définition et multiplie les points de régression. |
| `src/components/pdf/*` (5 occ.) | footers PDF `new Date().toLocaleDateString('fr-FR')` | Interdiction @react-pdf du brief. |

## 2. Famille `StatutBadge` (4 copies)

| # | Fichier:ligne | Table statut→couleur→libellé | Rendu |
|---|---|---|---|
| 1 | `app/dashboard/organisateur/page.tsx:25` | `STATUT_CONFIG` (StatutSejour) : DRAFT Brouillon gris, OPTION Option ambre, SUBMITTED **« Soumis »** orange, CONVENTION primary, SOUMIS_RECTORAT **« Soumis au rectorat »** violet, SIGNE_DIRECTION violet, DECLARE_TAM teal. Fallback `?? DRAFT` | span `px-2.5 py-0.5` |
| 2 | `app/dashboard/signataire/page.tsx:47` | `STATUT_CONFIG` (StatutSejour) : idem #1 **sauf** SUBMITTED **« En attente »**, SOUMIS_RECTORAT **« Soumis rectorat »**. Fallback `?? DRAFT` | span `px-2.5 py-0.5` |
| 3 | `app/dashboard/reseau/page.tsx:115` | ternaire : ACTIVE « Actif » success, SUSPENDED « Suspendu » rouge, sinon « En attente » ambre | span `px-2 py-0.5` |
| 4 | `app/dashboard/reseau/page.tsx:36` (`DemandeStatutBadge`) | OUVERTE vert, FERMEE gris, ANNULEE rouge ; fallback = statut brut en gris | span `px-2 py-0.5` |

**Constat** : 4 mappings réellement différents (y compris entre #1 et #2 sur le MÊME enum — libellés par rôle, intentionnel), mais un shell de rendu identique à la marge de padding près (`px-2.5` vs `px-2`).

**Composant unifié proposé** (`src/components/StatutBadge.tsx`) : le mapping reste la donnée du site d'appel, le composant ne l'impose pas.

```tsx
export interface StatutBadgeEntry { label: string; cls: string }

export default function StatutBadge({ statut, config, fallback, compact }: {
  statut: string;
  config: Record<string, StatutBadgeEntry>;
  fallback?: StatutBadgeEntry;   // défaut : { label: statut, cls: gris } (comportement DemandeStatutBadge)
  compact?: boolean;             // px-2 (réseau) au lieu de px-2.5
});
```

Correspondances exactes : #1/#2 → `config={STATUT_CONFIG} fallback={STATUT_CONFIG.DRAFT}` ; #3 → table `{ACTIVE, SUSPENDED}` + `fallback` ambre « En attente » + `compact` ; #4 → table `{OUVERTE, FERMEE, ANNULEE}` + fallback par défaut + `compact`.

**Non-membres de la famille (non touchés)** : `ContexteBadge` (hebergeur/demandes:31, binaire scolaire/hors-scolaire), `STATUT_DEVIS_BADGE` (organisateur/demandes:26, table consommée par des spans inline avec markup différent), badges inline divers (`En retard`, `Aujourd'hui`…), `PLANNING_COULEURS` (palette hex planning).

## 3. Famille `KpiCard` (3 copies)

| # | Fichier:ligne | Props | Markup |
|---|---|---|---|
| 1 | `app/dashboard/admin/page.tsx:85` | `label, value: number\|string, accent?` (classe CSS) | `rounded-2xl border shadow-sm p-5`, label uppercase, valeur `text-2xl font-bold ${accent ?? 'text-gray-900'}` |
| 2 | `app/dashboard/reseau/page.tsx:57` | `label, value, description?, accent?, onClick?` | **sur-ensemble strict de #1** : même markup + description en dessous + cursor/hover si onClick |
| 3 | `app/dashboard/hebergeur/pilotage/ca/page.tsx:56` | `label, value: string, tooltip: string (obligatoire), sub?, color?` (couleur **inline style**) | `rounded-xl px-5 py-4 flex-1 min-w-0`, dépend du composant local `InfoTip` |

**Composant unifié proposé** (`src/components/KpiCard.tsx`) : la variante #2 (réseau) telle quelle — elle rend exactement #1 quand `description`/`onClick` sont absents.

**Quirk préservé** : `admin/page.tsx:1190-1193` passe des couleurs hex (`accent="#C87D2E"`) là où `accent` est une classe CSS — la couleur n'est donc PAS appliquée aujourd'hui (classe invalide). On n'y touche pas : dédup pure, le quirk reste.

### Exception NON fusionnée (KpiCard)

| Fichier:ligne | Raison |
|---|---|
| `app/dashboard/hebergeur/pilotage/ca/page.tsx:56` | Markup réellement différent (`rounded-xl` vs `rounded-2xl`, `px-5 py-4` vs `p-5`, `flex-1 min-w-0`), tooltip **obligatoire** dépendant du composant local `InfoTip`, couleur en `style` inline vs classe. Couvrir ça par props = markup conditionnel, pas une dédup. Doute → non fusionnée. |

## 4. Plan de remplacement (Phase 3, un commit par famille)

1. `refactor(4.12): unifie formatDate` — 25 définitions → imports de `@/src/lib/utils` (+ maj `EtapeRecapitulatif.tsx` et `buildPeriodeLabel` qui consommaient le `formatDate` de `shared.tsx`).
2. `refactor(4.12): unifie KpiCard` — 2 copies (admin, réseau) → `@/src/components/KpiCard` ; pilotage/ca en exception.
3. `refactor(4.12): unifie StatutBadge` — 4 copies → `@/src/components/StatutBadge`, mappings conservés localement.

Gate avant chaque commit : `npx tsc --noEmit` = 0 erreur ET `npm run build` = succès.

## 5. Rapport final

_(complété en Phase 4)_
