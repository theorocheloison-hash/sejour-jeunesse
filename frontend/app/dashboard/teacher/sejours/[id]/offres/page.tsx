'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDemandes } from '@/src/lib/demande';
import { getComparatif, updateDevisStatut } from '@/src/lib/devis';
import type { Demande } from '@/src/lib/demande';
import type { Devis, StatutDevis } from '@/src/lib/devis';

const STATUT_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE:            { label: 'En attente',            cls: 'bg-orange-100 text-orange-700' },
  ACCEPTE:               { label: 'Accepté',               cls: 'bg-green-100 text-green-700' },
  REFUSE:                { label: 'Refusé',                cls: 'bg-red-100 text-red-700' },
  EN_ATTENTE_VALIDATION: { label: 'Soumis au directeur',   cls: 'bg-blue-100 text-blue-700' },
  SELECTIONNE:           { label: 'Sélectionné',           cls: 'bg-emerald-100 text-emerald-700' },
  NON_RETENU:            { label: 'Non retenu',            cls: 'bg-gray-100 text-gray-600' },
};

export default function OffresPage() {
  const params = useParams();
  const router = useRouter();
  const sejourId = params.id as string;
  const { user, isLoading } = useAuth();

  const [demande, setDemande] = useState<Demande | null>(null);
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TEACHER')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    // Find the demande linked to this sejour
    getMesDemandes().then((demandes) => {
      const d = demandes.find((dem) => dem.sejourId === sejourId);
      if (d) {
        setDemande(d);
        getComparatif(d.id).then(setDevisList).catch(() => setError('Impossible de charger les devis.'));
      } else {
        setError('Aucune demande trouvée pour ce séjour.');
      }
    }).catch(() => setError('Erreur de chargement.'));
  }, [user, sejourId]);

  const handleStatut = async (devisId: string, statut: StatutDevis) => {
    setUpdatingId(devisId);
    try {
      await updateDevisStatut(devisId, statut);
      if (demande) {
        const updated = await getComparatif(demande.id);
        setDevisList(updated);
      }
    } catch { /* ignore */ }
    setUpdatingId(null);
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Offres reçues</h1>
        <p className="text-sm text-gray-500 mb-8">Comparez les devis des centres d&apos;hébergement</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {devisList.length === 0 && !error ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Aucun devis reçu pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Centre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ville</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Par élève</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Annulation</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {devisList.map((d) => {
                  const badge = STATUT_BADGE[d.statut] ?? STATUT_BADGE.EN_ATTENTE;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.centre?.nom ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{d.centre?.ville ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{d.montantTotal} €</td>
                      <td className="px-4 py-3 text-right text-gray-600">{d.montantParEleve} €</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{d.description ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{d.conditionsAnnulation ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {d.centre?.email && (
                            <a
                              href={`mailto:${d.centre.email}`}
                              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Contacter
                            </a>
                          )}
                          {d.statut === 'EN_ATTENTE' && (
                            <button
                              onClick={() => handleStatut(d.id, 'EN_ATTENTE_VALIDATION')}
                              disabled={updatingId === d.id}
                              className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Soumettre
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
