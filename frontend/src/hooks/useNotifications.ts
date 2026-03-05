import { useEffect, useState } from 'react';
import { getDemandesOuvertes } from '@/src/lib/demande';
import { getMesDevis } from '@/src/lib/devis';

interface Notifications {
  demandes: number;
  devisAcceptes: number;
}

export function useNotifications(enabled: boolean) {
  const [counts, setCounts] = useState<Notifications>({ demandes: 0, devisAcceptes: 0 });

  useEffect(() => {
    if (!enabled) return;

    const fetch = async () => {
      try {
        const [demandes, devis] = await Promise.all([
          getDemandesOuvertes().catch(() => []),
          getMesDevis().catch(() => []),
        ]);
        setCounts({
          demandes: demandes.length,
          devisAcceptes: devis.filter((d) => d.statut === 'ACCEPTE' || d.statut === 'SELECTIONNE').length,
        });
      } catch {
        // silently ignore
      }
    };

    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [enabled]);

  return counts;
}
