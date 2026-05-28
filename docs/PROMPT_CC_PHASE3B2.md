# PROMPT CC — Phase 3B-2 : Afficher le devis DIRECT + bouton "Envoyer au client"

> **Contexte** : Le devis DIRECT se crée correctement (Phase 3B-1). Mais l'onglet Devis de la page séjour DIRECT affiche toujours le placeholder "Créer un devis" même quand un devis existe. Cette phase ajoute :
> 1. Chargement du devis DIRECT existant
> 2. Affichage résumé du devis (lignes, montants, statut)
> 3. Bouton "Envoyer au client par email" (appelle envoyerDevisDirect)
> 4. Bouton "Supprimer le séjour" dans le header
>
> **Règle** : Lire chaque fichier AVANT de le modifier.

---

## ÉTAPE 1 — Fonction API pour charger les devis d'un séjour DIRECT

Lire `frontend/src/lib/devis.ts`.

Ajouter cette fonction en fin de fichier :

```typescript
export async function getDevisForSejourDirect(sejourDirectId: string): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>('/devis/mes-devis');
  // Filtrer côté client les devis liés à ce séjour DIRECT
  return data.filter(d => (d as any).sejourDirectId === sejourDirectId);
}
```

> Note : `getMesDevis` retourne tous les devis du centre. On filtre côté client par `sejourDirectId`. C'est acceptable en V1 (quelques dizaines de devis max). Un endpoint dédié viendra si besoin.

---

## ÉTAPE 2 — Modifier l'onglet Devis DIRECT dans la page séjour

Lire `frontend/app/dashboard/sejour/[id]/page.tsx`. C'est un fichier de ~5000 lignes.

### 2A. Ajouter les imports

En haut du fichier, dans les imports depuis `@/src/lib/devis`, ajouter `envoyerDevisDirect` et `getDevisForSejourDirect`. Chercher la ligne d'import existante de `@/src/lib/devis` (il y a probablement déjà `getDossierPedagogique` importé depuis `@/src/lib/sejour`).

Si `@/src/lib/devis` n'est pas déjà importé dans ce fichier, ajouter :

```typescript
import { getDevisForSejourDirect, envoyerDevisDirect } from '@/src/lib/devis';
import type { Devis as DevisType } from '@/src/lib/devis';
```

Si `@/src/lib/devis` est déjà importé (vérifier !), ajouter les fonctions à l'import existant et utiliser un alias si `Devis` entre en conflit de nom.

### 2B. Ajouter le state pour le devis DIRECT

Dans le composant `CollaborationPage`, après les states existants (chercher le bloc de déclarations `useState`), ajouter :

```typescript
  // Devis DIRECT
  const [directDevis, setDirectDevis] = useState<DevisType | null>(null);
  const [directDevisLoading, setDirectDevisLoading] = useState(false);
  const [envoyerLoading, setEnvoyerLoading] = useState(false);
  const [envoyerSuccess, setEnvoyerSuccess] = useState(false);
```

### 2C. Charger le devis DIRECT quand on clique sur l'onglet Devis

Chercher le `useEffect` qui charge les données des onglets quand `tab` change. Il y a probablement un pattern comme :

```typescript
useEffect(() => {
  if (tab === 'messages') loadMessages();
  if (tab === 'planning') loadPlanning();
  // etc.
}, [tab, ...]);
```

**Ajouter dans ce useEffect :**

```typescript
  if (tab === 'devis' && isDirect && id) {
    setDirectDevisLoading(true);
    getDevisForSejourDirect(id)
      .then(devis => setDirectDevis(devis[0] ?? null))
      .catch(() => {})
      .finally(() => setDirectDevisLoading(false));
  }
```

> Si le pattern est différent (pas de useEffect centralisé sur `tab`), ajouter un useEffect dédié :
> ```typescript
> useEffect(() => {
>   if (tab !== 'devis' || !isDirect || !id) return;
>   setDirectDevisLoading(true);
>   getDevisForSejourDirect(id)
>     .then(devis => setDirectDevis(devis[0] ?? null))
>     .catch(() => {})
>     .finally(() => setDirectDevisLoading(false));
> }, [tab, isDirect, id]);
> ```

### 2D. Remplacer le placeholder statique par un rendu dynamique

Chercher le bloc `{tab === 'devis' && isDirect && (` qui a été ajouté en Phase 3B-1. C'est le placeholder statique avec "Créer un devis".

**Remplacer ce bloc ENTIÈREMENT par :**

```typescript
{tab === 'devis' && isDirect && (
  <div className="space-y-4">
    {directDevisLoading ? (
      <div className="flex justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    ) : directDevis ? (
      <>
        {/* Résumé du devis existant */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Devis {directDevis.numeroDevis ?? ''}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Créé le {new Date(directDevis.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              directDevis.statut === 'EN_ATTENTE' ? 'bg-orange-100 text-orange-700' :
              directDevis.statut === 'SELECTIONNE' ? 'bg-green-100 text-green-700' :
              directDevis.statut === 'SIGNE_DIRECTION' ? 'bg-purple-100 text-purple-700' :
              directDevis.statut === 'EN_ATTENTE_VALIDATION' ? 'bg-blue-100 text-blue-700' :
              directDevis.statut === 'FACTURE_ACOMPTE' ? 'bg-indigo-100 text-indigo-700' :
              directDevis.statut === 'FACTURE_SOLDE' ? 'bg-teal-100 text-teal-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {directDevis.statut === 'EN_ATTENTE' ? 'Brouillon' :
               directDevis.statut === 'SELECTIONNE' ? 'Signé' :
               directDevis.statut === 'SIGNE_DIRECTION' ? 'Signé direction' :
               directDevis.statut === 'EN_ATTENTE_VALIDATION' ? 'En attente direction' :
               directDevis.statut === 'FACTURE_ACOMPTE' ? 'Facture acompte' :
               directDevis.statut === 'FACTURE_SOLDE' ? 'Facture solde' :
               directDevis.statut}
            </span>
          </div>

          {/* Lignes du devis */}
          {(directDevis.lignes ?? []).length > 0 && (
            <table className="w-full text-xs mb-4">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Qté</th>
                  <th className="text-right py-2 text-gray-500 font-medium">PU TTC</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {(directDevis.lignes ?? []).map((l, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{l.description}</td>
                    <td className="py-2 text-right">{l.quantite}</td>
                    <td className="py-2 text-right">{(l.prixUnitaire + l.prixUnitaire * (l.tva / 100)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                    <td className="py-2 text-right font-medium">{l.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Montants */}
          <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
            {directDevis.montantHT != null && (
              <div className="flex justify-between"><span className="text-gray-500">HT</span><span>{Number(directDevis.montantHT).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></div>
            )}
            {directDevis.montantTVA != null && (
              <div className="flex justify-between"><span className="text-gray-500">TVA</span><span>{Number(directDevis.montantTVA).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total TTC</span>
              <span className="text-[var(--color-primary)]">{Number(directDevis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
            </div>
            {directDevis.montantAcompte != null && Number(directDevis.montantAcompte) > 0 && (
              <div className="flex justify-between text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                <span>Acompte ({directDevis.pourcentageAcompte ?? 30}%)</span>
                <span className="font-semibold">{Number(directDevis.montantAcompte).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Bouton Envoyer au client */}
          {sejour?.clientEmail && directDevis.statut === 'EN_ATTENTE' && (
            <button
              onClick={async () => {
                setEnvoyerLoading(true);
                setEnvoyerSuccess(false);
                try {
                  await envoyerDevisDirect(directDevis.id);
                  setEnvoyerSuccess(true);
                  // Recharger le devis pour mettre à jour le statut
                  const devis = await getDevisForSejourDirect(id);
                  setDirectDevis(devis[0] ?? null);
                } catch { setMutationError('Erreur lors de l\'envoi du devis'); }
                finally { setEnvoyerLoading(false); }
              }}
              disabled={envoyerLoading}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {envoyerLoading ? 'Envoi en cours…' : `📨 Envoyer à ${sejour.clientEmail}`}
            </button>
          )}

          {/* Message si pas d'email client */}
          {!sejour?.clientEmail && directDevis.statut === 'EN_ATTENTE' && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Renseignez l&apos;email du client pour pouvoir envoyer le devis par email.
            </p>
          )}

          {/* Confirmation envoi */}
          {envoyerSuccess && (
            <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
              ✅ Devis envoyé par email ! Le client recevra un lien pour consulter et signer le devis.
            </p>
          )}

          {/* Lien vers page modification */}
          <Link
            href={`/dashboard/hebergeur/devis/nouveau?sejourDirectId=${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Modifier le devis
          </Link>
        </div>

        {/* Signature reçue */}
        {(directDevis.statut === 'SELECTIONNE' || directDevis.statut === 'SIGNE_DIRECTION') && directDevis.nomSignataireDirecteur && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-green-800">✅ Devis signé</p>
            <p className="text-xs text-green-700 mt-1">
              Signé par {directDevis.nomSignataireDirecteur}
              {directDevis.dateSignatureDirecteur && ` le ${new Date(directDevis.dateSignatureDirecteur).toLocaleDateString('fr-FR')}`}
            </p>
          </div>
        )}
      </>
    ) : (
      /* Pas de devis → placeholder création */
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Devis</h3>
        <p className="text-xs text-gray-500 mb-4">Créez un devis pour ce séjour et envoyez-le au client pour signature.</p>
        <Link
          href={`/dashboard/hebergeur/devis/nouveau?sejourDirectId=${id}`}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Créer un devis
        </Link>
      </div>
    )}
  </div>
)}
```

### 2E. Ajouter la vérification de mutationError

Vérifier que `setMutationError` existe bien dans le composant (chercher `mutationError` dans les states). Si oui, rien à faire. Si le nom est différent (par ex `setError`), adapter le code ci-dessus.

Vérifier aussi que `mutationError` est affiché quelque part dans le JSX (il y a probablement déjà un bloc d'affichage des erreurs). Si pas, ajouter après le bloc des actions :

```typescript
{mutationError && (
  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{mutationError}</div>
)}
```

---

## ÉTAPE 3 — Bouton "Supprimer le séjour" dans le header

Toujours dans `frontend/app/dashboard/sejour/[id]/page.tsx`.

### 3A. Ajouter l'import

Vérifier que `deleteSejourDirect` est importé depuis `@/src/lib/collaboration`. Si non, ajouter à l'import existant :

```typescript
import { ..., deleteSejourDirect } from '@/src/lib/collaboration';
```

### 3B. Ajouter le bouton dans le header

Chercher le header de la page — c'est le bloc qui affiche le titre du séjour, le badge statut, les dates. Il y a probablement un bouton "Modifier" à côté du titre.

Ajouter un bouton "Supprimer" conditionnel APRÈS le bouton Modifier, uniquement en mode DIRECT :

```typescript
{isDirect && (
  <button
    onClick={async () => {
      if (!confirm('Supprimer ce séjour ? Le client CRM sera conservé.')) return;
      try {
        await deleteSejourDirect(id);
        router.push('/dashboard/hebergeur/planning');
      } catch {
        setMutationError('Erreur lors de la suppression');
      }
    }}
    className="text-xs text-red-500 hover:text-red-700 hover:underline"
  >
    Supprimer
  </button>
)}
```

---

## ÉTAPE 4 — Build et vérification

```bash
cd frontend && npm run build
```

Vérifier : 0 erreur.

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `frontend/src/lib/devis.ts` | +1 fonction getDevisForSejourDirect |
| `frontend/app/dashboard/sejour/[id]/page.tsx` | Import devis, state directDevis, chargement, rendu dynamique onglet Devis DIRECT (résumé + bouton envoyer + signature), bouton supprimer |

## BUGS CASCADE ANTICIPÉS
1. **`getMesDevis` retourne les devis sans `sejourDirectId` dans le payload** — Le backend `getMesDevis` fait un include sur `demande.enseignant` et `demande.sejour` mais PAS sur `sejourDirect`. Le filtre `d.sejourDirectId` côté client pourrait ne pas fonctionner si le champ n'est pas retourné. **FIX** : Si le filtre ne marche pas, CC doit vérifier le retour de `getMesDevis` dans le backend et ajouter `sejourDirectId` au select/include.
2. **Conflit de nom `Devis`** — Le fichier importe peut-être déjà un type `Devis` depuis un autre module. L'alias `DevisType` évite ce conflit.
3. **`setMutationError` peut ne pas exister** — CC doit vérifier le nom exact du state d'erreur dans le composant.
4. **Le bouton "Modifier le devis"** pointe vers `devis/nouveau?sejourDirectId=xxx`. Si un devis existe déjà, `createDirectDevis` va rejeter ("Un devis actif existe déjà"). Il faudrait pointer vers la page de modification. **Pour V1 c'est acceptable** — le lien sera adapté plus tard pour pointer vers `/devis/[id]/modifier`.
