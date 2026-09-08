'use client';

import React, { useState } from 'react';
import { inviterOrganisateurDirect } from '@/src/lib/collaboration';
import { formatDate } from '@/src/lib/utils';

/**
 * Bloc « Organisateur » unifié (hébergeur) — source unique pour :
 *  - l'en-tête séjour (variant "compact", rendu par SejourHeader)
 *  - les onglets Messages & Journal en gestion directe (variant "card")
 * Trois états, même conteneur coloré dans les deux variants :
 *  1. À inviter          — DIRECT sans organisateur : CTA + explication au clic + email
 *  2. Invitation envoyée — en attente : Renvoyer / Modifier
 *  3. Collaboratif       — organisateur rattaché (rejoint OU collab natif) : nom mis en avant
 * Garde-fou #39 : si le « createur » est en réalité le compte hébergeur du centre
 * (auto-invitation), on n'affiche PAS l'état collaboratif (retour null).
 */
export interface BlocOrganisateurProps {
  sejourId: string;
  variant?: 'compact' | 'card';
  invitationCollab?: { email: string; createdAt: string } | null;
  createur?: { id: string; prenom: string; nom: string; email: string } | null;
  /** userId du compte propriétaire du centre — garde-fou #39. */
  hebergeurUserId?: string | null;
  /** Pré-remplit le champ email du formulaire d'invitation. */
  clientEmail?: string | null;
  /** En-tête contextuel (variant "card" seulement) : titre/sous-titre/icône par onglet. */
  heading?: { title: string; subtitle: string; icon: React.ReactNode };
}

const EXPLICATION_ACCES =
  "Une fois qu'il aura rejoint le séjour, l'organisateur pourra consulter et signer le devis, échanger avec vous par messagerie, suivre le planning, gérer les inscriptions, et accéder aux documents et au journal.";

export default function BlocOrganisateur({
  sejourId,
  variant = 'compact',
  invitationCollab = null,
  createur = null,
  hebergeurUserId = null,
  clientEmail = null,
  heading,
}: BlocOrganisateurProps) {
  const isCard = variant === 'card';
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

  // Conteneur coloré COMMUN aux trois états — même style, densité selon variant.
  const shellCls = [
    'border border-[var(--color-border-strong)] bg-[var(--color-primary-light)]',
    isCard ? 'rounded-2xl shadow-sm p-6 text-center' : 'rounded-xl px-3 py-2.5 mt-1',
  ].join(' ');
  const rowCls = isCard ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2 flex-wrap';

  // Garde-fou #39 : le « createur » est en réalité le compte hébergeur du centre
  // (auto-invitation). Séjour déjà COLLABORATIF → rien à afficher : ni badge, ni CTA
  // « Inviter » (trompeur, et inviterOrganisateur exige un séjour DIRECT).
  const createurEstHebergeur = !!createur && !!hebergeurUserId && createur.id === hebergeurUserId;
  if (createurEstHebergeur) return null;

  // ── État 3 — organisateur rattaché (rejoint OU collab natif) ──
  if (createur && !invitationCollab && !sentTo) {
    return (
      <div className={shellCls}>
        <div className={rowCls}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-2.5 py-0.5 text-xs font-semibold text-white shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Séjour collaboratif
          </span>
          <span className="text-sm font-semibold text-[var(--color-primary)] truncate">
            {createur.prenom} {createur.nom}
          </span>
        </div>
      </div>
    );
  }

  // « Déjà invité » : envoi immédiat (sentTo) OU invitation en attente serveur.
  const inviteEmail = sentTo ?? invitationCollab?.email ?? null;
  const inviteDate = sentTo ? null : invitationCollab?.createdAt ?? null;

  // En-tête contextuel (variant card seulement).
  const Header = isCard && heading ? (
    <>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/70 mb-3">
        {heading.icon}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{heading.title}</h3>
      <p className="text-xs text-gray-600 mb-4">{heading.subtitle}</p>
    </>
  ) : null;

  // ── État 2 — invitation envoyée ──
  if (inviteEmail && !showForm) {
    return (
      <div className={shellCls}>
        {Header}
        <div className={rowCls}>
          <p className="text-xs text-gray-700">
            Invitation envoyée à <strong>{inviteEmail}</strong>
            {inviteDate ? ` le ${formatDate(inviteDate, 'long')}` : ''}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => envoyer(inviteEmail)}
              disabled={sending}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Renvoyer'}
            </button>
            <button
              onClick={() => { setShowForm(true); setEmail(inviteEmail); }}
              className="text-xs text-gray-600 hover:text-gray-800 hover:underline"
            >
              Modifier l&apos;email
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  // ── État 1 — à inviter (CTA → explication au clic + email) ──
  return (
    <div className={shellCls}>
      {Header}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90',
            isCard ? 'mx-auto' : '',
          ].join(' ')}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          Inviter l&apos;organisateur à collaborer sur le séjour
        </button>
      ) : (
        <div className={isCard ? 'flex flex-col items-center gap-3' : 'flex flex-col gap-2'}>
          <p className={`text-xs text-gray-600 ${isCard ? 'max-w-md' : ''}`}>{EXPLICATION_ACCES}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@organisateur.fr"
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs w-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
              onClick={() => envoyer(email)}
              disabled={sending || !email.trim()}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
