'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getAdminStats,
  getHebergeurs,
  validerHebergeur,
  refuserHebergeur,
  getUtilisateurs,
  updateUtilisateur,
  getCentres,
  type AdminStats,
  type Hebergeur,
  type Utilisateur,
  type Centre,
} from '@/src/lib/admin';

// ─── Constantes ──────────────────────────────────────────────────────────────

type Tab = 'stats' | 'hebergeurs' | 'utilisateurs' | 'centres';

const TABS: { value: Tab; label: string }[] = [
  { value: 'stats',        label: 'Vue générale' },
  { value: 'hebergeurs',   label: 'Hébergeurs' },
  { value: 'utilisateurs', label: 'Utilisateurs' },
  { value: 'centres',      label: 'Centres' },
];

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Enseignant',
  DIRECTOR: 'Directeur',
  RECTOR: 'Rectorat',
  PARENT: 'Parent',
  VENUE: 'Hébergeur',
  ADMIN: 'Admin',
  ACCOUNTANT: 'Comptable',
};

const STATUT_SEJOUR_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR');
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

// ─── Stats Tab ───────────────────────────────────────────────────────────────

function StatsTab({ stats }: { stats: AdminStats | null }) {
  if (!stats) return <LoadingSpinner />;
  const maxRole = Math.max(...stats.utilisateursParRole.map((r) => r.count), 1);
  const maxSejour = Math.max(...stats.sejoursParStatut.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Utilisateurs" value={stats.totalUtilisateurs} />
        <KpiCard label="Centres" value={stats.totalCentres} />
        <KpiCard label="Séjours" value={stats.totalSejours} />
        <KpiCard label="Devis" value={stats.totalDevis} />
        <KpiCard label="En attente" value={stats.hebergeursEnAttente} accent="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilisateurs par rôle */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Utilisateurs par rôle</h3>
          <div className="space-y-3">
            {stats.utilisateursParRole.map((r) => (
              <div key={r.role} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 shrink-0">{ROLE_LABELS[r.role] ?? r.role}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-[#003189] h-full rounded-full transition-all"
                    style={{ width: `${(r.count / maxRole) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Séjours par statut */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Séjours par statut</h3>
          <div className="space-y-3">
            {stats.sejoursParStatut.map((s) => (
              <div key={s.statut} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 shrink-0">{STATUT_SEJOUR_LABELS[s.statut] ?? s.statut}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${(s.count / maxSejour) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hébergeurs Tab ──────────────────────────────────────────────────────────

function HebergeursTab() {
  const [hebergeurs, setHebergeurs] = useState<Hebergeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'EN_ATTENTE' | 'VALIDE' | 'ALL'>('EN_ATTENTE');
  const [actionId, setActionId] = useState<string | null>(null);
  const [motifRefus, setMotifRefus] = useState('');
  const [showRefusModal, setShowRefusModal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHebergeurs(subTab === 'ALL' ? undefined : subTab);
      setHebergeurs(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [subTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleValider = async (id: string) => {
    setActionId(id);
    try {
      await validerHebergeur(id);
      setHebergeurs((prev) => prev.filter((h) => h.id !== id));
    } catch { /* ignore */ }
    setActionId(null);
  };

  const handleRefuser = async () => {
    if (!showRefusModal) return;
    setActionId(showRefusModal);
    try {
      await refuserHebergeur(showRefusModal, motifRefus || undefined);
      setHebergeurs((prev) => prev.filter((h) => h.id !== showRefusModal));
    } catch { /* ignore */ }
    setShowRefusModal(null);
    setMotifRefus('');
    setActionId(null);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {([['EN_ATTENTE', 'En attente'], ['VALIDE', 'Validés'], ['ALL', 'Tous']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setSubTab(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${subTab === val ? 'bg-[#003189] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : hebergeurs.length === 0 ? (
        <EmptyState text="Aucun hébergeur trouvé" />
      ) : (
        <div className="space-y-3">
          {hebergeurs.map((h) => {
            const centre = h.centres[0];
            return (
              <div key={h.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{h.prenom} {h.nom}</h3>
                      {h.compteValide ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Validé</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">En attente</span>
                      )}
                      {h.emailVerifie && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Email vérifié</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{h.email}</p>
                    {h.telephone && <p className="text-xs text-gray-400">{h.telephone}</p>}
                    <p className="text-xs text-gray-400 mt-1">Inscrit le {formatDate(h.createdAt)}</p>

                    {centre && (
                      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
                        <p className="text-sm font-medium text-gray-900">{centre.nom}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                          <span>{centre.ville} ({centre.codePostal})</span>
                          <span>Capacité : {centre.capacite}</span>
                          {centre.siret && <span>SIRET : {centre.siret}</span>}
                          {centre.departement && <span>{centre.departement}</span>}
                          {centre.agrementEducationNationale && (
                            <span className="text-emerald-600 font-medium">Agréé EN : {centre.agrementEducationNationale}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!h.compteValide && (
                    <div className="shrink-0 flex gap-2">
                      <button
                        onClick={() => handleValider(h.id)}
                        disabled={actionId === h.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition disabled:opacity-50"
                      >
                        {actionId === h.id ? <Spinner /> : null}
                        Valider
                      </button>
                      <button
                        onClick={() => setShowRefusModal(h.id)}
                        disabled={actionId === h.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 transition disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refus modal */}
      {showRefusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRefusModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Refuser l&apos;hébergeur</h3>
            <textarea
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              placeholder="Motif du refus (optionnel)..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003189] mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRefusModal(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
              <button
                onClick={handleRefuser}
                disabled={actionId !== null}
                className="px-4 py-2 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600 transition disabled:opacity-50"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Utilisateurs Tab ────────────────────────────────────────────────────────

function UtilisateursTab() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUtilisateurs(search || undefined, roleFilter || undefined);
      setUtilisateurs(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(fetchData, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  const handleToggleValide = async (u: Utilisateur) => {
    try {
      const updated = await updateUtilisateur(u.id, { compteValide: !u.compteValide });
      setUtilisateurs((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom ou email..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003189] focus:border-transparent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003189] focus:border-transparent bg-white"
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500">{utilisateurs.length} utilisateur{utilisateurs.length > 1 ? 's' : ''}</p>

      {loading ? <LoadingSpinner /> : utilisateurs.length === 0 ? (
        <EmptyState text="Aucun utilisateur trouvé" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Établissement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inscrit le</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {utilisateurs.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">{u.prenom} {u.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.etablissementNom ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.compteValide ? (
                          <span className="h-2 w-2 rounded-full bg-green-500" title="Compte validé" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-amber-500" title="En attente" />
                        )}
                        {u.emailVerifie ? (
                          <span className="h-2 w-2 rounded-full bg-blue-500" title="Email vérifié" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-gray-300" title="Email non vérifié" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleValide(u)}
                        className={`text-xs font-medium px-2 py-1 rounded transition ${u.compteValide ? 'text-amber-700 hover:bg-amber-50' : 'text-green-700 hover:bg-green-50'}`}
                      >
                        {u.compteValide ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Centres Tab ─────────────────────────────────────────────────────────────

function CentresTab() {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCentres(search || undefined);
      setCentres(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un centre par nom ou ville..."
          className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003189] focus:border-transparent"
        />
      </div>

      <p className="text-xs text-gray-500">{centres.length} centre{centres.length > 1 ? 's' : ''}</p>

      {loading ? <LoadingSpinner /> : centres.length === 0 ? (
        <EmptyState text="Aucun centre trouvé" />
      ) : (
        <div className="space-y-3">
          {centres.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{c.nom}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.statut === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.statut === 'ACTIVE' ? 'Actif' : c.statut}
                    </span>
                    {c.agrementEducationNationale && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Agréé EN
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{c.adresse}, {c.ville} {c.codePostal}</span>
                    <span>Capacité : {c.capacite}</span>
                    {c.departement && <span>{c.departement}</span>}
                    {c.siret && <span>SIRET : {c.siret}</span>}
                    <span>{c._count.devis} devis</span>
                  </div>
                  {c.user && (
                    <p className="text-xs text-gray-400 mt-1">
                      Géré par {c.user.prenom} {c.user.nom} ({c.user.email})
                      {!c.user.compteValide && <span className="text-amber-600 font-medium ml-1">— compte non validé</span>}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">Créé le {formatDate(c.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[#003189] border-t-transparent" />
    </div>
  );
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
      <p className="text-sm font-medium text-gray-500">{text}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      getAdminStats().then(setStats).catch(() => {});
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
              <span className="text-sm font-bold text-[#003189]">Liavo</span>
              <span className="text-xs text-gray-400">Administration</span>
            </div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 transition">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard administrateur</h1>
        <p className="text-sm text-gray-500 mb-6">Gestion de la plateforme Liavo</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                tab === t.value
                  ? 'border-[#003189] text-[#003189]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
              {t.value === 'hebergeurs' && stats && stats.hebergeursEnAttente > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {stats.hebergeursEnAttente}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'stats' && <StatsTab stats={stats} />}
        {tab === 'hebergeurs' && <HebergeursTab />}
        {tab === 'utilisateurs' && <UtilisateursTab />}
        {tab === 'centres' && <CentresTab />}
      </main>
    </div>
  );
}
