'use client';

import { useEffect } from 'react';

/**
 * Garde « modifications non enregistrées » (lot A profil, réutilisable) :
 * - fermeture / rechargement de l'onglet → avertissement natif du navigateur
 *   (beforeunload) ;
 * - clic sur un lien interne (<a>) → window.confirm, navigation annulable.
 *
 * Limite assumée : le bouton « précédent » du navigateur en navigation interne
 * (App Router) n'est pas intercepté — Next n'expose pas de garde de route ;
 * beforeunload ne couvre que les sorties de page complètes.
 */
export default function useGardeModificationsNonEnregistrees(actif: boolean) {
  useEffect(() => {
    if (!actif) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // Phase de CAPTURE : on passe avant le routeur Next (les <Link> rendent des <a>).
    const onClickCapture = (e: MouseEvent) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const lien = (e.target as HTMLElement | null)?.closest?.('a');
      if (!lien) return;
      if (!lien.getAttribute('href') || lien.target === '_blank' || lien.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(lien.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Ancre sur la page courante (hash seul) → pas une sortie.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm('Vous avez des modifications non enregistrées. Quitter sans enregistrer ?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [actif]);
}
