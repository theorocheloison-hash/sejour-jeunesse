'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  ClipboardCheck,
} from 'lucide-react';
import {
  getAccompagnateurPublique,
  signerAccompagnateur,
  type AccompagnateurPublique,
} from '@/src/lib/accompagnateur';

const RGPD_TEXT = `Conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679) et à la loi Informatique et Libertés du 6 janvier 1978 modifiée, les données personnelles collectées dans ce formulaire sont traitées par l'établissement scolaire responsable du séjour. Elles sont utilisées dans le strict cadre de l'organisation du séjour scolaire. Ces données ne seront ni cédées, ni vendues, ni utilisées à d'autres fins. Vous pouvez accéder, rectifier ou supprimer vos données en contactant l'établissement scolaire.`;

export default function SignerOrdreMissionPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<AccompagnateurPublique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [signatureNom, setSignatureNom] = useState('');
  const [moyenTransport, setMoyenTransport] = useState('');
  const [contactUrgenceNom, setContactUrgenceNom] = useState('');
  const [contactUrgenceTel, setContactUrgenceTel] = useState('');
  const [rgpdAccepte, setRgpdAccepte] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    getAccompagnateurPublique(token)
      .then((res) => {
        setData(res);
        if (res.signeeAt) setSigned(true);
        setSignatureNom(`${res.prenom} ${res.nom}`);
      })
      .catch(() => setError('Lien invalide ou ordre de mission introuvable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!token || !signatureNom.trim() || !rgpdAccepte) return;
    setSigning(true);
    try {
      await signerAccompagnateur(token, {
        signatureNom: signatureNom.trim(),
        rgpdAccepte: true,
        moyenTransport: moyenTransport || undefined,
        contactUrgenceNom: contactUrgenceNom.trim() || undefined,
        contactUrgenceTel: contactUrgenceTel.trim() || undefined,
      });
      setSigned(true);
    } catch {
      setError('Erreur lors de la signature. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#003189]/5 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#003189] border-t-transparent" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#003189]/5 to-white px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <ShieldCheck className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900">Lien invalide</h2>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { sejour, hebergement } = data;
  const formValid = signatureNom.trim() && rgpdAccepte;

  // Computed values for the document
  const annee = new Date(sejour.dateDebut).getFullYear();
  const idShort = data.id.slice(0, 4).toUpperCase();
  const numOM = `OM-${annee}-${idShort}`;
  const msPerDay = 86_400_000;
  const nuits = Math.round(
    (new Date(sejour.dateFin).getTime() - new Date(sejour.dateDebut).getTime()) / msPerDay,
  );
  const jours = nuits + 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003189]/5 to-white">
      {/* HEADER */}
      <header className="bg-[#003189] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium tracking-wide">Ordre de mission</span>
          <div className="ml-auto">
            {signed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 border border-green-300/30 px-3 py-1 text-xs font-semibold text-green-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Signé
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-300/30 px-3 py-1 text-xs font-semibold text-amber-100">
                <Clock className="h-3.5 w-3.5" />
                En attente de signature
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ══════════════════════════════════════════════════════════════════
            DOCUMENT OFFICIEL — ORDRE DE MISSION
            ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white border-2 border-gray-300 shadow-lg print:shadow-none print:border" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
          {/* Bandeau ministère */}
          <div className="text-center py-4 border-b border-gray-200">
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#003189]">
              Ministère de l&apos;Éducation Nationale
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              République Française — Liberté, Égalité, Fraternité
            </p>
          </div>

          <div className="px-8 sm:px-12 py-6">
            {/* En-tête établissement + numéro */}
            <div className="flex justify-between items-start border-b-2 border-[#003189] pb-4 mb-6">
              <div className="text-[12px] leading-relaxed">
                <p className="text-[15px] font-bold text-[#003189]">
                  {sejour.etablissement ?? 'Établissement scolaire'}
                </p>
                {sejour.etablissementAdresse && (
                  <p className="text-gray-700">{sejour.etablissementAdresse}</p>
                )}
                {sejour.etablissementVille && (
                  <p className="text-gray-700">{sejour.etablissementVille}</p>
                )}
                {sejour.etablissementUai && (
                  <p className="text-gray-600">UAI : {sejour.etablissementUai}</p>
                )}
                {sejour.etablissementTelephone && (
                  <p className="text-gray-600">Tél. : {sejour.etablissementTelephone}</p>
                )}
                {sejour.etablissementEmail && (
                  <p className="text-gray-600">{sejour.etablissementEmail}</p>
                )}
              </div>
              <div className="text-right text-[11px] leading-relaxed">
                <p className="text-[14px] font-bold text-[#003189] mb-1">{numOM}</p>
                <p className="text-gray-600">
                  Date d&apos;émission : {fmt(data.createdAt)}
                </p>
              </div>
            </div>

            {/* Titre */}
            <h2 className="text-center text-[18px] font-bold uppercase tracking-[3px] text-[#003189] border-b border-[#003189] pb-2 mb-6">
              Ordre de mission
            </h2>

            {/* Section DÉSIGNATION DE L'AGENT */}
            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[1px] text-[#003189] bg-[#f0f4fa] px-3 py-1.5 border-l-[3px] border-[#003189] mb-3">
                Désignation de l&apos;agent
              </div>
              <table className="w-full text-[13px]">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500 w-[200px]">Nom et prénom</td>
                    <td className="py-1 font-semibold text-gray-900">{data.nom} {data.prenom}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Qualité / Fonction</td>
                    <td className="py-1 font-semibold text-gray-900">Enseignant(e) accompagnateur(trice)</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Établissement d&apos;affectation</td>
                    <td className="py-1 font-semibold text-gray-900">{sejour.etablissement ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section OBJET DE LA MISSION */}
            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[1px] text-[#003189] bg-[#f0f4fa] px-3 py-1.5 border-l-[3px] border-[#003189] mb-3">
                Objet de la mission
              </div>
              <table className="w-full text-[13px]">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500 w-[200px]">Objet</td>
                    <td className="py-1 font-semibold text-gray-900">Accompagnement pédagogique — séjour scolaire</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Intitulé du séjour</td>
                    <td className="py-1 font-semibold text-gray-900">{sejour.titre}</td>
                  </tr>
                  {sejour.niveauClasse && (
                    <tr>
                      <td className="py-1 pr-4 text-gray-500">Niveau de classe</td>
                      <td className="py-1 font-semibold text-gray-900">{sejour.niveauClasse}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Nombre d&apos;élèves encadrés</td>
                    <td className="py-1 font-semibold text-gray-900">{sejour.placesTotales}</td>
                  </tr>
                  {sejour.enseignant && (
                    <tr>
                      <td className="py-1 pr-4 text-gray-500">Enseignant responsable</td>
                      <td className="py-1 font-semibold text-gray-900">{sejour.enseignant}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section LIEU ET DATES DE MISSION */}
            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[1px] text-[#003189] bg-[#f0f4fa] px-3 py-1.5 border-l-[3px] border-[#003189] mb-3">
                Lieu et dates de mission
              </div>
              <table className="w-full text-[13px]">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500 w-[200px]">Destination</td>
                    <td className="py-1 font-semibold text-gray-900">{sejour.lieu}</td>
                  </tr>
                  {hebergement && (
                    <tr>
                      <td className="py-1 pr-4 text-gray-500">Hébergement</td>
                      <td className="py-1 font-semibold text-gray-900">
                        {hebergement.nom}
                        {hebergement.adresse && `, ${hebergement.adresse}`}
                        {hebergement.ville && `, ${hebergement.ville}`}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Date de départ</td>
                    <td className="py-1 font-semibold text-gray-900">{fmt(sejour.dateDebut)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Date de retour</td>
                    <td className="py-1 font-semibold text-gray-900">{fmt(sejour.dateFin)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 text-gray-500">Durée</td>
                    <td className="py-1 font-semibold text-gray-900">
                      {nuits} nuit{nuits > 1 ? 's' : ''} / {jours} jour{jours > 1 ? 's' : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section TRANSPORT */}
            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[1px] text-[#003189] bg-[#f0f4fa] px-3 py-1.5 border-l-[3px] border-[#003189] mb-3">
                Transport
              </div>
              <div className="text-[13px] text-gray-700 space-y-1.5 pl-1">
                <p className="text-gray-500 text-[12px] italic mb-2">
                  Moyen de transport utilisé (à renseigner par l&apos;accompagnateur) :
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border border-gray-400 rounded-sm text-center text-[10px] leading-4">
                    {moyenTransport === 'collectif' ? '\u2713' : '\u00A0'}
                  </span>
                  <span>Transport collectif organisé par l&apos;établissement</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border border-gray-400 rounded-sm text-center text-[10px] leading-4">
                    {moyenTransport === 'personnel' ? '\u2713' : '\u00A0'}
                  </span>
                  <span>Véhicule personnel (remboursement sur justificatif)</span>
                </div>
              </div>
            </div>

            {/* Section RÉFÉRENCES RÉGLEMENTAIRES */}
            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[1px] text-[#003189] bg-[#f0f4fa] px-3 py-1.5 border-l-[3px] border-[#003189] mb-3">
                Références réglementaires
              </div>
              <div className="text-[11px] text-gray-600 leading-relaxed border border-gray-200 bg-gray-50 px-4 py-3 text-justify">
                Le présent ordre de mission est établi conformément au Décret n°2006-781 du 3 juillet 2006
                fixant les conditions et les modalités de règlement des frais occasionnés par les
                déplacements temporaires des personnels civils de l&apos;État, et à la circulaire n°2011-117
                du 3 août 2011 relative aux sorties et voyages scolaires. L&apos;agent désigné est autorisé
                à se rendre sur le lieu de mission indiqué ci-dessus pour y exercer les fonctions
                d&apos;accompagnement pédagogique dans le cadre du séjour scolaire.
              </div>
            </div>

            {/* Section VISA DU CHEF D'ÉTABLISSEMENT */}
            <div className="mb-5">
              <div className="text-[12px] font-bold uppercase tracking-[1px] text-[#003189] bg-[#f0f4fa] px-3 py-1.5 border-l-[3px] border-[#003189] mb-3">
                Visa du chef d&apos;établissement
              </div>
              <div className="text-[13px] text-gray-700 mb-3">
                Le Chef d&apos;établissement certifie que ce déplacement est effectué dans l&apos;intérêt du service.
              </div>
              <div className="flex justify-between gap-8">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-[0.5px] mb-1">Le(La) Chef(fe) d&apos;établissement</p>
                  <p className="text-[13px] font-semibold text-[#003189]">
                    {sejour.etablissement ?? '—'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">Cachet et signature</p>
                </div>
                <div className="w-48 h-20 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                  <p className="text-[10px] text-gray-400 text-center px-3 leading-tight">
                    Signature électronique générée à la validation du devis par le directeur
                  </p>
                </div>
              </div>
            </div>

            {/* Signature accompagnateur (si signé) */}
            {signed && (
              <div className="mt-8 pt-6 border-t-2 border-[#003189]">
                <div className="flex justify-between gap-8">
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-[0.5px] mb-1">
                      Signature de l&apos;accompagnateur
                    </p>
                    <p className="text-[14px] font-bold text-[#003189]">
                      {data.signatureNom ?? `${data.prenom} ${data.nom}`}
                    </p>
                    <p className="text-[12px] text-gray-600 mt-1">
                      Date : {data.signeeAt ? fmt(data.signeeAt) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-[0.5px] mb-1">
                      Enseignant responsable
                    </p>
                    <p className="text-[14px] font-bold text-[#003189]">
                      {sejour.enseignant ?? '—'}
                    </p>
                    <p className="text-[12px] text-gray-600 mt-1">
                      {sejour.etablissement ?? ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pied de document */}
          <div className="border-t border-gray-200 px-8 sm:px-12 py-3 text-center">
            <p className="text-[10px] text-gray-400">
              Document généré automatiquement par la plateforme Liavo — {numOM}
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            FORMULAIRE DE SIGNATURE / CONFIRMATION
            ══════════════════════════════════════════════════════════════════ */}
        {signed ? (
          <section className="bg-green-50 rounded-2xl shadow-md border border-green-200 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800">
              {data.signeeAt
                ? `Ordre de mission signé le ${fmt(data.signeeAt)}`
                : 'Ordre de mission signé avec succès !'}
            </h2>
            <p className="mt-2 text-sm text-green-600">
              Merci. Votre ordre de mission est validé pour ce séjour.
            </p>
          </section>
        ) : (
          <>
            {/* Moyen de transport */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Moyen de transport
              </h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group rounded-xl border border-gray-200 px-4 py-3 hover:border-[#003189]/30 transition-colors has-[:checked]:border-[#003189] has-[:checked]:bg-blue-50/50">
                  <input
                    type="radio"
                    name="transport"
                    value="collectif"
                    checked={moyenTransport === 'collectif'}
                    onChange={(e) => setMoyenTransport(e.target.value)}
                    className="h-4 w-4 text-[#003189] focus:ring-[#003189]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Transport collectif</p>
                    <p className="text-xs text-gray-500">Organisé par l&apos;établissement</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group rounded-xl border border-gray-200 px-4 py-3 hover:border-[#003189]/30 transition-colors has-[:checked]:border-[#003189] has-[:checked]:bg-blue-50/50">
                  <input
                    type="radio"
                    name="transport"
                    value="personnel"
                    checked={moyenTransport === 'personnel'}
                    onChange={(e) => setMoyenTransport(e.target.value)}
                    className="h-4 w-4 text-[#003189] focus:ring-[#003189]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Véhicule personnel</p>
                    <p className="text-xs text-gray-500">Remboursement sur justificatif</p>
                  </div>
                </label>
              </div>
            </section>

            {/* Contact d'urgence */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-6">
                <Phone className="h-5 w-5" />
                Contact d&apos;urgence
                <span className="text-sm font-normal text-gray-400">(optionnel)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contactNom" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du contact
                  </label>
                  <input
                    id="contactNom"
                    type="text"
                    value={contactUrgenceNom}
                    onChange={(e) => setContactUrgenceNom(e.target.value)}
                    placeholder="ex : Marie Dupont"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="contactTel" className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    id="contactTel"
                    type="tel"
                    value={contactUrgenceTel}
                    onChange={(e) => setContactUrgenceTel(e.target.value)}
                    placeholder="ex : 06 12 34 56 78"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* RGPD */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
                <ShieldCheck className="h-5 w-5" />
                Protection des données personnelles
              </h2>

              <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 mb-5 max-h-48 overflow-y-auto">
                <p className="text-xs text-gray-600 leading-relaxed">
                  {RGPD_TEXT}
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rgpdAccepte}
                  onChange={(e) => setRgpdAccepte(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-[#003189] focus:ring-[#003189] focus:ring-2 cursor-pointer"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  J&apos;ai lu et j&apos;accepte les conditions de traitement de mes données personnelles
                  <span className="text-red-500 ml-0.5">*</span>
                </span>
              </label>
            </section>

            {/* Signature */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
                <ClipboardCheck className="h-5 w-5" />
                Signature électronique
              </h2>

              <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 mb-5">
                <p className="text-sm text-blue-800">
                  Je soussigné(e) <strong>{signatureNom || '...'}</strong> certifie avoir pris
                  connaissance de cet ordre de mission et m&apos;engage à respecter les obligations
                  qui en découlent.
                </p>
              </div>

              <div className="mb-5">
                <label htmlFor="signatureNom" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <input
                  id="signatureNom"
                  type="text"
                  value={signatureNom}
                  onChange={(e) => setSignatureNom(e.target.value)}
                  placeholder="Prénom Nom"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                />
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSign}
                disabled={signing || !formValid}
                className="w-full rounded-xl bg-green-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-600/25 hover:bg-green-700 hover:shadow-green-700/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                {signing ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signature en cours...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Signer cet ordre de mission
                  </span>
                )}
              </button>

              {!rgpdAccepte && (
                <p className="mt-2 text-xs text-amber-600 text-center">
                  Vous devez accepter les conditions RGPD pour pouvoir signer.
                </p>
              )}

              <p className="mt-3 text-xs text-gray-400 text-center">
                En signant, vous acceptez votre mission d&apos;accompagnement pour ce séjour scolaire.
              </p>
            </section>
          </>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-gray-400">
          Liavo — Plateforme de gestion des séjours scolaires
        </p>
      </footer>
    </div>
  );
}
