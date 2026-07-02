'use client';

import React, { useEffect, useState } from 'react';
import {
  getGroupes,
  createGroupe,
  updateGroupe,
  deleteGroupe,
  proposerGroupes,
  affecterEleve,
  retirerEleve,
  cloturerInscriptions,
  getActivitesCatalogue,
} from '@/src/lib/collaboration';
import type {
  SejourCollabInfo,
  Participant,
  ActiviteCatalogue,
  GroupeSejour,
  PropositionGroupes,
} from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';

export interface TabGroupesProps {
  sejourId: string;
  sejour: SejourCollabInfo | null;
  user: User;
  groupes: GroupeSejour[];
  participants: Participant[];
  onGroupesChange: React.Dispatch<React.SetStateAction<GroupeSejour[]>>;
  onSejourUpdate: (updates: Partial<SejourCollabInfo>) => void;
  onReloadSejour: () => void;
  onError: (message: string) => void;
}

export default function TabGroupes({
  sejourId,
  sejour,
  user,
  groupes,
  participants,
  onGroupesChange,
  onSejourUpdate,
  onReloadSejour,
  onError,
}: TabGroupesProps) {
  const [groupeModal, setGroupeModal] = useState<{ open: boolean; editId?: string; nom: string; couleur: string; taille: number } | null>(null);
  const [propositionGroupes, setPropositionGroupes] = useState<PropositionGroupes | null>(null);
  const [loadingProposition, setLoadingProposition] = useState(false);
  const [dragEleve, setDragEleve] = useState<string | null>(null);
  // Catalogue rechargé à l'ouverture de l'onglet (parité réseau avec l'implémentation
  // d'origine — le résultat n'est pas rendu ici mais rafraîchit le cache serveur).
  const [, setActivitesCatalogue] = useState<ActiviteCatalogue[]>([]);

  useEffect(() => {
    getActivitesCatalogue(sejourId).then(setActivitesCatalogue).catch(() => {});
  }, [sejourId]);

  const handleProposerGroupes = async () => {
    if (!sejourId) return;
    setLoadingProposition(true);
    try {
      const prop = await proposerGroupes(sejourId);
      setPropositionGroupes(prop);
    } catch { /* ignore */ }
    finally { setLoadingProposition(false); }
  };

  const handleAppliquerProposition = async () => {
    if (!sejourId || !propositionGroupes) return;
    try {
      const created = await Promise.all(
        propositionGroupes.groupes.map(g => createGroupe(sejourId, g))
      );
      onGroupesChange(prev => [...prev, ...created]);
      setPropositionGroupes(null);
    } catch { /* ignore */ }
  };

  const handleSaveGroupe = async () => {
    if (!groupeModal || !sejourId) return;
    try {
      if (groupeModal.editId) {
        const updated = await updateGroupe(sejourId, groupeModal.editId, { nom: groupeModal.nom, couleur: groupeModal.couleur, taille: groupeModal.taille });
        onGroupesChange(prev => prev.map(g => g.id === groupeModal.editId ? updated : g));
      } else {
        const created = await createGroupe(sejourId, { nom: groupeModal.nom, couleur: groupeModal.couleur, taille: groupeModal.taille });
        onGroupesChange(prev => [...prev, created]);
      }
      setGroupeModal(null);
    } catch (err) {
      console.error('[handleSaveGroupe]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(sejourId).then(g => onGroupesChange(g)).catch(() => {});
    }
  };

  const handleDeleteGroupe = async (groupeId: string) => {
    if (!sejourId) return;
    try {
      await deleteGroupe(sejourId, groupeId);
      onGroupesChange(prev => prev.filter(g => g.id !== groupeId));
    } catch (err) {
      console.error('[handleDeleteGroupe]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(sejourId).then(g => onGroupesChange(g)).catch(() => {});
    }
  };

  const handleAffecterEleve = async (autorisationId: string, groupeId: string) => {
    if (!sejourId) return;
    try {
      await affecterEleve(sejourId, groupeId, autorisationId);
      onGroupesChange(await getGroupes(sejourId));
    } catch (err) {
      console.error('[handleAffecterEleve]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(sejourId).then(g => onGroupesChange(g)).catch(() => {});
    }
  };

  const handleRetirerEleve = async (autorisationId: string) => {
    if (!sejourId) return;
    try {
      await retirerEleve(sejourId, autorisationId);
      onGroupesChange(await getGroupes(sejourId));
    } catch (err) {
      console.error('[handleRetirerEleve]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(sejourId).then(g => onGroupesChange(g)).catch(() => {});
    }
  };

  const handleCloturerInscriptions = async () => {
    if (!sejourId) return;
    try {
      await cloturerInscriptions(sejourId);
      onSejourUpdate({ inscriptionsCloturees: true });
    } catch (err) {
      console.error('[handleCloturerInscriptions]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      onReloadSejour();
    }
  };

  return (
    <div className="space-y-6">
      {/* Bandeau clôture inscriptions — ORGANISATEUR uniquement */}
      {user.role === 'ORGANISATEUR' && !sejour?.inscriptionsCloturees && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Inscriptions ouvertes</p>
            <p className="text-xs text-amber-600 mt-0.5">Clôturez les inscriptions pour affecter les élèves aux groupes.</p>
          </div>
          <button onClick={handleCloturerInscriptions}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Clôturer les inscriptions
          </button>
        </div>
      )}
      {user.role === 'ORGANISATEUR' && sejour?.inscriptionsCloturees && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-700 font-medium">
          ✓ Inscriptions clôturées — vous pouvez affecter les élèves aux groupes
        </div>
      )}

      {/* Actions HEBERGEUR */}
      {user.role === 'HEBERGEUR' && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Groupes du séjour</h2>
          <div className="flex gap-2">
            <button onClick={handleProposerGroupes} disabled={loadingProposition}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50">
              {loadingProposition ? 'Calcul...' : '✨ Proposer automatiquement'}
            </button>
            <button onClick={() => setGroupeModal({ open: true, nom: '', couleur: '#16a34a', taille: 10 })}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              + Ajouter un groupe
            </button>
          </div>
        </div>
      )}

      {/* Proposition automatique */}
      {propositionGroupes && user.role === 'HEBERGEUR' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {(() => {
                  const taillesMap = new Map<number, number>();
                  propositionGroupes.groupes.forEach(g => {
                    taillesMap.set(g.taille, (taillesMap.get(g.taille) ?? 0) + 1);
                  });
                  const parts = Array.from(taillesMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([taille, count]) => `${count} groupe${count > 1 ? 's' : ''} de ${taille}`);
                  return `Proposition : ${parts.join(' + ')} élèves`;
                })()}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Basée sur {propositionGroupes.nombreEleves} élèves et les capacités de vos activités</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAppliquerProposition}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Appliquer
              </button>
              <button onClick={() => setPropositionGroupes(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Ignorer
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {propositionGroupes.groupes.map((g, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.couleur }} />
                <span className="text-xs font-medium text-gray-900">{g.nom}</span>
                <span className="text-xs text-gray-500">{g.taille} élèves</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout deux colonnes : élèves non affectés | groupes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colonne gauche — élèves non affectés */}
        {sejour?.inscriptionsCloturees && (
          <div className="lg:col-span-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Élèves non affectés ({participants.filter(p => !groupes.some(g => g.eleves.some(e => e.autorisationId === p.id))).length})
            </h3>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {participants
                .filter(p => !groupes.some(g => g.eleves.some(e => e.autorisationId === p.id)))
                .map(p => (
                  <div
                    key={p.id}
                    draggable={user.role === 'ORGANISATEUR'}
                    onDragStart={() => user.role === 'ORGANISATEUR' && setDragEleve(p.id)}
                    onDragEnd={() => setDragEleve(null)}
                    className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs ${user.role === 'ORGANISATEUR' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold shrink-0">
                      {p.elevePrenom[0]}{p.eleveNom[0]}
                    </div>
                    <span className="truncate font-medium text-gray-900">{p.elevePrenom} {p.eleveNom}</span>
                    {p.signeeAt && <span className="shrink-0 text-green-500">✓</span>}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Colonne droite — cards groupes */}
        <div className={`${sejour?.inscriptionsCloturees ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {groupes.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
              {user.role === 'HEBERGEUR' ? 'Créez les groupes ou utilisez la proposition automatique.' : 'Les groupes seront créés par l\'hébergeur.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groupes.map(g => (
                <div
                  key={g.id}
                  onDragOver={user.role === 'ORGANISATEUR' ? (e) => e.preventDefault() : undefined}
                  onDrop={user.role === 'ORGANISATEUR' ? (e) => { e.preventDefault(); if (dragEleve) { handleAffecterEleve(dragEleve, g.id); setDragEleve(null); } } : undefined}
                  className={`rounded-2xl border-2 bg-white p-4 transition-colors ${dragEleve && user.role === 'ORGANISATEUR' ? 'border-dashed border-[var(--color-primary)] bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: g.couleur }} />
                      <span className="text-sm font-semibold text-gray-900">{g.nom}</span>
                      <span className="text-xs text-gray-400">({g.eleves.length}/{g.taille})</span>
                    </div>
                    {user.role === 'HEBERGEUR' && (
                      <div className="flex gap-1">
                        <button onClick={() => setGroupeModal({ open: true, editId: g.id, nom: g.nom, couleur: g.couleur, taille: g.taille })}
                          className="rounded p-1 text-gray-400 hover:text-[var(--color-primary)]">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteGroupe(g.id)}
                          className="rounded p-1 text-gray-400 hover:text-red-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 min-h-8">
                    {g.eleves.map(e => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1 text-xs">
                        <span className="truncate text-gray-900">{e.autorisation.elevePrenom} {e.autorisation.eleveNom}</span>
                        {user.role === 'ORGANISATEUR' && (
                          <button onClick={() => handleRetirerEleve(e.autorisationId)}
                            className="shrink-0 ml-2 text-gray-300 hover:text-red-400">&times;</button>
                        )}
                      </div>
                    ))}
                    {g.eleves.length === 0 && (
                      <p className="text-xs text-gray-300 text-center py-2">
                        {sejour?.inscriptionsCloturees && user.role === 'ORGANISATEUR' ? 'Glissez des élèves ici' : 'Vide'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modale groupe (HEBERGEUR uniquement) */}
      {groupeModal?.open && user.role === 'HEBERGEUR' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{groupeModal.editId ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                <input value={groupeModal.nom}
                  onChange={e => setGroupeModal(m => m ? { ...m, nom: e.target.value } : m)}
                  placeholder="ex: Groupe 1, Les Lynx..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Taille cible (élèves)</label>
                <input type="number" min="1" value={groupeModal.taille}
                  onChange={e => setGroupeModal(m => m ? { ...m, taille: Number(e.target.value) } : m)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {['#16a34a','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#374151'].map(hex => (
                    <button key={hex} type="button"
                      onClick={() => setGroupeModal(m => m ? { ...m, couleur: hex } : m)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: hex, borderColor: groupeModal.couleur === hex ? '#1B4060' : 'transparent', transform: groupeModal.couleur === hex ? 'scale(1.2)' : 'scale(1)' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setGroupeModal(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={handleSaveGroupe} disabled={!groupeModal.nom.trim()}
                className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {groupeModal.editId ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
