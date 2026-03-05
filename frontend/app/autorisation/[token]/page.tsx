'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MapPin,
  CalendarDays,
  Users,
  GraduationCap,
  Building2,
  Phone,
  ShieldCheck,
  UserRound,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Heart,
  BookOpen,
} from 'lucide-react';
import {
  getAutorisationPublique,
  signerAutorisation,
  type AutorisationPublique,
} from '@/src/lib/autorisation';

const THEMATIQUE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

const TYPE_HEBERGEMENT_LABEL: Record<string, string> = {
  auberge_jeunesse: 'Auberge de jeunesse',
  centre_vacances: 'Centre de vacances',
  camping: 'Camping',
  gite: 'Gîte',
  hotel: 'Hôtel',
  refuge: 'Refuge',
  autre: 'Autre',
};

export default function SignerAutorisationPage() {
  const { token } = useParams<{ token: string }>();

  const [autorisation, setAutorisation] = useState<AutorisationPublique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [infosMedicales, setInfosMedicales] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    getAutorisationPublique(token)
      .then((data) => {
        setAutorisation(data);
        if (data.signeeAt) setSigned(true);
      })
      .catch(() => setError('Lien invalide ou autorisation introuvable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    setSigning(true);
    try {
      await signerAutorisation(token, {
        infosMedicales: infosMedicales.trim() || undefined,
      });
      setSigned(true);
    } catch {
      setError('Erreur lors de la signature. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#003189]/5 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#003189] border-t-transparent" />
      </div>
    );
  }

  if (error && !autorisation) {
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

  if (!autorisation) return null;

  const { sejour, hebergement } = autorisation;
  const thematiques = sejour.thematiquesPedagogiques ?? [];

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003189]/5 to-white">
      {/* ── HEADER ── */}
      <header className="bg-[#003189] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium tracking-wide">Autorisation parentale</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── HERO — Présentation du séjour ── */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#003189] to-[#0050c8] px-6 py-8 text-white">
            <p className="text-3xl mb-2">🏕️</p>
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
                  <BookOpen className="h-4 w-4" />
                  {sejour.niveauClasse}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {sejour.placesTotales} élèves
              </span>
            </div>
          </div>
        </section>

        {/* ── Le séjour en détail ── */}
        {(sejour.description || thematiques.length > 0) && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
              <ClipboardCheck className="h-5 w-5" />
              Le séjour en détail
            </h2>
            {sejour.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-4">
                {sejour.description}
              </p>
            )}
            {thematiques.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Thématiques pédagogiques
                </p>
                <div className="flex flex-wrap gap-2">
                  {thematiques.map((t, i) => (
                    <span
                      key={t}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${THEMATIQUE_COLORS[i % THEMATIQUE_COLORS.length]}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── L'hébergement ── */}
        {hebergement && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
              <Building2 className="h-5 w-5" />
              L&apos;hébergement
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Établissement</p>
                <p className="font-semibold text-gray-900">{hebergement.nom}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-medium text-gray-900">
                  {TYPE_HEBERGEMENT_LABEL[hebergement.type] ?? hebergement.type}
                </p>
              </div>
              {hebergement.adresse && (
                <div>
                  <p className="text-xs text-gray-500">Adresse</p>
                  <p className="font-medium text-gray-900">{hebergement.adresse}, {hebergement.ville}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Capacité</p>
                <p className="font-medium text-gray-900">{hebergement.capacite} places</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Votre enfant ── */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
            <UserRound className="h-5 w-5" />
            Votre enfant
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Élève concerné(e)</p>
              <p className="text-base font-semibold text-gray-900">
                {autorisation.elevePrenom} {autorisation.eleveNom}
              </p>
            </div>
            <div>
              {signed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Autorisation signée
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Clock className="h-4 w-4" />
                  En attente de signature
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Formulaire / Confirmation ── */}
        {signed ? (
          <section className="bg-green-50 rounded-2xl shadow-md border border-green-200 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800">
              {autorisation.signeeAt
                ? 'Cette autorisation a déjà été signée'
                : 'Autorisation signée avec succès !'}
            </h2>
            <p className="mt-2 text-sm text-green-600">
              Merci pour votre confiance. Votre enfant pourra participer au séjour.
            </p>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-4">
              <Heart className="h-5 w-5" />
              Autoriser la participation
            </h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="infosMedicales"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                <Phone className="inline h-4 w-4 mr-1 text-gray-400" />
                Informations médicales importantes
                <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
              </label>
              <textarea
                id="infosMedicales"
                rows={3}
                value={infosMedicales}
                onChange={(e) => setInfosMedicales(e.target.value)}
                placeholder="Allergies, traitements en cours, régime alimentaire, contacts d'urgence..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none transition-shadow"
              />
            </div>

            <button
              type="button"
              onClick={handleSign}
              disabled={signing}
              className="w-full rounded-xl bg-green-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-600/25 hover:bg-green-700 hover:shadow-green-700/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {signing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signature en cours…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  J&apos;autorise mon enfant à participer
                </span>
              )}
            </button>

            <p className="mt-3 text-xs text-gray-400 text-center">
              En signant, vous autorisez la participation de votre enfant à ce séjour
              et certifiez avoir pris connaissance des informations ci-dessus.
            </p>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-gray-400">
          Séjour Jeunesse — Plateforme de gestion des séjours scolaires
        </p>
      </footer>
    </div>
  );
}
