'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateInfosSejour, deleteSejourDirect } from '@/src/lib/collaboration';
import type { SejourCollabInfo } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import { formatParticipants, formatDate } from '@/src/lib/utils';

// ─── Statut sejour (barre contexte) ────────────────────────────────────────

const STATUT_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  OPTION: 'Option',
  SUBMITTED: 'Soumis',
  CONVENTION: 'Convention',
  SOUMIS_RECTORAT: 'Soumis rectorat',
  SIGNE_DIRECTION: 'Signé direction',
  DECLARE_TAM: 'Déclaré TAM',
};

const STATUT_BADGE_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  OPTION: 'bg-amber-100 text-amber-700',
  SUBMITTED: 'bg-orange-100 text-orange-700',
  CONVENTION: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  SOUMIS_RECTORAT: 'bg-purple-100 text-purple-700',
  SIGNE_DIRECTION: 'bg-purple-100 text-purple-700',
  DECLARE_TAM: 'bg-teal-100 text-teal-700',
};

interface SejourHeaderProps {
  sejourId: string;
  sejour: SejourCollabInfo;
  user: User;
  isDirect: boolean;
  isEvenement: boolean;
  retourHref: string;
  onSejourUpdate: (updates: Partial<SejourCollabInfo>) => void;
  onError: (message: string) => void;
  onDeleted: () => void; // appelé après suppression, pour router.push
}

export default function SejourHeader({
  sejourId,
  sejour,
  user,
  isDirect,
  isEvenement,
  retourHref,
  onSejourUpdate,
  onError,
  onDeleted,
}: SejourHeaderProps) {
  const router = useRouter();
  const isHebergeur = user.role === 'HEBERGEUR';
  const isDirector = user.role === 'SIGNATAIRE';
  const sejourStatut = sejour?.statut ?? 'DRAFT';

  const [editingInfos, setEditingInfos] = useState(false);
  const [infosForm, setInfosForm] = useState({
    titre: '',
    dateDebut: '',
    dateFin: '',
    clientNom: '',
    clientPrenom: '',
    clientEmail: '',
    clientTelephone: '',
    clientAdresse: '',
    clientCodePostal: '',
    clientVille: '',
    placesTotales: 0,
    nombreAccompagnateurs: 0,
  });
  const [infosLoading, setInfosLoading] = useState(false);

  // Synchronise le formulaire d'édition avec le séjour (initialisation + rechargement parent)
  useEffect(() => {
    setInfosForm({
      titre: sejour.titre ?? '',
      dateDebut: sejour.dateDebut ? new Date(sejour.dateDebut).toISOString().substring(0, 10) : '',
      dateFin: sejour.dateFin ? new Date(sejour.dateFin).toISOString().substring(0, 10) : '',
      clientNom: sejour.clientNom ?? '',
      clientPrenom: sejour.clientPrenom ?? '',
      clientEmail: sejour.clientEmail ?? '',
      clientTelephone: sejour.clientTelephone ?? '',
      clientAdresse: sejour.clientAdresse ?? '',
      clientCodePostal: sejour.clientCodePostal ?? '',
      clientVille: sejour.clientVille ?? '',
      placesTotales: sejour.placesTotales ?? 0,
      nombreAccompagnateurs: sejour.nombreAccompagnateurs ?? 0,
    });
  }, [
    sejour.titre, sejour.dateDebut, sejour.dateFin,
    sejour.clientNom, sejour.clientPrenom, sejour.clientEmail, sejour.clientTelephone,
    sejour.clientAdresse, sejour.clientCodePostal, sejour.clientVille,
    sejour.placesTotales, sejour.nombreAccompagnateurs,
  ]);

  // ── Save infos séjour (titre + dates) ──
  const handleSaveInfos = async () => {
    if (!sejourId) return;
    setInfosLoading(true);
    try {
      const updated = await updateInfosSejour(sejourId, {
        titre: infosForm.titre || undefined,
        dateDebut: infosForm.dateDebut || undefined,
        dateFin: infosForm.dateFin || undefined,
        // Participants — éditables dans les deux modes (DIRECT et COLLABORATIF).
        placesTotales: infosForm.placesTotales,
        nombreAccompagnateurs: infosForm.nombreAccompagnateurs,
        // Champs client (séjour DIRECT uniquement) — string vide → undefined
        // pour ne pas écraser une valeur existante.
        ...(isDirect && {
          clientNom: infosForm.clientNom || undefined,
          clientPrenom: infosForm.clientPrenom || undefined,
          clientEmail: infosForm.clientEmail || undefined,
          clientTelephone: infosForm.clientTelephone || undefined,
          clientAdresse: infosForm.clientAdresse || undefined,
          clientCodePostal: infosForm.clientCodePostal || undefined,
          clientVille: infosForm.clientVille || undefined,
        }),
      });
      onSejourUpdate({
        titre: updated.titre,
        dateDebut: updated.dateDebut,
        dateFin: updated.dateFin,
        placesTotales: updated.placesTotales,
        nombreAccompagnateurs: updated.nombreAccompagnateurs,
        ...(isDirect && {
          clientNom: updated.clientNom,
          clientPrenom: updated.clientPrenom,
          clientEmail: updated.clientEmail,
          clientTelephone: updated.clientTelephone,
          clientAdresse: updated.clientAdresse,
          clientCodePostal: updated.clientCodePostal,
          clientVille: updated.clientVille,
        }),
      });
      setEditingInfos(false);
    } catch {
      // ignore
    } finally {
      setInfosLoading(false);
    }
  };

  return (
    /* ── Barre de contexte sticky (remplace l'ancienne topbar pour tous les rôles) */
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 print:hidden">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => {
            // Si l'utilisateur a un historique de navigation dans l'app, revenir en arrière.
            // Sinon (accès direct par URL), fallback vers la page par défaut.
            if (window.history.length > 1 && document.referrer) {
              router.back();
            } else {
              router.push(retourHref);
            }
          }}
          className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Retour"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate flex items-center">
            <span className="truncate">{sejour?.titre ?? '—'}</span>
            {isHebergeur && !editingInfos && (
              <button
                onClick={() => setEditingInfos(true)}
                className="text-xs text-gray-400 hover:text-[var(--color-primary)] hover:underline ml-2 shrink-0"
              >
                ✏️ Modifier
              </button>
            )}
            {isHebergeur && isDirect && !editingInfos && (
              <button
                onClick={async () => {
                  if (!confirm('Supprimer ce séjour ? Le client CRM sera conservé.')) return;
                  try {
                    await deleteSejourDirect(sejourId);
                    onDeleted();
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string } } })
                      ?.response?.data?.message ?? 'Erreur lors de la suppression';
                    onError(msg);
                  }
                }}
                className="text-xs text-red-500 hover:text-red-700 hover:underline ml-2 shrink-0"
              >
                Supprimer
              </button>
            )}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {sejour?.hebergementSelectionne?.nom ?? '—'}
            {sejour?.dateDebut && sejour?.dateFin && (
              <> · {formatDate(sejour.dateDebut, 'jourMoisCourt')} → {formatDate(sejour.dateFin, 'jourMoisCourt')}</>
            )}
            {sejour?.placesTotales != null && <> · {formatParticipants(sejour.placesTotales, sejour.nombreAccompagnateurs, sejour.typeContexte)}</>}
          </p>
          {isDirect && (
            <p className="text-xs text-gray-500 truncate">
              {sejour?.clientOrganisation
                ?? ([sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' ') || 'Client non renseigné')}
              {sejour?.clientEmail && <> · {sejour.clientEmail}</>}
            </p>
          )}
          {isHebergeur && editingInfos && (
            <div className="flex flex-col gap-2 mt-2 p-3 bg-white rounded-xl border border-gray-200 shadow-sm max-w-md">
              <input
                value={infosForm.titre}
                onChange={e => setInfosForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Titre du séjour"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={infosForm.dateDebut}
                  onChange={e => setInfosForm(f => ({ ...f, dateDebut: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <input
                  type="date"
                  value={infosForm.dateFin}
                  onChange={e => setInfosForm(f => ({ ...f, dateFin: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              {/* Participants — éditables dans les deux modes (DIRECT et COLLABORATIF). */}
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-gray-500">
                  Participants
                  <input
                    type="number"
                    min={0}
                    value={infosForm.placesTotales}
                    onChange={e => setInfosForm(f => ({ ...f, placesTotales: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </label>
                <label className="flex-1 text-xs text-gray-500">
                  Accompagnateurs
                  <input
                    type="number"
                    min={0}
                    value={infosForm.nombreAccompagnateurs}
                    onChange={e => setInfosForm(f => ({ ...f, nombreAccompagnateurs: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </label>
              </div>
              {isDirect && (
                <>
                  <p className="text-xs font-semibold text-gray-500 mt-2">Informations client</p>
                  <div className="flex gap-2">
                    <input
                      placeholder="Prénom"
                      value={infosForm.clientPrenom}
                      onChange={e => setInfosForm(f => ({ ...f, clientPrenom: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <input
                      placeholder="Nom"
                      value={infosForm.clientNom}
                      onChange={e => setInfosForm(f => ({ ...f, clientNom: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={infosForm.clientEmail}
                    onChange={e => setInfosForm(f => ({ ...f, clientEmail: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <input
                    placeholder="Téléphone"
                    value={infosForm.clientTelephone}
                    onChange={e => setInfosForm(f => ({ ...f, clientTelephone: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <input
                    placeholder="Adresse"
                    value={infosForm.clientAdresse}
                    onChange={e => setInfosForm(f => ({ ...f, clientAdresse: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder="Code postal"
                      value={infosForm.clientCodePostal}
                      onChange={e => setInfosForm(f => ({ ...f, clientCodePostal: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <input
                      placeholder="Ville"
                      value={infosForm.clientVille}
                      onChange={e => setInfosForm(f => ({ ...f, clientVille: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingInfos(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveInfos}
                  disabled={infosLoading}
                  className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {infosLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isDirect && user.role === 'HEBERGEUR' && sejour.hebergementSelectionne?.nom && (
          <a
            href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Visite ${sejour.hebergementSelectionne.nom}`)}&details=${encodeURIComponent(`Visite de ${sejour.clientNom ?? 'client'} au ${sejour.hebergementSelectionne.nom}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            📅 Planifier visite
          </a>
        )}
        {isDirector && (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
            Vue direction
          </span>
        )}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          isDirect && sejourStatut === 'SIGNE_DIRECTION'
            ? 'bg-green-100 text-green-700'
            : (STATUT_BADGE_CLS[sejourStatut] ?? 'bg-gray-100 text-gray-600')
        }`}>
          {isDirect && sejourStatut === 'SIGNE_DIRECTION'
            ? 'Signé'
            : (STATUT_LABEL[sejourStatut] ?? sejourStatut)}
        </span>
      </div>
    </div>
  );
}
