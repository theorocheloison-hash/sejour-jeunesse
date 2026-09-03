'use client';

import React, { useState } from 'react';
import { inviterOrganisateurDirect } from '@/src/lib/collaboration';
import { formatDate } from '@/src/lib/utils';

/**
 * Bloc « Organisateur » de l'en-tête séjour (hébergeur, séjour DIRECT ou ex-direct).
 * Trois états : invitation en attente (Renvoyer / Modifier l'email), organisateur
 * rattaché (lecture seule), aucun (formulaire d'invitation pré-rempli clientEmail).
 * Rendu compact — ce bloc vit dans la barre sticky, pas dans un onglet vide.
 */
interface BlocOrganisateurProps {
  sejourId: string;
  invitationCollab: { email: string; createdAt: string } | null;
  createur?: { prenom: string; nom: string; email: string } | null;
  clientEmail?: string | null; // pré-remplit le champ email du formulaire d'invitation
}

export default function BlocOrganisateur({
  sejourId,
  invitationCollab,
  createur,
  clientEmail,
}: BlocOrganisateurProps) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState(clientEmail ?? '');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const envoyer = async (target: string) => {
    const value = target.trim();
    if (!value) return;
    setSending(true);
    setError(null);
    try {
      await inviterOrganisateurDirect(sejourId, value);
      setSentTo(value);
      setShowForm(false);
    } catch {
      setError("Erreur lors de l'envoi de l'invitation.");
    } finally {
      setSending(false);
    }
  };

  // État 2 — organisateur rattaché : lecture seule (pas de date : absente du payload).
  if (!invitationCollab && !sentTo && createur) {
    return (
      <p className="text-xs text-gray-500 truncate">
        Rattaché : {createur.prenom} {createur.nom} ({createur.email})
      </p>
    );
  }

  // « Déjà invité » : on vient d'envoyer (sentTo) OU une invitation est en attente côté serveur.
  const inviteEmail = sentTo ?? invitationCollab?.email ?? null;
  const inviteDate = sentTo ? null : invitationCollab?.createdAt ?? null;

  // État 1 — invitation envoyée.
  if (inviteEmail && !showForm) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500 truncate">
          Invitation envoyée à <strong>{inviteEmail}</strong>
          {inviteDate ? ` le ${formatDate(inviteDate, 'long')}` : ''}
        </p>
        <button
          onClick={() => envoyer(inviteEmail)}
          disabled={sending}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-50 shrink-0"
        >
          {sending ? 'Envoi…' : 'Renvoyer'}
        </button>
        <button
          onClick={() => { setShowForm(true); setEmail(inviteEmail); }}
          className="text-xs text-gray-500 hover:text-gray-700 hover:underline shrink-0"
        >
          Modifier l&apos;email
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  // État 3 — aucun organisateur : bouton puis champ email.
  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
      >
        Inviter l&apos;organisateur
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@organisateur.fr"
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
      <button
        onClick={() => envoyer(email)}
        disabled={sending || !email.trim()}
        className="text-xs font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-50 shrink-0"
      >
        {sending ? 'Envoi…' : 'Envoyer'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
