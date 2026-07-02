'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages, sendMessage } from '@/src/lib/collaboration';
import type { MessageCollab } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import InviteOrganisateurCard from './InviteOrganisateurCard';

export interface TabMessagesProps {
  sejourId: string;
  user: User;
  isDirect: boolean;
  invitationCollab: { email: string; createdAt: string } | null;
  estLectureSeule: boolean;
}

export default function TabMessages({
  sejourId,
  user,
  isDirect,
  invitationCollab,
  estLectureSeule,
}: TabMessagesProps) {
  const [messages, setMessages] = useState<MessageCollab[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!sejourId) return;
    try { setMessages(await getMessages(sejourId)); } catch { /* ignore */ }
  }, [sejourId]);

  // Chargement initial (mode collaboratif uniquement — comme l'effet par onglet d'origine)
  useEffect(() => {
    if (!isDirect) loadMessages();
  }, [isDirect, loadMessages]);

  // ── Polling messages 10s ──
  useEffect(() => {
    const iv = setInterval(loadMessages, 10_000);
    return () => clearInterval(iv);
  }, [loadMessages]);

  // ── Auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!sejourId || !msgInput.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(sejourId, msgInput.trim());
      setMessages((prev) => [...prev, msg]);
      setMsgInput('');
    } catch { /* ignore */ }
    setSending(false);
  };

  if (isDirect) {
    return (
      <InviteOrganisateurCard
        sejourId={sejourId}
        pending={invitationCollab}
        title="Messagerie"
        subtitle="Invitez l'organisateur à rejoindre l'espace collaboratif pour échanger des messages."
        icon={
          <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">Aucun message pour l&apos;instant. Lancez la conversation !</p>
        )}
        {messages.map((m) => {
          const isOwn = m.auteurId === user.id;
          const msgRole = m.auteur.role;
          const ROLE_CONFIG: Record<string, { label: string; bubbleCls: string; labelCls: string }> = {
            ORGANISATEUR: { label: 'Organisateur', bubbleCls: 'bg-[var(--color-primary)] text-white',  labelCls: 'text-[var(--color-primary)]' },
            HEBERGEUR:    { label: 'Hébergeur',    bubbleCls: 'bg-[var(--color-success)] text-white',  labelCls: 'text-[var(--color-success)]' },
            SIGNATAIRE:   { label: 'Direction',    bubbleCls: 'bg-purple-600 text-white',              labelCls: 'text-purple-600' },
          };
          const config = ROLE_CONFIG[msgRole] ?? { label: msgRole, bubbleCls: 'bg-gray-100 text-gray-900', labelCls: 'text-gray-500' };
          return (
            <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[70%] space-y-1">
                <div className={`flex items-center gap-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-xs font-semibold ${config.labelCls}`}>{config.label}</span>
                  <span className="text-xs text-gray-400">{m.auteur.prenom} {m.auteur.nom}</span>
                </div>
                <div className={`rounded-2xl px-4 py-2.5 ${config.bubbleCls} ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.contenu}</p>
                  <p className="text-[10px] mt-1 opacity-70">
                    {new Date(m.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-200">
        <input
          type="text"
          value={msgInput}
          onChange={(e) => setMsgInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          placeholder={estLectureSeule ? 'Accès en lecture seule' : 'Votre message...'}
          disabled={estLectureSeule}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-border-strong)] disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !msgInput.trim() || estLectureSeule}
          title={estLectureSeule ? 'Accès en lecture seule' : undefined}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? '...' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}
