'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAlertesCapacite, acquitterAlerteCapacite } from '@/src/lib/chambres';
import type { AlerteCapacite, SurEngagement } from '@/src/lib/chambres';

/**
 * Alertes « option plus accueillable » (module chambres, étage 1 — D9/D10).
 * Deux usages : sans sejourId = dashboard hébergeur (toutes les alertes du
 * centre, cartes arrondies) ; avec sejourId = page séjour (l'alerte de CE
 * séjour, bandeau full-width). Hébergeur uniquement : aucun appel API sinon.
 * L'état affiché vient TOUJOURS du serveur (empreinte de situation) : après un
 * acquittement, PATCH puis refetch — jamais d'état local optimiste.
 */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AlertesCapacite({ sejourId }: { sejourId?: string }) {
  const { user } = useAuth();
  const isHebergeur = user?.role === 'HEBERGEUR';

  const [capacite, setCapacite] = useState(0);
  const [alertes, setAlertes] = useState<AlerteCapacite[]>([]);
  const [surEngagements, setSurEngagements] = useState<SurEngagement[]>([]);
  const [acquitting, setAcquitting] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getAlertesCapacite();
      setCapacite(data.capacite);
      setAlertes(data.alertes);
      setSurEngagements(data.surEngagements ?? []);
    } catch {
      // Silencieux : l'alerte est une aide, jamais un blocage d'écran.
    }
  }, []);

  useEffect(() => {
    if (isHebergeur) load();
  }, [isHebergeur, load]);

  if (!isHebergeur) return null;

  const visibles = sejourId ? alertes.filter((a) => a.sejourId === sejourId) : alertes;
  // Sur-engagements : mode dashboard uniquement (pas la page séjour, pas la liste).
  const surEngagementsVisibles = sejourId ? [] : surEngagements;
  if (visibles.length === 0 && surEngagementsVisibles.length === 0) return null;

  const acquitter = async (id: string) => {
    setAcquitting(id);
    setErreur(null);
    try {
      await acquitterAlerteCapacite(id);
    } catch {
      setErreur("L'acquittement a échoué — rechargez la page et réessayez.");
    } finally {
      await load();
      setAcquitting(null);
    }
  };

  const renderAlerte = (a: AlerteCapacite) => {
    if (a.etat === 'ACQUITTEE') {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>
            ⏳ <strong className="font-medium text-gray-600">{a.titre}</strong> — prévenu
            {a.capaciteAlerteAcquitteeAt ? ` le ${fmtDate(a.capaciteAlerteAcquitteeAt)}` : ''} — en attente
          </span>
          {!sejourId && (
            <Link href={`/dashboard/sejour/${a.sejourId}`} className="underline shrink-0">
              Voir le séjour →
            </Link>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-amber-800">
          ⚠️ <strong>{a.titre}</strong> (option, {a.effectif} pers., {fmtDate(a.dateDebut)} →{' '}
          {fmtDate(a.dateFin)}) : plus accueillable — {a.maxOccupationSignee}/{capacite} places
          prises par des séjours signés, déficit {a.deficit} place{a.deficit > 1 ? 's' : ''}.
          {!sejourId && (
            <>
              {' '}
              <Link href={`/dashboard/sejour/${a.sejourId}`} className="underline font-medium">
                Voir le séjour →
              </Link>
            </>
          )}
        </p>
        <button
          onClick={() => acquitter(a.sejourId)}
          disabled={acquitting !== null}
          className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {acquitting === a.sejourId ? 'Enregistrement…' : "J'ai prévenu le client"}
        </button>
      </div>
    );
  };

  // Page séjour : bandeau full-width sous le header (même langage que les
  // bandeaux mutationError / thématiques manquantes).
  if (sejourId) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 print:hidden">
        <div className="max-w-5xl mx-auto space-y-2">
          {erreur && <p className="text-sm text-red-700">{erreur}</p>}
          {visibles.map((a) => (
            <div key={a.sejourId}>{renderAlerte(a)}</div>
          ))}
        </div>
      </div>
    );
  }

  // dateFin est EXCLUSIVE ([debut, fin)) : on affiche la veille.
  const fmtVeille = (iso: string) => {
    const veille = new Date(iso);
    veille.setDate(veille.getDate() - 1);
    return fmtDate(veille.toISOString());
  };

  // Dashboard : cartes arrondies dans le flux des bannières existantes.
  // Sur-engagements (rouge) AU-DESSUS des alertes options — non acquittables,
  // aucun bouton : la bannière ne se tait que quand la surcapacité disparaît.
  return (
    <div className="space-y-2">
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      {surEngagementsVisibles.map((se) => (
        <div
          key={`${se.dateDebut}-${se.dateFin}`}
          className="rounded-lg border border-red-700 bg-red-50 px-5 py-3"
        >
          <p className="text-sm text-red-800">
            🔴 <strong>Sur-engagement</strong> : {se.pic} places pour capacité {capacite} du{' '}
            {fmtDate(se.dateDebut)} au {fmtVeille(se.dateFin)} (déficit {se.deficit}) — séjours :{' '}
            {se.sejours.map((s) => s.titre).join(', ')}
          </p>
        </div>
      ))}
      {visibles.map((a) => (
        <div
          key={a.sejourId}
          className={
            a.etat === 'ACTIVE'
              ? 'rounded-lg border border-amber-500 bg-amber-50 px-5 py-3'
              : 'rounded-lg border border-gray-200 bg-white px-5 py-3'
          }
        >
          {renderAlerte(a)}
        </div>
      ))}
    </div>
  );
}
