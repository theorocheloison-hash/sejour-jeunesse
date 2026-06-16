# Prompt CC — Tag source réseau + téléphone + badge hébergeur

## CONTEXTE

On ajoute le support "source réseau" sur les demandes publiques (/appel-offres).
Quand un enseignant arrive via un lien réseau (ex: `liavo.fr/appel-offres?reseau=lmdj`),
la demande ET le user sont tagués avec la source réseau.
Côté hébergeur, un badge "via [réseau]" s'affiche sur les demandes issues d'un réseau.
On ajoute aussi le champ téléphone dans le formulaire /appel-offres.

## RÈGLES ABSOLUES

- Lire chaque fichier AVANT de modifier.
- Proposer le contenu exact → attendre "ok" → puis modifier.
- Migrations SQL manuellement uniquement. Jamais `prisma migrate dev`.
- `tsc --noEmit` + `npm run build` à 0 erreurs avant commit.
- Fix à la source, jamais de patch.

---

# PROMPT 1 — BACKEND

## Fichiers à lire d'abord

```
backend/prisma/schema.prisma (chercher model User et model DemandeDevis)
backend/src/public/public.service.ts
backend/src/public/public.controller.ts
backend/src/demandes/demande.service.ts (méthode findOpen)
frontend/src/lib/public.ts (DemandePubliquePayload — pour vérifier l'interface)
```

## Modifications

### 1. Migration Prisma — `20260611_source_reseau_telephone`

Ajouter dans `backend/prisma/migrations/20260611_source_reseau_telephone/migration.sql` :

```sql
-- source réseau sur User (fidélité : persiste même si l'enseignant revient en DIRECT)
ALTER TABLE "users" ADD COLUMN "source_reseau" VARCHAR(50);

-- source réseau sur DemandeDevis (traçabilité par demande)
ALTER TABLE "demande_devis" ADD COLUMN "source_reseau" VARCHAR(50);

-- téléphone sur User (existe déjà dans le DTO mais peut être absent en base — vérifier)
-- Si la colonne telephone existe déjà sur users, ne PAS ajouter cette ligne.
-- Vérifier avec : SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='telephone';
```

### 2. Schema Prisma — Ajouter les champs

Sur le model `User` :
- `sourceReseau String? @map("source_reseau")` — si `telephone` n'existe pas déjà, l'ajouter aussi.

Sur le model `DemandeDevis` :
- `sourceReseau String? @map("source_reseau")`

### 3. `public.service.ts` — Modifier `DemandePubliqueDto` et `soumettreDemandePublique`

Ajouter dans l'interface `DemandePubliqueDto` :
```typescript
sourceReseau?: string;
telephone?: string;
```

Dans `soumettreDemandePublique` :

**À la création du User** (bloc `if (!user)`), ajouter :
```typescript
telephone: dto.telephone ?? null,
sourceReseau: dto.sourceReseau ?? null,
```

**ATTENTION — User existant mais sans sourceReseau :**
Si `user` existe déjà (réutilisation) ET n'a pas de `sourceReseau`, NE PAS écraser.
Le premier sourceReseau est le bon (première acquisition = attribution).
Ajouter après la récupération du user existant :
```typescript
// MAJ sourceReseau si pas encore renseigné (first-touch attribution)
if (user && !user.sourceReseau && dto.sourceReseau) {
  await this.prisma.user.update({
    where: { id: user.id },
    data: { sourceReseau: dto.sourceReseau },
  });
  user = { ...user, sourceReseau: dto.sourceReseau };
}
// MAJ téléphone si pas encore renseigné
if (user && !user.telephone && dto.telephone) {
  await this.prisma.user.update({
    where: { id: user.id },
    data: { telephone: dto.telephone },
  });
}
```

**À la création de la DemandeDevis** (dans le `$transaction`), ajouter :
```typescript
sourceReseau: dto.sourceReseau ?? null,
```

### 4. `demande.service.ts` — Méthode `findOpen` (vue hébergeur)

La méthode `findOpen` retourne les demandes ouvertes aux hébergeurs.
Ajouter `sourceReseau` dans le `select` de `demandeDevis` pour qu'il soit disponible côté frontend.
Chercher le `select` existant et y ajouter `sourceReseau: true`.

Faire de même pour toute autre méthode qui retourne des demandes au hébergeur
(chercher les autres `findMany` sur `demandeDevis` dans ce fichier).

### 5. Vérifications cascade

- Le `select` sur `user` dans `soumettreDemandePublique` récupère-t-il `telephone` et `sourceReseau` ?
  Si `findUnique` utilise un select restreint, ajouter les champs.
- Le type `Demande` côté frontend (chercher dans `frontend/src/types/` ou les interfaces locales)
  doit inclure `sourceReseau?: string` — sinon TypeScript cassera.
- `notifierCentresInscrits` n'est PAS impacté (ne touche pas aux nouveaux champs).

### Commit message

```
feat(source-reseau): tag source réseau sur User + DemandeDevis, téléphone /appel-offres
```

---

# PROMPT 2 — FRONTEND

## Fichiers à lire d'abord

```
frontend/app/appel-offres/page.tsx
frontend/src/lib/public.ts (DemandePubliquePayload)
frontend/src/types/ (chercher le type Demande utilisé côté hébergeur)
frontend/app/dashboard/hebergeur/ (page qui affiche les demandes reçues — trouver le bon fichier)
```

## Modifications

### 1. `frontend/src/lib/public.ts` — Ajouter au payload

Dans `DemandePubliquePayload` :
```typescript
sourceReseau?: string;
telephone?: string;
```

### 2. `frontend/app/appel-offres/page.tsx` — 3 changements

**A) Lire le param `reseau` depuis searchParams**

Dans `AppelOffresContent`, ajouter :
```typescript
const reseauParam = searchParams.get('reseau') ?? undefined;
```

**B) Bandeau conditionnel en haut du formulaire**

Mapping statique des réseaux (objet const en haut du fichier) :
```typescript
const RESEAUX_PARTENAIRES: Record<string, { nom: string; tel: string; email: string; logo?: string }> = {
  lmdj: {
    nom: 'La Montagne des Juniors',
    tel: '04 50 45 69 54',
    email: 'contact@lamdj.com',
  },
  iddj: {
    nom: 'Isère Drôme Destination Juniors',
    tel: '',
    email: '',
  },
};
```

Afficher un bandeau SI `reseauParam` est dans `RESEAUX_PARTENAIRES` :
```tsx
{reseauInfo && (
  <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-3">
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-900">
        Votre demande est accompagnée par {reseauInfo.nom}
      </p>
      {reseauInfo.tel && (
        <p className="text-xs text-gray-500 mt-0.5">
          📞 {reseauInfo.tel} · {reseauInfo.email}
        </p>
      )}
    </div>
  </div>
)}
```

**C) Champ téléphone dans le step Coordonnées**

Ajouter un state :
```typescript
const [telephone, setTelephone] = useState('');
```

Ajouter le champ entre l'email et l'établissement dans le step Coordonnées :
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
  <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)}
    placeholder="06 12 34 56 78" className={inputCls} />
</div>
```

**D) Passer `sourceReseau` et `telephone` dans handleSubmit**

Dans l'appel à `soumettreDemandePublique`, ajouter :
```typescript
sourceReseau: reseauParam || undefined,
telephone: telephone || undefined,
```

### 3. Type `Demande` côté hébergeur

Trouver le type/interface utilisé pour les demandes dans la vue hébergeur.
Ajouter `sourceReseau?: string | null`.

### 4. Badge "via [réseau]" dans la vue hébergeur des demandes

Trouver le composant/page qui affiche la liste des demandes ouvertes côté hébergeur.
(Probablement dans `frontend/app/dashboard/hebergeur/` ou `frontend/app/dashboard/_shared/`.)

Extraire le mapping dans un fichier partagé `frontend/src/data/reseaux-partenaires.ts` :
```typescript
export const RESEAUX_PARTENAIRES: Record<string, { nom: string; tel: string; email: string }> = {
  lmdj: { nom: 'La Montagne des Juniors', tel: '04 50 45 69 54', email: 'contact@lamdj.com' },
  iddj: { nom: 'Isère Drôme Destination Juniors', tel: '', email: '' },
};
```

Importer dans `/appel-offres/page.tsx` ET dans le composant hébergeur des demandes.

Pour chaque demande avec `sourceReseau`, afficher un badge :
```tsx
{demande.sourceReseau && RESEAUX_PARTENAIRES[demande.sourceReseau] && (
  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
    🏔️ via {RESEAUX_PARTENAIRES[demande.sourceReseau].nom}
  </span>
)}
```

### 5. Vérifications cascade

- Le `handleSubmit` dans `/appel-offres/page.tsx` passe déjà un objet à `soumettreDemandePublique`.
  Vérifier que les nouveaux champs sont bien inclus dans cet objet.
- Le type retourné par `findOpen` côté hébergeur doit inclure `sourceReseau`.
  Si le frontend type une interface `Demande`, y ajouter le champ.
- Le `canAdvance()` pour le step Coordonnées ne doit PAS exiger le téléphone (c'est optionnel).
- Le récap (step `stepForRecap`) peut afficher le téléphone s'il est renseigné — optionnel, pas critique.
- `tsc --noEmit` sur backend ET frontend avant commit.

### Commit message

```
feat(source-reseau): bandeau réseau + téléphone + badge "via LMDJ" hébergeur
```

---

## MIGRATION SQL À EXÉCUTER MANUELLEMENT EN PROD

Après merge, via `scalingo --app liavo-backend --region osc-fr1 pgsql-console` :

```sql
BEGIN;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "source_reseau" VARCHAR(50);
ALTER TABLE "demande_devis" ADD COLUMN IF NOT EXISTS "source_reseau" VARCHAR(50);
-- Vérifier si telephone existe déjà :
-- SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='telephone';
-- Si absent : ALTER TABLE "users" ADD COLUMN "telephone" VARCHAR(20);
COMMIT;
```

La migration Prisma dans le fichier `migrations/` s'appliquera au deploy via Procfile.
Mais si besoin d'appliquer avant (pour tester en prod), utiliser le SQL ci-dessus.

---

## CE QUI N'EST PAS DANS CE PROMPT (à faire séparément)

- KPIs enrichis dashboard réseau (stats par source) — prompt séparé post-démo
- Branding logo réseau dans le bandeau (pour l'instant texte seul, suffisant pour le 18/06)
- SSO APIDAE
- Rôle RESEAU : création demande au nom d'un enseignant
