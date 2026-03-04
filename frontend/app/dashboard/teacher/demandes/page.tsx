'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { createDemande, getMesDemandes } from '@/src/lib/demande';
import { getDevisForDemande, updateDevisStatut } from '@/src/lib/devis';
import type { Demande, CreateDemandeDto } from '@/src/lib/demande';
import type { Devis } from '@/src/lib/devis';

const STATUT_DEVIS_BADGE: Record<string, { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'En attente', cls: 'bg-orange-100 text-orange-700' },
  ACCEPTE:    { label: 'Accepté',    cls: 'bg-green-100 text-green-700' },
  REFUSE:     { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
};

const EMPTY: CreateDemandeDto = { titre: '', dateDebut: '', dateFin: '', nombreEleves: 1, villeHebergement: '' };

export default function TeacherDemandesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [form, setForm] = useState<CreateDemandeDto>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Devis inline
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [devisMap, setDevisMap] = useState<Record<string, Devis[]>>({});
  const [updatingDevis, setUpdatingDevis] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TEACHER')) router.push('/login');
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    try {
      setDemandes(await getMesDemandes());
    } catch {
      setError('Impossible de charger les demandes.');
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'TEACHER') load();
  }, [user, load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createDemande(form);
      setForm(EMPTY);
      await load();
    } catch {
      setError('Erreur lors de la création de la demande.');
    } finally {
      setCreating(false);
    }
  };

  const toggleDevis = async (demandeId: string) => {
    if (expandedId === demandeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(demandeId);
    if (!devisMap[demandeId]) {
      try {
        const devis = await getDevisForDemande(demandeId);
        setDevisMap((prev) => ({ ...prev, [demandeId]: devis }));
      } catch { /* ignore */ }
    }
  };

  const handleStatut = async (devisId: string, statut: 'ACCEPTE' | 'REFUSE', demandeId: string) => {
    setUpdatingDevis(devisId);
    try {
      await updateDevisStatut(devisId, statut);
      const devis = await getDevisForDemande(demandeId);
      setDevisMap((prev) => ({ ...prev, [demandeId]: devis }));
    } catch { /* ignore */ }
    setUpdatingDevis(null);
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mes demandes de devis</h1>
        <p className="text-sm text-gray-500 mb-8">Créez des demandes et recevez des devis de centres d&apos;hébergement</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Formulaire ─────────────────────────────────────────── */}
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nouvelle demande</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Titre</label>
              <input type="text" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Ex : Séjour montagne classe de 5e" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date de début</label>
              <input type="date" required value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date de fin</label>
              <input type="date" required value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre d&apos;élèves</label>
              <input type="number" min={1} required value={form.nombreEleves} onChange={(e) => setForm({ ...form, nombreEleves: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ville d&apos;hébergement</label>
              <input type="text" required value={form.villeHebergement} onChange={(e) => setForm({ ...form, villeHebergement: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Ex : Chamonix" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description (optionnel)</label>
              <textarea rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value || undefined })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {creating ? 'Création…' : 'Créer la demande'}
            </button>
          </div>
        </form>

        {/* ── Liste des demandes ──────────────────────────────── */}
        {demandes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">Aucune demande créée pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {demandes.map((d) => {
              const dateDebut = new Date(d.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const dateFin = new Date(d.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const devisCount = d._count?.devis ?? 0;
              const expanded = expandedId === d.id;
              const devis = devisMap[d.id] ?? [];

              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{d.titre}</h3>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {d.statut}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{d.villeHebergement}</span>
                        <span>{dateDebut} → {dateFin}</span>
                        <span>{d.nombreEleves} élève{d.nombreEleves > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDevis(d.id)}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {devisCount} devis reçu{devisCount > 1 ? 's' : ''} {expanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                      {devis.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucun devis reçu pour cette demande.</p>
                      ) : (
                        devis.map((dv) => {
                          const badge = STATUT_DEVIS_BADGE[dv.statut] ?? STATUT_DEVIS_BADGE.EN_ATTENTE;
                          return (
                            <div key={dv.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-900">{dv.centre?.nom ?? 'Centre'}</span>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                    <span>Total : {dv.montantTotal} €</span>
                                    <span>Par élève : {dv.montantParEleve} €</span>
                                    {dv.centre?.ville && <span>{dv.centre.ville}</span>}
                                    {dv.centre?.capacite && <span>{dv.centre.capacite} lits</span>}
                                  </div>
                                  {dv.description && <p className="mt-1 text-xs text-gray-600">{dv.description}</p>}
                                  {dv.conditionsAnnulation && <p className="mt-1 text-xs text-gray-400">Annulation : {dv.conditionsAnnulation}</p>}
                                </div>
                                {dv.statut === 'EN_ATTENTE' && (
                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      onClick={() => handleStatut(dv.id, 'ACCEPTE', d.id)}
                                      disabled={updatingDevis === dv.id}
                                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                    >
                                      Accepter
                                    </button>
                                    <button
                                      onClick={() => handleStatut(dv.id, 'REFUSE', d.id)}
                                      disabled={updatingDevis === dv.id}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      Refuser
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
