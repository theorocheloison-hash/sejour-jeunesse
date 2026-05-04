'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { soumettreDemandePublique } from '@/src/lib/public';
import { Logo } from '@/app/components/Logo';

const TYPE_STRUCTURE_OPTIONS = [
  { value: 'COLLEGE_LYCEE',   label: 'Collège ou lycée' },
  { value: 'ECOLE_PRIMAIRE',  label: 'École primaire' },
  { value: 'MAIRIE',          label: 'Mairie ou collectivité' },
  { value: 'CENTRE_LOISIRS',  label: 'Centre de loisirs (ALSH)' },
  { value: 'ASSOCIATION',     label: 'Association' },
  { value: 'COMITE_ENTREPRISE', label: "Comité d'entreprise" },
  { value: 'AUTRE',           label: 'Autre' },
];

const REGIONS = [
  'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne',
  'Centre-Val de Loire','Corse','Grand Est','Hauts-de-France',
  'Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie',
  'Pays de la Loire',"Provence-Alpes-Côte d'Azur",
];

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50';

function AppelOffresContent() {
  const searchParams = useSearchParams();
  const centreId   = searchParams.get('centreId') ?? undefined;
  const centreNom  = searchParams.get('centreNom') ?? undefined;

  const [step, setStep] = useState(1);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Données séjour
  const [titre, setTitre]               = useState('');
  const [dateDebut, setDateDebut]       = useState('');
  const [dateFin, setDateFin]           = useState('');
  const [nombreEleves, setNombreEleves] = useState('');
  const [niveauClasse, setNiveauClasse] = useState('');

  // Destination (step 2 — seulement si appel d'offres)
  const [region, setRegion]             = useState('');
  const [villeHeberg, setVilleHeberg]   = useState('');

  // Coordonnées (step 3)
  const [prenom, setPrenom]             = useState('');
  const [nom, setNom]                   = useState('');
  const [email, setEmail]               = useState('');
  const [typeStructure, setTypeStructure] = useState('');
  const [etablissementNom, setEtablissementNom] = useState('');

  const estContactDirect = !!centreId;
  const totalSteps = estContactDirect ? 2 : 3;

  const canAdvance = () => {
    if (step === 1) return titre && dateDebut && dateFin && nombreEleves;
    if (step === 2 && !estContactDirect) return region || villeHeberg;
    return true;
  };

  const handleSubmit = async () => {
    if (!prenom || !nom || !email) {
      setError('Veuillez renseigner vos coordonnées.');
      return;
    }
    setError(null);
    setIsPending(true);
    try {
      await soumettreDemandePublique({
        prenom,
        nom,
        email,
        typeStructure:      typeStructure || undefined,
        etablissementNom:   etablissementNom || undefined,
        titre,
        dateDebut,
        dateFin,
        nombreEleves:       parseInt(nombreEleves, 10),
        niveauClasse:       niveauClasse || undefined,
        regionCible:        region || undefined,
        villeHebergement:   villeHeberg || undefined,
        centreDestinataireId: centreId,
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-light)] mb-6">
          <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Demande envoyée !</h1>
        <p className="text-gray-500 mb-4">
          Un email a été envoyé à <strong>{submittedEmail}</strong> avec un lien
          pour suivre les réponses et accéder à votre espace LIAVO.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-6">
          Pensez à vérifier vos spams si vous ne trouvez pas l&apos;email.
        </div>
        <Link href="/catalogue" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Retour au catalogue
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/"><Logo size="sm" showTagline={false} /></Link>
            <Link href="/catalogue" className="text-sm text-gray-500 hover:text-gray-900">
              ← Catalogue
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {estContactDirect
              ? `Envoyer une demande à ${centreNom ?? 'ce centre'}`
              : 'Lancer un appel d\'offres'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {estContactDirect
              ? 'Décrivez votre séjour — le centre vous répondra directement.'
              : 'Décrivez votre séjour — les centres de votre zone vous envoient leurs devis.'}
          </p>
        </div>

        {/* Indicateur étapes */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s < step ? 'bg-[var(--color-primary)] text-white'
                : s === step ? 'bg-[var(--color-primary)] text-white ring-4 ring-indigo-100'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < totalSteps && <div className={`flex-1 h-0.5 ${s < step ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Step 1 — Infos séjour */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Votre séjour</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre du séjour *</label>
                <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex : Séjour ski 4ème A — Janvier 2026"
                  className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date d&apos;arrivée *</label>
                  <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de départ *</label>
                  <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputCls} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre d&apos;élèves *</label>
                  <input type="number" min="1" value={nombreEleves} onChange={(e) => setNombreEleves(e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Niveau de classe</label>
                  <input type="text" value={niveauClasse} onChange={(e) => setNiveauClasse(e.target.value)}
                    placeholder="Ex : 4ème" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Destination (appel d'offres uniquement) */}
          {step === 2 && !estContactDirect && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Destination souhaitée</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Région</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
                  <option value="">Toute la France</option>
                  {REGIONS.map((r) => <option key={r} value={`REGION:${r}`}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ou ville / zone précise</label>
                <input type="text" value={villeHeberg} onChange={(e) => setVilleHeberg(e.target.value)}
                  placeholder="Ex : Chamonix, Alpes…" className={inputCls} />
              </div>
            </div>
          )}

          {/* Dernière étape — Coordonnées */}
          {((step === 2 && estContactDirect) || (step === 3 && !estContactDirect)) && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de structure</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_STRUCTURE_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors ${
                      typeStructure === opt.value
                        ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="typeStructure" value={opt.value}
                        checked={typeStructure === opt.value}
                        onChange={() => setTypeStructure(opt.value)}
                        className="accent-[var(--color-primary)]" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nom de votre établissement
                </label>
                <input type="text" value={etablissementNom} onChange={(e) => setEtablissementNom(e.target.value)}
                  placeholder="Ex : Collège Victor Hugo, Mairie de Morillon…" className={inputCls} />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Votre espace LIAVO sera créé automatiquement. Vous recevrez un lien par email pour y accéder et définir votre mot de passe.
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
              <button type="button" onClick={handleSubmit} disabled={isPending}
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
