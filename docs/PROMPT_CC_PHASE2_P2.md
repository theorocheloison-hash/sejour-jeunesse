# PROMPT CC — Phase 2 Partie 2 : Frontend page publique signature devis

> **Contexte** : Phase 2 Partie 1 (backend endpoints publics) est déployée. On crée maintenant la page publique `/devis/signer/[token]` qui permet au client de :
> 1. Voir le résumé du devis (lignes, montants, centre, séjour)
> 2. Signer directement (option 1)
> 3. Envoyer à la direction pour signature (option 2)
> 4. Uploader un scan signé (option 3)
> 5. Voir les documents joints (brochure centre)
>
> **Référence** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md` section 3.5
> **Modèles existants** : `frontend/app/devis-libre/signer/[token]/page.tsx` (structure HTML) et `frontend/app/invitation-direction/[token]/page.tsx` (PDF inline)
> **Règle** : Lire ces deux fichiers AVANT d'écrire. Réutiliser le style LIAVO existant.

---

## ÉTAPE 1 — Fonctions API dans lib/collaboration.ts

Lire `frontend/src/lib/collaboration.ts`.

Ajouter en fin de fichier (ces fonctions utilisent `fetch` directement, PAS `api` d'axios, car elles sont publiques sans JWT) :

```typescript
// ── Devis public (signature sans compte) ─────────────────────────────────

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';

export interface DevisPublic {
  id: string;
  numeroDevis: string | null;
  statut: string;
  montantHT: number | null;
  montantTVA: number | null;
  montantTTC: number | null;
  tauxTva: number | null;
  pourcentageAcompte: number | null;
  montantAcompte: number | null;
  description: string | null;
  conditionsAnnulation: string | null;
  nomEntreprise: string | null;
  adresseEntreprise: string | null;
  siretEntreprise: string | null;
  emailEntreprise: string | null;
  telEntreprise: string | null;
  createdAt: string;
  isSigned: boolean;
  signatureDirecteur: string | null;
  nomSignataireDirecteur: string | null;
  dateSignatureDirecteur: string | null;
  signatureDocumentUrl: string | null;
  lignes: { description: string; quantite: number; prixUnitaire: number; tva: number; totalHT: number; totalTTC: number }[];
  centre: {
    nom: string; ville: string; adresse: string; codePostal: string | null;
    siret: string | null; telephone: string | null; email: string | null;
    tvaIntracommunautaire: string | null; iban: string | null;
    brochureUrl: string | null; conditionsAnnulation: string | null;
  } | null;
  sejour: {
    id: string; titre: string; lieu: string;
    dateDebut: string; dateFin: string; placesTotales: number;
    clientNom: string | null; clientPrenom: string | null; clientEmail: string | null;
    clientOrganisation: string | null; natureSejour: string; typeSejour: string | null;
  } | null;
}

export async function getDevisPublic(token: string): Promise<DevisPublic> {
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}`);
  if (!res.ok) throw new Error('Lien invalide');
  return res.json();
}

export async function signerDevisPublic(
  token: string,
  body: { nomSignataire: string; fonctionSignataire?: string; confirmation: boolean },
): Promise<{ success: boolean }> {
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}/signer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erreur lors de la signature');
  }
  return res.json();
}

export async function envoyerDevisDirection(
  token: string,
  body: { emailDirecteur: string; nomDirecteur?: string },
): Promise<{ success: boolean }> {
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}/envoyer-direction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erreur lors de l\'envoi');
  }
  return res.json();
}

export async function uploadSignaturePublic(
  token: string,
  file: File,
): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}/upload-signature`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erreur lors de l\'upload');
  }
  return res.json();
}
```

---

## ÉTAPE 2 — Créer la page `/devis/signer/[token]/page.tsx`

Créer le dossier et fichier : `frontend/app/devis/signer/[token]/page.tsx`

> **Design** : S'inspirer de `devis-libre/signer/[token]/page.tsx` pour le style (cards blanches, arrondis, couleurs LIAVO) et de `invitation-direction/[token]/page.tsx` pour la structure multi-sections.
> **Logo** : Utiliser `import { Logo } from '@/app/components/Logo';` comme dans invitation-direction.
> **Pas de JWT** : toutes les requêtes utilisent `fetch` via les fonctions ajoutées en étape 1.

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/app/components/Logo';
import {
  getDevisPublic,
  signerDevisPublic,
  envoyerDevisDirection,
  uploadSignaturePublic,
} from '@/src/lib/collaboration';
import type { DevisPublic } from '@/src/lib/collaboration';

const fmt = (d: string) => new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'long', year: 'numeric',
});
const fmtMoney = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

type ActiveTab = 'signer' | 'direction' | 'upload';

export default function SignerDevisPage() {
  const { token } = useParams<{ token: string }>();
  const [devis, setDevis] = useState<DevisPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab active
  const [activeTab, setActiveTab] = useState<ActiveTab>('signer');

  // Option 1 : signature directe
  const [nomSignataire, setNomSignataire] = useState('');
  const [fonctionSignataire, setFonctionSignataire] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  // Option 2 : envoyer direction
  const [emailDirecteur, setEmailDirecteur] = useState('');
  const [sendingDirection, setSendingDirection] = useState(false);
  const [sentDirection, setSentDirection] = useState(false);

  // Option 3 : upload scan
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    getDevisPublic(token)
      .then((d) => {
        setDevis(d);
        if (d.isSigned) setSigned(true);
      })
      .catch(() => setError('Ce lien de signature est invalide ou a expiré.'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Handlers ──

  const handleSign = async () => {
    if (!nomSignataire.trim() || !accepted) return;
    setSigning(true);
    setError(null);
    try {
      await signerDevisPublic(token, {
        nomSignataire: nomSignataire.trim(),
        fonctionSignataire: fonctionSignataire.trim() || undefined,
        confirmation: true,
      });
      setSigned(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la signature');
    } finally {
      setSigning(false);
    }
  };

  const handleSendDirection = async () => {
    if (!emailDirecteur.trim()) return;
    setSendingDirection(true);
    setError(null);
    try {
      await envoyerDevisDirection(token, { emailDirecteur: emailDirecteur.trim() });
      setSentDirection(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSendingDirection(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      await uploadSignaturePublic(token, uploadFile);
      setUploaded(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // ── Rendu : loading ──

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1B4060] border-t-transparent" />
    </div>
  );

  // ── Rendu : succès (signé / uploadé) ──

  if (signed || uploaded) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-4">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">
          {uploaded ? 'Document signé reçu !' : 'Devis signé !'}
        </h1>
        <p className="text-sm text-gray-500">
          {uploaded
            ? 'Votre document signé a bien été reçu. L\'hébergeur a été notifié.'
            : `Merci${nomSignataire ? ` ${nomSignataire}` : ''}. Votre réservation est confirmée. Un email de confirmation vous a été envoyé.`
          }
        </p>
        {devis?.centre && (
          <p className="text-sm text-gray-500 mt-2">À bientôt — {devis.centre.nom}</p>
        )}
      </div>
    </div>
  );

  // ── Rendu : envoyé à la direction ──

  if (sentDirection) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 mb-4">
          <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Invitation envoyée</h1>
        <p className="text-sm text-gray-500">
          Un email a été envoyé à <strong>{emailDirecteur}</strong> pour valider et signer le devis.
        </p>
      </div>
    </div>
  );

  // ── Rendu : erreur ──

  if (error && !devis) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-md w-full text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    </div>
  );

  if (!devis) return null;

  const sejour = devis.sejour;
  const centre = devis.centre;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" showTagline={false} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1B4060] mb-1">
            {centre?.nom ?? 'Centre d\'hébergement'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Devis {devis.numeroDevis}</h1>
        </div>

        {/* Résumé séjour */}
        {sejour && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">{sejour.titre}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {sejour.clientOrganisation && (
                <div className="col-span-2"><p className="text-xs text-gray-400">Structure</p><p className="font-medium">{sejour.clientOrganisation}</p></div>
              )}
              <div><p className="text-xs text-gray-400">Début</p><p className="font-medium">{fmt(sejour.dateDebut)}</p></div>
              <div><p className="text-xs text-gray-400">Fin</p><p className="font-medium">{fmt(sejour.dateFin)}</p></div>
              {sejour.placesTotales > 0 && (
                <div><p className="text-xs text-gray-400">Participants</p><p className="font-medium">{sejour.placesTotales}</p></div>
              )}
              {sejour.typeSejour && (
                <div><p className="text-xs text-gray-400">Type</p><p className="font-medium">{sejour.typeSejour.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</p></div>
              )}
            </div>
          </div>
        )}

        {/* Lignes du devis */}
        {devis.lignes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Détail des prestations</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B4060] text-white">
                  <th className="text-left px-3 py-2 rounded-tl-lg">Description</th>
                  <th className="text-right px-3 py-2">Qté</th>
                  <th className="text-right px-3 py-2">PU HT</th>
                  <th className="text-right px-3 py-2 rounded-tr-lg">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {devis.lignes.map((l, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2 text-right">{l.quantite}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(l.prixUnitaire)} €</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMoney(l.totalTTC)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Montants */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Montants</h2>
          <div className="space-y-2 text-sm">
            {devis.montantHT != null && (
              <div className="flex justify-between"><span className="text-gray-500">HT</span><span>{fmtMoney(devis.montantHT)} €</span></div>
            )}
            {devis.montantTVA != null && (
              <div className="flex justify-between"><span className="text-gray-500">TVA ({devis.tauxTva ?? 0}%)</span><span>{fmtMoney(devis.montantTVA)} €</span></div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-100 pt-2">
              <span>Total TTC</span>
              <span className="text-[#1B4060]">{fmtMoney(devis.montantTTC ?? 0)} €</span>
            </div>
            {devis.montantAcompte != null && devis.montantAcompte > 0 && (
              <div className="flex justify-between text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                <span>Acompte ({devis.pourcentageAcompte ?? 30}%)</span>
                <span className="font-semibold">{fmtMoney(devis.montantAcompte)} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Conditions d'annulation */}
        {(devis.conditionsAnnulation || centre?.conditionsAnnulation) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Conditions d&apos;annulation</h2>
            <p className="text-xs text-gray-600 whitespace-pre-line">{devis.conditionsAnnulation || centre?.conditionsAnnulation}</p>
          </div>
        )}

        {/* Documents joints */}
        {centre?.brochureUrl && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Documents</h2>
            <a
              href={centre.brochureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1B4060] px-4 py-2 text-sm font-semibold text-[#1B4060] hover:bg-blue-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Brochure {centre.nom}
            </a>
          </div>
        )}

        {/* Erreur contextuelle */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* ── Bloc signature : 3 onglets ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {([
              { key: 'signer' as const, label: 'Signer en ligne', icon: '✍️' },
              { key: 'direction' as const, label: 'Envoyer à la direction', icon: '📨' },
              { key: 'upload' as const, label: 'Upload document signé', icon: '📄' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setError(null); }}
                className={`flex-1 px-4 py-3 text-xs font-medium text-center transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#1B4060] border-b-2 border-[#1B4060] bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Option 1 : Signer directement */}
            {activeTab === 'signer' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Signez le devis électroniquement en renseignant votre nom.</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom et prénom complet *</label>
                  <input type="text" value={nomSignataire} onChange={e => setNomSignataire(e.target.value)}
                    placeholder="Ex : Jean DUPONT"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4060]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fonction (optionnel)</label>
                  <input type="text" value={fonctionSignataire} onChange={e => setFonctionSignataire(e.target.value)}
                    placeholder="Ex : Directrice, Enseignant responsable…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4060]" />
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                  <span className="text-xs text-gray-600">
                    J&apos;ai lu et j&apos;accepte les conditions du devis et les conditions d&apos;annulation.
                    En signant, je m&apos;engage à respecter les conditions de réservation et de paiement.
                  </span>
                </label>
                <button onClick={handleSign}
                  disabled={signing || !nomSignataire.trim() || !accepted}
                  className="w-full rounded-lg bg-[#1B4060] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {signing ? 'Signature en cours…' : '✍️ Signer le devis'}
                </button>
              </div>
            )}

            {/* Option 2 : Envoyer à la direction */}
            {activeTab === 'direction' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Envoyez le devis à votre direction (directeur, président, responsable) pour validation et signature.
                  Le signataire recevra un email avec un lien pour consulter et signer le devis.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email du signataire *</label>
                  <input type="email" value={emailDirecteur} onChange={e => setEmailDirecteur(e.target.value)}
                    placeholder="direction@etablissement.fr"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4060]" />
                </div>
                <button onClick={handleSendDirection}
                  disabled={sendingDirection || !emailDirecteur.trim()}
                  className="w-full rounded-lg bg-[#1B4060] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {sendingDirection ? 'Envoi en cours…' : '📨 Envoyer pour signature'}
                </button>
              </div>
            )}

            {/* Option 3 : Upload scan signé */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Téléchargez le devis, faites-le signer manuellement, puis uploadez le scan du document signé (PDF uniquement).
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#1B4060] hover:bg-blue-50/30 transition-colors"
                >
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(uploadFile.size / 1024 / 1024).toFixed(2)} Mo</p>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                        className="mt-2 text-xs text-red-500 hover:underline">Supprimer</button>
                    </div>
                  ) : (
                    <div>
                      <svg className="mx-auto h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-gray-500">Cliquez pour sélectionner le PDF signé</p>
                      <p className="text-xs text-gray-400 mt-1">PDF uniquement, 10 Mo max</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                </div>
                <button onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                  className="w-full rounded-lg bg-[#1B4060] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {uploading ? 'Envoi en cours…' : '📄 Envoyer le document signé'}
                </button>
              </div>
            )}
          </div>

          <div className="px-6 pb-4">
            <p className="text-xs text-gray-400 text-center">
              Signature électronique sécurisée — votre adresse IP et la date sont enregistrées conformément à la réglementation.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
```

---

## ÉTAPE 3 — Build et vérification

```bash
cd frontend
npm run build
```

Vérifier : 0 erreur. La page `/devis/signer/[token]` doit être accessible sans authentification (pas de layout protégé).

**Vérifier** que le dossier `frontend/app/devis/` n'a pas de `layout.tsx` qui ajouterait un guard JWT. Si un layout parent (`app/layout.tsx`) n'ajoute pas de guard, c'est OK. Si un layout intermédiaire ajoute un guard, créer un `frontend/app/devis/layout.tsx` minimal :

```typescript
export default function DevisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `frontend/src/lib/collaboration.ts` | +5 exports : DevisPublic type, getDevisPublic, signerDevisPublic, envoyerDevisDirection, uploadSignaturePublic |
| `frontend/app/devis/signer/[token]/page.tsx` | CRÉÉ — page publique signature avec 3 onglets |

## FICHIERS À NE PAS MODIFIER
- `frontend/app/devis-libre/signer/**` — sera supprimé en Phase 5
- `frontend/app/invitation-direction/**` — fonctionne tel quel pour la délégation direction
