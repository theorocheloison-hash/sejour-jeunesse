# PROMPT CC — Phase 3A : Backend verifyAccess + getSejourInfo pour séjours DIRECT

> **Contexte** : Les séjours DIRECT (modeGestion = 'DIRECT', statut = 'OPTION') ne sont pas accessibles via la page `/dashboard/sejour/[id]` car `verifyAccess()` rejette les statuts autres que CONVENTION/SIGNE_DIRECTION. Cette phase corrige ça côté backend pour que l'hébergeur puisse accéder à ses séjours DIRECT.
>
> **Objectif** : Permettre à l'hébergeur d'accéder à un séjour DIRECT en statut OPTION via tous les endpoints collaboration (planning, documents, participants, etc.).
>
> **Référence** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md` section 5.1
> **Règle** : Lire chaque fichier AVANT de le modifier.

---

## ÉTAPE 1 — Modifier verifyAccess() dans collaboration.service.ts

Lire `backend/src/collaboration/collaboration.service.ts`, méthode `verifyAccess()`.

**Actuellement :**
```typescript
if (!['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut)) {
  throw new ForbiddenException('Le séjour n\'est pas en statut CONVENTION');
}
```

**Remplacer par :**
```typescript
const STATUTS_COLLABORATIFS = ['CONVENTION', 'SIGNE_DIRECTION'];
const STATUTS_DIRECT = ['OPTION', ...STATUTS_COLLABORATIFS];

const isHebergeur = sejour.hebergementSelectionne?.userId === userId;

// En mode DIRECT, l'hébergeur peut accéder dès le statut OPTION
// En mode COLLABORATIF, seuls CONVENTION et SIGNE_DIRECTION sont accessibles
const statutsAutorises = (sejour.modeGestion === 'DIRECT' && isHebergeur)
  ? STATUTS_DIRECT
  : STATUTS_COLLABORATIFS;

if (!statutsAutorises.includes(sejour.statut)) {
  throw new ForbiddenException('Le séjour n\'est pas dans un statut accessible');
}
```

**IMPORTANT** : Le `isHebergeur` est calculé AVANT le check des statuts. Supprimer la déclaration dupliquée de `isHebergeur` plus bas dans la même méthode — elle est déclarée une 2ème fois après le check des statuts. Garder uniquement celle du haut. Le code après le check (qui vérifie isCreateur, isHebergeur, isDirector, accompagnateur) doit utiliser le `isHebergeur` déjà calculé.

**AUSSI** : Le `include` du `findUnique` doit charger `modeGestion` pour que la logique fonctionne. Vérifier que le `select` / `include` actuel retourne bien `modeGestion`. Si ce n'est pas le cas (c'est un `include` sans `select`, donc tous les champs du modèle sont retournés par défaut), aucune modification nécessaire — Prisma retourne tous les champs scalaires par défaut avec `findUnique`.

Le code final de la méthode `verifyAccess` doit être :

```typescript
async verifyAccess(sejourId: string, userId: string, role?: string) {
  const sejour = await this.prisma.sejour.findUnique({
    where: { id: sejourId },
    include: {
      hebergementSelectionne: true,
      createur: { select: { id: true, email: true, prenom: true, nom: true } },
    },
  });

  if (!sejour) throw new NotFoundException('Séjour introuvable');
  if (sejour.deletedAt) throw new NotFoundException('Séjour introuvable');

  const isHebergeur = sejour.hebergementSelectionne?.userId === userId;

  // Statuts autorisés selon le mode de gestion
  const STATUTS_COLLABORATIFS = ['CONVENTION', 'SIGNE_DIRECTION'];
  const STATUTS_DIRECT = ['OPTION', ...STATUTS_COLLABORATIFS];
  const statutsAutorises = (sejour.modeGestion === 'DIRECT' && isHebergeur)
    ? STATUTS_DIRECT
    : STATUTS_COLLABORATIFS;

  if (!statutsAutorises.includes(sejour.statut)) {
    throw new ForbiddenException('Le séjour n\'est pas dans un statut accessible');
  }

  const isCreateur = sejour.createurId === userId;
  const isDirector = role === 'SIGNATAIRE';

  const accompagnateurAcces = await this.prisma.accompagnateurMission.findFirst({
    where: {
      sejourId,
      userId,
      accesCollaboratif: true,
    },
    select: { roleCollaboratif: true },
  });

  if (!isCreateur && !isHebergeur && !isDirector && !accompagnateurAcces) {
    throw new ForbiddenException('Vous n\'avez pas accès à cet espace collaboratif');
  }

  return { ...sejour, roleCollaboratif: accompagnateurAcces?.roleCollaboratif ?? null };
}
```

> Note : on ajoute aussi `if (sejour.deletedAt)` pour exclure les séjours soft-deleted — filet de sécurité.

---

## ÉTAPE 2 — Enrichir getSejourInfo() pour retourner les champs DIRECT

Lire la méthode `getSejourInfo()` dans le même fichier.

**Actuellement :**
```typescript
async getSejourInfo(sejourId: string, userId: string, role?: string) {
  const sejour = await this.verifyAccess(sejourId, userId, role);

  const full = await this.prisma.sejour.findUnique({
    where: { id: sejourId },
    include: {
      createur: { select: { id: true, prenom: true, nom: true, email: true } },
      hebergementSelectionne: { select: { id: true, nom: true, ville: true, userId: true } },
    },
  });

  return full;
}
```

**Remplacer par :**
```typescript
async getSejourInfo(sejourId: string, userId: string, role?: string) {
  await this.verifyAccess(sejourId, userId, role);

  const full = await this.prisma.sejour.findUnique({
    where: { id: sejourId },
    include: {
      createur: { select: { id: true, prenom: true, nom: true, email: true } },
      hebergementSelectionne: { select: { id: true, nom: true, ville: true, userId: true } },
    },
  });

  return full;
}
```

> Le `findUnique` sans `select` retourne TOUS les champs scalaires, y compris les nouveaux champs `modeGestion`, `natureSejour`, `typeSejour`, `clientNom`, `clientEmail`, etc. Pas besoin de les ajouter explicitement. Le frontend recevra ces données et pourra les utiliser en Phase 3B.

---

## ÉTAPE 3 — Ajouter OPTION au STATUT_LABEL côté frontend

Lire `frontend/app/dashboard/sejour/[id]/page.tsx`.

Dans le dictionnaire `STATUT_LABEL` (environ ligne 97), ajouter l'entrée OPTION :

```typescript
const STATUT_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  OPTION: 'Option',           // ← AJOUTER
  SUBMITTED: 'Soumis',
  CONVENTION: 'Convention',
  SOUMIS_RECTORAT: 'Soumis rectorat',
  SIGNE_DIRECTION: 'Signé direction',
  DECLARE_TAM: 'Déclaré TAM',
  APPROVED: 'Approuvé',
  REJECTED: 'Refusé',
};
```

Dans le dictionnaire `STATUT_BADGE_CLS` (juste en dessous), ajouter :

```typescript
const STATUT_BADGE_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  OPTION: 'bg-amber-100 text-amber-700',  // ← AJOUTER
  SUBMITTED: 'bg-orange-100 text-orange-700',
  CONVENTION: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  SOUMIS_RECTORAT: 'bg-purple-100 text-purple-700',
  SIGNE_DIRECTION: 'bg-purple-100 text-purple-700',
  DECLARE_TAM: 'bg-teal-100 text-teal-700',
  APPROVED: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  REJECTED: 'bg-red-100 text-red-700',
};
```

---

## ÉTAPE 4 — Build et vérification

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

Vérifier : 0 erreur des deux côtés.

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `backend/src/collaboration/collaboration.service.ts` | verifyAccess() élargi (OPTION pour hébergeur DIRECT + soft delete check), getSejourInfo() inchangé mais vérifié |
| `frontend/app/dashboard/sejour/[id]/page.tsx` | Ajout OPTION dans STATUT_LABEL + STATUT_BADGE_CLS |

## CE QUE ÇA DÉBLOQUE
- L'hébergeur peut cliquer sur un séjour OPTION au planning → la page s'ouvre
- Tous les onglets fonctionnent (planning vide, documents vides, etc.)
- L'onglet Devis affiche "Aucun devis" (le devis sera créé depuis cette page en Phase 3B)
- Les onglets Messages/Journal fonctionnent mais sont vides (pas de créateur pour discuter)

## CE QUE ÇA NE FAIT PAS (Phase 3B frontend)
- Pas d'onglets grisés Messages/Journal avec CTA "Inviter"
- Pas d'adaptation labels (client vs organisateur)
- Pas de bouton "Créer un devis" spécifique au mode DIRECT
- Pas de bouton "Envoyer le devis" au client
- Pas de bouton "Inviter l'organisateur"
