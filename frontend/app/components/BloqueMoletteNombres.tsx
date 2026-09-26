'use client';

import { useEffect } from 'react';

/**
 * Empêche la molette de modifier un champ numérique (<input type="number">) :
 * sur un champ qui a le focus, le navigateur incrémente/décrémente la valeur au
 * défilement — une pointure, une quantité ou un montant changeait sans que
 * l'utilisateur s'en aperçoive. On retire le focus au premier cran : la page
 * défile normalement et la valeur reste intacte.
 * Monté UNE fois dans le layout racine : couvre tous les formulaires, sans
 * gestionnaire par champ. Listener passif (aucun preventDefault).
 */
export default function BloqueMoletteNombres() {
  useEffect(() => {
    const surMolette = () => {
      const actif = document.activeElement;
      if (actif instanceof HTMLInputElement && actif.type === 'number') actif.blur();
    };
    document.addEventListener('wheel', surMolette, { passive: true });
    return () => document.removeEventListener('wheel', surMolette);
  }, []);
  return null;
}
