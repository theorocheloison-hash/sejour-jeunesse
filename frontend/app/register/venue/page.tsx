'use client';

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/src/lib/api';
import { extractApiError } from '@/src/contexts/AuthContext';

const TYPES_SEJOURS = [
  { value: 'scolaire', label: 'Séjour scolaire' },
  { value: 'colo', label: 'Colonie de vacances' },
  { value: 'classe_decouverte', label: 'Classe de découverte' },
  { value: 'classe_neige', label: 'Classe de neige' },
  { value: 'classe_mer', label: 'Classe de mer' },
  { value: 'seminaire', label: 'Séminaire' },
  { value: 'mariage', label: 'Mariage / Événement' },
  { value: 'groupe', label: 'Groupe / Association' },
];

interface CentrePublic {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone: string | null;
  email: string | null;
  capacite: number;
  description: string | null;
  departement: string | null;
  siret: string | null;
  agrementEducationNationale: string | null;
  typeSejours: string[];
}

function RegisterVenueContent() {
  const searchParams = useSearchParams();
  const urlNomCentre = searchParams.get('nomCentre') ?? '';
  const urlVille = searchParams.get('ville') ?? '';
  const urlCodePostal = searchParams.get('codePostal') ?? '';
  const urlInvitationToken = searchParams.get('invitationToken') ?? '';
  const urlReseau = searchParams.get('reseau') ?? '';
  const fromInvitation = !!(urlNomCentre || urlVille || urlCodePostal);

  // step 1 = personal info, 1.5 = centre search, 2 = centre details, 3 = types séjours
  const [step, setStep] = useState<1 | 1.5 | 2 | 3>(1);
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    telephone: '',
    nomCentre: urlNomCentre,
    siret: '',
    adresse: '',
    ville: urlVille,
    codePostal: urlCodePostal,
    departement: '',
    telephoneCentre: '',
    emailContact: '',
    capacite: '',
    description: '',
    typeSejours: [] as string[],
    agrementEducationNationale: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const [apidaeCentre, setApidaeCentre] = useState<{
    nom: string;
    ville: string;
    departement: string | null;
    capacite: number;
    imageUrl: string | null;
  } | null>(null);

  const urlToken = searchParams.get('token') ?? searchParams.get('invitationToken') ?? '';

  // Centre search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CentrePublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [centrePreFilled, setCentrePreFilled] = useState(fromInvitation);
  const [siretLoading, setSiretLoading] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);
  const [centreFromSiret, setCentreFromSiret] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleType = (value: string) =>
    setForm((f) => ({
      ...f,
      typeSejours: f.typeSejours.includes(value)
        ? f.typeSejours.filter((t) => t !== value)
        : [...f.typeSejours, value],
    }));

  // Check if invitation token points to an APIDAE centre
  useEffect(() => {
    if (!urlToken) return;
    api.get(`/centres/check-invitation/${urlToken}`)
      .then(({ data }) => {
        if (data.isApidae && data.centre) {
          setApidaeCentre(data.centre);
        }
      })
      .catch(() => {});
  }, [urlToken]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get<CentrePublic[]>(`/centres/search-public?search=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
        setHasSearched(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSelectCentre = (centre: CentrePublic) => {
    setForm((f) => ({
      ...f,
      nomCentre: centre.nom,
      adresse: centre.adresse,
      ville: centre.ville,
      codePostal: centre.codePostal,
      telephoneCentre: centre.telephone ?? '',
      emailContact: centre.email ?? '',
      capacite: String(centre.capacite),
      description: centre.description ?? '',
      departement: centre.departement ?? '',
      siret: centre.siret ?? '',
      agrementEducationNationale: centre.agrementEducationNationale ?? '',
      typeSejours: centre.typeSejours ?? [],
    }));
    setCentrePreFilled(true);
    setStep(2);
  };

  const handleSiretSearch = async () => {
    setSiretError(null);
    const cleaned = form.siret.replace(/[\s\-]/g, '');
    if (cleaned.length !== 14 || !/^\d{14}$/.test(cleaned)) {
      setSiretError('Le SIRET doit contenir exactement 14 chiffres');
      return;
    }
    setSiretLoading(true);
    try {
      const { data } = await api.get(`/auth/sirene/${cleaned}`);
      if (!data.found) {
        setSiretError('SIRET introuvable. Vérifiez le numéro ou renseignez les informations manuellement.');
        return;
      }
      setForm(f => ({
        ...f,
        nomCentre: f.nomCentre || data.raisonSociale,
        adresse: f.adresse || data.adresse,
        ville: f.ville || data.ville,
        codePostal: f.codePostal || data.codePostal,
        departement: f.departement || data.departement,
        siret: data.siret,
      }));
      setCentreFromSiret(true);
    } catch {
      setSiretError('Erreur lors de la recherche. Renseignez les informations manuellement.');
    } finally {
      setSiretLoading(false);
    }
  };

  const goStep15 = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.prenom || !form.nom || !form.email || !form.password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (apidaeCentre) {
      setStep(3);
    } else {
      setStep(fromInvitation ? 2 : 1.5);
    }
  };

  const goStep2 = () => {
    setError(null);
    setStep(2);
  };

  const goStep3 = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const siretCleaned = form.siret.replace(/[\s\-]/g, '');
    if (!centrePreFilled && (!form.siret || siretCleaned.length !== 14)) {
      setError('Le SIRET est obligatoire. Recherchez votre structure pour continuer.');
      return;
    }
    if (!form.nomCentre || !form.adresse || !form.ville || !form.codePostal || !form.capacite) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await api.post('/auth/register/venue', {
        prenom: form.prenom,
        nom: form.nom,
        email: form.email,
        password: form.password,
        telephone: form.telephone || undefined,
        nomCentre: form.nomCentre,
        adresse: form.adresse,
        ville: form.ville,
        codePostal: form.codePostal,
        capacite: parseInt(form.capacite, 10) || 0,
        description: form.description || undefined,
        siret: form.siret || undefined,
        departement: form.departement || undefined,
        emailContact: form.emailContact || undefined,
        agrementEducationNationale: form.agrementEducationNationale || undefined,
        typeSejours: form.typeSejours.length > 0 ? form.typeSejours : undefined,
        invitationToken: urlInvitationToken || undefined,
        reseau: urlReseau || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setIsPending(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-6">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Compte en attente</h1>
          <p className="text-gray-500 mb-4">
            Votre inscription pour le centre <strong className="text-gray-700">{form.nomCentre}</strong> a bien été enregistrée.
          </p>
          <div className="space-y-3 mb-6">
            <div className="bg-[var(--color-primary-light)]border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
              Un email de vérification a été envoyé à <strong>{form.email}</strong>.
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              Votre compte sera activé après validation par notre équipe.
            </div>
          </div>
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Retour à la connexion
          </Link>
        </div>
      </main>
    );
  }

  const stepLabels: Record<number, string> = {
    1: 'Vos informations',
    1.5: 'Recherche de votre centre',
    2: 'Votre centre',
    3: 'Types de séjours',
  };
  const stepIndex = step === 1 ? 1 : step === 1.5 ? 2 : step === 2 ? 3 : 4;
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-transparent disabled:opacity-50";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/register" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--color-primary-hover)] mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Retour
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-primary)] mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Inscription hébergeur</h1>
          <p className="mt-1 text-sm text-gray-500">
            Étape {stepIndex} sur 4 — {stepLabels[step]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          <div className="h-1 flex-1 rounded-full bg-[var(--color-primary)]" />
          <div className={`h-1 flex-1 rounded-full transition-colors ${stepIndex >= 2 ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${stepIndex >= 3 ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${stepIndex >= 4 ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 1 : Infos personnelles ── */}
          {step === 1 && (
            <>
            {apidaeCentre && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                {apidaeCentre.imageUrl && (
                  <img
                    src={apidaeCentre.imageUrl}
                    alt={apidaeCentre.nom}
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Votre centre est déjà sur LIAVO 🎉
                  </p>
                  <p className="text-lg font-bold text-[var(--color-primary)]">
                    {apidaeCentre.nom}
                  </p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    {apidaeCentre.ville}{apidaeCentre.departement ? ` (${apidaeCentre.departement})` : ''} — {apidaeCentre.capacite} lits
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Créez simplement votre compte pour accéder à votre espace hébergeur.
                  </p>
                </div>
              </div>
            )}
            <form onSubmit={goStep15} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                  <input id="prenom" type="text" required value={form.prenom} onChange={set('prenom')} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                  <input id="nom" type="text" required value={form.nom} onChange={set('nom')} className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input id="email" type="email" required value={form.email} onChange={set('email')} placeholder="contact@moncentre.fr" className={inputCls} />
              </div>
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Téléphone <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input id="telephone" type="tel" value={form.telephone} onChange={set('telephone')} placeholder="06 12 34 56 78" className={inputCls} />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <input id="password" type="password" required value={form.password} onChange={set('password')} placeholder="8 caractères minimum" className={inputCls} />
              </div>
              <button type="submit"
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2">
                Continuer
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>
            </>
          )}

          {/* ── STEP 1.5 : Recherche centre ── */}
          {step === 1.5 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-2">🔍</div>
                <h2 className="text-base font-bold text-gray-900">Votre établissement est-il déjà référencé ?</h2>
                <p className="text-xs text-gray-500 mt-1">Recherchez votre centre pour pré-remplir automatiquement vos informations</p>
              </div>

              {/* Search bar */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tapez le nom de votre centre..."
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-transparent"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-transparent" />
                  </div>
                )}
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {searchResults.map((centre) => (
                    <button
                      key={centre.id}
                      type="button"
                      onClick={() => handleSelectCentre(centre)}
                      className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-primary-light)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{centre.nom}</p>
                          <p className="text-xs text-gray-500">{centre.adresse}, {centre.ville} ({centre.codePostal})</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {centre.agrementEducationNationale && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Agréé EN
                            </span>
                          )}
                          <span className="text-xs font-semibold text-[var(--color-primary)]">Sélectionner</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {hasSearched && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-500">Votre centre n&apos;est pas encore référencé — vous pourrez compléter votre fiche après inscription.</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setStep(1); setError(null); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  Retour
                </button>
                <button type="button" onClick={goStep2}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  Passer cette étape
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 : Détails du centre ── */}
          {step === 2 && (
            <form onSubmit={goStep3} className="space-y-4">

              {/* Pre-fill banner */}
              {centrePreFilled && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/20 text-sm text-[var(--color-success)] mb-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{fromInvitation ? 'Informations pré-remplies depuis l\'invitation — vérifiez et complétez si nécessaire' : 'Données récupérées depuis notre base — vérifiez et complétez si nécessaire'}</span>
                </div>
              )}

              <div>
                <label htmlFor="nomCentre" className="block text-sm font-medium text-gray-700 mb-1.5">Nom du centre</label>
                <input id="nomCentre" type="text" required value={form.nomCentre} onChange={set('nomCentre')}
                  placeholder="Centre de vacances Les Pins" className={inputCls} />
              </div>
              {!centrePreFilled && (
                <div>
                  <label htmlFor="siret" className="block text-sm font-medium text-gray-700 mb-1.5">
                    SIRET <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="siret"
                      type="text"
                      value={form.siret}
                      onChange={(e) => { set('siret')(e); setSiretError(null); setCentreFromSiret(false); }}
                      placeholder="123 456 789 00012"
                      maxLength={17}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={handleSiretSearch}
                      disabled={siretLoading}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {siretLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                      )}
                      Rechercher
                    </button>
                  </div>
                  {siretError && (
                    <p className="mt-1.5 text-xs text-red-600">{siretError}</p>
                  )}
                  {centreFromSiret && (
                    <p className="mt-1.5 text-xs text-green-600">Informations récupérées — vérifiez et complétez si nécessaire</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Entrez votre SIRET à 14 chiffres pour pré-remplir automatiquement les informations de votre structure
                  </p>
                </div>
              )}

              {centrePreFilled && (
                <div>
                  <label htmlFor="siret" className="block text-sm font-medium text-gray-700 mb-1.5">
                    SIRET <span className="text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <input id="siret" type="text" value={form.siret} onChange={set('siret')}
                    placeholder="123 456 789 00012" maxLength={17} className={inputCls} />
                </div>
              )}

              <div>
                <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
                <input id="adresse" type="text" required value={form.adresse} onChange={set('adresse')}
                  placeholder="12 rue des Montagnes" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="codePostal" className="block text-sm font-medium text-gray-700 mb-1.5">Code postal</label>
                  <input id="codePostal" type="text" required value={form.codePostal} onChange={set('codePostal')}
                    placeholder="73000" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ville" className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
                  <input id="ville" type="text" required value={form.ville} onChange={set('ville')} className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="departement" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Département <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input id="departement" type="text" value={form.departement} onChange={set('departement')}
                  placeholder="Savoie" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="telephoneCentre" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tél. du centre <span className="text-gray-400 font-normal">(opt.)</span>
                  </label>
                  <input id="telephoneCentre" type="tel" value={form.telephoneCentre} onChange={set('telephoneCentre')}
                    placeholder="04 50 12 34 56" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="emailContact" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email contact <span className="text-gray-400 font-normal">(opt.)</span>
                  </label>
                  <input id="emailContact" type="email" value={form.emailContact} onChange={set('emailContact')}
                    placeholder="resa@moncentre.fr" className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="capacite" className="block text-sm font-medium text-gray-700 mb-1.5">Capacité d&apos;accueil (personnes)</label>
                <input id="capacite" type="number" required value={form.capacite} onChange={set('capacite')}
                  min="1" placeholder="60" className={inputCls} />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <textarea id="description" value={form.description} onChange={set('description')}
                  rows={3} placeholder="Présentez brièvement votre centre..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-transparent disabled:opacity-50 resize-none" />
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => { setStep(1.5); setError(null); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  Retour
                </button>
                <button type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2">
                  Continuer
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3 : Types de séjours ── */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {apidaeCentre && (
                <div className="rounded-lg bg-[var(--color-success-light)] border border-green-200 px-4 py-3 mb-2">
                  <p className="text-sm font-semibold text-[var(--color-success)]">
                    ✓ Votre centre {apidaeCentre.nom} sera automatiquement rattaché à votre compte
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Vos photos, description et capacité sont déjà enregistrées.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Types de séjours proposés <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES_SEJOURS.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        form.typeSejours.includes(t.value)
                          ? 'border-[var(--color-border-strong)] bg-[var(--color-primary-light)]text-[var(--color-primary)] font-medium'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.typeSejours.includes(t.value)}
                        onChange={() => toggleType(t.value)}
                        className="sr-only"
                      />
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        form.typeSejours.includes(t.value)
                          ? 'border-[var(--color-border-strong)] bg-[var(--color-primary)]'
                          : 'border-gray-300'
                      }`}>
                        {form.typeSejours.includes(t.value) && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="agrement" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Agrément Éducation Nationale <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input id="agrement" type="text" value={form.agrementEducationNationale} onChange={set('agrementEducationNationale')}
                  placeholder="N°12345678" className={inputCls} />
                <p className="mt-1 text-xs text-gray-400">Numéro d&apos;agrément si votre centre en dispose</p>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => { setStep(2); setError(null); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  Retour
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {isPending ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Inscription...</>
                  ) : (
                    "S'inscrire"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:underline">Se connecter</Link>
        </p>
        <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Besoin d&apos;aide ?{' '}
          <a href="mailto:contact@liavo.fr" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
            contact@liavo.fr
          </a>
        </p>
      </div>
    </main>
  );
}

export default function RegisterVenuePage() {
  return (
    <Suspense>
      <RegisterVenueContent />
    </Suspense>
  );
}
