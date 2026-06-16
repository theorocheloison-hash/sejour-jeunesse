# Prompt CC — Backend : Auth enseignant unifié (magic link + mot de passe)

## Contexte

Les enseignants qui soumettent une demande via `/appel-offres` ont un compte auto-créé avec un mot de passe UUID aléatoire qu'ils ne connaissent pas. Ils reçoivent un magic link (TTL 7j) dans l'email de confirmation, mais :
1. Le magic link ne demande jamais de créer un mot de passe → après déconnexion, bloqué
2. Les emails de notification (devis reçu, etc.) pointent vers `/dashboard/teacher` ou `/login` sans magic link → mur
3. `renvoyerMagicLink` a un guard `compteValide` qui bloque les comptes auto-créés (compteValide=true)
4. Le login pour ces users renvoie `COMPTE_DORMANT` trop tard (après bcrypt.compare)

Fix à la source, 5 étapes, 3 fichiers + 1 migration.

---

## Étape 1 — Migration : champ `motDePasseDefini`

### 1a. Schema Prisma

Dans `backend/prisma/schema.prisma`, modèle `User`, ajouter APRÈS le champ `motDePasse` :

```prisma
  motDePasseDefini   Boolean  @default(false) @map("mot_de_passe_defini")
```

### 1b. Fichier de migration SQL

Créer : `backend/prisma/migrations/<timestamp>_add_mot_de_passe_defini/migration.sql`

```sql
ALTER TABLE utilisateurs ADD COLUMN mot_de_passe_defini BOOLEAN NOT NULL DEFAULT false;

UPDATE utilisateurs SET mot_de_passe_defini = true
  WHERE role IN ('HEBERGEUR', 'SIGNATAIRE', 'ADMIN', 'RESEAU', 'AUTORITE', 'PARENT');

UPDATE utilisateurs SET mot_de_passe_defini = true
  WHERE role = 'ORGANISATEUR' AND email_verifie = true AND magic_link_token IS NULL;
```

### 1c. Regénérer le client Prisma

```bash
npx prisma generate
```

---

## Étape 2 — auth.service.ts : 6 modifications

Fichier : `backend/src/auth/auth.service.ts`

### 2a. Nouvelle méthode `genererMagicUrl`

Ajouter APRÈS la méthode `consommerMagicLink` :

```typescript
/**
 * Génère un magic link frais pour un utilisateur et retourne l'URL.
 * Réutilisable partout (notifications, relance, etc.).
 * Chaque appel écrase le précédent (un seul magic link actif).
 */
async genererMagicUrl(userId: string): Promise<string> {
  const magicToken = randomUUID();
  const magicExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await this.prisma.user.update({
    where: { id: userId },
    data: { magicLinkToken: magicToken, magicLinkExpires: magicExpires },
  });
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
  return `${frontendUrl}/auth/magic/${magicToken}`;
}
```

### 2b. Remplacer `renvoyerMagicLink` intégralement

```typescript
async renvoyerMagicLink(email: string) {
  const user = await this.prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, prenom: true, motDePasseDefini: true },
  });
  if (!user || user.motDePasseDefini) {
    return { message: 'Si cet email correspond à un compte, un lien a été envoyé.' };
  }
  const magicUrl = await this.genererMagicUrl(user.id);
  await this.email.sendMagicLink(email, user.prenom, 'votre séjour', magicUrl);
  return { message: 'Si cet email correspond à un compte, un lien a été envoyé.' };
}
```

### 2c. Remplacer `consommerMagicLink` intégralement

```typescript
async consommerMagicLink(token: string, res: any) {
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
  const user = await this.prisma.user.findFirst({
    where: { magicLinkToken: token, magicLinkExpires: { gte: new Date() } },
    select: { id: true, email: true, role: true, motDePasseDefini: true },
  });
  if (!user) {
    return res.redirect(`${frontendUrl}/login?error=magic_link_expired`);
  }
  await this.prisma.user.update({
    where: { id: user.id },
    data: { compteValide: true, emailVerifie: true, magicLinkToken: null, magicLinkExpires: null },
  });
  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = this.jwt.sign(payload);
  const needsPassword = !user.motDePasseDefini;
  return res.redirect(
    `${frontendUrl}/auth/callback#token=${encodeURIComponent(accessToken)}&onboarding=true${needsPassword ? '&needsPassword=true' : ''}`
  );
}
```

### 2d. Marquer `motDePasseDefini: true` dans les 4 méthodes d'inscription

Dans chacune de ces méthodes, ajouter `motDePasseDefini: true` dans le `data` du `prisma.user.create` :
- `register`
- `registerOrganisateur`
- `registerHebergeur`
- `registerSignataire`

### 2e. Marquer `motDePasseDefini: true` dans les méthodes de mot de passe

Dans `reinitialiserMotDePasse`, ajouter dans le `data` du `prisma.user.update` :
```typescript
motDePasseDefini: true,
```

Dans `definirMotDePasse`, ajouter dans le `data` du `prisma.user.update` :
```typescript
motDePasseDefini: true,
```

### 2f. Déplacer le check COMPTE_DORMANT AVANT bcrypt dans `login`

Dans la méthode `login`, le check `COMPTE_DORMANT` est actuellement APRÈS `bcrypt.compare`. Le déplacer AVANT pour que l'enseignant sans mot de passe voie un message utile au lieu de "Identifiants invalides".

Chercher les gates existants. Réorganiser dans cet ordre :

```typescript
// Gate 0 : compte sans mot de passe défini (demande publique → magic link)
if (!user.motDePasseDefini) {
  throw new UnauthorizedException('COMPTE_DORMANT');
}

// Gate 1 : mot de passe
const isValid = await bcrypt.compare(dto.password, user.motDePasse);
if (!isValid) throw new UnauthorizedException('Identifiants invalides');

// Gate 2 : email vérifié
if (!user.emailVerifie) {
  throw new UnauthorizedException('EMAIL_NON_VERIFIE');
}

// Gate 3 : hébergeur validé
if (user.role === 'HEBERGEUR' && !user.compteValide) {
  throw new UnauthorizedException('COMPTE_EN_ATTENTE_VALIDATION');
}
```

SUPPRIMER l'ancien check `COMPTE_DORMANT` (celui basé sur `!emailVerifie && magicLinkToken`) — il est remplacé par le nouveau gate 0.

**IMPORTANT** : s'assurer que `motDePasseDefini` est inclus dans le `select` du `findUnique` en haut de la méthode `login`. Ajouter `motDePasseDefini: true` dans le select si nécessaire.

---

## Étape 3 — email.service.ts : magic link dans `sendDevisRecu`

Fichier : `backend/src/email/email.service.ts`

### 3a. Modifier la signature

```typescript
async sendDevisRecu(
  to: string,
  enseignantNom: string,
  sejourTitre: string,
  centreNom: string,
  montant: string,
  magicUrl?: string,
) {
```

### 3b. Modifier le corps de l'email

Remplacer la ligne :
```
<p>Connectez-vous pour consulter le détail et comparer les offres.</p>
```
Par :
```
<p>Cliquez ci-dessous pour consulter le détail du devis.${magicUrl ? ' Aucun mot de passe requis.' : ''}</p>
```

### 3c. Modifier le CTA

Remplacer :
```typescript
      'Voir les devis',
      `${FRONTEND_URL}/dashboard/teacher`,
```
Par :
```typescript
      'Consulter le devis',
      magicUrl ?? `${FRONTEND_URL}/login`,
```

---

## Étape 4 — Injecter magic link dans les appelants de `sendDevisRecu`

Trouver tous les appels :
```bash
grep -rn "sendDevisRecu" backend/src/ --include="*.ts"
```

Pour CHAQUE appel trouvé :

1. L'enseignant (destinataire de l'email) est identifié par son userId dans le contexte (souvent via `demande.enseignantId` ou `sejour.createurId`)
2. AVANT l'appel `sendDevisRecu`, ajouter la génération du magic link :

```typescript
// Magic link pour accès direct sans mot de passe
const magicToken = randomUUID();
const magicExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
await this.prisma.user.update({
  where: { id: enseignantId },
  data: { magicLinkToken: magicToken, magicLinkExpires: magicExpires },
});
const magicUrl = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/auth/magic/${magicToken}`;
```

3. Passer `magicUrl` comme dernier argument à `sendDevisRecu(..., magicUrl)`

4. Ajouter `import { randomUUID } from 'crypto';` en haut du fichier si pas déjà présent.

NOTE : cette approche inline évite d'injecter AuthService (risque de dépendance circulaire). La logique est identique à `genererMagicUrl` dans auth.service.ts.

---

## Étape 5 — Vérifications

```bash
npx prisma generate
cd backend && npx tsc --noEmit
cd backend && npm run build
```

0 erreurs sur les trois commandes.

**Tests manuels à effectuer :**
1. Login hébergeur existant → fonctionne normalement (pas de régression)
2. Login enseignant inscrit classiquement (Sauvageon) → fonctionne normalement
3. Créer une demande via /appel-offres → email reçu avec magic link → cliquer → redirigé avec needsPassword=true
4. Se déconnecter → login avec email + nouveau mot de passe → OK
5. Simuler un devis envoyé → l'email contient un magic link → cliquer → connecté directement

## CE QU'ON NE TOUCHE PAS

- `soumettreDemandePublique` dans public.service.ts (le flow de demande ne change pas)
- `sendMagicLink` dans email.service.ts (le 1er email ne change pas)
- Aucun fichier frontend (prompt séparé)
- Le flow d'inscription hébergeur ne change pas côté UX
- La table `utilisateurs` garde tous ses champs existants, on ajoute juste `mot_de_passe_defini`
