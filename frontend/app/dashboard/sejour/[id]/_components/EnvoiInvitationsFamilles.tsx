'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAutorisationsBySejour, envoyerInvitations, type AutorisationParentale } from '@/src/lib/autorisation';
import type { Participant } from '@/src/lib/collaboration';

/**
 * B3a — envoi des liens d'autorisation aux familles par l'hébergeur EN PROPRE.
 * Autonome : se nourrit de GET /autorisations/sejour/:id (objet complet, dont
 * emailEnvoye — absent de getParticipants). Même règle d'éligibilité
 * qu'InscriptionsEleves (organisateur) : !signeeAt && !emailEnvoye && parentEmail.
 * Rien à envoyer et rien d'envoyé → null (la grille + le papier suffisent).
 */
interface Props {
  sejourId: string;
  /** Signal de rechargement : identité changée par le parent à chaque refetch
   *  (setParticipants après save/import de la grille) — jamais sur un simple
   *  re-render. Le bloc refait alors son propre fetch (emailEnvoye). */
  participants: Participant[];
}

export default function EnvoiInvitationsFamilles({ sejourId, participants }: Props) {
  const [autorisations, setAutorisations] = useState<AutorisationParentale[] | null>(null);
  const [sending, setSending] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try { setAutorisations(await getAutorisationsBySejour(sejourId)); }
    catch (e) {
      // bloc silencieux : l'onglet reste utilisable sans lui, mais l'échec est traçable
      console.error('[EnvoiInvitationsFamilles] chargement échoué', e);
    }
  }, [sejourId]);

  useEffect(() => { charger(); }, [charger, participants]);

  if (!autorisations) return null;
  const eligibles = autorisations.filter((a) => !a.signeeAt && !a.emailEnvoye && a.parentEmail);
  const dejaEnvoyees = autorisations.filter((a) => a.emailEnvoye).length;

  if (eligibles.length === 0 && dejaEnvoyees === 0) return null;

  if (eligibles.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        ✓ Invitations envoyées à {dejaEnvoyees} famille{dejaEnvoyees > 1 ? 's' : ''}.
        Les nouveaux participants avec email apparaîtront ici.
      </p>
    );
  }

  const handleEnvoyer = async () => {
    if (!window.confirm(`Envoyer le lien d'autorisation à ${eligibles.length} famille${eligibles.length > 1 ? 's' : ''} ?`)) return;
    setSending(true); setErreur(null); setResultat(null);
    try {
      const r = await envoyerInvitations(sejourId, eligibles.map((a) => a.id));
      setResultat(`${r.sent} invitation${r.sent > 1 ? 's' : ''} envoyée${r.sent > 1 ? 's' : ''}${r.errors.length ? ` — ${r.errors.length} échec(s)` : ''}`);
      await charger();
    } catch (e: any) {
      // 403 PLAN_INSUFFICIENT : la modale globale (api.ts) affiche déjà le message.
      if (e?.response?.status === 403 && e?.response?.data?.error === 'PLAN_INSUFFICIENT') return;
      // 400 actionnable (ex. email de centre manquant) ou 403 « CODE|message »
      // (centre en validation) → partie lisible seulement.
      const msg: unknown = e?.response?.data?.message;
      setErreur(typeof msg === 'string' ? msg.replace(/^CENTRE_EN_VALIDATION\|/, '') : "L'envoi a échoué. Réessayez.");
    }
    finally { setSending(false); }
  };

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-blue-900">
        <span className="font-semibold">Faire signer en ligne :</span>{' '}
        {eligibles.length} famille{eligibles.length > 1 ? 's' : ''} avec email n&apos;{eligibles.length > 1 ? 'ont' : 'a'} pas encore reçu le lien d&apos;autorisation.
      </p>
      <div className="flex items-center gap-2">
        {resultat && <span className="text-xs font-medium text-green-700">{resultat}</span>}
        {erreur && <span className="text-xs font-medium text-red-600">{erreur}</span>}
        <button
          type="button"
          onClick={handleEnvoyer}
          disabled={sending}
          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? 'Envoi…' : `Envoyer le lien d'autorisation aux ${eligibles.length} famille${eligibles.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
