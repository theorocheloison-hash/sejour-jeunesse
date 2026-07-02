'use client';
import { useState, Suspense, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { soumettreDemandePublique } from '@/src/lib/public';
import { Logo } from '@/app/components/Logo';
import EtapeInfos from '@/src/components/sejour/EtapeInfos';
import EtapeGeographie from '@/src/components/sejour/EtapeGeographie';
import EtapeRecapitulatif from '@/src/components/sejour/EtapeRecapitulatif';
import { INITIAL_DATA } from '@/src/components/sejour/shared';
import type { SejourFormData } from '@/src/components/sejour/shared';
import OrganisationSearch from '@/src/components/OrganisationSearch';
import type { OrganisationResult, SireneRaw } from '@/src/components/OrganisationSearch';
import { RESEAUX_PARTENAIRES } from '@/src/data/reseaux-partenaires';

const HORS_SCOLAIRE_TYPES = new Set([
  'MAIRIE','COLLECTIVITE_TERRITORIALE','CENTRE_LOISIRS',
  'ASSOCIATION','COMITE_ENTREPRISE','ENTREPRISE','MICRO_ENTREPRISE',
]);

// Recherche SIRENE publique (sans JWT) — alimente OrganisationSearch sur cette page publique.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';
const sirenePublic = async (q: string, signal: AbortSignal): Promise<SireneRaw[]> => {
  const res = await fetch(`${API_BASE}/public/organisations/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
};

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50';

const TYPE_STRUCTURE_OPTIONS = [
  { value: 'COLLEGE_LYCEE',     label: 'Collège ou lycée',        sub: 'Voyage scolaire, classe verte, classe de neige' },
  { value: 'ECOLE_PRIMAIRE',    label: 'École primaire',          sub: 'Classe découverte, séjour avec nuitée(s)' },
  { value: 'MAIRIE',            label: 'Mairie ou collectivité',  sub: 'Séjour organisé par une collectivité' },
  { value: 'CENTRE_LOISIRS',    label: 'Centre de loisirs (ALSH)',sub: 'Séjour organisé par un centre de loisirs' },
  { value: 'ASSOCIATION',       label: 'Association',             sub: 'Colonie, camp, séjour associatif' },
  { value: 'COMITE_ENTREPRISE', label: "Comité d'entreprise",     sub: 'Séjour organisé par un CSE' },
  { value: 'AUTRE',             label: 'Autre',                   sub: '' },
];

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const s = i + 1;
        const done = s < current;
        const active = s === current;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                done ? 'bg-[var(--color-primary)] text-white'
                : active ? 'bg-[var(--color-primary)] text-white ring-4 ring-indigo-100'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : s}
              </div>
              {/* < sm : seul le libellé de l'étape active est affiché (les 5 libellés nowrap débordent à 375px) */}
              <span className={`mt-1.5 text-xs font-medium whitespace-nowrap ${active ? 'text-[var(--color-primary)]' : done ? 'text-gray-500 hidden sm:block' : 'text-gray-400 hidden sm:block'}`}>
                {label}
              </span>
            </div>
            {s < labels.length && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${done ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AppelOffresContent() {
  const searchParams = useSearchParams();
  const centreId  = searchParams.get('centreId') ?? undefined;
  const centreNom = searchParams.get('centreNom') ?? undefined;
  const reseauParam = searchParams.get('reseau') ?? undefined;
  const reseauInfo = reseauParam ? RESEAUX_PARTENAIRES[reseauParam] : undefined;

  const estContactDirect = !!centreId;

  // Réseau avec départements par défaut (ex. LMDJ 73/74) : on saute le step Destination
  // et on auto-remplit la zone. Pas applicable en contact direct (un centre précis est déjà ciblé).
  const skipDestination = !!reseauInfo?.departementsDefaut?.length && !estContactDirect;

  // Steps : 1=TypeStructure, 2=Infos, 3=Géographie(si destination), 4=Récap, 5=Coordonnées
  // Sans destination (contact direct OU réseau pré-rempli) : 1=Type, 2=Infos, 3=Récap, 4=Coordonnées
  const [step, setStep]               = useState(1);
  const [form, setForm]               = useState<SejourFormData>(() =>
    skipDestination
      ? {
          ...INITIAL_DATA,
          typeZone: 'DEPARTEMENT',
          departementsCibles: reseauInfo!.departementsDefaut!,
          // Step Destination sauté → date butoire non saisie : défaut J+30.
          dateButoireDevis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }
      : INITIAL_DATA,
  );
  const [typeStructure, setTypeStructure] = useState('');
  const [prenom, setPrenom]           = useState('');
  const [nom, setNom]                 = useState('');
  const [email, setEmail]             = useState('');
  const [telephone, setTelephone]     = useState('');
  const [typePension, setTypePension] = useState<string[]>([]);
  // Établissement : sélection annuaire (selectedOrg) OU saisie manuelle (fallback).
  const [selectedOrg, setSelectedOrg] = useState<OrganisationResult | null>(null);
  const [manualMode, setManualMode]   = useState(false);
  const [manualNom, setManualNom]     = useState('');
  const [manualVille, setManualVille] = useState('');
  const [isPending, setIsPending]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const estHorsScolaireUser = HORS_SCOLAIRE_TYPES.has(typeStructure);
  const sansDestination = estContactDirect || skipDestination;
  const stepLabels = sansDestination
    ? ['Type', 'Informations', 'Récapitulatif', 'Coordonnées']
    : ['Type', 'Informations', 'Destination', 'Récapitulatif', 'Coordonnées'];
  const totalSteps = stepLabels.length;

  // Mapping step → composant
  const stepForGeo   = sansDestination ? 99 : 3;
  const stepForRecap = sansDestination ? 3 : 4;
  const stepForCoord = sansDestination ? 4 : 5;

  const canAdvance = () => {
    if (step === 1) return !!typeStructure;
    if (step === 2) {
      const datesOk = form.datesFlexibles
        ? (form.moisSouhaite || form.noteDateFlexible || form.dureeNuits)  // au moins un champ période
        : (form.dateDebut && form.dateFin);
      const base = form.titre && datesOk && form.nbEleves;
      if (estHorsScolaireUser) return !!(base && form.ageMin && form.ageMax && form.typeAccueilACM && form.projetEducatif);
      return !!(base && form.niveauClasse && form.thematiquesPedagogiques.length > 0);
    }
    if (step === stepForGeo) return !!(form.typeZone && form.zoneGeographique && form.dateButoireDevis);
    if (step === stepForCoord) {
      // Téléphone obligatoire : l'hébergeur doit pouvoir rappeler l'organisateur.
      // Établissement obligatoire : annuaire sélectionné OU saisie manuelle (nom + ville).
      const telOk = !!telephone.trim();
      return telOk && (manualMode ? !!(manualNom.trim() && manualVille.trim()) : !!selectedOrg);
    }
    return true;
  };

  const buildRegionCible = () => {
    if (!form.typeZone || form.typeZone === 'FRANCE' || !form.zoneGeographique) return undefined;
    if (form.typeZone === 'REGION')      return `REGION:${form.zoneGeographique}`;
    if (form.typeZone === 'DEPARTEMENT') return `DEPARTEMENT:${form.zoneGeographique}`;
    if (form.typeZone === 'VILLE')       return `VILLE:${form.zoneGeographique}`;
    return undefined;
  };

  const handleSubmit = async () => {
    if (!prenom || !nom || !email) { setError('Veuillez renseigner vos coordonnées.'); return; }
    setError(null);
    setIsPending(true);
    try {
      await soumettreDemandePublique({
        prenom, nom, email,
        typeStructure:           typeStructure || undefined,
        etablissementNom:        (manualMode ? manualNom.trim() : selectedOrg?.nom) || undefined,
        etablissementVille:      (manualMode ? manualVille.trim() : selectedOrg?.ville) || undefined,
        etablissementUai:        manualMode ? undefined : (selectedOrg?.uai ?? undefined),
        titre:                   form.titre,
        ...(form.datesFlexibles
          ? {
              moisSouhaite:     form.moisSouhaite ? parseInt(form.moisSouhaite, 10) : undefined,
              anneeSouhaitee:   form.anneeSouhaitee ? parseInt(form.anneeSouhaitee, 10) : undefined,
              noteDateFlexible: form.noteDateFlexible || undefined,
              dureeNuits:       form.dureeNuits ? parseInt(form.dureeNuits, 10) : undefined,
            }
          : { dateDebut: form.dateDebut, dateFin: form.dateFin }),
        nombreEleves:            parseInt(form.nbEleves, 10),
        niveauClasse:            estHorsScolaireUser ? undefined : form.niveauClasse || undefined,
        thematiquesPedagogiques: estHorsScolaireUser ? [] : form.thematiquesPedagogiques,
        regionCible:             buildRegionCible(),
        departementsCibles:      form.departementsCibles.length ? form.departementsCibles : undefined,
        villeHebergement:        form.zoneGeographique || undefined,
        centreDestinataireId:    centreId,
        dateButoireReponse:      form.dateButoireDevis || undefined,
        nombreAccompagnateurs:   form.nombreAccompagnateurs ? parseInt(form.nombreAccompagnateurs, 10) : undefined,
        heureArrivee:            form.heureArrivee || undefined,
        heureDepart:             form.heureDepart || undefined,
        transportAller:          form.transportAller || undefined,
        transportSurPlace:       form.transportSurPlace,
        activitesSouhaitees:     form.activitesSouhaitees || undefined,
        typePension:             typePension.length ? typePension : undefined,
        budgetMaxParEleve:       form.budgetMaxParEleve ? parseFloat(form.budgetMaxParEleve) : undefined,
        informationsComplementaires: form.informationsComplementaires || undefined,
        ageMin:                  estHorsScolaireUser && form.ageMin ? parseInt(form.ageMin, 10) : undefined,
        ageMax:                  estHorsScolaireUser && form.ageMax ? parseInt(form.ageMax, 10) : undefined,
        moinsde6ans:             estHorsScolaireUser ? form.moinsde6ans : undefined,
        typeAccueilACM:          estHorsScolaireUser ? form.typeAccueilACM : undefined,
        projetEducatif:          estHorsScolaireUser ? form.projetEducatif : undefined,
        sourceReseau:            reseauParam || undefined,
        telephone:               telephone.trim() || undefined,
      });
      setSubmittedEmail(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
    } finally {
      setIsPending(false);
    }
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Demande envoyée !</h1>
        <p className="text-gray-500 mb-4">
          Un email a été envoyé à <strong>{submittedEmail}</strong> avec un lien pour suivre les réponses.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-6">
          Pensez à vérifier vos spams si vous ne trouvez pas l&apos;email.
        </div>
        <Link href="/catalogue" className="text-sm text-[var(--color-primary)] hover:underline">← Retour au catalogue</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {reseauInfo ? (
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4 min-w-0">
              {reseauInfo.logo ? (
                <img src={reseauInfo.logo} alt={reseauInfo.nom} className="h-12 w-auto" />
              ) : (
                <span className="text-lg font-bold truncate" style={{ color: reseauInfo.couleurPrimaire }}>
                  {reseauInfo.nom}
                </span>
              )}
              <div className="border-l border-gray-200 pl-4 flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-gray-400">propulsé par</span>
                <div className="opacity-60"><Logo size="sm" showTagline={false} /></div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Une question ? On vous accompagne</p>
              <a href="tel:+33450456954" className="text-base font-semibold text-gray-900 hover:underline">
                📞 04 50 45 69 54
              </a>
              <p className="text-xs text-gray-400 mt-0.5">{reseauInfo.email}</p>
            </div>
          </div>
        </header>
      ) : (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/"><Logo size="sm" showTagline={false} /></Link>
              <Link href="/catalogue" className="text-sm text-gray-500 hover:text-gray-900">← Catalogue</Link>
            </div>
          </div>
        </nav>
      )}

      <main
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
        style={reseauInfo ? ({ '--color-primary': reseauInfo.couleurSecondaire } as CSSProperties) : undefined}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {estContactDirect
              ? `Envoyer une demande à ${centreNom ?? 'ce centre'}`
              : (reseauInfo?.titrePage ?? "Lancer un appel d'offres")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {estContactDirect
              ? 'Décrivez votre séjour — le centre vous répondra directement.'
              : (reseauInfo?.sousTitrePage ?? 'Décrivez votre séjour — les centres de votre zone vous envoient leurs devis.')}
          </p>
        </div>

        <StepIndicator current={step} labels={stepLabels} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Step 1 — Type de structure */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Vous êtes…</h2>
              <div className="space-y-2">
                {TYPE_STRUCTURE_OPTIONS.map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                    typeStructure === opt.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="typeStructure" value={opt.value}
                      checked={typeStructure === opt.value}
                      onChange={() => setTypeStructure(opt.value)}
                      className="mt-1 accent-[var(--color-primary)]" />
                    <div>
                      <div className={`text-sm font-semibold ${typeStructure === opt.value ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                        {opt.label}
                      </div>
                      {opt.sub && <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Infos séjour */}
          {step === 2 && (
            <>
              <EtapeInfos form={form} setForm={setForm} estHorsScolaireUser={estHorsScolaireUser} />
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de pension <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="space-y-2">
                  {([['PENSION_COMPLETE', 'Pension complète'], ['DEMI_PENSION', 'Demi-pension'], ['GESTION_LIBRE', 'Gestion libre']] as const).map(([val, label]) => {
                    const checked = typePension.includes(val);
                    return (
                      <label key={val} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setTypePension((prev) => checked ? prev.filter((v) => v !== val) : [...prev, val])}
                          className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)]"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Géographie (appel d'offres uniquement) */}
          {step === stepForGeo && (
            <EtapeGeographie form={form} setForm={setForm} />
          )}

          {/* Step récap */}
          {step === stepForRecap && (
            <EtapeRecapitulatif form={form} estHorsScolaireUser={estHorsScolaireUser} />
          )}

          {/* Step coordonnées */}
          {step === stepForCoord && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Vos coordonnées</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom *</label>
                  <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                  <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email professionnel *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.fr" className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone *</label>
                <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)}
                  placeholder="06 12 34 56 78" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre établissement *</label>

                {manualMode ? (
                  <div className="space-y-2">
                    <input type="text" value={manualNom} onChange={(e) => setManualNom(e.target.value)}
                      placeholder="Nom de l'établissement *" className={inputCls} />
                    <input type="text" value={manualVille} onChange={(e) => setManualVille(e.target.value)}
                      placeholder="Ville *" className={inputCls} />
                    <button type="button"
                      onClick={() => { setManualMode(false); setManualNom(''); setManualVille(''); }}
                      className="text-xs text-[var(--color-primary)] hover:underline">
                      ← Rechercher dans l&apos;annuaire
                    </button>
                  </div>
                ) : selectedOrg ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedOrg.nom}</p>
                      {selectedOrg.ville && <p className="text-xs text-gray-500">{selectedOrg.ville}</p>}
                    </div>
                    <button type="button" onClick={() => setSelectedOrg(null)}
                      className="shrink-0 text-gray-400 hover:text-red-500 text-lg leading-none" aria-label="Réinitialiser l'établissement">
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <OrganisationSearch
                      onSelect={(org) => setSelectedOrg(org)}
                      placeholder="Rechercher votre établissement…"
                      sireneSearchFn={sirenePublic}
                    />
                    <button type="button"
                      onClick={() => { setManualMode(true); setSelectedOrg(null); }}
                      className="mt-1 text-xs text-[var(--color-primary)] hover:underline">
                      Mon établissement n&apos;apparaît pas
                    </button>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Votre espace LIAVO sera créé automatiquement. Vous recevrez un lien par email pour y accéder.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 1}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Précédent
            </button>
            {step < totalSteps ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                Suivant →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={isPending || !canAdvance()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">
                {isPending
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi…</>
                  : 'Envoyer ma demande'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AppelOffresPage() {
  return <Suspense><AppelOffresContent /></Suspense>;
}
