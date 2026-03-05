'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDemandesOuvertes } from '@/src/lib/demande';
import { createDevis } from '@/src/lib/devis';
import type { Demande } from '@/src/lib/demande';

interface DevisForm {
  montantTotal: string;
  montantParEleve: string;
  description: string;
  conditionsAnnulation: string;
}

const EMPTY_FORM: DevisForm = { montantTotal: '', montantParEleve: '', description: '', conditionsAnnulation: '' };

export default function VenueDemandesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [form, setForm] = useState<DevisForm>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  const load = async () => {
    try {
      const data = await getDemandesOuvertes();
      setDemandes(data);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('403') || (typeof e === 'object' && e !== null && 'response' in e)) {
        setError('Abonnement inactif — activez votre abonnement pour voir les demandes.');
      } else {
        setError('Impossible de charger les demandes.');
      }
    }
  };

  useEffect(() => {
    if (user?.role === 'VENUE') load();
  }, [user]);

  const handleSend = async (demandeId: string) => {
    setSending(true);
    setSuccessId(null);
    try {
      await createDevis({
        demandeId,
        montantTotal: form.montantTotal,
        montantParEleve: form.montantParEleve,
        description: form.description || undefined,
        conditionsAnnulation: form.conditionsAnnulation || undefined,
      });
      setSuccessId(demandeId);
      setOpenForm(null);
      setForm(EMPTY_FORM);
    } catch {
      setError('Erreur lors de l\'envoi du devis.');
    } finally {
      setSending(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Demandes des enseignants</h1>
        <p className="text-sm text-gray-500 mb-8">Consultez les demandes ouvertes et envoyez vos devis</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {demandes.length === 0 && !error ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Aucune demande ouverte pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {demandes.map((d) => {
              const dateDebut = new Date(d.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const dateFin = new Date(d.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{d.titre}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        <span>{d.villeHebergement}</span>
                        <span>{dateDebut} → {dateFin}</span>
                        <span>{d.nombreEleves} élève{d.nombreEleves > 1 ? 's' : ''}</span>
                        {d.enseignant && <span>{d.enseignant.prenom} {d.enseignant.nom}</span>}
                      </div>
                      {d.description && <p className="mt-2 text-sm text-gray-600">{d.description}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                      {successId === d.id ? (
                        <span className="text-sm font-medium text-green-600">Devis envoyé !</span>
                      ) : (
                        <>
                          <Link
                            href={`/dashboard/venue/devis/nouveau?demandeId=${d.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Créer un devis
                          </Link>
                          <button
                            onClick={() => { setOpenForm(openForm === d.id ? null : d.id); setForm(EMPTY_FORM); setSuccessId(null); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {openForm === d.id ? 'Annuler' : 'Devis rapide'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {openForm === d.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Montant total (€)</label>
                        <input type="number" step="0.01" value={form.montantTotal} onChange={(e) => setForm({ ...form, montantTotal: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Montant par élève (€)</label>
                        <input type="number" step="0.01" value={form.montantParEleve} onChange={(e) => setForm({ ...form, montantParEleve: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description (optionnel)</label>
                        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Conditions d&apos;annulation (optionnel)</label>
                        <textarea rows={2} value={form.conditionsAnnulation} onChange={(e) => setForm({ ...form, conditionsAnnulation: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          onClick={() => handleSend(d.id)}
                          disabled={sending || !form.montantTotal || !form.montantParEleve}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sending ? 'Envoi…' : 'Envoyer le devis'}
                        </button>
                      </div>
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
