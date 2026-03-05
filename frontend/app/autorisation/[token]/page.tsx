'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MapPin,
  CalendarDays,
  Users,
  GraduationCap,
  Building2,
  ShieldCheck,
  UserRound,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Heart,
  BookOpen,
  Ruler,
  Weight,
  Footprints,
  UtensilsCrossed,
  Mountain,
  Stethoscope,
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

const REGIME_OPTIONS = [
  'Aucun régime particulier',
  'Végétarien',
  'Végétalien/Vegan',
  'Sans porc',
  'Sans gluten',
  'Autre',
];

const NIVEAU_SKI_OPTIONS = [
  { value: '', label: 'Non renseigné' },
  { value: 'DEBUTANT', label: 'Débutant' },
  { value: 'INTERMEDIAIRE', label: 'Intermédiaire' },
  { value: 'CONFIRME', label: 'Confirmé' },
  { value: 'HORS_PISTE', label: 'Hors-piste' },
];

export default function SignerAutorisationPage() {
  const { token } = useParams<{ token: string }>();

  const [autorisation, setAutorisation] = useState<AutorisationPublique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [pointure, setPointure] = useState('');
  const [regime, setRegime] = useState('Aucun régime particulier');
  const [regimeAutre, setRegimeAutre] = useState('');
  const [niveauSki, setNiveauSki] = useState('');
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

  const showSki = autorisation?.sejour.thematiquesPedagogiques?.some(
    (t) => /ski|montagne|neige/i.test(t),
  );

  const handleSign = async () => {
    if (!token || !taille || !poids || !pointure) return;
    setSigning(true);
    try {
      const regimeVal = regime === 'Autre' ? regimeAutre.trim() : regime === 'Aucun régime particulier' ? undefined : regime;
      await signerAutorisation(token, {
        taille: parseInt(taille, 10),
        poids: parseInt(poids, 10),
        pointure: parseInt(pointure, 10),
        regimeAlimentaire: regimeVal || undefined,
        niveauSki: niveauSki || undefined,
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

  const formValid = taille && poids && pointure;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003189]/5 to-white">
      {/* HEADER */}
      <header className="bg-[#003189] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium tracking-wide">Autorisation parentale</span>
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
                  <BookOpen className="h-4 w-4" />
                  {sejour.niveauClasse}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {sejour.placesTotales} places
              </span>
            </div>
          </div>
        </section>

        {/* Détail séjour */}
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

        {/* Hébergement */}
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

        {/* Votre enfant */}
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

        {/* Formulaire / Confirmation */}
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
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#003189] mb-6">
              <Heart className="h-5 w-5" />
              Autoriser la participation
            </h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Informations pratiques */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-gray-400" />
                Informations pratiques
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="taille" className="block text-sm font-medium text-gray-700 mb-1">
                    Taille (cm) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="taille"
                      type="number"
                      min="50"
                      max="250"
                      value={taille}
                      onChange={(e) => setTaille(e.target.value)}
                      placeholder="ex: 145"
                      className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="poids" className="block text-sm font-medium text-gray-700 mb-1">
                    Poids (kg) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="poids"
                      type="number"
                      min="10"
                      max="200"
                      value={poids}
                      onChange={(e) => setPoids(e.target.value)}
                      placeholder="ex: 38"
                      className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="pointure" className="block text-sm font-medium text-gray-700 mb-1">
                    Pointure <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Footprints className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="pointure"
                      type="number"
                      min="20"
                      max="50"
                      value={pointure}
                      onChange={(e) => setPointure(e.target.value)}
                      placeholder="ex: 37"
                      className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Régime alimentaire */}
            <div className="mb-6">
              <label htmlFor="regime" className="block text-sm font-medium text-gray-700 mb-1">
                <UtensilsCrossed className="inline h-4 w-4 mr-1 text-gray-400" />
                Régime alimentaire
              </label>
              <select
                id="regime"
                value={regime}
                onChange={(e) => setRegime(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
              >
                {REGIME_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {regime === 'Autre' && (
                <input
                  type="text"
                  value={regimeAutre}
                  onChange={(e) => setRegimeAutre(e.target.value)}
                  placeholder="Précisez le régime alimentaire..."
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                />
              )}
            </div>

            {/* Niveau de ski (conditionnel) */}
            {showSki && (
              <div className="mb-6">
                <label htmlFor="niveauSki" className="block text-sm font-medium text-gray-700 mb-1">
                  <Mountain className="inline h-4 w-4 mr-1 text-gray-400" />
                  Niveau de ski
                  <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                </label>
                <select
                  id="niveauSki"
                  value={niveauSki}
                  onChange={(e) => setNiveauSki(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none"
                >
                  {NIVEAU_SKI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Informations médicales */}
            <div className="mb-6">
              <label
                htmlFor="infosMedicales"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <Stethoscope className="inline h-4 w-4 mr-1 text-gray-400" />
                Informations médicales importantes
                <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
              </label>
              <textarea
                id="infosMedicales"
                rows={3}
                value={infosMedicales}
                onChange={(e) => setInfosMedicales(e.target.value)}
                placeholder="Allergies, traitements en cours, contacts d'urgence..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#003189] focus:ring-2 focus:ring-[#003189]/20 focus:outline-none transition-shadow"
              />
            </div>

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

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-gray-400">
          Séjour Jeunesse — Plateforme de gestion des séjours scolaires
        </p>
      </footer>
    </div>
  );
}
