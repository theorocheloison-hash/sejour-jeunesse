'use client';

import { useCallback, useEffect, useState } from 'react';

const ETAPES = [
  'Présentez votre centre',
  'Créez vos prestations et tarifs',
  'Documents de conformité',
  'Créez votre premier séjour',
  'Envoyez votre premier devis',
];

interface WelcomeModalProps {
  centreId: string;
  prenom: string;
  /** Nombre d'étapes déjà faites — le modal ne s'affiche qu'à 0 ou 1. */
  etapesFaites: number;
}

/**
 * Modal de bienvenue, première visite uniquement (clé localStorage par centre).
 * Un seul écran, un seul bouton — fermable par clic extérieur et Échap
 * (toute fermeture pose la clé : jamais de ré-affichage).
 */
export default function WelcomeModal({ centreId, prenom, etapesFaites }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (etapesFaites > 1) return;
    if (localStorage.getItem(`liavo_welcome_vu_${centreId}`) === '1') return;
    setVisible(true);
  }, [centreId, etapesFaites]);

  const fermer = useCallback(() => {
    localStorage.setItem(`liavo_welcome_vu_${centreId}`, '1');
    setVisible(false);
  }, [centreId]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, fermer]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue sur LIAVO"
      onClick={fermer}
    >
      <div
        className="flex h-full w-full flex-col justify-center overflow-y-auto bg-white p-6 sm:block sm:h-auto sm:max-w-md sm:rounded-2xl sm:p-8 sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[var(--color-primary)]">
          Bienvenue sur LIAVO{prenom ? ` ${prenom}` : ''} 👋
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Cinq étapes pour rendre votre centre pleinement opérationnel :
        </p>

        <ol className="mt-4 space-y-2">
          {ETAPES.map((label, i) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700">{label}</span>
            </li>
          ))}
        </ol>

        <p
          className="mt-5 rounded-lg px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: 'rgba(200,125,46,0.1)', color: '#C87D2E' }}
        >
          30 jours d&apos;essai Pilotage : tout est ouvert.
        </p>

        <button
          type="button"
          onClick={fermer}
          className="mt-6 w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          C&apos;est parti
        </button>
      </div>
    </div>
  );
}
