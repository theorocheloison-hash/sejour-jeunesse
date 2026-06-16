# Prompt CC — Frontend : Auth enseignant unifié (page mot de passe + login COMPTE_DORMANT)

## Contexte

Le backend a été mis à jour (voir `docs/prompts/CC_BACKEND_AUTH_ENSEIGNANT_UNIFIE.md`). Deux changements impactent le frontend :
1. `consommerMagicLink` redirige maintenant vers `/auth/callback#token=...&needsPassword=true` si l'enseignant n'a jamais défini de mot de passe
2. Le login renvoie `COMPTE_DORMANT` AVANT le check bcrypt pour les users sans mot de passe défini, et `POST /auth/renvoyer-magic-link` fonctionne maintenant correctement

Ce prompt ajoute la gestion frontend de ces deux cas. NE TOUCHE PAS aux composants existants sauf les deux fichiers ciblés.

---

## Étape 1 — `/auth/callback` : gérer `needsPassword=true`

Fichier : `frontend/app/auth/callback/page.tsx` (ou le fichier équivalent dans ce dossier)

### Comportement actuel

La page `/auth/callback` lit le hash fragment (`#token=...&onboarding=true`), stocke le JWT, et redirige vers le dashboard.

### Modification

Lire le paramètre `needsPassword` dans le hash fragment. Si présent et `true`, afficher un formulaire de création de mot de passe AVANT de rediriger vers le dashboard.

**Logique à ajouter :**

```typescript
// Parser le hash fragment
const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const token = params.get('token');
const needsPassword = params.get('needsPassword') === 'true';
```

**Si `needsPassword === true` :**

1. Stocker le JWT normalement (cookie ou localStorage, selon le pattern existant)
2. Au lieu de rediriger vers le dashboard, afficher un formulaire :

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  🔒 Sécurisez votre accès                          │
│                                                     │
│  Créez un mot de passe pour pouvoir vous            │
│  reconnecter facilement à votre espace LIAVO.       │
│                                                     │
│  Mot de passe (min. 8 caractères)                   │
│  [________________________]                         │
│                                                     │
│  Confirmer le mot de passe                          │
│  [________________________]                         │
│                                                     │
│  [     Créer mon mot de passe     ]                 │
│                                                     │
│  Passer cette étape →                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

3. Le bouton "Créer mon mot de passe" appelle `POST /auth/set-password` avec le body `{ password }` et le header Authorization Bearer (le JWT est déjà stocké).

4. Utiliser la fonction API existante ou faire un fetch direct :
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';
const res = await fetch(`${API_BASE}/auth/set-password`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ password }),
});
```

5. Après succès → rediriger vers le dashboard selon le rôle (pattern existant de la page callback).

6. "Passer cette étape" → rediriger vers le dashboard directement (l'enseignant pourra définir son mot de passe plus tard via "Mot de passe oublié").

**Validation du formulaire :**
- Mot de passe min 8 caractères
- Les deux champs doivent correspondre
- Bouton disabled tant que les conditions ne sont pas remplies

**Style :** utiliser les mêmes classes Tailwind que le reste de l'app (card blanche, rounded-2xl, shadow-sm, bouton bg-[var(--color-primary)], texte gris). Centré verticalement sur fond gris clair. Logo LIAVO en haut.

---

## Étape 2 — Page login : gérer COMPTE_DORMANT

Fichier : trouver la page de login (probablement `frontend/app/login/page.tsx` ou `frontend/app/(auth)/login/page.tsx`)

```bash
find frontend/app -name "page.tsx" | xargs grep -l "COMPTE_DORMANT\|login\|Login" | head -5
```

### Comportement actuel

Quand le backend renvoie `401 COMPTE_DORMANT`, le frontend affiche probablement un message d'erreur générique ou rien du tout.

### Modification

Détecter l'erreur `COMPTE_DORMANT` dans la réponse du login et afficher un bloc spécifique :

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ℹ️ Compte créé via une demande de séjour           │
│                                                     │
│  Votre compte a été créé automatiquement lorsque    │
│  vous avez soumis une demande. Pour vous connecter, │
│  entrez votre email et recevez un lien d'accès.     │
│                                                     │
│  Email                                              │
│  [________________________]                         │
│                                                     │
│  [   Recevoir mon lien de connexion   ]             │
│                                                     │
│  ✅ Un lien vous a été envoyé par email !           │
│  (affiché après succès)                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Logique :**

1. Quand le login échoue avec `COMPTE_DORMANT`, afficher ce bloc (au lieu du formulaire login classique, ou en dessous).
2. Pré-remplir le champ email avec l'email que l'utilisateur vient de saisir.
3. Le bouton appelle `POST /auth/renvoyer-magic-link` avec `{ email }`.
4. Après succès, afficher le message de confirmation "Un lien vous a été envoyé par email".
5. L'utilisateur va dans ses emails, clique le magic link → cycle normal (callback → needsPassword si premier accès → dashboard).

**Endpoint :**
```typescript
const res = await fetch(`${API_BASE}/auth/renvoyer-magic-link`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});
```

**Gestion d'erreur :** l'endpoint renvoie toujours 200 avec un message générique (sécurité). Toujours afficher "Un lien a été envoyé" quelle que soit la réponse.

---

## Vérifications

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

0 erreurs sur les deux commandes.

**Tests manuels :**
1. Cliquer un magic link (simuler en DB) → la page callback affiche le formulaire "Créez votre mot de passe"
2. Remplir + valider → redirigé vers le dashboard
3. Se déconnecter → login classique avec email + mot de passe → OK
4. Login avec un email d'enseignant sans mot de passe → message COMPTE_DORMANT → cliquer "Recevoir un lien" → email reçu
5. Login hébergeur classique → pas de régression (pas de COMPTE_DORMANT, login normal)
6. "Passer cette étape" → arrive au dashboard → peut définir son mdp plus tard via "mot de passe oublié"

## CE QU'ON NE TOUCHE PAS

- Aucun autre composant frontend
- Aucun style global
- Aucun fichier backend
- Le flow d'inscription hébergeur/organisateur classique ne change pas
- Le dashboard enseignant ne change pas
