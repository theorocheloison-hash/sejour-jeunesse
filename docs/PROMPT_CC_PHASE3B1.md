# PROMPT CC — Phase 3B-1 : Créer et envoyer un devis DIRECT depuis la page séjour

> **Contexte** : La page `/dashboard/sejour/[id]` est accessible pour les séjours DIRECT (Phase 3A). Mais l'onglet Devis ne fonctionne pas en mode DIRECT car il cherche les devis via `getBudgetData()` qui passe par `demande.devis` (il n'y a pas de DemandeDevis en mode DIRECT). Cette phase ajoute :
> 1. Fonctions API `createDirectDevis` + `envoyerDevisDirect` dans `lib/devis.ts`
> 2. Adaptation de la page `devis/nouveau` pour accepter `sejourDirectId`
> 3. Lien "Créer un devis" et "Envoyer au client" dans l'onglet Devis de la page séjour
> 4. Chargement des devis DIRECT via `getMesDevis` (ils sont déjà retournés par ce endpoint)
>
> **Référence** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md`
> **Règle** : Lire chaque fichier EN ENTIER avant modification. Ce sont des fichiers critiques de 500-5000 lignes. Ne jamais déduire.

---

## ÉTAPE 1 — Ajouter les fonctions API dans lib/devis.ts

Lire `frontend/src/lib/devis.ts` en entier.

### 1A. Ajouter ces deux fonctions en fin de fichier :

```typescript
export async function createDirectDevis(dto: CreateDevisDto & { sejourDirectId: string }): Promise<Devis> {
  const { data } = await api.post<Devis>('/devis/direct', dto);
  return data;
}

export async function envoyerDevisDirect(devisId: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/devis/${devisId}/envoyer-direct`);
  return data;
}
```

### 1B. Enrichir le type `Devis` pour inclure les champs DIRECT

Dans l'interface `Devis`, ajouter après `lignes?` :

```typescript
  sejourDirectId?: string | null;
  tokenSignature?: string | null;
  sejourDirect?: {
    id: string;
    titre: string;
    dateDebut: string;
    dateFin: string;
    clientNom: string | null;
    clientEmail: string | null;
    clientOrganisation: string | null;
    modeGestion: string;
  } | null;
```

---

## ÉTAPE 2 — Adapter la page devis/nouveau pour sejourDirectId

Lire `frontend/app/dashboard/hebergeur/devis/nouveau/page.tsx` EN ENTIER (~500 lignes).

### 2A. Récupérer sejourDirectId en plus de demandeId

Dans `NouveauDevisContent`, après la ligne `const demandeId = searchParams.get('demandeId') ?? '';`, ajouter :

```typescript
  const sejourDirectId = searchParams.get('sejourDirectId') ?? '';
  const isDirect = !!sejourDirectId;
```

### 2B. Adapter le useEffect de chargement

Trouver le `useEffect` qui commence par `if (!user || !demandeId) return;`.

**Remplacer cette condition et le contenu du useEffect par :**

```typescript
  useEffect(() => {
    if (!user) return;
    // Mode DIRECT : pas de demandeId, on charge le centre + numéro
    if (isDirect) {
      Promise.all([
        getNextNumeroDevis(),
        getCatalogue().catch(() => [] as ProduitCatalogue[]),
        api.get(`/centres/mon-profil`).then(r => r.data),
      ])
        .then(([numData, cat, centre]) => {
          setNumeroDevis(numData.numero);
          setCatalogue(cat);
          setNomEntreprise(centre.nom ?? '');
          setAdresseEntreprise(`${centre.adresse ?? ''}, ${centre.codePostal ?? ''} ${centre.ville ?? ''}`);
          setSiretEntreprise(centre.siret ?? '');
          setEmailEntreprise(centre.email ?? '');
          setTelEntreprise(centre.telephone ?? '');
          if (centre.conditionsAnnulation) {
            setConditionsAnnulation(centre.conditionsAnnulation);
          }
        })
        .catch(() => setLoadError('Impossible de charger les informations du centre.'));
      return;
    }
    // Mode collaboratif : demandeId obligatoire
    if (!demandeId) return;
    Promise.all([
      getDemandeInfo(demandeId),
      getNextNumeroDevis(),
      getCatalogue().catch(() => [] as ProduitCatalogue[]),
    ])
      .then(([infoData, numData, cat]) => {
        setInfo(infoData);
        setNumeroDevis(numData.numero);
        setCatalogue(cat);
        setNomEntreprise(infoData.centre.nom);
        setAdresseEntreprise(`${infoData.centre.adresse}, ${infoData.centre.codePostal} ${infoData.centre.ville}`);
        setEmailEntreprise(infoData.centre.email ?? '');
        setTelEntreprise(infoData.centre.telephone ?? '');
        setLignes([makeLigneForm({ quantite: String(infoData.demande.nombreEleves ?? 1) })]);
        if (infoData.centre.conditionsAnnulation) {
          setConditionsAnnulation(infoData.centre.conditionsAnnulation);
        }
      })
      .catch(() => setLoadError('Impossible de charger les informations de la demande.'));
  }, [user, demandeId, isDirect, sejourDirectId]);
```

### 2C. Adapter handleSubmit pour le mode DIRECT

Trouver la fonction `handleSubmit` (ou le `onSubmit` / `handleCreate`). Elle appelle `createDevis(dto)`.

**Ajouter un branchement en haut de handleSubmit :**

Juste après `setSending(true);` et avant l'appel `createDevis`, ajouter :

```typescript
      // Mode DIRECT : appeler createDirectDevis au lieu de createDevis
      if (isDirect && sejourDirectId) {
        try {
          const { createDirectDevis } = await import('@/src/lib/devis');
          await createDirectDevis({
            sejourDirectId,
            montantTotal: String(calculs.montantTTC),
            montantParEleve: String(round2(calculs.montantTTC / (parseFloat(lignes[0]?.quantite) || 1))),
            description: description || undefined,
            conditionsAnnulation: conditionsAnnulation || undefined,
            nomEntreprise: nomEntreprise || undefined,
            adresseEntreprise: adresseEntreprise || undefined,
            siretEntreprise: siretEntreprise || undefined,
            emailEntreprise: emailEntreprise || undefined,
            telEntreprise: telEntreprise || undefined,
            tauxTva: calculs.montantHT > 0 ? round2((calculs.montantTVA / calculs.montantHT) * 100) : 0,
            montantHT: calculs.montantHT,
            montantTVA: calculs.montantTVA,
            montantTTC: calculs.montantTTC,
            pourcentageAcompte,
            montantAcompte: calculs.montantAcompte,
            numeroDevis: numeroDevis || undefined,
            lignes: lignes.filter(l => l.description.trim()).map((l) => {
              const qte = parseFloat(l.quantite) || 0;
              const puTTC = parseFloat(l.prixUnitaire) || 0;
              const tvaRate = parseFloat(l.tva) || 0;
              const puHT = round2(puTTC / (1 + tvaRate / 100));
              const totalHT = round2(puHT * qte);
              const totalTTC = round2(puTTC * qte);
              return { description: l.description, quantite: qte, prixUnitaire: puHT, tva: tvaRate, totalHT, totalTTC };
            }),
          });
          setSuccess(true);
          setTimeout(() => router.push(`/dashboard/sejour/${sejourDirectId}`), 1500);
          return;
        } catch (err: any) {
          setMutationError(err?.response?.data?.message ?? 'Erreur lors de la création du devis');
          setSending(false);
          return;
        }
      }
```

> **IMPORTANT** : Ce bloc doit être AVANT l'appel `createDevis` existant (flux collaboratif). Le `return` empêche l'exécution du code collaboratif.

> **IMPORTANT 2** : Vérifier le nom exact de la variable d'erreur (`setMutationError`, `setError`, ou `setLoadError`). Lire le code existant pour utiliser la bonne. Si c'est un état différent (par ex. il n'y a pas de `mutationError` mais un `error`), adapter.

### 2D. Adapter le lien retour (breadcrumb)

En haut de la page, il y a un lien "← Retour" qui pointe vers les devis ou la demande. Ajouter la condition :

Trouver le `<Link>` de retour en haut du composant. Modifier le `href` :

```typescript
href={isDirect ? `/dashboard/sejour/${sejourDirectId}` : `/dashboard/hebergeur/devis`}
```

### 2E. Masquer le header "Demande" en mode DIRECT

La page affiche un bloc avec les infos de la demande (titre, dates, nb élèves). En mode DIRECT, `info` est null. Vérifier que le rendu gère déjà `info === null` (en n'affichant rien). Si le code assume `info !== null` et crasherait, ajouter un `{info && (...)}` autour du bloc.

### 2F. Ajouter `description` en state si absent

Vérifier si la page a un champ `description` en state. Si ce n'est pas le cas (possible que le devis collaboratif n'ait pas de champ description dans le formulaire), ne pas l'ajouter — passer `undefined` dans le DTO.

---

## ÉTAPE 3 — Enrichir SejourCollabInfo pour le mode DIRECT

Lire `frontend/src/lib/collaboration.ts`, trouver l'interface `SejourCollabInfo`.

Ajouter ces champs à l'interface :

```typescript
  modeGestion?: string;       // 'DIRECT' | 'COLLABORATIF'
  natureSejour?: string;      // 'SEJOUR' | 'EVENEMENT'
  typeSejour?: string | null;
  clientNom?: string | null;
  clientPrenom?: string | null;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  clientOrganisation?: string | null;
```

---

## ÉTAPE 4 — Modifications sur la page séjour `[id]/page.tsx`

Lire `frontend/app/dashboard/sejour/[id]/page.tsx`. C'est un fichier de ~5000 lignes. Les modifications sont chirurgicales — chercher les patterns exacts.

### 4A. Computed : détection mode DIRECT

Après la ligne `const [sejour, setSejour] = useState<SejourCollabInfo | null>(null);` (dans le composant `CollaborationPage`), ajouter :

```typescript
  const isDirect = sejour?.modeGestion === 'DIRECT';
  const isEvenement = sejour?.natureSejour === 'EVENEMENT';
```

### 4B. Filtrage des onglets

Trouver le code qui rend la barre d'onglets (les boutons de tab). Il itère sur `TABS` ou une liste filtrée.

Chercher un pattern comme `TABS.filter(...)` ou `{TABS.map(t => ...)}` dans le JSX.

**Ajouter un filtrage avant le `.map` :**

```typescript
const visibleTabs = TABS.filter(t => {
  // En mode DIRECT, griser messages/journal (on ne les masque pas, on les grise en 4C)
  // Masquer groupes/projet si événement
  if (isEvenement && (t.key === 'groupes' || t.key === 'projet' || t.key === 'participants')) return false;
  // Masquer budget si DIRECT (pas de demande pour le budget collaboratif)
  if (isDirect && t.key === 'budget') return false;
  // Masquer projet si DIRECT
  if (isDirect && t.key === 'projet') return false;
  return true;
});
```

Puis remplacer `TABS.map(...)` ou `TABS.filter(...)` existant par `visibleTabs.map(...)` dans le JSX de la barre d'onglets.

**AUSSI** : modifier le label de l'onglet planning pour les événements. Dans le `.map`, changer le label affiché :

```typescript
{t.key === 'planning' && isEvenement ? 'Programme' : t.label}
```

### 4C. Griser les onglets Messages et Journal en mode DIRECT

Dans le rendu des boutons d'onglets, ajouter un style conditionnel :

```typescript
const isLockedTab = isDirect && (t.key === 'messages' || t.key === 'journal');
```

Et dans le `className` du bouton, ajouter `${isLockedTab ? 'opacity-40 cursor-not-allowed' : ''}`.

Dans le `onClick`, ajouter : `if (isLockedTab) return;`.

### 4D. Placeholder pour Messages/Journal en mode DIRECT

Trouver le rendu conditionnel `{tab === 'messages' && (` dans le JSX.

Ajouter un bloc AU DÉBUT de ce rendu :

```typescript
{tab === 'messages' && isDirect && (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
      <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    </div>
    <h3 className="text-sm font-semibold text-gray-900 mb-1">Messagerie</h3>
    <p className="text-xs text-gray-500 mb-4">Invitez l&apos;organisateur à collaborer pour échanger des messages.</p>
    <button className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white opacity-50 cursor-not-allowed" disabled>
      Inviter l&apos;organisateur (bientôt)
    </button>
  </div>
)}
```

Faire pareil pour `{tab === 'journal' && isDirect && (` avec un texte adapté ("Invitez l'organisateur pour publier dans le journal").

**IMPORTANT** : ces blocs doivent être AVANT le rendu existant des messages/journal. Ajouter une condition sur le rendu existant : `{tab === 'messages' && !isDirect && (` pour le rendu collaboratif.

### 4E. Onglet Devis — ajouter le lien "Créer un devis" en mode DIRECT

Trouver le rendu de l'onglet devis : `{tab === 'devis' && (`.

Ajouter ce bloc AU DÉBUT du rendu devis (avant le contenu existant) :

```typescript
{tab === 'devis' && isDirect && (
  <div className="space-y-4">
    {/* Lien vers création devis */}
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Devis</h3>
      <p className="text-xs text-gray-500 mb-4">Créez un devis pour ce séjour et envoyez-le au client pour signature.</p>
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/hebergeur/devis/nouveau?sejourDirectId=${id}`}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Créer un devis
        </Link>
      </div>
    </div>
  </div>
)}
```

> Ce bloc s'affiche quand il n'y a pas encore de devis. Plus tard (quand le devis existe), il sera remplacé par l'affichage du devis + bouton "Envoyer au client". Pour l'instant, c'est suffisant pour débloquer le flow.

**ET** ajouter la condition `!isDirect` sur le rendu devis collaboratif existant :

```typescript
{tab === 'devis' && !isDirect && (
  // ... le code existant de l'onglet devis collaboratif
)}
```

### 4F. Header — afficher client en mode DIRECT

Chercher l'endroit dans le header/barre contextuelle où s'affiche le nom de l'organisateur (`sejour.createur`). C'est probablement dans un bloc qui affiche le titre du séjour + le nom du créateur.

Ajouter une condition pour afficher les infos client en mode DIRECT :

```typescript
{isDirect ? (
  <span className="text-xs text-gray-500">
    {sejour?.clientOrganisation ?? sejour?.clientNom ?? 'Client non renseigné'}
    {sejour?.clientEmail && <> · {sejour.clientEmail}</>}
  </span>
) : sejour?.createur ? (
  <span className="text-xs text-gray-500">
    {sejour.createur.prenom} {sejour.createur.nom}
  </span>
) : null}
```

> **ATTENTION** : Ne pas modifier le header pour les séjours collaboratifs. C'est une condition additionnelle, pas un remplacement.

---

## ÉTAPE 5 — Build et vérification

```bash
cd frontend && npm run build
cd ../backend && npm run build
```

Vérifier : 0 erreur des deux côtés.

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `frontend/src/lib/devis.ts` | +2 fonctions (createDirectDevis, envoyerDevisDirect) + enrichir type Devis |
| `frontend/src/lib/collaboration.ts` | Enrichir SejourCollabInfo (modeGestion, natureSejour, client*) |
| `frontend/app/dashboard/hebergeur/devis/nouveau/page.tsx` | Support sejourDirectId (chargement, submit, lien retour) |
| `frontend/app/dashboard/sejour/[id]/page.tsx` | Onglets filtrés + grisés + placeholder Messages/Journal + lien "Créer devis" + header client |

## BUGS CASCADE ANTICIPÉS
1. **`getBudgetData()` crashe en mode DIRECT** car il cherche `demande.devis`. → On ne l'appelle pas : l'onglet budget est masqué en mode DIRECT (filtré dans `visibleTabs`).
2. **`getAccompagnateursBySejour()` retourne 403 ou []** pour un séjour DIRECT sans accompagnateurs. → Les accompagnateurs sont chargés dans le `useEffect` initial avec `.catch(() => {})` — déjà safe.
3. **La page devis/nouveau a un state `description`** — vérifier si c'est un state ou un champ non géré. En cas de doute, passer `undefined` dans le DTO.
4. **Le `handleSubmit` existant peut avoir un nom différent** (`handleCreate`, `onSubmit`, etc.) — CC doit lire le fichier pour trouver le bon nom.
5. **Le calcul `montantParEleve`** divise par la quantité de la première ligne. En mode DIRECT, c'est une approximation acceptable. Le backend accepte 0.
