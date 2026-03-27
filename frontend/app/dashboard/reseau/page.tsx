'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getMyReseauStats,
  inviterCentreReseau,
  getReseauCentreDetail,
  type ReseauStats,
  type ReseauCentre,
} from '@/src/lib/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR');
}

function formatEuros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

const PERIODES: { value: string; label: string }[] = [
  { value: '30j', label: '30 derniers jours' },
  { value: '90j', label: '90 jours' },
  { value: 'saison', label: 'Cette saison' },
  { value: 'tout', label: 'Depuis le début' },
];

const ONBOARDING_LABELS = ['Profil complet', 'Mandat signé', 'Agrément renseigné', 'SIRET renseigné'];

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

// ─── Onboarding dots ─────────────────────────────────────────────────────────

function OnboardingDots({ centre }: { centre: ReseauCentre }) {
  const steps = [
    centre.onboardingDetails.profilComplet,
    centre.onboardingDetails.mandatSigne,
    centre.onboardingDetails.agrementRenseigne,
    centre.onboardingDetails.siretRenseigne,
  ];
  return (
    <div className="flex items-center gap-1">
      {steps.map((ok, i) => (
        <span
          key={i}
          title={ONBOARDING_LABELS[i]}
          className={`inline-block w-2.5 h-2.5 rounded-full cursor-help ${ok ? 'bg-[var(--color-success)]' : 'bg-gray-300'}`}
        />
      ))}
    </div>
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

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {message}
    </div>
  );
}

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [nomCentre, setNomCentre] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !nomCentre) { setError('Tous les champs sont obligatoires'); return; }
    setSending(true);
    setError(null);
    try {
      await inviterCentreReseau(email, nomCentre);
      onSuccess(`Invitation envoyée à ${email}`);
      onClose();
    } catch {
      setError('Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Inviter un centre</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email du centre</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="contact@centre.fr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du centre</label>
            <input
              type="text"
              value={nomCentre}
              onChange={e => setNomCentre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="Centre de la Montagne"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={sending} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition disabled:opacity-50">
            {sending ? 'Envoi...' : 'Envoyer l\'invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slide-over centre detail ────────────────────────────────────────────────

const DEVIS_STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  EN_ATTENTE_VALIDATION: 'Validation',
  SELECTIONNE: 'Retenu',
  NON_RETENU: 'Non retenu',
};

function CentreSlideOver({ centreId, onClose }: { centreId: string; onClose: () => void }) {
  const [centre, setCentre] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReseauCentreDetail(centreId)
      .then(setCentre)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [centreId]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 z-50 overflow-y-auto">
        <div className="p-5">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>

          {loading ? <LoadingSpinner /> : !centre ? <EmptyState text="Centre introuvable" /> : (
            <div className="space-y-5 pt-2">
              {centre.imageUrl && (
                <img src={centre.imageUrl} alt={centre.nom} className="w-full h-40 object-cover rounded-xl" />
              )}

              <div>
                <h2 className="text-lg font-bold text-gray-900">{centre.nom}</h2>
                <p className="text-sm text-gray-500">{centre.ville}{centre.departement ? ` (${centre.departement})` : ''}</p>
                <p className="text-xs text-gray-400">{centre.adresse}, {centre.codePostal}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Capacité élèves</span><p className="font-medium">{centre.capacite}</p></div>
                {centre.capaciteAdultes && <div><span className="text-gray-500">Capacité adultes</span><p className="font-medium">{centre.capaciteAdultes}</p></div>}
              </div>

              {centre.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
                  <p className="text-sm text-gray-700">{centre.description}</p>
                </div>
              )}

              {centre.thematiquesCentre?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Thématiques</p>
                  <div className="flex flex-wrap gap-1.5">
                    {centre.thematiquesCentre.map((t: string) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {centre.activitesCentre?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Activités</p>
                  <div className="flex flex-wrap gap-1.5">
                    {centre.activitesCentre.map((a: string) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {centre.periodeOuverture && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Période d&apos;ouverture</p>
                  <p className="text-sm text-gray-700">{centre.periodeOuverture}</p>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {centre.accessiblePmr && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Accessible PMR</span>
                )}
                {centre.avisSecurite && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Avis sécurité : {centre.avisSecurite}</span>
                )}
                {centre.agrementEducationNationale && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Agréé EN</span>
                )}
              </div>

              {/* Statut plateforme */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Statut plateforme</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Compte</span>
                  <StatutBadge statut={centre.statut} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Mandat signé</span>
                  <span className={`font-medium ${centre.mandatFacturationAccepte ? 'text-green-600' : 'text-amber-600'}`}>
                    {centre.mandatFacturationAccepte ? `Oui (${formatDate(centre.mandatFacturationAccepteAt)})` : 'Non'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">SIRET</span>
                  <span className={`font-medium ${centre.siret ? 'text-green-600' : 'text-amber-600'}`}>
                    {centre.siret ? 'Oui' : 'Non'}
                  </span>
                </div>
              </div>

              {/* Activité récente — devis */}
              {centre.devis?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Derniers devis</p>
                  <div className="space-y-1.5">
                    {centre.devis.slice(0, 5).map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">{formatDate(d.createdAt)}</span>
                        <span className="text-xs font-medium text-gray-600">{DEVIS_STATUT_LABELS[d.statut] ?? d.statut}</span>
                        <span className="font-medium text-gray-900">{d.montantTTC ? formatEuros(d.montantTTC) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(stats: ReseauStats) {
  const headers = ['Nom', 'Ville', 'Département', 'Capacité', 'Statut', 'Profil (/4)',
    'Demandes reçues', 'Devis envoyés', 'Devis retenus', 'CA généré (€)', 'Dernière activité'];
  const rows = stats.centres.map(c => [
    c.nom, c.ville, c.departement ?? '', c.capacite,
    c.statut === 'ACTIVE' ? 'Actif' : c.statut === 'PENDING' ? 'En attente' : 'Suspendu',
    c.onboardingScore,
    c.demandesRecues, c.devisEnvoyes, c.devisSelectionnes,
    c.caGenere, new Date(c.derniereActivite).toLocaleDateString('fr-FR'),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${stats.reseau}_centres_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReseauDashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [stats, setStats] = useState<ReseauStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<string>('tout');
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'RESEAU' && user.role !== 'ADMIN'))) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadStats = useCallback((p: string) => {
    if (!user || (user.role !== 'RESEAU' && user.role !== 'ADMIN')) return;
    setLoading(true);
    getMyReseauStats(p)
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques du réseau'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadStats(periode);
  }, [loadStats, periode]);

  const handlePeriodeChange = (p: string) => {
    setPeriode(p);
  };

  if (isLoading || !user) return null;

  const displayName = stats?.nomComplet && stats.nomComplet !== stats.reseau ? stats.nomComplet : stats?.reseau;

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
        {/* Title + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Tableau de bord {displayName ? `— ${displayName}` : ''}
          </h1>
          <div className="flex items-center gap-2">
            {stats && (
              <button
                onClick={() => exportCSV(stats)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Exporter CSV
              </button>
            )}
            <button
              onClick={() => setShowInvite(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition"
            >
              Inviter un centre
            </button>
          </div>
        </div>

        {/* Subtitle + Période */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <p className="text-sm text-gray-500">
            Suivi de l&apos;activité de vos centres adhérents sur Liavo
            {stats?.periode && stats.periode !== 'tout' && (
              <span className="ml-1 text-[var(--color-primary)] font-medium">
                — {PERIODES.find(p => p.value === stats.periode)?.label}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            {PERIODES.map(p => (
              <button
                key={p.value}
                onClick={() => handlePeriodeChange(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${periode === p.value ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profil</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devis</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retenus</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA généré</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière activité</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.centres.map((c: ReseauCentre) => (
                        <tr
                          key={c.id}
                          className="hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => setSelectedCentreId(c.id)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                            {c.nom}
                            {c.onboardingScore < 4 && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400" title="Profil incomplet" />}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {c.ville}{c.departement ? ` (${c.departement})` : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.capacite}</td>
                          <td className="px-4 py-3"><StatutBadge statut={c.statut} /></td>
                          <td className="px-4 py-3"><OnboardingDots centre={c} /></td>
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

      {/* Modals / Overlays */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={(msg) => setToast({ message: msg, type: 'success' })}
        />
      )}
      {selectedCentreId && (
        <CentreSlideOver centreId={selectedCentreId} onClose={() => setSelectedCentreId(null)} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
