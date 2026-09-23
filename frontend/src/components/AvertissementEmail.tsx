'use client';

import { useEffect, useState } from 'react';
import { diagnostiquerEmail } from '@/src/lib/email';

/**
 * Avertissement NON BLOQUANT sous un champ email :
 * — ACADEMIQUE (délivrabilité @ac-*.fr) : affiché immédiatement, texte selon le
 *   contexte — 'ENVOI' (destinataire d'un envoi, défaut), 'COMPTE' (email
 *   d'inscription : activation bloquée), 'INVITATION' (email verrouillé par une
 *   invitation) ; onUtiliserLien n'est honoré qu'en contexte 'ENVOI' ;
 * — ACADEMIQUE_MALFORME (faute de frappe probable) : texte commun aux 3
 *   contextes, affiché après 800 ms de valeur stable, pour ne pas accuser une
 *   saisie en cours ;
 * — null : rien, et le message disparaît sans délai.
 */
export default function AvertissementEmail({
  email,
  onUtiliserLien,
  contexte = 'ENVOI',
}: {
  email: string;
  onUtiliserLien?: () => void;
  contexte?: 'ENVOI' | 'COMPTE' | 'INVITATION';
}) {
  const diag = diagnostiquerEmail(email);
  const [malformeStable, setMalformeStable] = useState(false);

  useEffect(() => {
    if (diag !== 'ACADEMIQUE_MALFORME') {
      setMalformeStable(false);
      return;
    }
    const timer = setTimeout(() => setMalformeStable(true), 800);
    return () => clearTimeout(timer);
  }, [diag, email]);

  if (diag === null) return null;
  if (diag === 'ACADEMIQUE_MALFORME' && !malformeStable) return null;

  return (
    <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
      {diag === 'ACADEMIQUE' ? (
        contexte === 'COMPTE' ? (
          <>
            Adresse académique : ces messageries bloquent actuellement les emails de
            LIAVO — vous ne recevriez probablement pas l&apos;email d&apos;activation de
            votre compte. Utilisez plutôt une adresse personnelle.
          </>
        ) : contexte === 'INVITATION' ? (
          <>
            Cette adresse académique risque de ne pas recevoir l&apos;email
            d&apos;activation de votre compte. Demandez à votre hébergeur de vous
            réinviter sur une adresse personnelle.
          </>
        ) : (
          <>
            Adresse académique : ces messageries bloquent actuellement souvent les emails
            envoyés par LIAVO. Préférez une adresse personnelle, ou prévenez votre contact
            par téléphone.
            {onUtiliserLien && (
              <button type="button" onClick={onUtiliserLien} className="ml-1 font-medium underline">
                Utiliser plutôt « Copier le lien »
              </button>
            )}
          </>
        )
      ) : (
        <>Cette adresse semble mal saisie (domaine académique inhabituel). Vérifiez-la.</>
      )}
    </p>
  );
}
