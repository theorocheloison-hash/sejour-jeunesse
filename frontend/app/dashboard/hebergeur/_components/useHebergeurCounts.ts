'use client';
import { useCallback, useEffect, useState } from 'react';
import { getDemandesOuvertes } from '@/src/lib/demande';
import { getRappelsToday } from '@/src/lib/clients';
import { getMesDevis, getFactureAcompte } from '@/src/lib/devis';
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
      // Lot 1 : facturation lue depuis les Factures liées (le devis ne mute plus).
      // Acompte émis mais pas encore validé/versé → action en attente.
      const acomptesAttente = devis.filter((d: any) => {
        const fa = getFactureAcompte(d);
        return fa && !fa.acompteVerse;
      }).length;
      // Devis signé/sélectionné SANS facture acompte → acompte à émettre.
      const devisSignesAFacturer = devis.filter((d: any) =>
        (d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION') &&
        d.signatureDirecteur &&
        !getFactureAcompte(d)
      ).length;
      setActionsFactCount(devisSignesAFacturer + acomptesAttente);
      setSejoursNonLusCount(nonLus.total);
    } catch { /* ignore */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount, loaded, reload: load };
}
