'use client';

import { useState, useRef } from 'react';

type ActiveTab = 'signer' | 'direction' | 'upload';

interface SignatureDevisPanelProps {
  contratUrl: string | null;
  /** Possédé par le parent : le lien « Télécharger le contrat » reste chez lui. */
  contratOuvert: boolean;
  /** Onglets proposés (défaut : les trois). L'onglet actif initial est le premier disponible. */
  ongletsDisponibles?: ActiveTab[];
  onSigner: (body: { nomSignataire: string; fonctionSignataire?: string; confirmation: true }) => Promise<void>;
  onEnvoyerDirection: (body: { emailDirecteur: string }) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}

/**
 * Panneau de signature du devis (3 gestes : signer en ligne, envoyer à la direction,
 * uploader un scan). Partagé entre la page publique tokenisée et l'espace connecté :
 * il ne connaît ni token ni id, seulement les trois callbacks de soumission.
 */
export default function SignatureDevisPanel({
  contratUrl,
  contratOuvert,
  ongletsDisponibles = ['signer', 'direction', 'upload'],
  onSigner,
  onEnvoyerDirection,
  onUpload,
}: SignatureDevisPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(ongletsDisponibles[0]);
  const [error, setError] = useState<string | null>(null);

  const [nomSignataire, setNomSignataire] = useState('');
  const [fonctionSignataire, setFonctionSignataire] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  const [emailDirecteur, setEmailDirecteur] = useState('');
  const [sendingDirection, setSendingDirection] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSign = async () => {
    if (!nomSignataire.trim() || !accepted) return;
    setSigning(true);
    setError(null);
    try {
      await onSigner({
        nomSignataire: nomSignataire.trim(),
        fonctionSignataire: fonctionSignataire.trim() || undefined,
        confirmation: true,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de la signature');
    } finally {
      setSigning(false);
    }
  };

  const handleSendDirection = async () => {
    if (!emailDirecteur.trim()) return;
    setSendingDirection(true);
    setError(null);
    try {
      await onEnvoyerDirection({ emailDirecteur: emailDirecteur.trim() });
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setSendingDirection(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(uploadFile);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const tabs = ([
    { key: 'signer' as const, label: 'Signer en ligne', icon: '✍️' },
    { key: 'direction' as const, label: 'Envoyer à la direction', icon: '📨' },
    { key: 'upload' as const, label: 'Upload document signé', icon: '📄' },
  ]).filter(t => ongletsDisponibles.includes(t.key));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {error && (
        <div className="m-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
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
      )}

      <div className="p-6">
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
                disabled={!!contratUrl && !contratOuvert}
                className={`mt-0.5 h-4 w-4 rounded border-gray-300${!!contratUrl && !contratOuvert ? ' opacity-50 cursor-not-allowed' : ''}`} />
              <span className="text-xs text-gray-600">
                {contratUrl
                  ? "J'ai lu et j'accepte le contrat, les conditions du devis et les conditions d'annulation. En signant, je m'engage à respecter les conditions de réservation et de paiement."
                  : "J'ai lu et j'accepte les conditions du devis et les conditions d'annulation. En signant, je m'engage à respecter les conditions de réservation et de paiement."}
              </span>
            </label>
            <button onClick={handleSign}
              disabled={signing || !nomSignataire.trim() || !accepted}
              className="w-full rounded-lg bg-[#1B4060] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
              {signing ? 'Signature en cours…' : '✍️ Signer le devis'}
            </button>
          </div>
        )}

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
  );
}
