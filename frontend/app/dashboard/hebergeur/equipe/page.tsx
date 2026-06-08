'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/src/hooks/usePermissions';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';

type PermLevel = 'NONE' | 'READ' | 'WRITE';
type PermModule = 'planning' | 'sejours' | 'devis' | 'crm' | 'facturation' | 'parametres';
type PermMap = Record<PermModule, PermLevel>;

interface CollaborateurDTO {
  id: string;
  inviteEmail: string;
  permissions: PermMap;
  acceptedAt: string | null;
  createdAt: string;
  centre: { id: string; nom: string };
  user: { prenom: string; nom: string; email: string } | null;
}

const MODULES: { key: PermModule; label: string }[] = [
  { key: 'planning', label: 'Planning' },
  { key: 'sejours', label: 'Séjours' },
  { key: 'devis', label: 'Devis' },
  { key: 'crm', label: 'CRM' },
  { key: 'facturation', label: 'Facturation' },
  { key: 'parametres', label: 'Paramètres' },
];

const LEVEL_LABELS: Record<PermLevel, string> = {
  NONE: '❌ Aucun',
  READ: '👁️ Lecture',
  WRITE: '✏️ Modification',
};

const DEFAULT_PERMS: PermMap = {
  planning: 'WRITE', sejours: 'WRITE', devis: 'WRITE',
  crm: 'READ', facturation: 'NONE', parametres: 'NONE',
};

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

function PermissionGrid({ value, onChange }: { value: PermMap; onChange: (m: PermModule, l: PermLevel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MODULES.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
          <select value={value[key]} onChange={(e) => onChange(key, e.target.value as PermLevel)} className={inputCls}>
            <option value="NONE">{LEVEL_LABELS.NONE}</option>
            <option value="READ">{LEVEL_LABELS.READ}</option>
            <option value="WRITE">{LEVEL_LABELS.WRITE}</option>
          </select>
        </div>
      ))}
    </div>
  );
}

export default function EquipePage() {
  const { loading: permsLoading, isOwner } = usePermissions();
  const { centres } = useAuth();
  const ownedCentres = centres.filter((c) => c.isOwned);

  const [collabs, setCollabs] = useState<CollaborateurDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modale invitation
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCentreIds, setInviteCentreIds] = useState<string[]>([]);
  const [invitePerms, setInvitePerms] = useState<PermMap>(DEFAULT_PERMS);

  // Modale édition
  const [editTarget, setEditTarget] = useState<CollaborateurDTO | null>(null);
  const [editPerms, setEditPerms] = useState<PermMap>(DEFAULT_PERMS);

  // Modale suppression
  const [deleteTarget, setDeleteTarget] = useState<CollaborateurDTO | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CollaborateurDTO[]>('/collaborateurs');
      setCollabs(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permsLoading && isOwner) reload();
  }, [permsLoading, isOwner, reload]);

  const toggleCentre = (id: string) => {
    setInviteCentreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || inviteCentreIds.length === 0) {
      setError('Renseignez un email et au moins un centre.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/collaborateurs/inviter', {
        email: inviteEmail.trim(),
        centreIds: inviteCentreIds,
        permissions: invitePerms,
      });
      setShowInvite(false);
      setInviteEmail('');
      setInviteCentreIds([]);
      setInvitePerms(DEFAULT_PERMS);
      await reload();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de l\'invitation');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: CollaborateurDTO) => {
    setEditTarget(c);
    setEditPerms({ ...DEFAULT_PERMS, ...c.permissions });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/collaborateurs/${editTarget.id}`, { permissions: editPerms });
      setEditTarget(null);
      await reload();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/collaborateurs/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  if (permsLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-24 px-6">
        <p className="text-sm text-gray-500 text-center max-w-md">
          Seul le propriétaire du centre peut gérer l&apos;équipe.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Mon équipe</h1>
        <button
          onClick={() => { setShowInvite(true); setError(null); }}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Inviter un collaborateur
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && !showInvite && !editTarget && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : collabs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">Aucun collaborateur. Invitez votre équipe pour partager l&apos;accès à vos centres.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Nom</th>
                  <th className="px-4 py-2.5 font-medium">Centre</th>
                  <th className="px-4 py-2.5 font-medium">Permissions</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {collabs.map((c) => {
                  const resume = MODULES
                    .filter((m) => c.permissions[m.key] && c.permissions[m.key] !== 'NONE')
                    .map((m) => `${m.label} ${c.permissions[m.key] === 'WRITE' ? '✏️' : '👁️'}`)
                    .join(', ');
                  return (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-gray-900">{c.inviteEmail}</td>
                      <td className="px-4 py-3 text-gray-600">{c.user ? `${c.user.prenom} ${c.user.nom}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.centre.nom}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{resume || '—'}</td>
                      <td className="px-4 py-3">
                        {c.acceptedAt ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Accepté</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">En attente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => { openEdit(c); setError(null); }} className="text-xs text-[var(--color-primary)] hover:underline mr-3">Modifier</button>
                        <button onClick={() => setDeleteTarget(c)} className="text-xs text-red-500 hover:underline">Supprimer</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale invitation */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Inviter un collaborateur</h2>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="collaborateur@exemple.fr" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Centres concernés</label>
                {ownedCentres.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun centre dont vous êtes propriétaire.</p>
                ) : (
                  <div className="space-y-1.5">
                    {ownedCentres.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={inviteCentreIds.includes(c.id)} onChange={() => toggleCentre(c.id)} className="h-4 w-4 rounded border-gray-300" />
                        {c.nom}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Permissions par module</p>
                <PermissionGrid value={invitePerms} onChange={(m, l) => setInvitePerms((p) => ({ ...p, [m]: l }))} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleInvite} disabled={saving} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Envoi…' : 'Envoyer l\'invitation'}
              </button>
              <button onClick={() => setShowInvite(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale édition */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Modifier les permissions</h2>
            <p className="text-xs text-gray-400 mb-4">{editTarget.inviteEmail} · {editTarget.centre.nom}</p>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>}
            <PermissionGrid value={editPerms} onChange={(m, l) => setEditPerms((p) => ({ ...p, [m]: l }))} />
            <div className="flex gap-3 mt-6">
              <button onClick={handleEdit} disabled={saving} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Supprimer l&apos;accès</h2>
            <p className="text-sm text-gray-600 mb-5">
              Supprimer l&apos;accès de <strong>{deleteTarget.inviteEmail}</strong> sur <strong>{deleteTarget.centre.nom}</strong> ?
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={saving} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Suppression…' : 'Supprimer'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
