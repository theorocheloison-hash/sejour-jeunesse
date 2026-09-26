'use client';

import { useEffect, useState } from 'react';

export interface BarreEnregistrementProps {
  /** Des modifications non enregistrées existent (la barre s'affiche). */
  visible: boolean;
  /** Enregistrement en cours (spinner, boutons désactivés). */
  enregistrement: boolean;
  /** Message d'erreur serveur/validation, affiché en entier à côté des boutons. */
  erreur: string | null;
  /** Dernier enregistrement réussi — affiché 3 s puis masqué. */
  succes: boolean;
  onEnregistrer: () => void;
  onAnnuler: () => void;
  libelle?: string;
}

/**
 * Barre d'enregistrement fixe en bas d'écran (lot A profil, réutilisable) :
 * état « modifications non enregistrées », erreur serveur complète, succès
 * éphémère, boutons Annuler / Enregistrer accessibles sans défiler.
 * z-40 : au-dessus du contenu, sous les modales existantes (z-50).
 */
export default function BarreEnregistrement({
  visible,
  enregistrement,
  erreur,
  succes,
  onEnregistrer,
  onAnnuler,
  libelle = 'Modifications non enregistrées',
}: BarreEnregistrementProps) {
  // Succès éphémère : affiché 3 s, minuteur nettoyé au démontage / re-déclenchement.
  // `expire` est remis à zéro PENDANT le rendu quand `succes` change (pattern React
  // « adjusting state during render ») ; l'effet ne fait que poser le minuteur.
  const [succesPrecedent, setSuccesPrecedent] = useState(succes);
  const [expire, setExpire] = useState(false);
  if (succes !== succesPrecedent) {
    setSuccesPrecedent(succes);
    setExpire(false);
  }
  useEffect(() => {
    if (!succes) return;
    const timer = setTimeout(() => setExpire(true), 3000);
    return () => clearTimeout(timer);
  }, [succes]);
  const succesAffiche = succes && !expire;

  if (!visible && !erreur && !succesAffiche) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)] print:hidden">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {erreur ? (
            <p className="text-sm text-red-700 whitespace-pre-wrap break-words">{erreur}</p>
          ) : visible ? (
            <p className="text-sm font-medium text-gray-700">{libelle}</p>
          ) : (
            <p className="text-sm font-medium text-green-700">Profil enregistré</p>
          )}
        </div>
        {(visible || erreur) && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={onAnnuler}
              disabled={enregistrement}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler les modifications
            </button>
            <button
              type="button"
              onClick={onEnregistrer}
              disabled={enregistrement}
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {enregistrement ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
