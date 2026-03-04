'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDisponibilites, createDisponibilite, deleteDisponibilite } from '@/src/lib/centre';
import type { Disponibilite } from '@/src/lib/centre';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function DisponibilitesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [dispos, setDispos] = useState<Disponibilite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [capacite, setCapacite] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  const fetchDispos = useCallback(async () => {
    setLoading(true);
    try { setDispos(await getDisponibilites()); }
    catch { setError('Erreur de chargement.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === 'VENUE') fetchDispos(); }, [user, fetchDispos]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createDisponibilite({
        dateDebut,
        dateFin,
        capaciteDisponible: parseInt(capacite, 10),
        commentaire: commentaire || undefined,
      });
      setDateDebut(''); setDateFin(''); setCapacite(''); setCommentaire('');
      await fetchDispos();
    } catch { setError('Erreur lors de l\'ajout.'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteDisponibilite(id); await fetchDispos(); }
    catch { setError('Erreur lors de la suppression.'); }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <span className="font-semibold text-gray-900">Disponibilités</span>
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Retour</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Formulaire */}
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ajouter une période de disponibilité</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de début *</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de fin *</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} min={dateDebut} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Capacité disponible *</label>
              <input type="number" value={capacite} onChange={(e) => setCapacite(e.target.value)} min={1} placeholder="Ex : 30" className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Commentaire</label>
              <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ex : Vacances de printemps" className={inputCls} />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {submitting ? 'Ajout...' : 'Ajouter'}
          </button>
        </form>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
        ) : dispos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune disponibilité enregistrée.</p>
        ) : (
          <div className="space-y-3">
            {dispos.map((d) => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {fmtDate(d.dateDebut)} → {fmtDate(d.dateFin)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {d.capaciteDisponible} places{d.commentaire ? ` — ${d.commentaire}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
