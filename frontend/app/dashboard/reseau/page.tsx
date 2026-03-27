'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMyReseauStats, type ReseauStats, type ReseauCentre } from '@/src/lib/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR');
}

function formatEuros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

// ─── Statut badge ────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: string }) {
  const cls =
    statut === 'ACTIVE'
      ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
      : statut === 'SUSPENDED'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';
  const label = statut === 'ACTIVE' ? 'Actif' : statut === 'SUSPENDED' ? 'Suspendu' : 'En attente';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Loading / Empty ─────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border-strong)] border-t-transparent" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
      <p className="text-sm font-medium text-gray-500">{text}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReseauDashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [stats, setStats] = useState<ReseauStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'RESEAU' && user.role !== 'ADMIN'))) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && (user.role === 'RESEAU' || user.role === 'ADMIN')) {
      getMyReseauStats()
        .then(setStats)
        .catch(() => setError('Impossible de charger les statistiques du réseau'))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[var(--color-primary)]">Liavo</span>
              <span className="text-xs text-gray-400">Espace réseau</span>
            </div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 transition">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Tableau de bord {stats ? `— ${stats.reseau}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mb-6">Suivi de l&apos;activité de vos centres adhérents sur Liavo</p>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <EmptyState text={error} />
        ) : stats ? (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard label="Centres membres" value={stats.kpis.totalCentres} />
              <KpiCard label="Centres actifs" value={stats.kpis.centresActifs} accent="text-[var(--color-success)]" />
              <KpiCard label="Demandes reçues" value={stats.kpis.demandesRecues} />
              <KpiCard label="Devis envoyés" value={stats.kpis.devisEnvoyes} />
              <KpiCard label="Devis retenus" value={stats.kpis.devisSelectionnes} accent="text-[var(--color-primary)]" />
              <KpiCard label="Taux de réponse" value={`${stats.kpis.tauxReponse} %`} />
            </div>

            {/* Table des centres */}
            {stats.centres.length === 0 ? (
              <EmptyState text="Aucun centre rattaché à ce réseau" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ville / Dép.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacité</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devis</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retenus</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA généré</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière activité</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.centres.map((c: ReseauCentre) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">{c.nom}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {c.ville}{c.departement ? ` (${c.departement})` : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.capacite}</td>
                          <td className="px-4 py-3"><StatutBadge statut={c.statut} /></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.demandesRecues}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.devisEnvoyes}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.devisSelectionnes}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatEuros(c.caGenere)}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(c.derniereActivite)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
