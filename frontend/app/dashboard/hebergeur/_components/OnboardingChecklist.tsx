'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import WelcomeModal from './WelcomeModal';

// ─── Types (réponse GET /centres/onboarding-status) ─────────────────────────

type Justificatif = 'ABSENT' | 'EN_ATTENTE_VALIDATION' | 'VALIDE';

interface OnboardingStatus {
  etapes: {
    profil: { ok: boolean };
    catalogue: { ok: boolean };
    conformite: { justificatif: Justificatif; iban: boolean; ok: boolean };
    sejour: { ok: boolean; id: string | null };
    devis: { ok: boolean };
  };
  centreValide: boolean;
  envoisBloques: boolean;
  complete: boolean;
}

const OCRE = '#C87D2E';

// Confettis déterministes (CSS pur, une seule passe de 2s).
const CONFETTIS = [
  { left: '6%',  delay: '0s',    couleur: '#C87D2E' },
  { left: '14%', delay: '0.25s', couleur: '#1B4060' },
  { left: '22%', delay: '0.1s',  couleur: '#16a34a' },
  { left: '31%', delay: '0.4s',  couleur: '#C87D2E' },
  { left: '39%', delay: '0.05s', couleur: '#1B4060' },
  { left: '47%', delay: '0.3s',  couleur: '#C87D2E' },
  { left: '55%', delay: '0.15s', couleur: '#16a34a' },
  { left: '63%', delay: '0.45s', couleur: '#1B4060' },
  { left: '71%', delay: '0.2s',  couleur: '#C87D2E' },
  { left: '79%', delay: '0.35s', couleur: '#16a34a' },
  { left: '87%', delay: '0.08s', couleur: '#1B4060' },
  { left: '94%', delay: '0.28s', couleur: '#C87D2E' },
];

// ─── Pastille d'état d'une étape ─────────────────────────────────────────────

function Pastille({ ok, accent }: { ok: boolean; accent?: boolean }) {
  if (ok) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] liavo-check-pop">
        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 bg-white"
      style={{ borderColor: accent ? OCRE : '#d1d5db' }}
    />
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function OnboardingChecklist() {
  const { user, centres, centreActif } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [replie, setReplie] = useState(false);
  // true par défaut : pas de flash confetti avant lecture du localStorage.
  const [feteVue, setFeteVue] = useState(true);

  const centre = centres.find((c) => c.id === centreActif) ?? null;

  // État persisté par centre (jamais de clé globale — multi-centre).
  useEffect(() => {
    if (!centreActif) return;
    setReplie(localStorage.getItem(`liavo_onboarding_replie_${centreActif}`) === '1');
    setFeteVue(localStorage.getItem(`liavo_onboarding_fete_${centreActif}`) === '1');
  }, [centreActif]);

  useEffect(() => {
    if (!centreActif) return;
    let cancelled = false;
    setChargement(true);
    setErreur(false);
    api
      .get<OnboardingStatus>('/centres/onboarding-status')
      .then(({ data }) => { if (!cancelled) setStatus(data); })
      .catch(() => { if (!cancelled) setErreur(true); })
      .finally(() => { if (!cancelled) setChargement(false); });
    return () => { cancelled = true; };
  }, [centreActif]);

  // La célébration ne se joue qu'une fois : clé posée dès son affichage.
  const celebration = !!status?.complete && !feteVue;
  useEffect(() => {
    if (celebration && centreActif) {
      localStorage.setItem(`liavo_onboarding_fete_${centreActif}`, '1');
    }
  }, [celebration, centreActif]);

  // Un collaborateur ne doit jamais voir "renseignez votre IBAN" :
  // ownership déjà chargée par AuthContext (mes-centres → isOwned).
  if (!centreActif || !centre || !centre.isOwned) return null;
  // Erreur réseau : pas de carte d'erreur anxiogène sur le dashboard.
  if (erreur) return null;

  if (chargement) {
    return (
      <div className="w-full animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 h-4 w-48 rounded bg-gray-200" />
        <div className="mb-4 h-1.5 w-full rounded-full bg-gray-100" />
        <div className="space-y-2">
          <div className="h-3 w-2/3 rounded bg-gray-100" />
          <div className="h-3 w-1/2 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!status) return null;
  // Terminé et célébration déjà vue → la carte ne se ré-affiche plus.
  if (status.complete && feteVue) return null;

  const { profil, catalogue, conformite, sejour, devis } = status.etapes;
  const faites = [profil.ok, catalogue.ok, conformite.ok, sejour.ok, devis.ok].filter(Boolean).length;
  const pct = (faites / 5) * 100;

  // Étape 5 : mène directement à la création du devis sur le séjour le plus
  // récent ; sans séjour, retour au planning (l'étape 4 le crée).
  const devisHref = status.etapes.sejour.id
    ? `/dashboard/hebergeur/devis/nouveau?sejourDirectId=${status.etapes.sejour.id}`
    : '/dashboard/hebergeur/planning';

  const keyframes = (
    <style>{`
      @keyframes liavo-check-pop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
      .liavo-check-pop { animation: liavo-check-pop 0.35s ease-out both; }
      @keyframes liavo-confetti {
        0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(160px) rotate(320deg); opacity: 0; }
      }
      .liavo-confetti { animation: liavo-confetti 2s ease-in both; }
    `}</style>
  );

  // ── État célébration (une seule fois) ──
  if (status.complete) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {keyframes}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTIS.map((c, i) => (
            <span
              key={i}
              className="liavo-confetti absolute top-0 block h-2 w-2 rounded-sm"
              style={{ left: c.left, backgroundColor: c.couleur, animationDelay: c.delay }}
            />
          ))}
        </div>
        <p className="text-lg font-bold text-[var(--color-primary)]">Votre centre est prêt 🎉</p>
        <p className="mt-1 text-sm text-gray-500">
          Profil, catalogue, conformité, séjour, devis : tout est en place. Bonne saison avec LIAVO !
        </p>
      </div>
    );
  }

  // ── État replié : une seule ligne ──
  if (replie) {
    return (
      <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <p className="min-w-0 truncate text-sm text-gray-600">
          <span className="font-semibold text-[var(--color-primary)]">Démarrage</span>
          {' · '}
          <span className="font-semibold" style={{ color: OCRE }}>{faites}/5</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setReplie(false);
            localStorage.removeItem(`liavo_onboarding_replie_${centreActif}`);
          }}
          className="shrink-0 text-sm font-semibold hover:underline"
          style={{ color: OCRE }}
        >
          reprendre
        </button>
      </div>
    );
  }

  // ── Lignes d'étapes ──
  const ligne = (
    ok: boolean,
    label: string,
    detail: string | null,
    href: string,
    action: string,
    accent = false,
  ) => (
    <li className="flex items-start gap-3">
      <Pastille ok={ok} accent={accent} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`text-sm ${ok ? 'text-gray-400 line-through' : accent ? 'font-semibold' : 'font-medium text-gray-800'}`} style={!ok && accent ? { color: OCRE } : undefined}>
            {label}
          </span>
          {detail && !ok && <span className="text-xs text-gray-400">{detail}</span>}
        </div>
        {!ok && (
          <Link href={href} className="mt-0.5 inline-block text-xs font-semibold hover:underline" style={{ color: accent ? OCRE : 'var(--color-primary)' }}>
            {action} →
          </Link>
        )}
      </div>
    </li>
  );

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      {keyframes}
      {user && (
        <WelcomeModal centreId={centreActif} prenom={user.firstName} etapesFaites={faites} />
      )}

      {/* En-tête : titre + compteur + repli */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-base font-bold text-[var(--color-primary)] sm:text-lg">
          Démarrez avec {centre.nom}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: OCRE }}>{faites}/5</span>
          <button
            type="button"
            aria-label="Réduire la checklist"
            onClick={() => {
              setReplie(true);
              localStorage.setItem(`liavo_onboarding_replie_${centreActif}`, '1');
            }}
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: OCRE }}
        />
      </div>

      <ul className="space-y-3">
        {ligne(profil.ok, 'Présentez votre centre', 'photo + description', '/dashboard/hebergeur/profil', 'Compléter le profil')}
        {ligne(catalogue.ok, 'Créez vos prestations et tarifs', null, '/dashboard/hebergeur/catalogue', 'Ouvrir le catalogue')}

        {/* Documents de conformité : sous-états justificatif + IBAN */}
        <li className="flex items-start gap-3">
          <Pastille ok={conformite.ok} />
          <div className="min-w-0 flex-1">
            <span className={`text-sm ${conformite.ok ? 'text-gray-400 line-through' : 'font-medium text-gray-800'}`}>
              Documents de conformité
            </span>
            {!conformite.ok || conformite.justificatif === 'EN_ATTENTE_VALIDATION' ? (
              <div className="mt-1 space-y-1">
                {conformite.justificatif === 'ABSENT' && (
                  <Link href="/dashboard/hebergeur/documents" className="block text-xs font-semibold text-[var(--color-primary)] hover:underline">
                    Déposer un justificatif →
                  </Link>
                )}
                {conformite.justificatif === 'EN_ATTENTE_VALIDATION' && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Justificatif en cours d&apos;examen
                  </p>
                )}
                {!conformite.iban && (
                  <Link href="/dashboard/hebergeur/profil" className="block text-xs font-semibold text-[var(--color-primary)] hover:underline">
                    Renseigner votre IBAN →
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </li>

        {ligne(sejour.ok, 'Créez votre premier séjour', null, '/dashboard/hebergeur/planning', 'Ouvrir le planning')}
        {ligne(devis.ok, 'Envoyez votre premier devis', 'étape finale', devisHref, 'Créer un devis', true)}
      </ul>

      {/* Découverte passive des features avancées. Séparateur porté par ce bloc
          uniquement quand la note de validation (qui a le sien) ne suit pas. */}
      <div className={`mt-4 ${!status.envoisBloques ? 'border-t border-gray-100 pt-3' : ''}`}>
        <p className="mb-2 text-xs font-semibold text-gray-500">Aller plus loin</p>
        <div className="flex flex-col gap-1.5">
          <Link href="/dashboard/hebergeur/inviter-enseignant" className="text-xs font-medium text-[var(--color-primary)] hover:underline">
            Inviter un organisateur →
          </Link>
          <Link href="/dashboard/hebergeur/equipe" className="text-xs font-medium text-[var(--color-primary)] hover:underline">
            Inviter vos collaborateurs →
          </Link>
          <Link href="/dashboard/hebergeur/pilotage" className="text-xs font-medium text-[var(--color-primary)] hover:underline">
            Suivre votre chiffre d&apos;affaires →
          </Link>
        </div>
      </div>

      {status.envoisBloques && (
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          Centre en cours de validation par l&apos;équipe LIAVO — testez tout en vous envoyant
          vos documents à vous-même.
        </p>
      )}
    </div>
  );
}
