'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/app/components/Logo';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';

type InvitationDirecteurPublic = {
  etablissementUai: string | null;
  etablissementNom: string | null;
  sejourTitre: string | null;
  enseignantPrenom: string | null;
  organisationId: string | null;
  typeContexte: string;
  organisation: { id: string; nom: string; uai: string | null; ville: string | null } | null;
  signeAt: string | null;
  nomSignataire: string | null;
  devis: any | null;
};

function DevisPDFInline({ data }: { data: DevisPDFProps }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer');
        const { default: DevisPDF } = await import('@/src/components/pdf/DevisPDF');
        const blob = await pdf(<DevisPDF {...data} />).toBlob();
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-48 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        Génération du PDF...
      </div>
    </div>
  );

  if (!url) return null;

  return (
    <iframe
      src={url}
      className="w-full rounded-2xl border border-gray-200 shadow-sm"
      style={{ height: '70vh', minHeight: 500 }}
      title="Aperçu du devis"
    />
  );
}

function buildPdfProps(invitation: InvitationDirecteurPublic): DevisPDFProps | null {
  const d = invitation.devis;
  if (!d) return null;
  const c = d.centre ?? {};
  const enseignant = d.demande?.enseignant ?? null;
  const sejour = d.demande?.sejour ?? null;
  const orga = enseignant?.memberships?.[0]?.organisation ?? null;

  const htCalc = Number(d.montantHT) || (d.lignes ?? []).reduce((sum: number, l: any) => sum + Number(l.totalHT ?? 0), 0);
  const ttcCalc = Number(d.montantTTC) || Number(d.montantTotal) || 0;
  const tvaCalc = Number(d.montantTVA) || (ttcCalc - htCalc);

  return {
    typeDocument: 'DEVIS',
    numeroDocument: d.numeroDevis ?? `DEV-${(d.id ?? '').substring(0, 8).toUpperCase()}`,
    dateDocument: d.createdAt,
    dateValidite: d.createdAt ? new Date(new Date(d.createdAt).getTime() + 30 * 86400000).toISOString() : undefined,
    nomEmetteur: d.nomEntreprise ?? c.nom ?? '',
    adresseEmetteur: d.adresseEntreprise ?? [c.adresse, c.codePostal, c.ville].filter(Boolean).join(', '),
    siretEmetteur: d.siretEntreprise ?? c.siret ?? undefined,
    emailEmetteur: d.emailEntreprise ?? c.email ?? undefined,
    telEmetteur: d.telEntreprise ?? c.telephone ?? undefined,
    nomDestinataire: enseignant ? `${enseignant.prenom ?? ''} ${enseignant.nom ?? ''}`.trim() : '',
    etablissementNom: orga?.nom ?? invitation.etablissementNom ?? undefined,
    adresseDestinataire: orga?.ville ?? undefined,
    emailDestinataire: enseignant?.email ?? undefined,
    telDestinataire: enseignant?.telephone ?? undefined,
    titreSejour: sejour?.titre ?? invitation.sejourTitre ?? '',
    lieuSejour: sejour?.lieu ?? '',
    dateDebutSejour: sejour?.dateDebut,
    dateFinSejour: sejour?.dateFin,
    nombreEleves: sejour?.placesTotales,
    niveauClasse: sejour?.niveauClasse ?? undefined,
    lignes: (d.lignes ?? []).map((l: any) => ({
      description: l.description,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      tva: Number(l.tva),
      totalHT: Number(l.totalHT),
      totalTTC: Number(l.totalTTC),
    })),
    montantHT: htCalc,
    montantTVA: tvaCalc,
    montantTTC: ttcCalc,
    montantAcompte: d.montantAcompte ?? undefined,
    pourcentageAcompte: d.pourcentageAcompte ?? undefined,
    conditionsAnnulation: d.conditionsAnnulation ?? undefined,
    signatureDirecteur: d.signatureDirecteur ?? null,
    logoUrl: c.logoUrl ?? null,
  };
}

function InvitationDirectionContent() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<InvitationDirecteurPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [nomSignataire, setNomSignataire] = useState('');
  const [fonctionSignataire, setFonctionSignataire] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/invitations-directeur/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('not_found');
        }
        return res.json() as Promise<InvitationDirecteurPublic>;
      })
      .then((d) => {
        setData(d);
        if (d.signeAt) setSigned(true);
      })
      .catch(() => setLoadError('Ce lien n\'est plus valide ou a expiré.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!token || !nomSignataire.trim()) return;
    setSigning(true);
    setSignError(null);
    try {
      const res = await fetch(`${API_URL}/invitations-directeur/${token}/signer-sans-compte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomSignataire: nomSignataire.trim(),
          fonctionSignataire: fonctionSignataire.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setSigned(true);
    } catch {
      setSignError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-gray-500">{loadError ?? 'Cette invitation est introuvable.'}</p>
        </div>
      </main>
    );
  }

  const pdfProps = buildPdfProps(data);

  // Écran "déjà signé" / "succès"
  if (signed) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-6">
            <Logo size="md" showTagline={false} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
              <svg className="h-7 w-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {data.signeAt ? 'Devis déjà signé' : 'Devis signé avec succès'}
            </h1>
            <p className="text-sm text-gray-500 mb-4">
              {data.signeAt && data.nomSignataire ? (
                <>Signé par <strong className="text-gray-700">{data.nomSignataire}</strong> le {new Date(data.signeAt).toLocaleDateString('fr-FR')}.</>
              ) : (
                <>L'hébergeur et l'organisateur ont été notifiés.</>
              )}
            </p>
            <Link
              href={`/register/signataire?token=${token}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:underline"
            >
              Créer un compte signataire
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-6">
          <Logo size="md" showTagline={false} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Validation du devis</h1>
          <p className="text-sm text-gray-600 mb-2">
            <strong>{data.enseignantPrenom ?? 'L\'organisateur'}</strong> vous soumet le devis pour le séjour
            {' '}<strong>« {data.sejourTitre ?? '—'} »</strong> pour validation.
          </p>
          {(data.organisation?.nom || data.etablissementNom) && (
            <p className="text-xs text-gray-500">
              {data.organisation?.nom ?? data.etablissementNom}
              {data.organisation?.uai && <> — UAI : {data.organisation.uai}</>}
            </p>
          )}
        </div>

        {pdfProps && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Aperçu du devis</h2>
            <DevisPDFInline data={pdfProps} />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Signature électronique</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
              <input
                type="text"
                value={nomSignataire}
                onChange={(e) => setNomSignataire(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={signing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fonction</label>
              <input
                type="text"
                value={fonctionSignataire}
                onChange={(e) => setFonctionSignataire(e.target.value)}
                placeholder="ex : Directrice, Président(e)..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={signing}
              />
            </div>
            {signError && (
              <p className="text-sm text-red-600">{signError}</p>
            )}
            <button
              onClick={handleSign}
              disabled={signing || !nomSignataire.trim()}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signing ? 'Signature en cours...' : 'Je valide et signe ce devis'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Vous souhaitez accéder à un espace de direction ?{' '}
          <Link href={`/register/signataire?token=${token}`} className="text-purple-600 hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function InvitationDirectionPage() {
  return (
    <Suspense>
      <InvitationDirectionContent />
    </Suspense>
  );
}
