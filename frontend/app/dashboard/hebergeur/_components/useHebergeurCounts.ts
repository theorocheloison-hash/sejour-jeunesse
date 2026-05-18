'use client';
import { useCallback, useEffect, useState } from 'react';
import { getDemandesOuvertes } from '@/src/lib/demande';
import { getRappelsToday } from '@/src/lib/clients';
import { getMesDevis } from '@/src/lib/devis';
import { getMonProfil } from '@/src/lib/centre';
import type { Centre } from '@/src/lib/centre';

export function useHebergeurCounts() {
  const [centre, setCentre] = useState<Centre | null>(null);
  const [demandesCount, setDemandesCount] = useState(0);
  const [rappelsCount, setRappelsCount] = useState(0);
  const [actionsFactCount, setActionsFactCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profil, demandes, rappels, devis] = await Promise.all([
        getMonProfil().catch(() => null),
        getDemandesOuvertes().catch(() => []),
        getRappelsToday().catch(() => []),
        getMesDevis().catch(() => []),
      ]);
      setCentre(profil);
      setDemandesCount(demandes.length);
      setRappelsCount(rappels.length);
      const acomptesAttente = devis.filter((d: any) =>
        d.statut === 'SELECTIONNE' &&
        d.typeDocument === 'FACTURE_ACOMPTE' &&
        !d.acompteVerse
      ).length;
      const devisSignesAFacturer = devis.filter((d: any) =>
        d.statut === 'SELECTIONNE' &&
        d.signatureDirecteur &&
        (!d.typeDocument || d.typeDocument === 'DEVIS')
      ).length;
      setActionsFactCount(devisSignesAFacturer + acomptesAttente);
    } catch { /* ignore */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { centre, demandesCount, rappelsCount, actionsFactCount, loaded, reload: load };
}
