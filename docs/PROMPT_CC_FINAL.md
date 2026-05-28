# PROMPT CC — Fix cosmétique devis/nouveau + Phase 4 (inviter organisateur) + Phase 5 (migration DevisLibres)

> **Contexte** : Le séjour DIRECT end-to-end fonctionne en prod. Ce prompt couvre les 3 derniers chantiers :
> 1. Fix cosmétique : blocs "Destinataire" et "Objet" affichent "Chargement..." en mode DIRECT
> 2. Phase 4 : bouton "Inviter l'organisateur à collaborer" (upgrade DIRECT → COLLABORATIF)
> 3. Phase 5 : migration des DevisLibres existants + nettoyage
>
> **Règle** : Lire chaque fichier AVANT de le modifier. Ne jamais déduire.
> **IMPORTANT** : Ce prompt est LONG. Exécuter les étapes dans l'ordre, committer après chaque section majeure si souhaité.

---

# SECTION A — Fix cosmétique page devis/nouveau en mode DIRECT

## ÉTAPE A1 — Charger les données du séjour DIRECT pour afficher Destinataire/Objet

Lire `frontend/app/dashboard/hebergeur/devis/nouveau/page.tsx` en entier.

### A1a. Ajouter un state pour les données du séjour DIRECT

Après les states existants (après `const [success, setSuccess] = useState(false);`), ajouter :

```typescript
  // Données séjour DIRECT (pour afficher Destinataire + Objet)
  const [directSejour, setDirectSejour] = useState<{
    titre: string; dateDebut: string; dateFin: string; placesTotales: number;
    clientNom: string | null; clientEmail: string | null; clientOrganisation: string | null;
    lieu: string;
  } | null>(null);
```

### A1b. Charger le séjour DIRECT dans le useEffect

Dans le `useEffect` de chargement, branche `if (isDirect)`, APRÈS le `.then(([numData, cat, centre]) => { ... })`, ajouter le chargement du séjour :

```typescript
      // Charger aussi les données du séjour pour Destinataire/Objet
      api.get(`/collaboration/${sejourDirectId}`).then(r => setDirectSejour(r.data)).catch(() => {});
```

> Cet appel utilise `getSejourCollabInfo` (GET /collaboration/:sejourId) qui retourne maintenant les champs client (Phase 3A). L'import `api` est déjà présent dans le fichier.

### A1c. Adapter le bloc "Destinataire"

Trouver le bloc JSX `<h2 ...>Destinataire</h2>`.

**Remplacer le contenu du bloc Destinataire ENTIER (le `<div>` qui contient le `<h2>Destinataire` + le rendu conditionnel) par :**

```typescript
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Destinataire</h2>
            {isDirect ? (
              directSejour ? (
                <div className="text-sm text-gray-700 space-y-1">
                  {directSejour.clientNom && <p className="font-semibold">{directSejour.clientNom}</p>}
                  {directSejour.clientOrganisation && <p className="font-medium text-gray-600">{directSejour.clientOrganisation}</p>}
                  {directSejour.clientEmail && <p className="text-gray-500">{directSejour.clientEmail}</p>}
                  {!directSejour.clientNom && !directSejour.clientOrganisation && (
                    <p className="text-gray-400 italic">Client non renseigné</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Chargement...</p>
              )
            ) : demande ? (
              <div className="text-sm text-gray-700 space-y-1">
                {demande.enseignant && (
                  <p className="font-semibold">{demande.enseignant.prenom} {demande.enseignant.nom}</p>
                )}
                {demande.enseignant?.memberships?.[0]?.organisation.nom && (
                  <p className="font-medium text-gray-600">{demande.enseignant.memberships[0].organisation.nom}</p>
                )}
                {demande.enseignant?.memberships?.[0]?.organisation.ville && (
                  <p className="text-gray-500">{demande.enseignant.memberships[0].organisation.ville}</p>
                )}
                {demande.enseignant?.email && <p className="text-gray-500">{demande.enseignant.email}</p>}
                {demande.enseignant?.telephone && <p className="text-gray-500">Pers. : {demande.enseignant.telephone}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Chargement...</p>
            )}
          </div>
```

### A1d. Adapter le bloc "Objet"

Trouver le bloc JSX `<h2 ...>Objet</h2>`.

**Remplacer le contenu du bloc Objet ENTIER par :**

```typescript
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Objet</h2>
            {isDirect ? (
              directSejour ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {directSejour.titre} — {directSejour.lieu} — du {new Date(directSejour.dateDebut).toLocaleDateString('fr-FR')} au {new Date(directSejour.dateFin).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{directSejour.placesTotales} participant{directSejour.placesTotales > 1 ? 's' : ''}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Chargement...</p>
              )
            ) : sejour ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">
                  Séjour — {sejour.lieu} — du {new Date(sejour.dateDebut).toLocaleDateString('fr-FR')} au {new Date(sejour.dateFin).toLocaleDateString('fr-FR')}
                </p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{sejour.placesTotales} participant{sejour.placesTotales > 1 ? 's' : ''}</span>
                  {sejour.niveauClasse && <span>Niveau : {sejour.niveauClasse}</span>}
                </div>
              </div>
            ) : demande ? (
              <p className="text-sm font-semibold text-gray-900">
                {demande.titre} — {demande.villeHebergement} — {demande.nombreEleves} participants
              </p>
            ) : (
              <p className="text-sm text-gray-400">Chargement...</p>
            )}
          </div>
```

### A1e. Adapter le lien "Annuler" en bas

Trouver le `<Link href="/dashboard/hebergeur/demandes"` dans les actions en bas de page.

Remplacer le `href` :
```typescript
href={isDirect ? `/dashboard/sejour/${sejourDirectId}` : '/dashboard/hebergeur/demandes'}
```

---

# SECTION B — Phase 4 : Inviter l'organisateur sur un séjour DIRECT

## ÉTAPE B1 — Backend : endpoint POST /sejours/:id/inviter-organisateur

Lire `backend/src/sejours/sejour.service.ts` et `backend/src/sejours/sejour.controller.ts`.

### B1a. Méthode service

Ajouter dans `SejourService` :

```typescript
  /**
   * Envoie une invitation à un organisateur pour collaborer sur un séjour DIRECT.
   * L'organisateur recevra un lien pour créer un compte et rejoindre le séjour.
   * À l'acceptation, modeGestion passe de DIRECT à COLLABORATIF, createurId est set.
   */
  async inviterOrganisateur(
    sejourId: string,
    emailOrganisateur: string,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true, titre: true, dateDebut: true, dateFin: true, placesTotales: true,
        modeGestion: true, hebergementSelectionneId: true, deletedAt: true,
        clientNom: true, clientOrganisation: true,
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.modeGestion !== 'DIRECT') {
      throw new ForbiddenException('Ce séjour n\'est pas en gestion directe');
    }
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    // Créer une InvitationCollaboration liée au séjour existant
    const invitation = await this.prisma.invitationCollaboration.create({
      data: {
        centreId: centre.id,
        emailEnseignant: emailOrganisateur.trim(),
        titreSejourSuggere: sejour.titre,
        dateDebut: sejour.dateDebut,
        dateFin: sejour.dateFin,
        nbElevesEstime: sejour.placesTotales,
        message: `${centre.nom} vous invite à collaborer sur le séjour "${sejour.titre}".`,
        sejourId: sejour.id, // ← Lié au séjour existant
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const lien = `${frontendUrl}/rejoindre/${invitation.token}`;
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    await this.email.sendGenericNotification(
      emailOrganisateur.trim(),
      `${centre.nom} vous invite à collaborer sur un séjour`,
      `<p>Bonjour,</p>
       <p><strong>${centre.nom}</strong> vous invite à rejoindre l'espace collaboratif pour le séjour :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.titre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Participants</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.placesTotales}</td></tr>
       </table>
       <p>En rejoignant, vous aurez accès à l'espace collaboratif : messagerie, documents partagés, planning, journal de séjour.</p>
       <p style="margin:24px 0">
         <a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Rejoindre le séjour
         </a>
       </p>`,
      centre.nom,
    );

    return { success: true, message: 'Invitation envoyée' };
  }
```

### B1b. Route controller

Dans `backend/src/sejours/sejour.controller.ts`, ajouter cette route AVANT les routes paramétriques `@Get(':id/...')` :

```typescript
  /** POST /sejours/:id/inviter-organisateur — Inviter un organisateur sur un séjour DIRECT */
  @Post(':id/inviter-organisateur')
  @Roles(Role.HEBERGEUR)
  inviterOrganisateur(
    @Param('id') id: string,
    @Body() body: { emailOrganisateur: string },
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.sejourService.inviterOrganisateur(id, body.emailOrganisateur, user.id, centreId);
  }
```

> **ATTENTION** au positionnement : cette route doit être APRÈS les routes statiques (`direct`, `depuis-catalogue`, `me`) et AVANT les routes `@Get(':id/...')` paramétriques. Si `:id` est paramétrique et `inviter-organisateur` est un segment, NestJS le gère correctement car POST ≠ GET. Mais vérifier que `@Post(':id/inviter-organisateur')` est bien après `@Post('direct')`.

### B1c. Adapter le flow d'acceptation pour les séjours DIRECT existants

Lire `backend/src/invitation-collaboration/invitation-collaboration.service.ts`, méthode `accepter()`.

La méthode `accepter()` crée un nouveau séjour. MAIS si `invitation.sejourId` est déjà set (cas de l'invitation sur séjour DIRECT), on doit RATTACHER l'organisateur au séjour existant au lieu d'en créer un nouveau.

Trouver dans `accepter()` le début de la transaction `this.prisma.$transaction(async (tx) => {`. À l'intérieur, AVANT la création du séjour, ajouter ce branchement :

```typescript
      // ── Si l'invitation est liée à un séjour DIRECT existant → rattacher au lieu de créer ──
      if (invitation.sejourId) {
        const existingSejour = await tx.sejour.findUnique({
          where: { id: invitation.sejourId },
          select: { id: true, modeGestion: true, createurId: true },
        });
        if (existingSejour && existingSejour.modeGestion === 'DIRECT' && !existingSejour.createurId) {
          // Rattacher l'organisateur au séjour existant
          await tx.sejour.update({
            where: { id: existingSejour.id },
            data: {
              createurId: enseignantId,
              modeGestion: 'COLLABORATIF',
            },
          });

          await tx.invitationCollaboration.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date(), sejourId: existingSejour.id },
          });

          return { sejourId: existingSejour.id, devisCree: null };
        }
      }
```

Ce bloc doit être AVANT la logique existante de création de séjour. Le `return` interrompt la transaction et skip la création d'un nouveau séjour.

## ÉTAPE B2 — Frontend : bouton "Inviter l'organisateur"

### B2a. Fonction API

Lire `frontend/src/lib/collaboration.ts`. Ajouter en fin de fichier :

```typescript
export async function inviterOrganisateurDirect(sejourId: string, emailOrganisateur: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/sejours/${sejourId}/inviter-organisateur`, { emailOrganisateur });
  return data;
}
```

### B2b. Bouton dans la page séjour

Lire `frontend/app/dashboard/sejour/[id]/page.tsx`.

Ajouter l'import de `inviterOrganisateurDirect` dans les imports de `@/src/lib/collaboration`.

Ajouter ces states après les states existants :

```typescript
  // Invitation organisateur
  const [showInviteOrga, setShowInviteOrga] = useState(false);
  const [inviteOrgaEmail, setInviteOrgaEmail] = useState('');
  const [inviteOrgaSending, setInviteOrgaSending] = useState(false);
  const [inviteOrgaSuccess, setInviteOrgaSuccess] = useState(false);
```

Trouver les placeholders Messages et Journal en mode DIRECT (les blocs `{tab === 'messages' && isDirect && (` et `{tab === 'journal' && isDirect && (`). Dans ces placeholders, le bouton "Inviter l'organisateur (bientôt)" est actuellement `disabled`.

**Remplacer le bouton disabled dans le placeholder Messages par :**

```typescript
    {!showInviteOrga ? (
      <button
        onClick={() => setShowInviteOrga(true)}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
      >
        Inviter l&apos;organisateur
      </button>
    ) : inviteOrgaSuccess ? (
      <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
        ✅ Invitation envoyée à {inviteOrgaEmail}
      </p>
    ) : (
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={inviteOrgaEmail}
          onChange={e => setInviteOrgaEmail(e.target.value)}
          placeholder="email@organisateur.fr"
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={async () => {
            if (!inviteOrgaEmail.trim()) return;
            setInviteOrgaSending(true);
            try {
              await inviterOrganisateurDirect(id, inviteOrgaEmail.trim());
              setInviteOrgaSuccess(true);
            } catch { setMutationError('Erreur lors de l\'envoi de l\'invitation'); }
            finally { setInviteOrgaSending(false); }
          }}
          disabled={inviteOrgaSending || !inviteOrgaEmail.trim()}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {inviteOrgaSending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    )}
```

**Faire la même modification dans le placeholder Journal** (remplacer le bouton disabled par le même bloc ci-dessus — ou mieux, extraire les states en partageant `showInviteOrga` entre les deux onglets, ce qui est déjà le cas puisque les states sont au niveau du composant parent).

---

# SECTION C — Phase 5 : Migration DevisLibres

> **Note** : Il n'y a que 3 devis libres en base (Sauvageon). La migration est simple.

## ÉTAPE C1 — Script de migration SQL

Créer `backend/prisma/migrations/20260528_migrate_devis_libres/migration.sql` :

```sql
-- =============================================================
-- Migration DevisLibres → Séjours DIRECT + Devis standard
-- Exécution : Scalingo via prisma migrate deploy
-- =============================================================

-- Étape 1 : Créer une table temporaire de mapping
CREATE TEMP TABLE IF NOT EXISTS _dl_mapping (
  devis_libre_id UUID PRIMARY KEY,
  sejour_id UUID NOT NULL,
  devis_id UUID NOT NULL
);

-- Étape 2 : Pour chaque DevisLibre, créer un Séjour DIRECT
DO $$
DECLARE
  dl RECORD;
  new_sejour_id UUID;
  new_devis_id UUID;
  sejour_statut "StatutSejour";
  devis_statut "StatutDevis";
BEGIN
  FOR dl IN SELECT * FROM devis_libres LOOP
    -- Mapper statut DevisLibre → StatutSejour
    CASE dl.statut
      WHEN 'BROUILLON' THEN sejour_statut := 'OPTION';
      WHEN 'ENVOYE' THEN sejour_statut := 'OPTION';
      WHEN 'ACCEPTE' THEN sejour_statut := 'CONVENTION';
      WHEN 'PAYE' THEN sejour_statut := 'CONVENTION';
      WHEN 'REFUSE' THEN sejour_statut := 'OPTION';
      ELSE sejour_statut := 'OPTION';
    END CASE;

    -- Mapper statut DevisLibre → StatutDevis
    CASE dl.statut
      WHEN 'BROUILLON' THEN devis_statut := 'EN_ATTENTE';
      WHEN 'ENVOYE' THEN devis_statut := 'EN_ATTENTE';
      WHEN 'ACCEPTE' THEN devis_statut := 'SELECTIONNE';
      WHEN 'PAYE' THEN devis_statut := 'FACTURE_SOLDE';
      WHEN 'REFUSE' THEN devis_statut := 'NON_RETENU';
      ELSE devis_statut := 'EN_ATTENTE';
    END CASE;

    new_sejour_id := gen_random_uuid();
    new_devis_id := gen_random_uuid();

    -- Créer le Séjour
    INSERT INTO sejours (
      id, titre, description, lieu, date_debut, date_fin,
      places_totales, places_restantes, statut,
      mode_gestion, nature_sejour, type_sejour,
      hebergement_selectionne_id,
      client_nom, client_prenom, client_email, client_telephone, client_organisation,
      type_contexte,
      created_at, updated_at
    )
    SELECT
      new_sejour_id,
      COALESCE(dl.type_evenement, 'Événement'),
      dl.description,
      c.ville,
      dl.date_debut,
      dl.date_fin,
      0, 0,
      sejour_statut,
      'DIRECT',
      'EVENEMENT',
      CASE
        WHEN LOWER(COALESCE(dl.type_evenement, '')) LIKE '%mariage%' THEN 'MARIAGE'
        WHEN LOWER(COALESCE(dl.type_evenement, '')) LIKE '%séminaire%' OR LOWER(COALESCE(dl.type_evenement, '')) LIKE '%seminaire%' THEN 'SEMINAIRE'
        WHEN LOWER(COALESCE(dl.type_evenement, '')) LIKE '%anniversaire%' THEN 'ANNIVERSAIRE'
        ELSE 'AUTRE_EVENEMENT'
      END,
      dl.centre_id,
      dl.nom_client,
      dl.prenom_client,
      dl.email_client,
      dl.tel_client,
      NULL, -- pas de clientOrganisation pour les événements
      'HORS_SCOLAIRE',
      dl.created_at,
      dl.updated_at
    FROM centres_hebergement c WHERE c.id = dl.centre_id;

    -- Créer le Devis
    INSERT INTO devis (
      id, sejour_direct_id, centre_id,
      montant_total, montant_par_eleve,
      montant_ht, montant_tva, montant_ttc,
      taux_tva, pourcentage_acompte, montant_acompte,
      montant_verse_total, numero_devis, statut,
      conditions_annulation, description,
      token_signature,
      nom_entreprise, adresse_entreprise, siret_entreprise, email_entreprise, tel_entreprise,
      created_at, updated_at
    )
    VALUES (
      new_devis_id,
      new_sejour_id,
      dl.centre_id,
      COALESCE(dl.montant_ttc, 0),
      0,
      dl.montant_ht,
      dl.montant_tva,
      dl.montant_ttc,
      dl.taux_tva,
      dl.pourcentage_acompte,
      dl.montant_acompte,
      dl.montant_verse_total,
      dl.numero_devis,
      devis_statut,
      dl.conditions_annulation,
      dl.description,
      dl.token_signature,
      NULL, NULL, NULL, NULL, NULL,
      dl.created_at,
      dl.updated_at
    );

    -- Stocker le mapping
    INSERT INTO _dl_mapping (devis_libre_id, sejour_id, devis_id)
    VALUES (dl.id, new_sejour_id, new_devis_id);
  END LOOP;
END $$;

-- Étape 3 : Migrer les lignes de devis
INSERT INTO lignes_devis (id, devis_id, description, quantite, prix_unitaire, tva, total_ht, total_ttc)
SELECT gen_random_uuid(), m.devis_id, ldl.description, ldl.quantite, ldl.prix_unitaire, ldl.tva, ldl.total_ht, ldl.total_ttc
FROM lignes_devis_libre ldl
JOIN _dl_mapping m ON m.devis_libre_id = ldl.devis_libre_id;

-- Étape 4 : Migrer les versements
INSERT INTO versements_paiement (id, devis_id, montant, date_paiement, reference, created_at)
SELECT gen_random_uuid(), m.devis_id, v.montant, v.date_paiement, v.reference, v.created_at
FROM versements_devis_libre v
JOIN _dl_mapping m ON m.devis_libre_id = v.devis_libre_id;

-- Étape 5 : Migrer les liens SejourClient
INSERT INTO sejours_clients (id, client_id, sejour_id, created_at)
SELECT gen_random_uuid(), dl.client_id, m.sejour_id, NOW()
FROM devis_libres dl
JOIN _dl_mapping m ON m.devis_libre_id = dl.id
WHERE dl.client_id IS NOT NULL
ON CONFLICT (client_id, sejour_id) DO NOTHING;

-- Étape 6 : Nettoyage (on ne DROP PAS les tables maintenant — on le fera manuellement après vérification)
-- Les tables devis_libres, lignes_devis_libre, versements_devis_libre restent en base
-- mais le code ne les utilise plus.

DROP TABLE IF EXISTS _dl_mapping;
```

## ÉTAPE C2 — Redirect frontend `/devis-libre/signer/[token]` → `/devis/signer/[token]`

Ajouter dans `frontend/next.config.ts` (ou `next.config.js`) la redirection. Lire le fichier d'abord pour trouver la syntaxe existante.

Si le fichier a déjà un bloc `redirects`, ajouter dans le tableau :

```typescript
{
  source: '/devis-libre/signer/:token',
  destination: '/devis/signer/:token',
  permanent: true,
},
```

Si le fichier n'a pas de bloc `redirects`, ajouter dans le `nextConfig` :

```typescript
async redirects() {
  return [
    {
      source: '/devis-libre/signer/:token',
      destination: '/devis/signer/:token',
      permanent: true,
    },
  ];
},
```

> **IMPORTANT** : Les tokens de signature existants des DevisLibres sont migrés sur les nouveaux Devis (token_signature). Donc l'ancienne URL `/devis-libre/signer/xxx` sera redirigée vers `/devis/signer/xxx` qui trouvera le même token sur le Devis migré.

## ÉTAPE C3 — NE PAS supprimer les modules DevisLibres

> Les modules backend `devis-libres/` et frontend `devis-libre/`, `devis-libres/`, `lib/devis-libres.ts` ne sont PAS supprimés dans ce prompt. Ils seront supprimés manuellement après vérification de la migration en prod. Laisser le code mort en place pour l'instant.

---

## ÉTAPE FINALE — Build et vérification

```bash
cd backend && npx prisma generate && npm run build
cd ../frontend && npm run build
```

Vérifier : 0 erreur des deux côtés.

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `frontend/app/dashboard/hebergeur/devis/nouveau/page.tsx` | Fix Destinataire/Objet en mode DIRECT |
| `backend/src/sejours/sejour.service.ts` | +inviterOrganisateur() |
| `backend/src/sejours/sejour.controller.ts` | +POST /:id/inviter-organisateur |
| `backend/src/invitation-collaboration/invitation-collaboration.service.ts` | Branchement accepter() pour séjours DIRECT existants |
| `frontend/src/lib/collaboration.ts` | +inviterOrganisateurDirect() |
| `frontend/app/dashboard/sejour/[id]/page.tsx` | Bouton inviter organisateur dans placeholders Messages/Journal |
| `backend/prisma/migrations/20260528_migrate_devis_libres/migration.sql` | Script migration DevisLibres |
| `frontend/next.config.ts` | Redirect /devis-libre/signer → /devis/signer |
