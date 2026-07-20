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
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';
import { formatParticipants } from '@/src/lib/utils';

const fmt = (d: string | null) => !d ? 'Dates à définir' : new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'long', year: 'numeric',
});
const fmtMoney = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const puTTC = (puHT: number, tva: number) => Math.round(puHT * (1 + tva / 100) * 100) / 100;

type ActiveTab = 'signer' | 'direction' | 'upload';

export default function SignerDevisPage() {
  const { token } = useParams<{ token: string }>();
  const [devis, setDevis] = useState<DevisPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('signer');

  const [nomSignataire, setNomSignataire] = useState('');
  const [fonctionSignataire, setFonctionSignataire] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [contratOuvert, setContratOuvert] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  const [emailDirecteur, setEmailDirecteur] = useState('');
  const [sendingDirection, setSendingDirection] = useState(false);
  const [sentDirection, setSentDirection] = useState(false);

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1B4060] border-t-transparent" />
    </div>
  );

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

  // Données du PDF devis (génération client si aucun PDF n'a été uploadé par l'hébergeur).
  const pdfProps: DevisPDFProps = {
    typeDocument: 'DEVIS',
    numeroDocument: devis.numeroDevis ?? `DEV-${devis.id.substring(0, 8).toUpperCase()}`,
    dateDocument: devis.createdAt,
    dateValidite: new Date(new Date(devis.createdAt).getTime() + 30 * 86400000).toISOString(),
    nomEmetteur: devis.nomEntreprise ?? centre?.nom ?? '',
    adresseEmetteur: devis.adresseEntreprise ?? [centre?.adresse, centre?.codePostal, centre?.ville].filter(Boolean).join(', '),
    siretEmetteur: devis.siretEntreprise ?? centre?.siret ?? undefined,
    emailEmetteur: devis.emailEntreprise ?? centre?.email ?? undefined,
    telEmetteur: devis.telEntreprise ?? centre?.telephone ?? undefined,
    tvaEmetteur: centre?.tvaIntracommunautaire ?? undefined,
    ibanEmetteur: centre?.iban ?? undefined,
    nomDestinataire: [sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' '),
    etablissementNom: sejour?.clientOrganisation ?? undefined,
    adresseDestinataire:
      [
        sejour?.clientAdresse,
        [sejour?.clientCodePostal, sejour?.clientVille].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ') || undefined,
    emailDestinataire: sejour?.clientEmail ?? undefined,
    titreSejour: sejour?.titre ?? '',
    lieuSejour: sejour?.lieu ?? '',
    dateDebutSejour: sejour?.dateDebut ?? undefined,
    dateFinSejour: sejour?.dateFin ?? undefined,
    nombreEleves: sejour?.placesTotales ?? undefined,
    nombreAccompagnateurs: sejour?.nombreAccompagnateurs ?? undefined,
    lignes: devis.lignes.map((l) => ({
      description: l.description,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      tva: Number(l.tva),
      totalHT: Number(l.totalHT),
      totalTTC: Number(l.totalTTC),
    })),
    montantHT: devis.montantHT ?? 0,
    montantTVA: devis.montantTVA ?? 0,
    montantTTC: devis.montantTTC ?? 0,
    montantAcompte: devis.montantAcompte ?? undefined,
    montantSolde: devis.montantSolde ?? undefined,
    pourcentageAcompte: devis.pourcentageAcompte ?? undefined,
    conditionsAnnulation: devis.conditionsAnnulation ?? undefined,
    signatureDirecteur: devis.signatureDirecteur ?? null,
    logoUrl: centre?.logoUrl ?? null,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" showTagline={false} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1B4060] mb-1">
            {centre?.nom ?? 'Centre d\'hébergement'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Devis {devis.numeroDevis}</h1>

          <div className="mt-4 flex justify-center">
            {devis.documentUrl ? (
              <a
                href={devis.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-lg border border-[#1B4060] px-4 py-2 text-sm font-semibold text-[#1B4060] hover:bg-blue-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Télécharger le devis (PDF)
              </a>
            ) : (
              <DevisPDFButton
                data={pdfProps}
                filename={`devis-${(devis.numeroDevis ?? devis.id).substring(0, 12)}.pdf`}
                label="Télécharger le devis (PDF)"
              />
            )}
          </div>
        </div>

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
                <div><p className="text-xs text-gray-400">Participants</p><p className="font-medium">{formatParticipants(sejour.placesTotales, sejour.nombreAccompagnateurs)}</p></div>
              )}
              {sejour.typeSejour && (
                <div><p className="text-xs text-gray-400">Type</p><p className="font-medium">{sejour.typeSejour.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</p></div>
              )}
            </div>
          </div>
        )}

        {devis.lignes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Détail des prestations</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B4060] text-white">
                  <th className="text-left px-3 py-2 rounded-tl-lg">Description</th>
                  <th className="text-right px-3 py-2">Qté</th>
                  <th className="text-right px-3 py-2">PU TTC</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">TVA %</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">PU HT</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Total HT</th>
                  <th className="text-right px-3 py-2 rounded-tr-lg">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {devis.lignes.map((l, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2">{l.description}</td>
                    {/* Ligne option (qty 0) : le PU TTC reste la seule info pertinente — qté et totaux en « — » */}
                    <td className="px-3 py-2 text-right">{Number(l.quantite) === 0 ? '—' : l.quantite}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(puTTC(Number(l.prixUnitaire), Number(l.tva)))} €</td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">{Number(l.tva)} %</td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">{fmtMoney(Number(l.prixUnitaire))} €</td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">{Number(l.quantite) === 0 ? '—' : `${fmtMoney(Number(l.totalHT))} €`}</td>
                    <td className="px-3 py-2 text-right font-medium">{Number(l.quantite) === 0 ? '—' : `${fmtMoney(Number(l.totalTTC))} €`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

        {(devis.conditionsAnnulation || centre?.conditionsAnnulation) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Conditions d&apos;annulation</h2>
            <p className="text-xs text-gray-600 whitespace-pre-line">{devis.conditionsAnnulation || centre?.conditionsAnnulation}</p>
          </div>
        )}

        {devis.contratUrl && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Contrat</h2>
            <a
              href={`/api/devis/public/${token}/contrat`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setContratOuvert(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1B4060] px-4 py-2 text-sm font-semibold text-[#1B4060] hover:bg-blue-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Télécharger le contrat (PDF)
            </a>
            {!contratOuvert && (
              <p className="mt-2 text-xs text-amber-600 font-medium">
                Veuillez ouvrir et lire le contrat avant de signer.
              </p>
            )}
            {contratOuvert && (
              <p className="mt-2 text-xs text-green-600 font-medium">✓ Contrat consulté</p>
            )}
          </div>
        )}

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

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
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
                    disabled={!!devis.contratUrl && !contratOuvert}
                    className={`mt-0.5 h-4 w-4 rounded border-gray-300${!!devis.contratUrl && !contratOuvert ? ' opacity-50 cursor-not-allowed' : ''}`} />
                  <span className="text-xs text-gray-600">
                    {devis.contratUrl
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

      </div>
    </div>
  );
}
