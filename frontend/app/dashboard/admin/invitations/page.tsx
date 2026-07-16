'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { formatDate } from '@/src/lib/utils';

interface Invitation {
  id: string;
  email: string;
  nomCentre: string;
  token: string;
  utilisedAt: string | null;
  emailEnvoye: boolean;
  emailEnvoyeAt: string | null;
  createdAt: string;
  centreExistantId: string | null;
  centrePrecreerNom: string | null;
  centrePrecreerVille: string | null;
  centrePrecreerCapacite: number | null;
  centreExistant: { id: string; nom: string; ville: string } | null;
}

interface CentreResult {
  id: string;
  nom: string;
  ville: string;
  codePostal: string;
  departement: string | null;
  _source?: 'BASE' | 'API_EN';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AdminInvitationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [email, setEmail] = useState('');
  const [nomCentre, setNomCentre] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [capacite, setCapacite] = useState('');
  const [siret, setSiret] = useState('');
  const [departement, setDepartement] = useState('');
  const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);
  const [selectedCentreLabel, setSelectedCentreLabel] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Centre search (public)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CentreResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) router.replace('/login');
  }, [isLoading, user, router]);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Invitation[]>('/admin/invitations');
      setInvitations(data);
    } catch {
      setError('Impossible de charger les invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN') loadInvitations();
  }, [user, loadInvitations]);

  // Debounced centre search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.length < 2 || selectedCentreId) {
      setSearchResults([]);
      return;
    }
    // Collage d'un UUID → résolution directe du centre par id (pas de search-by-name).
    const trimmed = searchQuery.trim();
    if (UUID_RE.test(trimmed)) {
      setSearching(true);
      api.get<{ id: string; nom: string; ville: string } | null>(`/public/centres/${trimmed}`)
        .then(({ data }) => {
          if (data && UUID_RE.test(data.id)) {
            setSelectedCentreId(data.id);
            setSelectedCentreLabel(`${data.nom} — ${data.ville}`);
            setNomCentre(data.nom);
            setSearchQuery('');
            setSearchResults([]);
          } else {
            setSearchResults([]);
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<CentreResult[]>(`/centres/search-public?search=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.filter((r) => UUID_RE.test(r.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, selectedCentreId]);

  const handleSelectCentre = (centre: CentreResult) => {
    if (!UUID_RE.test(centre.id)) return;
    setSelectedCentreId(centre.id);
    setSelectedCentreLabel(`${centre.nom} — ${centre.ville}`);
    setNomCentre(centre.nom);
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearSelectedCentre = () => {
    setSelectedCentreId(null);
    setSelectedCentreLabel('');
  };

  const resetForm = () => {
    setEmail('');
    setNomCentre('');
    setAdresse('');
    setVille('');
    setCodePostal('');
    setCapacite('');
    setSiret('');
    setDepartement('');
    setSelectedCentreId(null);
    setSelectedCentreLabel('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    if (!email || !nomCentre) {
      setError('Email et nom du centre sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email,
        nomCentre,
        centreExistantId: selectedCentreId ?? undefined,
      };
      if (!selectedCentreId) {
        payload.centrePrecreerNom = nomCentre;
        payload.centrePrecreerAdresse = adresse || undefined;
        payload.centrePrecreerVille = ville || undefined;
        payload.centrePrecreerCodePostal = codePostal || undefined;
        payload.centrePrecreerCapacite = capacite ? parseInt(capacite, 10) : undefined;
        payload.centrePrecreerSiret = siret || undefined;
        payload.centrePrecreerDepartement = departement || undefined;
      }
      await api.post('/admin/invitations', payload);
      setSuccess('Invitation envoyée');
      resetForm();
      await loadInvitations();
    } catch {
      setError('Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenvoyer = async (id: string) => {
    setActionId(id);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/admin/invitations/${id}/renvoyer`);
      setSuccess('Invitation renvoyée');
      await loadInvitations();
    } catch {
      setError('Erreur lors du renvoi');
    } finally {
      setActionId(null);
    }
  };

  if (isLoading || !user) return null;

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

  const typeLabel = (inv: Invitation): string => {
    if (inv.centreExistantId) return 'Centre existant';
    if (inv.centrePrecreerNom) return 'Pré-rempli';
    return 'Manuelle';
  };

  const statutBadge = (inv: Invitation) => {
    if (inv.utilisedAt) {
      return <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">Utilisée</span>;
    }
    if (inv.emailEnvoye) {
      return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Email envoyé</span>;
    }
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">En attente</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin</Link>
          <span className="text-gray-300">/</span>
          <p className="text-sm font-semibold text-gray-900">Invitations hébergeurs</p>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Invitations hébergeurs</h1>
          <p className="mt-1 text-sm text-gray-500">Envoyez une invitation à un hébergeur pour rejoindre LIAVO.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/30 text-sm text-[var(--color-success)]">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Liste ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Toutes les invitations</h2>
                <span className="text-xs text-gray-500">{invitations.length}</span>
              </div>
              {loading ? (
                <p className="px-5 py-6 text-sm text-gray-500">Chargement…</p>
              ) : invitations.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500">Aucune invitation envoyée pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Email</th>
                        <th className="px-4 py-2 text-left font-medium">Centre</th>
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-left font-medium">Statut</th>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invitations.map((inv) => {
                        const centreLabel = inv.centreExistant
                          ? `${inv.centreExistant.nom} (${inv.centreExistant.ville})`
                          : inv.centrePrecreerNom
                          ? `${inv.centrePrecreerNom}${inv.centrePrecreerVille ? ` (${inv.centrePrecreerVille})` : ''}`
                          : inv.nomCentre;
                        return (
                          <tr key={inv.id} className="text-gray-700">
                            <td className="px-4 py-3">{inv.email}</td>
                            <td className="px-4 py-3">{centreLabel}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{typeLabel(inv)}</td>
                            <td className="px-4 py-3">{statutBadge(inv)}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.createdAt, 'court', '—')}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRenvoyer(inv.id)}
                                disabled={!!inv.utilisedAt || actionId === inv.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {actionId === inv.id ? '…' : 'Renvoyer'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Formulaire création ── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Nouvelle invitation</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="hebergeur@exemple.fr" className={inputCls} />
                </div>

                {/* Recherche centre existant */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Centre déjà en base <span className="text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  {selectedCentreId ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-primary-light)] px-3 py-2">
                      <span className="text-xs text-[var(--color-primary)] font-medium truncate">{selectedCentreLabel}</span>
                      <button type="button" onClick={clearSelectedCentre} className="text-xs text-red-500 hover:underline shrink-0">Retirer</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un centre par nom ou ville…"
                        className={inputCls}
                      />
                      {searching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                      )}
                      {searchResults.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {searchResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCentre(c)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              <p className="font-medium text-gray-900 truncate">{c.nom}</p>
                              <p className="text-gray-500 truncate">{c.ville} {c.codePostal && `— ${c.codePostal}`}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom du centre *</label>
                  <input type="text" value={nomCentre} onChange={(e) => setNomCentre(e.target.value)}
                    readOnly={!!selectedCentreId}
                    placeholder="Centre des Pins"
                    className={`${inputCls} ${selectedCentreId ? 'bg-gray-50 cursor-not-allowed' : ''}`} />
                </div>

                {/* Champs pré-création — masqués si centre existant sélectionné */}
                {!selectedCentreId && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                      <input type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)}
                        placeholder="12 rue des Montagnes" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Code postal</label>
                        <input type="text" value={codePostal} onChange={(e) => setCodePostal(e.target.value)}
                          placeholder="73000" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                        <input type="text" value={ville} onChange={(e) => setVille(e.target.value)}
                          placeholder="Chamonix" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Capacité</label>
                        <input type="number" min="0" value={capacite} onChange={(e) => setCapacite(e.target.value)}
                          placeholder="60" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Département</label>
                        <input type="text" value={departement} onChange={(e) => setDepartement(e.target.value)}
                          placeholder="73" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">SIRET</label>
                      <input type="text" value={siret} onChange={(e) => setSiret(e.target.value)}
                        placeholder="12345678900012" maxLength={14} className={inputCls} />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi…</>
                  ) : (
                    'Envoyer l\'invitation'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
