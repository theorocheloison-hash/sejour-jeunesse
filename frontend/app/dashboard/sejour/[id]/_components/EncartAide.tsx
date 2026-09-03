'use client';

import { useState } from 'react';

/**
 * Encart repliable « Comment fonctionne cet espace » (D4/D14) — affiché en tête
 * de l'espace pour l'organisateur créateur. État replié/déplié en mémoire
 * uniquement (pas de localStorage) : les consignes durables vivent dans les
 * blocs vides.
 */
export default function EncartAide() {
  const [ouvert, setOuvert] = useState(true);

  return (
    <div className="bg-[var(--color-primary-light)] border-b border-gray-200 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <button
          onClick={() => setOuvert((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-[var(--color-primary)]"
        >
          <span>Comment fonctionne cet espace ?</span>
          <svg
            className={`h-4 w-4 shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {ouvert && (
          <div className="mt-2 space-y-1.5 text-sm text-gray-700">
            <p>
              <strong>Vous organisez, l&apos;hébergeur vous accueille.</strong> L&apos;hébergeur gère le lieu,
              les chambres et le devis ; vous pilotez votre dossier (signature, budget, projet pédagogique)
              et le séjour lui-même. Les onglets Messages et Documents servent à échanger avec lui.
            </p>
            <p>
              <strong>Les inscriptions des élèves sont votre responsabilité.</strong> Deux façons de faire,
              au choix dans le bloc Inscriptions : <em>faire remplir par les familles</em> (vous ajoutez vos
              élèves puis envoyez aux parents un lien d&apos;autorisation à signer en ligne) ou{' '}
              <em>saisir vous-même la liste</em> (vous gérez les autorisations papier de votre côté).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
