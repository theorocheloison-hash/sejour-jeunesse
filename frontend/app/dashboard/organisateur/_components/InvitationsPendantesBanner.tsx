'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/src/lib/api';

interface InvitationPendante {
  token: string;
  titreSejourSuggere: string;
  dateDebut: string;
  dateFin: string;
  nbElevesEstime: number;
  centre: { nom: string; ville: string };
}

const DISMISS_KEY = 'liavo-invit-pendantes-dismiss';

function lireDismiss(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function ecrireDismiss(tokens: string[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(tokens));
  } catch {}
}

export default function InvitationsPendantesBanner() {
  const [invitations, setInvitations] = useState<InvitationPendante[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => lireDismiss());

  useEffect(() => {
    api.get<InvitationPendante[]>('/invitation-collaboration/pendantes')
      .then(({ data }) => {
        if (Array.isArray(data)) setInvitations(data);
      })
      // La bannière ne doit jamais pouvoir casser ou bloquer le dashboard.
      .catch(() => {});
  }, []);

  const dismiss = (token: string) => {
    setDismissed((prev) => {
      const next = prev.includes(token) ? prev : [...prev, token];
      ecrireDismiss(next);
      return next;
    });
  };

  const visibles = invitations.filter((inv) => !dismissed.includes(inv.token));
  if (visibles.length === 0) return null;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 space-y-3">
      {visibles.map((inv) => (
        <div
          key={inv.token}
          className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {inv.centre.nom} vous invite sur «&nbsp;{inv.titreSejourSuggere}&nbsp;»
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {fmt(inv.dateDebut)} → {fmt(inv.dateFin)} · {inv.nbElevesEstime} participants · {inv.centre.ville}
            </p>
          </div>
          <Link
            href={`/rejoindre/${inv.token}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors"
          >
            Voir l&apos;invitation
          </Link>
          <button
            type="button"
            onClick={() => dismiss(inv.token)}
            aria-label="Masquer cette invitation"
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
