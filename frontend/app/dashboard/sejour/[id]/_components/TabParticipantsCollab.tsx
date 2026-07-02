'use client';

import { useState } from 'react';
import type { SejourCollabInfo, Participant } from '@/src/lib/collaboration';
import { getOrdreMissionHtml, type AccompagnateurMission } from '@/src/lib/accompagnateur';
import { validerPaiement } from '@/src/lib/autorisation';
import type { User } from '@/src/types/auth';
import SecureFileLink from '@/src/components/SecureFileLink';
import TabParticipantsSaisieDirecte from './TabParticipantsSaisieDirecte';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'https://liavo.fr';

function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

const NIVEAU_SKI_LABEL: Record<string, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  CONFIRME: 'Confirmé',
  HORS_PISTE: 'Hors-piste',
};

export interface TabParticipantsCollabProps {
  sejour: SejourCollabInfo | null;
  user: User;
  participants: Participant[];
  accompagnateurs: AccompagnateurMission[];
  onReload: () => void;
}

export default function TabParticipantsCollab({
  sejour,
  user,
  participants,
  accompagnateurs,
  onReload,
}: TabParticipantsCollabProps) {
  const [participantFilter, setParticipantFilter] = useState<'all' | 'signed' | 'pending'>('all');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  // ── CSV Export ──
  const exportCSV = () => {
    const headers = ['Prénom', 'Nom', 'Statut', 'Taille (cm)', 'Poids (kg)', 'Pointure', 'Régime alimentaire', 'Niveau ski', 'Infos médicales'];
    const rows = participants.map((p) => [
      p.elevePrenom,
      p.eleveNom,
      p.signeeAt ? 'Signée' : 'En attente',
      p.taille?.toString() ?? '',
      p.poids?.toString() ?? '',
      p.pointure?.toString() ?? '',
      p.regimeAlimentaire ?? '',
      p.niveauSki ? (NIVEAU_SKI_LABEL[p.niveauSki] ?? p.niveauSki) : '',
      p.infosMedicales ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${sejour?.titre ?? 'sejour'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filter participants ──
  const filteredParticipants = participants.filter((p) => {
    if (participantFilter === 'signed') return !!p.signeeAt;
    if (participantFilter === 'pending') return !p.signeeAt;
    return true;
  });

  const signedCount = participants.filter((p) => p.signeeAt).length;

  // Check if ski column relevant
  const showSkiColumn = participants.some((p) => p.niveauSki);

  return (
    <div className="space-y-4">
      {sejour && (
        <TabParticipantsSaisieDirecte
          sejourId={sejour.id}
          champsInscription={sejour.hebergementSelectionne?.champsInscription ?? null}
          participants={participants}
          onReload={onReload}
        />
      )}
      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            {signedCount}/{participants.length} autorisations signées
          </span>
          <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-success)] rounded-full transition-all"
              style={{ width: participants.length ? `${(signedCount / participants.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtres */}
          {(['all', 'signed', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setParticipantFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                participantFilter === f
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'signed' ? 'Signés' : 'En attente'}
            </button>
          ))}
          <button
            onClick={exportCSV}
            disabled={participants.length === 0}
            className="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Tableau */}
      {filteredParticipants.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">
          {participants.length === 0 ? 'Aucun participant enregistré.' : 'Aucun résultat pour ce filtre.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Élève</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Statut</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Taille</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Poids</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Pointure</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Régime</th>
                {showSkiColumn && (
                  <th className="text-left py-3 px-3 font-semibold text-gray-700">Ski</th>
                )}
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Médical</th>
                {user.role !== 'HEBERGEUR' && <th className="text-center py-3 px-3 font-semibold text-gray-700">Paiement</th>}
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((p) => (
                <tr key={p.id} onClick={() => p.signeeAt ? setSelectedParticipant(p) : null} className={`border-b border-gray-100 transition-colors ${p.signeeAt ? 'cursor-pointer hover:bg-blue-50' : 'opacity-60'}`}>
                  <td className="py-3 px-3">
                    <p className="font-medium text-gray-900">{p.elevePrenom} {p.eleveNom}</p>
                  </td>
                  <td className="py-3 px-3">
                    {p.signeeAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                        Signée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                        En attente
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600">
                    {p.taille ? `${p.taille} cm` : '—'}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600">
                    {p.poids ? `${p.poids} kg` : '—'}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600">
                    {p.pointure ?? '—'}
                  </td>
                  <td className="py-3 px-3 text-gray-600">
                    {p.regimeAlimentaire ?? '—'}
                  </td>
                  {showSkiColumn && (
                    <td className="py-3 px-3 text-gray-600">
                      {p.niveauSki ? (NIVEAU_SKI_LABEL[p.niveauSki] ?? p.niveauSki) : '—'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-center">
                    {p.infosMedicales ? (
                      <span className="relative group cursor-help">
                        <span className="text-base" title={p.infosMedicales}>&#127973;</span>
                        <span className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-900 text-white text-xs p-3 shadow-lg">
                          {p.infosMedicales}
                          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  {user.role !== 'HEBERGEUR' && (
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {p.paiementValide ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                        Payé
                      </span>
                    ) : p.moyenPaiement ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {p.moyenPaiement === 'VIREMENT' ? 'Virement' :
                           p.moyenPaiement === 'PRELEVEMENT' ? 'Prélèvement' :
                           p.moyenPaiement === 'CB' ? 'CB' :
                           p.moyenPaiement === 'CHEQUE' ? 'Chèque' :
                           p.moyenPaiement === 'ESPECES' ? 'Espèces' :
                           p.moyenPaiement}
                        </span>
                        {/* Versements partiels */}
                        {(p.nombreVersementsEffectues ?? 0) > 0 && (
                          <span className="text-xs text-gray-500">
                            {p.nombreVersementsEffectues}/{p.nombreMensualites ?? 1} versement{(p.nombreMensualites ?? 1) > 1 ? 's' : ''}
                          </span>
                        )}
                        {/* Boutons action */}
                        <div className="flex gap-1 flex-wrap justify-center">
                          {/* Valider un versement partiel si mensualités > 1 */}
                          {(p.nombreMensualites ?? 1) > 1 && (p.nombreVersementsEffectues ?? 0) < (p.nombreMensualites ?? 1) && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const { validerPaiementPartiel } = await import('@/src/lib/autorisation');
                                  await validerPaiementPartiel(p.id, 0);
                                  await onReload();
                                } catch { /* ignore */ }
                              }}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              +1 versement
                            </button>
                          )}
                          {/* Valider paiement complet */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await validerPaiement(p.id);
                                await onReload();
                              } catch { /* ignore */ }
                            }}
                            className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                          >
                            Tout valider
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Accompagnateurs */}
      {accompagnateurs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Accompagnateurs ({accompagnateurs.length})
          </h3>
          <div className="space-y-2">
            {accompagnateurs.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{a.prenom} {a.nom}</span>
                    {a.signeeAt ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                          Signé
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              const { html } = await getOrdreMissionHtml(a.id);
                              const win = window.open('', '_blank');
                              if (win) {
                                win.document.write(html);
                                win.document.close();
                              }
                            } catch { /* ignore */ }
                          }}
                          className="rounded-lg border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors print:hidden"
                        >
                          Ordre de mission
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                        En attente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{a.email}{a.telephone ? ` — ${a.telephone}` : ''}</p>
                </div>
                {a.contactUrgenceNom && (
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-400">Contact urgence</p>
                    <p className="text-xs text-gray-600">{a.contactUrgenceNom}{a.contactUrgenceTel ? ` — ${a.contactUrgenceTel}` : ''}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale fiche élève */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedParticipant(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {selectedParticipant.elevePrenom} {selectedParticipant.eleveNom}
              </h3>
              <button onClick={() => setSelectedParticipant(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            {/* Infos parent */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Contact urgence</p>
              {selectedParticipant.nomParent && (
                <p className="text-sm font-medium text-gray-900">{selectedParticipant.nomParent}</p>
              )}
              <p className="text-sm text-gray-700">{selectedParticipant.parentEmail}</p>
              {selectedParticipant.telephoneUrgence && (
                <p className="text-sm text-gray-700 font-semibold">{selectedParticipant.telephoneUrgence}</p>
              )}
            </div>

            {/* Infos physiques */}
            <div className="grid grid-cols-3 gap-3">
              {selectedParticipant.taille && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Taille</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedParticipant.taille} cm</p>
                </div>
              )}
              {selectedParticipant.poids && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Poids</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedParticipant.poids} kg</p>
                </div>
              )}
              {selectedParticipant.pointure && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Pointure</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedParticipant.pointure}</p>
                </div>
              )}
            </div>

            {/* Régime alimentaire */}
            {selectedParticipant.regimeAlimentaire && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Régime alimentaire</p>
                <p className="text-sm text-gray-700">{selectedParticipant.regimeAlimentaire}</p>
              </div>
            )}

            {/* Niveau ski */}
            {selectedParticipant.niveauSki && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Niveau ski</p>
                <p className="text-sm text-gray-700">{NIVEAU_SKI_LABEL[selectedParticipant.niveauSki] ?? selectedParticipant.niveauSki}</p>
              </div>
            )}

            {/* Infos médicales */}
            {selectedParticipant.infosMedicales && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Infos médicales</p>
                <p className="text-sm text-gray-700">{selectedParticipant.infosMedicales}</p>
              </div>
            )}

            {/* Document médical */}
            {selectedParticipant.documentMedicalUrl && (
              <div className="flex items-center gap-2">
                <SecureFileLink
                  url={resolveFileUrl(selectedParticipant.documentMedicalUrl)}
                  className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Voir le document médical
                </SecureFileLink>
                <SecureFileLink
                  url={resolveFileUrl(selectedParticipant.documentMedicalUrl)}
                  download
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </SecureFileLink>
              </div>
            )}

            {/* Attestation assurance */}
            {selectedParticipant.attestationAssuranceUrl && (
              <div className="flex items-center gap-2">
                <SecureFileLink
                  url={resolveFileUrl(selectedParticipant.attestationAssuranceUrl)}
                  className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Voir l&apos;attestation d&apos;assurance
                </SecureFileLink>
                <SecureFileLink
                  url={resolveFileUrl(selectedParticipant.attestationAssuranceUrl)}
                  download
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </SecureFileLink>
              </div>
            )}

            {/* Signé le */}
            {selectedParticipant.signeeAt && (
              <p className="text-xs text-gray-400 text-center">
                Autorisation signée le {new Date(selectedParticipant.signeeAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
