# Prompt CC — Branding réseau complet sur /appel-offres

## CONTEXTE

Quand un enseignant arrive sur `/appel-offres?reseau=lmdj`, la page doit afficher l'identité visuelle LMDJ (La Montagne des Juniors) — pas juste un petit bandeau texte. Marie Charvolin (LMDJ) doit voir cette page le 18/06 et penser "c'est notre outil".

Le bandeau texte actuel (commit dc8fdfa) est remplacé par un branding complet conditionnel.

## RÈGLES ABSOLUES

- Lire chaque fichier AVANT de modifier.
- Proposer le contenu exact → attendre "ok" → puis modifier.
- `tsc --noEmit` + `npm run build` à 0 erreurs avant commit.
- NE PAS toucher au flow du formulaire (steps, champs, validation, submit). Uniquement le visuel.

---

## Étape 0 — Logo LMDJ

Copier le fichier `LOGO_LAMDJ.png` dans `frontend/public/logos/lmdj.png`.

Le fichier source est dans le dossier Téléchargements de Théo.
Si tu ne trouves pas le fichier, demande à Théo le chemin exact.

Next.js sert les fichiers de `public/` à la racine : le logo sera accessible à `https://liavo.fr/logos/lmdj.png`.

Créer le dossier `frontend/public/logos/` s'il n'existe pas.

---

## Étape 1 — Extraire le mapping réseau dans un fichier partagé

Lire `frontend/app/appel-offres/page.tsx` — trouver le `RESEAUX_PARTENAIRES` actuel.

Créer `frontend/src/data/reseaux-partenaires.ts` :

```typescript
export interface ReseauPartenaire {
  nom: string;
  tel: string;
  email: string;
  logo: string;           // chemin relatif depuis /public (ex: '/logos/lmdj.png')
  couleurPrimaire: string; // hex — pour le header/boutons
  couleurSecondaire: string;
  baseline: string;        // sous le logo
  titrePage: string;       // remplace "Lancer un appel d'offres"
  sousTitrePage: string;   // remplace "Décrivez votre séjour..."
}

export const RESEAUX_PARTENAIRES: Record<string, ReseauPartenaire> = {
  lmdj: {
    nom: 'La Montagne des Juniors',
    tel: '04 50 45 69 54',
    email: 'contact@lamdj.com',
    logo: '/logos/lmdj.png',
    couleurPrimaire: '#D41920',    // rouge LMDJ
    couleurSecondaire: '#2BB5D4',  // cyan LMDJ (couleur "Juniors")
    baseline: 'Ressources · Réseau · Classes & Colos',
    titrePage: 'Confiez-nous votre recherche d\'hébergement',
    sousTitrePage: 'Notre réseau compte plus de 100 centres de vacances agréés en Savoie et Haute-Savoie. Décrivez votre projet et recevez des propositions personnalisées.',
  },
  iddj: {
    nom: 'Isère Drôme Destination Juniors',
    tel: '',
    email: '',
    logo: '',
    couleurPrimaire: '#1B4060',
    couleurSecondaire: '#C87D2E',
    baseline: '',
    titrePage: 'Confiez-nous votre recherche d\'hébergement',
    sousTitrePage: 'Décrivez votre projet de séjour — les centres de votre zone vous envoient leurs devis.',
  },
};
```

Mettre à jour les imports dans `frontend/app/appel-offres/page.tsx` pour utiliser ce fichier au lieu du mapping inline.

Mettre à jour les imports dans le composant hébergeur qui affiche le badge "via LMDJ" (introduit au commit dc8fdfa) pour utiliser le même fichier.

---

## Étape 2 — Modifier le header de la page /appel-offres

Lire `frontend/app/appel-offres/page.tsx` — trouver le header actuel (probablement un `<header>` ou `<nav>` avec le logo Liavo et le lien "← Catalogue").

Quand `reseauParam` est présent et matche un réseau :

**Remplacer le header LIAVO par un header co-brandé :**

```tsx
{reseauInfo ? (
  <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
    <div className="flex items-center gap-4">
      <img src={reseauInfo.logo} alt={reseauInfo.nom} className="h-12 w-auto" />
      {/* Petit "powered by Liavo" discret */}
      <div className="border-l border-gray-200 pl-4">
        <span className="text-xs text-gray-400">propulsé par</span>
        <Logo className="h-4 w-auto opacity-50" />
      </div>
    </div>
    <div className="text-right text-xs text-gray-500">
      {reseauInfo.tel && <div>📞 {reseauInfo.tel}</div>}
      {reseauInfo.email && <div>{reseauInfo.email}</div>}
    </div>
  </header>
) : (
  // Header LIAVO standard (existant, inchangé)
  <header>...</header>
)}
```

L'idée : le logo LMDJ est dominant (h-12), le logo LIAVO est en petit "propulsé par" à côté. Le contact LMDJ est à droite.

**ATTENTION** : vérifier comment le composant `<Logo>` est importé et utilisé. Il est probablement dans `@/app/components/Logo`. Adapter l'import si nécessaire. Si `<Logo>` n'accepte pas `className`, utiliser le SVG inline ou un `<img>` vers le logo LIAVO.

---

## Étape 3 — Modifier le titre et le bandeau

Remplacer le titre actuel "Lancer un appel d'offres" et le sous-titre par les versions réseau quand applicable :

```tsx
<h1 className="text-2xl font-bold text-gray-900">
  {reseauInfo?.titrePage ?? 'Lancer un appel d\'offres'}
</h1>
<p className="text-sm text-gray-500 mt-1">
  {reseauInfo?.sousTitrePage ?? 'Décrivez votre séjour — les centres de votre zone vous envoient leurs devis.'}
</p>
```

**Supprimer l'ancien bandeau texte** (le `<div className="mb-6 rounded-xl border...">` ajouté au commit dc8fdfa). Son contenu est absorbé dans le header co-brandé.

---

## Étape 4 — Accent couleur (optionnel mais impactant)

Si le temps le permet : quand `reseauInfo` est présent, utiliser `couleurPrimaire` pour le step indicator actif et les boutons "Suivant" / "Envoyer".

Le step indicator actif utilise `bg-[var(--color-primary)]`. On peut overrider avec une variable CSS inline sur le conteneur :

```tsx
<div style={reseauInfo ? { '--color-primary': reseauInfo.couleurSecondaire } as React.CSSProperties : undefined}>
  {/* tout le formulaire */}
</div>
```

Ça change les steps, les boutons, et les focus rings en cyan LMDJ au lieu du bleu LIAVO. Un seul changement, cascade propre via la CSS variable.

**ATTENTION** : vérifier que `--color-primary` est bien la variable utilisée partout dans le formulaire (steps, boutons, focus rings). Si oui, ce trick fonctionne. Si certains éléments utilisent des classes Tailwind directes (comme `bg-indigo-600`), ils ne seront pas affectés — ce n'est pas grave pour la démo.

---

## Étape 5 — Vérifications

- `tsc --noEmit` sur frontend : 0 erreurs
- `npm run build` : 0 erreurs
- Tester visuellement :
  - `liavo.fr/appel-offres` → page LIAVO standard, aucun changement
  - `liavo.fr/appel-offres?reseau=lmdj` → header LMDJ + powered by Liavo, titre LMDJ, couleur cyan
  - `liavo.fr/appel-offres?reseau=iddj` → header IDDJ (sans logo pour l'instant), titre IDDJ
  - `liavo.fr/appel-offres?reseau=nimportequoi` → page LIAVO standard (fallback)
- Le formulaire fonctionne identiquement dans tous les cas (steps, validation, submit, sourceReseau tag)

---

## Commit message

```
feat(appel-offres): branding réseau complet LMDJ — header co-brandé, titre, couleurs
```

---

## CE QUI NE CHANGE PAS

- Le flow du formulaire (steps, champs, validation, canAdvance, handleSubmit)
- Le tag sourceReseau (déjà en place, inchangé)
- Le champ téléphone (déjà en place, inchangé)
- Le badge "via LMDJ" côté hébergeur (déjà en place, inchangé)
- Les autres pages de LIAVO
