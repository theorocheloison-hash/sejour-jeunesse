'use client';

export interface SousVue {
  key: string;
  label: string;
  actif: boolean;
  onSelect: () => void;
}

/**
 * Sous-onglets des blocs multi-vues (P8) — Sur place, Échanges, Réservation.
 * Gabarit COPIÉ de la barre d'onglets historique de la page (même hauteur py-3,
 * bordure basse, actif souligné var(--color-primary)) pour être immédiatement
 * reconnu comme des onglets — le JSX de la barre historique n'est pas touché.
 */
export default function SousOnglets({ vues }: { vues: SousVue[] }) {
  if (vues.length <= 1) return null;
  return (
    <div className="border-t border-gray-200">
      {/* overflow-x-auto : sur mobile les onglets débordent et doivent rester atteignables */}
      <div className="flex gap-6 overflow-x-auto">
        {vues.map((vue) => (
          <button
            key={vue.key}
            onClick={vue.onSelect}
            className={`shrink-0 whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${
              vue.actif
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {vue.label}
          </button>
        ))}
      </div>
    </div>
  );
}
