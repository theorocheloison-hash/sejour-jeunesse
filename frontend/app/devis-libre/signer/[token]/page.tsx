'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getDevisLibrePublic, signerDevisLibre } from '@/src/lib/devis-libres';
import type { DevisLibre } from '@/src/lib/devis-libres';

export default function SignerDevisLibrePage() {
  const { token } = useParams<{ token: string }>();
  const [devis, setDevis] = useState<DevisLibre | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nomSignataire, setNomSignataire] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [contratTelecharge, setContratTelecharge] = useState(false);

  useEffect(() => {
    getDevisLibrePublic(token)
      .then((d) => {
        setDevis(d);
        if (!d.contratUrl) setContratTelecharge(true);
        if ((d as { signed?: boolean }).signed) setSigned(true);
      })
      .catch(() => setError('Ce lien de signature est invalide ou a déjà été utilisé.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!nomSignataire.trim() || !accepted || !contratTelecharge) return;
    setSigning(true);
    try {
      await signerDevisLibre(token, nomSignataire.trim());
      setSigned(true);
    } catch {
      setError('Une erreur est survenue lors de la signature. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const fmtMoney = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1B4060] border-t-transparent" />
    </div>
  );

  if (signed) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-4">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Devis signé !</h1>
        <p className="text-sm text-gray-500">
          Merci {nomSignataire}. Votre réservation est confirmée. Un email de confirmation vous a été envoyé.
        </p>
        <p className="text-sm text-gray-500 mt-2">À bientôt au Chalet Le Sauvageon !</p>
      </div>
    </div>
  );

  if (error || !devis) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-md w-full text-center">
        <p className="text-sm text-red-600">{error ?? 'Lien invalide.'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1B4060] mb-1">Chalet Le Sauvageon</p>
          <h1 className="text-2xl font-bold text-gray-900">Signature de devis</h1>
          <p className="text-sm text-gray-500 mt-1">{devis.numeroDevis}</p>
        </div>

        {/* Résumé événement */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Votre événement</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Type</p><p className="font-medium">{devis.typeEvenement ?? '—'}</p></div>
            <div><p className="text-xs text-gray-400">Client</p><p className="font-medium">{devis.nomClient} {devis.prenomClient ?? ''}</p></div>
            <div><p className="text-xs text-gray-400">Début</p><p className="font-medium">{fmt(devis.dateDebut)}</p></div>
            <div><p className="text-xs text-gray-400">Fin</p><p className="font-medium">{fmt(devis.dateFin)}</p></div>
          </div>
        </div>

        {/* Montants */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Montants</h2>
          <div className="space-y-2 text-sm">
            {devis.montantHT != null && (
              <div className="flex justify-between"><span className="text-gray-500">HT</span><span>{fmtMoney(devis.montantHT)} €</span></div>
            )}
            {devis.montantTVA != null && (
              <div className="flex justify-between"><span className="text-gray-500">TVA</span><span>{fmtMoney(devis.montantTVA)} €</span></div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-100 pt-2">
              <span>Total TTC</span>
              <span className="text-[#1B4060]">{fmtMoney(devis.montantTTC ?? 0)} €</span>
            </div>
            {devis.montantAcompte != null && (
              <div className="flex justify-between text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                <span>Acompte ({devis.pourcentageAcompte ?? 30}%)</span>
                <span className="font-semibold">{fmtMoney(devis.montantAcompte)} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Lignes */}
        {(devis.lignes ?? []).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Détail des prestations</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B4060] text-white">
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-right px-3 py-2">Qté</th>
                  <th className="text-right px-3 py-2">PU HT</th>
                  <th className="text-right px-3 py-2">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {(devis.lignes ?? []).map((l, i) => (
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

        {/* Contrat */}
        {devis.contratUrl && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Contrat</h2>
            <p className="text-xs text-gray-500 mb-3">
              Lisez attentivement le contrat avant de signer.
            </p>
            <a
              href={devis.contratUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setContratTelecharge(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1B4060] px-4 py-2 text-sm font-semibold text-[#1B4060] hover:bg-blue-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Télécharger le contrat PDF
            </a>
            {!contratTelecharge && (
              <p className="text-xs text-amber-600 mt-2">
                Veuillez télécharger et lire le contrat avant de signer.
              </p>
            )}
          </div>
        )}

        {/* Signature */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Signature électronique</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nom et prénom complet *
            </label>
            <input
              type="text"
              value={nomSignataire}
              onChange={e => setNomSignataire(e.target.value)}
              placeholder="Ex : Jean DUPONT"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4060]"
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              J&apos;ai lu et j&apos;accepte le contrat ainsi que les conditions générales de vente du Chalet Le Sauvageon.
              En signant, je m&apos;engage à respecter les conditions de réservation et de paiement indiquées.
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleSign}
            disabled={signing || !nomSignataire.trim() || !accepted || !contratTelecharge}
            className="w-full rounded-lg bg-[#1B4060] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {signing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : '✍️ Signer le devis'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Signature électronique sécurisée — votre adresse IP et la date sont enregistrées.
          </p>
        </div>
      </div>
    </div>
  );
}
