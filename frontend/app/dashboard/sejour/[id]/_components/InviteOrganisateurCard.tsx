'use client';

import React, { useState } from 'react';
import { inviterOrganisateurDirect } from '@/src/lib/collaboration';
import { formatDate } from '@/src/lib/utils';

/**
 * Carte d'invitation de l'organisateur (séjour DIRECT) — partagée par les onglets
 * Messages et Journal. Affiche l'état « invitation en attente » (anti-spam) avec
 * Renvoyer / Modifier l'email, sinon un formulaire d'invitation.
 */
export interface InviteOrganisateurCardProps {
  sejourId: string;
  pending: { email: string; createdAt: string } | null;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

export default function InviteOrganisateurCard({
  sejourId,
  pending,
  title,
  subtitle,
  icon,
}: InviteOrganisateurCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
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

  // « Déjà invité » : on vient d'envoyer (sentTo) OU une invitation est en attente côté serveur.
  const inviteEmail = sentTo ?? pending?.email ?? null;
  const inviteDate = sentTo ? null : pending?.createdAt ?? null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>

      {inviteEmail && !showForm ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-600">
            Invitation envoyée à <strong>{inviteEmail}</strong>
            {inviteDate ? ` le ${formatDate(inviteDate, 'long')}` : ''}.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => envoyer(inviteEmail)}
              disabled={sending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Renvoyer'}
            </button>
            <button
              onClick={() => { setShowForm(true); setEmail(inviteEmail); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Modifier l&apos;email
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : !showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Inviter l&apos;organisateur
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@organisateur.fr"
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
              onClick={() => envoyer(email)}
              disabled={sending || !email.trim()}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
