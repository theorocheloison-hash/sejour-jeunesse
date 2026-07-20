'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import SecureFileLink from '@/src/components/SecureFileLink';
import {
  getAdminStats,
  getHebergeurs,
  validerHebergeur,
  refuserHebergeur,
  getUtilisateurs,
  updateUtilisateur,
  getCentres,
  getReseauStats,
  updateCentreReseau,
  getDossiersAValiderCount,
  getAdminAbonnements,
  getAdminFacturesLiavo,
  getAdminMetriquesAbonnements,
  getAdminActivite,
  genererDevisLiavo,
  facturerCentre,
  type AdminActivite,
  type AdminStats,
  type Hebergeur,
  type Utilisateur,
  type Centre,
  type ReseauStats,
  type CentreAbonnement,
  type FactureLiavo,
  type MetriquesAbonnements,
} from '@/src/lib/admin';
import { formatDate } from '@/src/lib/utils';
import KpiCard from '@/src/components/KpiCard';

// ─── Constantes ──────────────────────────────────────────────────────────────

type Tab = 'activite' | 'stats' | 'hebergeurs' | 'utilisateurs' | 'centres' | 'reseaux' | 'abonnements' | 'factures-liavo';

const TABS: { value: Tab; label: string }[] = [
  { value: 'activite',        label: 'Activité' },
  { value: 'stats',           label: 'Vue générale' },
  { value: 'hebergeurs',      label: 'Hébergeurs' },
  { value: 'utilisateurs',    label: 'Utilisateurs' },
  { value: 'centres',         label: 'Centres' },
  { value: 'abonnements',     label: 'Abonnements' },
  { value: 'factures-liavo',  label: 'Factures LIAVO' },
  { value: 'reseaux',         label: 'Réseaux partenaires' },
];

const RESEAUX_CONNUS = ['LMDJ', 'IDDJ'];

const ROLE_LABELS: Record<string, string> = {
  ORGANISATEUR: 'Organisateur',
  SIGNATAIRE: 'Direction / Signataire',
  AUTORITE: 'Autorité',
  PARENT: 'Parent',
  HEBERGEUR: 'Hébergeur',
  ADMIN: 'Admin',
  RESEAU: 'Réseau',
};

const STATUT_SEJOUR_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  OPTION: 'Option',
  SUBMITTED: 'Soumis',
  CONVENTION: 'Convention',
  SOUMIS_RECTORAT: 'Soumis au rectorat',
  SIGNE_DIRECTION: 'Signé direction',
  DECLARE_TAM: 'Déclaré TAM',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Activité Tab ────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { emoji: string; label: string }> = {
  NOUVEAU_COMPTE: { emoji: '👤', label: 'Nouveau compte' },
  NOUVEAU_CENTRE: { emoji: '🏠', label: 'Nouveau centre' },
  NOUVEAU_SEJOUR: { emoji: '📋', label: 'Nouveau séjour' },
  NOUVELLE_DEMANDE: { emoji: '📨', label: 'Nouvelle demande' },
  NOUVEAU_DEVIS: { emoji: '📄', label: 'Nouveau devis' },
};

const SIGNAL_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  vert: { bg: '#DEF7EC', color: '#03543F', label: 'Actif' },
  jaune: { bg: '#FDF6B2', color: '#723B13', label: 'Ralenti' },
  rouge: { bg: '#FDE8E8', color: '#9B1C1C', label: 'Inactif' },
  gris: { bg: '#F3F4F6', color: '#6B7280', label: 'Aucune activité' },
};

function ActiviteTab() {
  const [data, setData] = useState<AdminActivite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminActivite()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <EmptyState text="Impossible de charger l'activité" />;

  return (
    <div className="space-y-8">
      {/* ── KPIs mois en cours ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Ce mois-ci</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Séjours créés" value={data.kpis.sejoursCreesMois} />
          <KpiCard label="Devis créés" value={data.kpis.devisCreesMois} />
          <KpiCard label="Centres actifs" value={data.kpis.centresActifs} />
          <KpiCard label="Avec ≥1 séjour" value={data.kpis.centresAvecSejour} />
          <KpiCard label="Taux activation" value={`${data.kpis.tauxActivation}%`} accent={data.kpis.tauxActivation >= 50 ? 'text-green-600' : 'text-amber-600'} />
        </div>
      </div>

      {/* ── Santé clients ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Santé clients</h3>
        {data.santeClients.length === 0 ? (
          <EmptyState text="Aucun centre actif" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière activité</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Séjours</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.santeClients.map((c) => {
                    const sig = SIGNAL_COLORS[c.signal] ?? SIGNAL_COLORS.gris;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', borderRadius: 20,
                            padding: '2px 10px', fontSize: 11, fontWeight: 600,
                            backgroundColor: sig.bg, color: sig.color,
                          }}>
                            {sig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">{c.nom}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="text-xs font-medium">{c.plan}</span>
                          {c.isTrial && <span className="ml-1 text-xs text-amber-600">(trial)</span>}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {c.expiration ? (
                            <span className={c.joursRestants !== null && c.joursRestants <= 14 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                              {formatDate(c.expiration, 'numeric')}
                              {c.joursRestants !== null && <span className="ml-1 text-xs">({c.joursRestants}j)</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {c.derniereActivite ? (
                            <>
                              {formatDate(c.derniereActivite, 'numeric')}
                              {c.joursDepuisActivite !== null && (
                                <span className="ml-1 text-xs text-gray-400">
                                  (il y a {c.joursDepuisActivite}j)
                                </span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium text-center">{c.nbSejours}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium text-center">{c.nbDevis}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Feed d'activité (7 derniers jours) ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Activité récente (7 jours)</h3>
        {data.feed.length === 0 ? (
          <EmptyState text="Aucune activité cette semaine" />
        ) : (
          <div className="space-y-2">
            {data.feed.map((event, i) => {
              const config = EVENT_CONFIG[event.type] ?? { emoji: '•', label: event.type };
              const d = event.data;
              let detail = '';
              switch (event.type) {
                case 'NOUVEAU_COMPTE':
                  detail = `${d.prenom} ${d.nom} (${d.role}) — ${d.email}`;
                  break;
                case 'NOUVEAU_CENTRE':
                  detail = `${d.nom}${d.ville ? ` — ${d.ville}` : ''}${d.proprietaire ? ` · ${d.proprietaire}` : ''}`;
                  break;
                case 'NOUVEAU_SEJOUR':
                  detail = `${d.titre}${d.centre ? ` → ${d.centre}` : ''}${d.places ? ` · ${d.places} places` : ''}${d.clientNom ? ` · Client: ${d.clientNom}` : ''}${d.clientEmail ? ` (${d.clientEmail})` : ''}${d.clientOrganisation ? ` — ${d.clientOrganisation}` : ''}`;
                  break;
                case 'NOUVELLE_DEMANDE':
                  detail = `${d.titre} — ${d.nbEleves} élèves${d.ville ? ` · ${d.ville}` : ''}${d.centre ? ` → ${d.centre}` : ' (appel ouvert)'}${d.dateDebut ? ` · ${formatDate(d.dateDebut, 'numeric')}` : ''}${d.dateFin ? `–${formatDate(d.dateFin, 'numeric')}` : ''} · ${d.nbDevisRecus} devis reçu${d.nbDevisRecus > 1 ? 's' : ''} · ${d.enseignant} (${d.enseignantEmail})`;
                  break;
                case 'NOUVEAU_DEVIS':
                  detail = `${d.numero ?? 'Sans numéro'} — ${d.montant?.toFixed(2) ?? '?'} € · ${d.statut}${d.centre ? ` · ${d.centre}` : ''}${d.sejour ? ` · ${d.sejour}` : ''}`;
                  break;
              }
              return (
                <div key={`${event.type}-${i}`} className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <span className="text-base shrink-0 mt-0.5">{config.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-700">{config.label}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(event.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        {' · '}
                        {new Date(event.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 break-words">{detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
                    className="bg-[var(--color-primary)] h-full rounded-full transition-all"
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
                    className="bg-[var(--color-success)] h-full rounded-full transition-all"
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
  const [erreur, setErreur] = useState<string | null>(null);

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
    } catch (err) {
      console.error('[handleValider]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      fetchData();
    }
    setActionId(null);
  };

  const handleRefuser = async () => {
    if (!showRefusModal) return;
    setActionId(showRefusModal);
    try {
      await refuserHebergeur(showRefusModal, motifRefus || undefined);
      setHebergeurs((prev) => prev.filter((h) => h.id !== showRefusModal));
    } catch (err) {
      console.error('[handleRefuser]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      fetchData();
    }
    setShowRefusModal(null);
    setMotifRefus('');
    setActionId(null);
  };

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="text-red-500 hover:text-red-700 shrink-0">×</button>
        </div>
      )}
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {([['EN_ATTENTE', 'En attente'], ['VALIDE', 'Validés'], ['ALL', 'Tous']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setSubTab(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${subTab === val ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
                        <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">Validé</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">En attente</span>
                      )}
                      {h.emailVerifie && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Email vérifié</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{h.email}</p>
                    {h.telephone && <p className="text-xs text-gray-400">{h.telephone}</p>}
                    <p className="text-xs text-gray-400 mt-1">Inscrit le {formatDate(h.createdAt, 'numeric')}</p>

                    {centre && (
                      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
                        <p className="text-sm font-medium text-gray-900">{centre.nom}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                          <span>{centre.ville} ({centre.codePostal})</span>
                          <span>Capacité : {centre.capacite}</span>
                          {centre.siret && <span>SIRET : {centre.siret}</span>}
                          {centre.departement && <span>{centre.departement}</span>}
                          {centre.agrementEducationNationale && (
                            <span className="text-[var(--color-success)] font-medium">Agréé EN : {centre.agrementEducationNationale}</span>
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-success)] transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
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
  const [erreur, setErreur] = useState<string | null>(null);

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
    } catch (err) {
      console.error('[handleToggleValide]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="text-red-500 hover:text-red-700 shrink-0">×</button>
        </div>
      )}
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
                          <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" title="Compte validé" />
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
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(u.createdAt, 'numeric')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleValide(u)}
                        className={`text-xs font-medium px-2 py-1 rounded transition ${u.compteValide ? 'text-amber-700 hover:bg-amber-50' : 'text-[var(--color-success)] hover:bg-[var(--color-success-light)]'}`}
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
  const [centres, setCentres] = useState<(Centre & { reseau?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customReseau, setCustomReseau] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCentres(search || undefined);
      setCentres(data as (Centre & { reseau?: string | null })[]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  const handleReseauChange = async (centreId: string, value: string) => {
    if (value === '__custom__') {
      setCustomReseau(prev => ({ ...prev, [centreId]: '' }));
      return;
    }
    const reseau = value === '' ? null : value;
    try {
      await updateCentreReseau(centreId, reseau);
      setCentres(prev => prev.map(c => c.id === centreId ? { ...c, reseau } : c));
    } catch (err) {
      console.error('[handleReseauChange]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      fetchData();
    }
  };

  const handleCustomReseauSubmit = async (centreId: string) => {
    const value = customReseau[centreId]?.trim();
    if (!value) return;
    try {
      await updateCentreReseau(centreId, value);
      setCentres(prev => prev.map(c => c.id === centreId ? { ...c, reseau: value } : c));
      setCustomReseau(prev => { const n = { ...prev }; delete n[centreId]; return n; });
    } catch (err) {
      console.error('[handleCustomReseauSubmit]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="text-red-500 hover:text-red-700 shrink-0">×</button>
        </div>
      )}
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
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.statut === 'ACTIVE' ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-amber-100 text-amber-700'}`}>
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
                  <p className="text-xs text-gray-400">Créé le {formatDate(c.createdAt, 'numeric')}</p>
                </div>
                <div className="shrink-0">
                  <label className="text-xs text-gray-500 block mb-1">Réseau</label>
                  {customReseau[c.id] !== undefined ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={customReseau[c.id]}
                        onChange={(e) => setCustomReseau(prev => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleCustomReseauSubmit(c.id)}
                        placeholder="Nom du réseau..."
                        className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003189]"
                        autoFocus
                      />
                      <button
                        onClick={() => handleCustomReseauSubmit(c.id)}
                        className="px-2 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setCustomReseau(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                        className="px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <select
                      value={c.reseau ?? ''}
                      onChange={(e) => handleReseauChange(c.id, e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#003189]"
                    >
                      <option value="">Aucun</option>
                      {RESEAUX_CONNUS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      {c.reseau && !RESEAUX_CONNUS.includes(c.reseau) && (
                        <option value={c.reseau}>{c.reseau}</option>
                      )}
                      <option value="__custom__">Autre...</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Réseaux Tab ─────────────────────────────────────────────────────────────

function ReseauxTab() {
  const [centres, setCentres] = useState<(Centre & { reseau?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReseau, setSelectedReseau] = useState<string | null>(null);
  const [reseauStats, setReseauStats] = useState<ReseauStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    getCentres()
      .then(data => setCentres(data as (Centre & { reseau?: string | null })[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const reseaux = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const c of centres) {
      if (c.reseau) {
        grouped[c.reseau] = (grouped[c.reseau] ?? 0) + 1;
      }
    }
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [centres]);

  const handleViewStats = async (reseau: string) => {
    setSelectedReseau(reseau);
    setLoadingStats(true);
    try {
      const stats = await getReseauStats(reseau);
      setReseauStats(stats);
    } catch { /* ignore */ }
    setLoadingStats(false);
  };

  if (loading) return <LoadingSpinner />;

  if (reseaux.length === 0) {
    return <EmptyState text="Aucun réseau partenaire configuré" />;
  }

  return (
    <div className="space-y-6">
      {/* Liste des réseaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reseaux.map(([reseau, count]) => (
          <div
            key={reseau}
            className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer transition ${selectedReseau === reseau ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-gray-200 hover:border-gray-300'}`}
            onClick={() => handleViewStats(reseau)}
          >
            <h3 className="font-semibold text-gray-900 mb-1">{reseau}</h3>
            <p className="text-sm text-gray-500">{count} centre{count > 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Stats détaillées */}
      {selectedReseau && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Stats — {selectedReseau}</h3>
          {loadingStats ? <LoadingSpinner /> : reseauStats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Centres" value={reseauStats.kpis.totalCentres} />
                <KpiCard label="Actifs" value={reseauStats.kpis.centresActifs} accent="text-[var(--color-success)]" />
                <KpiCard label="Devis envoyés" value={reseauStats.kpis.devisEnvoyes} />
                <KpiCard label="CA total" value={reseauStats.kpis.caTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} accent="text-[var(--color-primary)]" />
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centre</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devis</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retenus</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA réseau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reseauStats.centres.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{c.nom}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.ville}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.demandesRecues}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.devisEnvoyes}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.devisSelectionnes}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.caViaReseau.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

const PRIX_DEVIS_LIAVO: Record<string, Record<string, number>> = {
  MENSUEL: { ESSENTIEL: 29, COMPLET: 49, PILOTAGE: 69 },
  ANNUEL: { ESSENTIEL: 290, COMPLET: 490, PILOTAGE: 690 },
};

function DevisLiavoForm({ onFactureEmise }: { onFactureEmise: () => void }) {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centreId, setCentreId] = useState('');
  const [plan, setPlan] = useState('COMPLET');
  const [frequence, setFrequence] = useState('MENSUEL');
  const [destNom, setDestNom] = useState('');
  const [destAdresse, setDestAdresse] = useState('');
  const [destSiret, setDestSiret] = useState('');
  const [destEmail, setDestEmail] = useState('');

  const [devisLoading, setDevisLoading] = useState(false);
  const [devisError, setDevisError] = useState<string | null>(null);
  const [devisResult, setDevisResult] = useState<{ numero: string; pdfUrl: string } | null>(null);

  const [factureLoading, setFactureLoading] = useState(false);
  const [factureError, setFactureError] = useState<string | null>(null);
  const [factureMessage, setFactureMessage] = useState<string | null>(null);

  useEffect(() => {
    getCentres()
      .then((data) => setCentres(data.filter((c) => c.user).sort((a, b) => a.nom.localeCompare(b.nom))))
      .catch(() => {});
  }, []);

  // Pré-remplir les champs destinataire à la sélection d'un centre (modifiables ensuite)
  function handleCentreChange(id: string) {
    setCentreId(id);
    const c = centres.find((x) => x.id === id);
    if (c) {
      setDestNom(c.nom);
      setDestAdresse([c.adresse, c.codePostal, c.ville].filter(Boolean).join(', '));
      setDestSiret(c.siret ?? '');
      setDestEmail(c.user?.email ?? '');
    }
  }

  const montant = PRIX_DEVIS_LIAVO[frequence]?.[plan] ?? 0;

  async function handleDevis() {
    setDevisLoading(true);
    setDevisError(null);
    setDevisResult(null);
    try {
      const result = await genererDevisLiavo({
        centreId,
        plan,
        frequence,
        destinataireNom: destNom,
        destinataireAdresse: destAdresse || undefined,
        destinataireSiret: destSiret || undefined,
        destinataireEmail: destEmail || undefined,
      });
      setDevisResult(result);
    } catch (e: any) {
      setDevisError(e?.response?.data?.message ?? 'Erreur lors de la génération du devis');
    } finally {
      setDevisLoading(false);
    }
  }

  async function handleFacture() {
    setFactureLoading(true);
    setFactureError(null);
    setFactureMessage(null);
    try {
      await facturerCentre({
        centreId,
        plan,
        frequence,
        destinataireNom: destNom || undefined,
        destinataireAdresse: destAdresse || undefined,
        destinataireSiret: destSiret || undefined,
        destinataireEmail: destEmail || undefined,
      });
      setFactureMessage('Facture émise et envoyée par email.');
      onFactureEmise();
    } catch (e: any) {
      setFactureError(e?.response?.data?.message ?? "Erreur lors de l'émission de la facture");
    } finally {
      setFactureLoading(false);
    }
  }

  const inputCls = 'border border-gray-300 rounded-lg text-sm px-3 py-2 w-full';
  const labelCls = 'text-xs font-medium text-gray-500 uppercase';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Générer un devis / une facture LIAVO</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className={labelCls}>Centre</label>
          <select className={inputCls} value={centreId} onChange={(e) => handleCentreChange(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelCls}>Plan</label>
          <select className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="ESSENTIEL">ESSENTIEL</option>
            <option value="COMPLET">COMPLET</option>
            <option value="PILOTAGE">PILOTAGE</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelCls}>Fréquence</label>
          <div className="flex items-center gap-2">
            <select className={inputCls} value={frequence} onChange={(e) => setFrequence(e.target.value)}>
              <option value="MENSUEL">MENSUEL</option>
              <option value="ANNUEL">ANNUEL</option>
            </select>
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{montant} € HT</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className={labelCls}>Destinataire</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Nom</label>
            <input className={inputCls} value={destNom} onChange={(e) => setDestNom(e.target.value)} placeholder="Ex : Ville de Neuilly-Plaisance" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Adresse</label>
            <input className={inputCls} value={destAdresse} onChange={(e) => setDestAdresse(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">SIRET</label>
            <input className={inputCls} value={destSiret} onChange={(e) => setDestSiret(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Email</label>
            <input className={inputCls} value={destEmail} onChange={(e) => setDestEmail(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={handleDevis}
          disabled={devisLoading || !centreId || !destNom}
          className="bg-[#1B4060] text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {devisLoading ? 'Génération…' : 'Générer le devis (PDF)'}
        </button>
        <button
          onClick={handleFacture}
          disabled={factureLoading || !centreId}
          className="bg-[#C87D2E] text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {factureLoading ? 'Émission…' : 'Émettre la facture'}
        </button>
      </div>

      {devisError && <p className="text-sm text-red-600">{devisError}</p>}
      {devisResult && (
        <p className="text-sm text-gray-700">
          Devis généré :{' '}
          <SecureFileLink url={devisResult.pdfUrl} className="text-[var(--color-primary)] hover:underline font-medium">
            Télécharger {devisResult.numero} (PDF)
          </SecureFileLink>
        </p>
      )}
      {factureError && <p className="text-sm text-red-600">{factureError}</p>}
      {factureMessage && <p className="text-sm text-green-700">{factureMessage}</p>}
    </div>
  );
}

function FacturesLiavoTab() {
  const [factures, setFactures] = useState<FactureLiavo[]>([]);
  const [loading, setLoading] = useState(true);

  const chargerFactures = useCallback(() => {
    getAdminFacturesLiavo()
      .then(setFactures)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    chargerFactures();
  }, [chargerFactures]);

  const PLAN_BADGE: Record<string, { bg: string; color: string }> = {
    DECOUVERTE: { bg: '#F0EFEB', color: '#888780' },
    ESSENTIEL: { bg: '#E6EEF4', color: '#1B4060' },
    COMPLET: { bg: '#1B4060', color: '#FFFFFF' },
    PILOTAGE: { bg: '#C87D2E', color: '#FFFFFF' },
  };

  const totalHT = factures.reduce((sum, f) => sum + f.montantHT, 0) / 100;

  return (
    <div className="space-y-4">
      <DevisLiavoForm onFactureEmise={chargerFactures} />
      {loading ? <LoadingSpinner /> : factures.length === 0 ? (
        <EmptyState text="Aucune facture LIAVO" />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fréquence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant HT</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {factures.map((f) => {
                    const badge = PLAN_BADGE[f.planAbonnement] ?? PLAN_BADGE.DECOUVERTE;
                    return (
                      <tr key={f.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 whitespace-nowrap" style={{ fontFamily: 'monospace', fontSize: 13, color: '#111827' }}>{f.numero}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{f.centre.nom}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', borderRadius: 20,
                            padding: '2px 10px', fontSize: 11, fontWeight: 600,
                            backgroundColor: badge.bg, color: badge.color,
                          }}>
                            {f.planAbonnement}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{f.typeAbonnement === 'ANNUEL' ? 'Annuel' : 'Mensuel'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{(f.montantHT / 100).toFixed(2)} €</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(f.dateEmission, 'numeric')}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {f.pdfUrl ? (
                            <SecureFileLink url={f.pdfUrl} className="text-[var(--color-primary)] hover:underline">Télécharger</SecureFileLink>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-gray-700 font-medium">
            Total : {totalHT.toFixed(2)} € HT — {factures.length} facture{factures.length > 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

function AbonnementsTab() {
  const [abonnements, setAbonnements] = useState<CentreAbonnement[]>([]);
  const [metriques, setMetriques] = useState<MetriquesAbonnements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminAbonnements()
      .then(setAbonnements)
      .catch(() => {})
      .finally(() => setLoading(false));
    getAdminMetriquesAbonnements().then(setMetriques).catch(() => {});
  }, []);

  const PLAN_BADGE: Record<string, { bg: string; color: string }> = {
    DECOUVERTE: { bg: '#F0EFEB', color: '#888780' },
    ESSENTIEL: { bg: '#E6EEF4', color: '#1B4060' },
    COMPLET: { bg: '#1B4060', color: '#FFFFFF' },
    PILOTAGE: { bg: '#C87D2E', color: '#FFFFFF' },
  };

  const frequenceLabel = (f: string | null) =>
    f === 'MENSUEL' ? 'Mensuel' : f === 'ANNUEL' ? 'Annuel' : '—';

  const statutBadgeClass = (s: string) =>
    s === 'ACTIF' ? 'bg-green-100 text-green-700'
    : s === 'SUSPENDU' ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4">
      {metriques && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Centres actifs" value={metriques.totalCentres} />
          <KpiCard label="Trials actifs" value={metriques.trialActifs} accent="text-[#C87D2E]" />
          <KpiCard label="Trials expirés" value={metriques.trialExpires} accent="text-[#9C2B2B]" />
          <KpiCard label="Abonnements payés" value={metriques.aboPayes} accent="text-[#1E5C42]" />
          <KpiCard label="MRR" value={`${metriques.mrr.toFixed(2)} €/mois`} accent="text-[#1B4060]" />
        </div>
      )}

      <p className="text-xs text-gray-500">{abonnements.length} centre{abonnements.length > 1 ? 's' : ''}</p>

      {loading ? <LoadingSpinner /> : abonnements.length === 0 ? (
        <EmptyState text="Aucun centre" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsable</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fréquence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actif jusqu&apos;au</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mandat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {abonnements.map((a) => {
                  const badge = PLAN_BADGE[a.planAbonnement] ?? PLAN_BADGE.DECOUVERTE;
                  const expiré = !!a.abonnementActifJusquAu && new Date(a.abonnementActifJusquAu) < new Date();
                  // Mandat Mollie = source de vérité prioritaire ; sinon le flag admin VIREMENT.
                  const modePaiementLabel = a.mollieMandatId ? 'Mollie' : (a.modePaiement === 'VIREMENT' ? 'Virement' : '—');
                  const modePaiementClass = modePaiementLabel === 'Mollie'
                    ? 'bg-blue-50 text-blue-700'
                    : modePaiementLabel === 'Virement'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-gray-100 text-gray-500';
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">{a.nom}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {a.user ? (
                          <div>
                            <div className="text-sm text-gray-900">{a.user.prenom} {a.user.nom}</div>
                            <div className="text-xs text-gray-400">{a.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', borderRadius: 20,
                          padding: '2px 10px', fontSize: 11, fontWeight: 600,
                          backgroundColor: badge.bg, color: badge.color,
                        }}>
                          {a.planAbonnement}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{frequenceLabel(a.abonnement)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${modePaiementClass}`}>
                          {modePaiementLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(a.abonnementStatut)}`}>
                          {a.abonnementStatut}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm whitespace-nowrap ${expiré ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {a.abonnementActifJusquAu ? formatDate(a.abonnementActifJusquAu, 'numeric') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {a.trialStartedAt ? `Oui · ${formatDate(a.trialStartedAt, 'numeric')}` : 'Non'}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {a.mollieMandatId ? '✅' : '❌'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border-strong)] border-t-transparent" />
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
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('activite');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [dossiersAValider, setDossiersAValider] = useState(0);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      getAdminStats().then(setStats).catch(() => {});
      getDossiersAValiderCount().then(setDossiersAValider).catch(() => {});
    }
  }, [user]);

  if (isLoading || !user) return null;

  return (
    <div>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard administrateur</h1>
        <p className="text-sm text-gray-500 mb-4">Gestion de la plateforme Liavo</p>

        {/* Validation des dossiers hébergeurs : un seul écran (la page claims),
            un seul workflow — les onglets permissifs ont été supprimés. */}
        <Link
          href="/dashboard/admin/claims"
          className="inline-flex items-center gap-2 rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-3 mb-6 text-sm font-medium text-gray-900 hover:bg-gray-50 transition"
        >
          {dossiersAValider > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {dossiersAValider}
            </span>
          )}
          {dossiersAValider > 0
            ? `${dossiersAValider} dossier${dossiersAValider > 1 ? 's' : ''} à valider →`
            : 'Dossiers à valider →'}
        </Link>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                tab === t.value
                  ? 'border-[var(--color-border-strong)] text-[var(--color-primary)]'
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
          {/* Lien de navigation externe au système d'onglets (page dédiée). */}
          <Link
            href="/dashboard/admin/invitations"
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            Invitations
          </Link>
        </div>

        {/* Tab content */}
        {tab === 'activite' && <ActiviteTab />}
        {tab === 'stats' && <StatsTab stats={stats} />}
        {tab === 'hebergeurs' && <HebergeursTab />}
        {tab === 'utilisateurs' && <UtilisateursTab />}
        {tab === 'centres' && <CentresTab />}
        {tab === 'abonnements' && <AbonnementsTab />}
        {tab === 'factures-liavo' && <FacturesLiavoTab />}
        {tab === 'reseaux' && <ReseauxTab />}
      </main>
    </div>
  );
}
