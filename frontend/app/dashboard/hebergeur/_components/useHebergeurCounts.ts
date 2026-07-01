'use client';
import { useCallback, useEffect, useState } from 'react';
import { getDemandesOuvertes } from '@/src/lib/demande';
import { getRappelsToday } from '@/src/lib/clients';
import { getMesDevis } from '@/src/lib/devis';
import { computeAlertes } from '@/src/lib/devisAlertes';
import { getMesCentres } from '@/src/lib/centre';
import { getMesNonLus } from '@/src/lib/collaboration';
import type { CentreResume } from '@/src/lib/centre';

export function useHebergeurCounts() {
  // getMesCentres() (pas getMonProfil) : ce dernier porte @RequirePermission('parametres')
  // et est rejeté pour un collaborateur sans ce droit → centre null + sidebar vide.
  const [centre, setCentre] = useState<CentreResume | null>(null);
  const [demandesCount, setDemandesCount] = useState(0);
  const [rappelsCount, setRappelsCount] = useState(0);
  const [actionsFactCount, setActionsFactCount] = useState(0);
  const [sejoursNonLusCount, setSejoursNonLusCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profil, demandes, rappels, devis, nonLus] = await Promise.all([
        getMesCentres().then(cs => cs[0] ?? null).catch(() => null),
        getDemandesOuvertes().catch(() => []),
        getRappelsToday().catch(() => []),
        getMesDevis().catch(() => []),
        getMesNonLus().catch(() => ({ total: 0, parSejour: [] })),
      ]);
      setCentre(profil);
      setDemandesCount(demandes.length);
      setRappelsCount(rappels.length);
      // Badge sidebar = même source de vérité que le bandeau alertes de la page devis
      // et la tuile "Devis & Facturation" du dashboard (alertes 30j typées).
      setActionsFactCount(computeAlertes(devis).total);
      setSejoursNonLusCount(nonLus.total);
    } catch { /* ignore */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount, loaded, reload: load };
}
