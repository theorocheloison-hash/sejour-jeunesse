'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDocuments, createDocument } from '@/src/lib/centre';
import type { DocumentCentre } from '@/src/lib/centre';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  AGREMENT:  { label: 'Agrément',  cls: 'bg-blue-100 text-blue-700' },
  ASSURANCE: { label: 'Assurance', cls: 'bg-purple-100 text-purple-700' },
  AUTRE:     { label: 'Autre',     cls: 'bg-gray-100 text-gray-600' },
};

function expirationBadge(dateExpiration: string | null) {
  if (!dateExpiration) return null;
  const exp = new Date(dateExpiration);
  const now = new Date();
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">Expiré</span>;
  if (daysLeft <= 30) return <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-medium">Expire bientôt</span>;
  return <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">Valide</span>;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [docs, setDocs] = useState<DocumentCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [type, setType] = useState<'AGREMENT' | 'ASSURANCE' | 'AUTRE'>('AGREMENT');
  const [nom, setNom] = useState('');
  const [dateExpiration, setDateExpiration] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try { setDocs(await getDocuments()); }
    catch { setError('Erreur de chargement.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === 'VENUE') fetchDocs(); }, [user, fetchDocs]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createDocument({
        type,
        nom,
        dateExpiration: dateExpiration || undefined,
      });
      setNom(''); setDateExpiration(''); setType('AGREMENT');
      await fetchDocs();
    } catch { setError('Erreur lors de l\'ajout.'); }
    finally { setSubmitting(false); }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <span className="font-semibold text-gray-900">Documents de conformité</span>
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Retour</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Formulaire */}
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ajouter un document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputCls}>
                <option value="AGREMENT">Agrément</option>
                <option value="ASSURANCE">Assurance</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom du document *</label>
              <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Agrément DSDEN 2025" className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date d'expiration</label>
              <input type="date" value={dateExpiration} onChange={(e) => setDateExpiration(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary)] transition-colors disabled:opacity-60">
            {submitting ? 'Ajout...' : 'Ajouter'}
          </button>
        </form>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" /></div>
        ) : docs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun document enregistré.</p>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => {
              const typeInfo = TYPE_LABELS[d.type] ?? TYPE_LABELS.AUTRE;
              return (
                <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo.cls}`}>{typeInfo.label}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.nom}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Ajouté le {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                        {d.dateExpiration && ` — Expire le ${new Date(d.dateExpiration).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>
                  {expirationBadge(d.dateExpiration)}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
