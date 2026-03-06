'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MapPin,
  CalendarDays,
  GraduationCap,
  Building2,
  ShieldCheck,
  UserRound,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003189]/5 to-white">
      {/* HEADER */}
      <header className="bg-[#003189] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium tracking-wide">Ordre de mission</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* HERO */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#003189] to-[#0050c8] px-6 py-8 text-white">
            <h1 className="text-2xl font-bold leading-tight">{sejour.titre}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-blue-100">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Du {fmt(sejour.dateDebut)} au {fmt(sejour.dateFin)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {sejour.lieu}
              </span>
              {sejour.niveauClasse && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4" />
                  {sejour.niveauClasse}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Infos séjour */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
            <Building2 className="h-5 w-5" />
            Informations du séjour
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {sejour.etablissement && (
              <div>
                <p className="text-xs text-gray-500">Établissement scolaire</p>
                <p className="font-semibold text-gray-900">
                  {sejour.etablissement}
                  {sejour.etablissementVille && ` (${sejour.etablissementVille})`}
                </p>
              </div>
            )}
            {sejour.enseignant && (
              <div>
                <p className="text-xs text-gray-500">Enseignant responsable</p>
                <p className="font-semibold text-gray-900">{sejour.enseignant}</p>
              </div>
            )}
            {hebergement && (
              <div>
                <p className="text-xs text-gray-500">Hébergement</p>
                <p className="font-semibold text-gray-900">
                  {hebergement.nom}
                  {hebergement.ville && ` — ${hebergement.ville}`}
                </p>
              </div>
            )}
            {sejour.description && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-gray-700 whitespace-pre-line">{sejour.description}</p>
              </div>
            )}
          </div>
        </section>

        {/* Accompagnateur */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
            <UserRound className="h-5 w-5" />
            Accompagnateur désigné
          </h2>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-gray-900">
                {data.prenom} {data.nom}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-500">
                <Mail className="h-3.5 w-3.5" />
                {data.email}
              </p>
            </div>
            <div>
              {signed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Signé
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Clock className="h-4 w-4" />
                  En attente
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Formulaire ou confirmation */}
        {signed ? (
          <section className="bg-green-50 rounded-2xl shadow-md border border-green-200 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800">
              {data.signeeAt
                ? 'Cet ordre de mission a déjà été signé'
                : 'Ordre de mission signé avec succès !'}
            </h2>
            <p className="mt-2 text-sm text-green-600">
              Merci. Votre ordre de mission est validé pour ce séjour.
            </p>
          </section>
        ) : (
          <>
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
                    Je signe mon ordre de mission
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

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-gray-400">
          Séjour Jeunesse — Plateforme de gestion des séjours scolaires
        </p>
      </footer>
    </div>
  );
}
