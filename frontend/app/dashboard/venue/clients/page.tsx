'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getMesClients, createClient, updateClient, deleteClient,
  addContact, deleteContact,
  addRappel, updateRappelStatut, deleteRappel,
  importerProspects, downloadTemplateClients, importerClientsCSV,
  STATUT_CLIENT_LABELS, TYPE_CLIENT_LABELS, RAPPEL_TYPE_LABELS, ACADEMIES,
} from '@/src/lib/clients';
import type { Client, ContactClient, Rappel } from '@/src/lib/clients';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export default function ClientsPage() {
  const { user, isLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('ALL');

  // Modales
  const [showNewClient, setShowNewClient] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newForm, setNewForm] = useState({ nom: '', type: 'ETABLISSEMENT_SCOLAIRE', statut: 'PROSPECT', ville: '', telephone: '', email: '', uai: '', notes: '' });
  const [importAcademie, setImportAcademie] = useState('');
  const [importTypes, setImportTypes] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Édition
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ prenom: '', nom: '', email: '', telephone: '', role: '' });

  // Rappel form
  const [showRappelForm, setShowRappelForm] = useState(false);
  const [rappelForm, setRappelForm] = useState({ type: 'TELEPHONE', dateEcheance: '', description: '' });

  const [saving, setSaving] = useState(false);

  // CSV import
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>>>([]);
  const [csvImporting, setCSVImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role === 'VENUE') {
      getMesClients().then(setClients).finally(() => setLoading(false));
    }
  }, [isLoading, user]);

  const selected = useMemo(() => clients.find(c => c.id === selectedId) ?? null, [clients, selectedId]);

  const filtered = useMemo(() => {
    let list = clients;
    if (filtreStatut !== 'ALL') list = list.filter(c => c.statut === filtreStatut);
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.nom.toLowerCase().includes(q) || (c.ville ?? '').toLowerCase().includes(q) || (c.uai ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [clients, filtreStatut, searchQuery]);

  const statutCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => { counts[c.statut] = (counts[c.statut] ?? 0) + 1; });
    return counts;
  }, [clients]);

  const today = new Date().toISOString().split('T')[0];

  const reload = async () => {
    const data = await getMesClients();
    setClients(data);
  };

  const handleCreateClient = async () => {
    if (!newForm.nom) return;
    setSaving(true);
    try {
      const created = await createClient(newForm);
      setClients(prev => [...prev, created]);
      setShowNewClient(false);
      setSelectedId(created.id);
      setNewForm({ nom: '', type: 'ETABLISSEMENT_SCOLAIRE', statut: 'PROSPECT', ville: '', telephone: '', email: '', uai: '', notes: '' });
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateClient(selectedId, editForm);
      await reload();
      setEditMode(false);
    } finally { setSaving(false); }
  };

  const handleDeleteClient = async () => {
    if (!selectedId || !confirm('Supprimer ce client ?')) return;
    await deleteClient(selectedId);
    setSelectedId(null);
    await reload();
  };

  const handleAddContact = async () => {
    if (!selectedId || !contactForm.prenom || !contactForm.nom) return;
    await addContact(selectedId, contactForm);
    await reload();
    setShowContactForm(false);
    setContactForm({ prenom: '', nom: '', email: '', telephone: '', role: '' });
  };

  const handleAddRappel = async () => {
    if (!selectedId || !rappelForm.dateEcheance || !rappelForm.description) return;
    await addRappel(selectedId, rappelForm);
    await reload();
    setShowRappelForm(false);
    setRappelForm({ type: 'TELEPHONE', dateEcheance: '', description: '' });
  };

  const handleImport = async () => {
    if (!importAcademie) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importerProspects(importAcademie, importTypes);
      setImportResult(result);
      await reload();
    } finally { setImporting(false); }
  };

  const handleCSVFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() && !l.startsWith('---'));
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
        return obj;
      }).filter(r => r['Nom']?.trim());
      setCsvPreview(rows);
      setShowImportCSV(true);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleConfirmCSVImport = async () => {
    setCSVImporting(true);
    try {
      const result = await importerClientsCSV(csvPreview);
      setCsvResult({ imported: result.imported, skipped: result.skipped });
      setCsvPreview([]);
      await getMesClients().then(setClients);
    } catch { /* ignore */ }
    setCSVImporting(false);
  };

  if (isLoading || !user) return null;

  const clientCount = clients.filter(c => c.statut === 'CLIENT').length;
  const prospectCount = clients.filter(c => c.statut === 'PROSPECT').length;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/venue" className="text-sm text-[var(--color-primary)] hover:underline">&larr; Tableau de bord</Link>
          <h1 className="text-base font-semibold text-gray-900">Clients & Prospects</h1>
          <span className="text-xs text-gray-500">{clientCount} clients, {prospectCount} prospects</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplateClients} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Modèle CSV
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Importer CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVFileUpload} />
          </label>
          <button onClick={() => setShowImport(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Importer prospects EN
          </button>
          <button onClick={() => setShowNewClient(true)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            + Nouveau client
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher (nom, ville, UAI)..." className={`flex-1 ${inputCls}`} />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setFiltreStatut('ALL')} className={`rounded-full px-3 py-1 text-xs font-medium ${filtreStatut === 'ALL' ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            Tous ({clients.length})
          </button>
          {Object.entries(STATUT_CLIENT_LABELS).map(([key, { label }]) => (
            <button key={key} onClick={() => setFiltreStatut(key)} className={`rounded-full px-3 py-1 text-xs font-medium ${filtreStatut === key ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {label} ({statutCounts[key] ?? 0})
            </button>
          ))}
        </div>

        {/* Layout liste + détail */}
        <div className="flex gap-6">
          {/* Liste gauche */}
          <div className="w-1/3 space-y-2 max-h-[75vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Aucun client.</p>
            ) : filtered.map(c => {
              const st = STATUT_CLIENT_LABELS[c.statut] ?? STATUT_CLIENT_LABELS.PROSPECT;
              const overdueRappels = c.rappels.filter(r => r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] < today).length;
              return (
                <div key={c.id} onClick={() => { setSelectedId(c.id); setEditMode(false); }} className={`rounded-xl border px-4 py-3 cursor-pointer transition-all ${selectedId === c.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.nom}</p>
                    <div className="flex items-center gap-1.5">
                      {overdueRappels > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {c.ville ?? ''}{c.uai ? ` · ${c.uai}` : ''}{c.sejours.length > 0 ? ` · ${c.sejours.length} séjour${c.sejours.length > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Détail droite */}
          <div className="flex-1">
            {!selected ? (
              <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-400">Sélectionnez un client pour voir le détail</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Section 1 — Infos */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900">{selected.nom}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{selected.source}</span>
                      {!editMode ? (
                        <button onClick={() => { setEditMode(true); setEditForm({ nom: selected.nom, type: selected.type, statut: selected.statut, ville: selected.ville ?? '', telephone: selected.telephone ?? '', email: selected.email ?? '', uai: selected.uai ?? '', notes: selected.notes ?? '' }); }} className="text-xs text-[var(--color-primary)] hover:underline">Modifier</button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={handleSaveEdit} disabled={saving} className="text-xs bg-[var(--color-primary)] text-white px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-50">Enregistrer</button>
                          <button onClick={() => setEditMode(false)} className="text-xs text-gray-500 hover:underline">Annuler</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {editMode ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-gray-500 mb-1">Nom *</label><input value={editForm.nom ?? ''} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} className={inputCls} /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Statut</label><select value={editForm.statut ?? ''} onChange={e => setEditForm(f => ({ ...f, statut: e.target.value }))} className={inputCls}>{Object.entries(STATUT_CLIENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Type</label><select value={editForm.type ?? ''} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>{Object.entries(TYPE_CLIENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Ville</label><input value={editForm.ville ?? ''} onChange={e => setEditForm(f => ({ ...f, ville: e.target.value }))} className={inputCls} /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Téléphone</label><input value={editForm.telephone ?? ''} onChange={e => setEditForm(f => ({ ...f, telephone: e.target.value }))} className={inputCls} /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Email</label><input value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">UAI</label><input value={editForm.uai ?? ''} onChange={e => setEditForm(f => ({ ...f, uai: e.target.value }))} className={inputCls} /></div>
                      <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-gray-400">Type</p><p className="font-medium">{TYPE_CLIENT_LABELS[selected.type] ?? selected.type}</p></div>
                      <div><p className="text-xs text-gray-400">Statut</p><p><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(STATUT_CLIENT_LABELS[selected.statut] ?? STATUT_CLIENT_LABELS.PROSPECT).cls}`}>{(STATUT_CLIENT_LABELS[selected.statut] ?? STATUT_CLIENT_LABELS.PROSPECT).label}</span></p></div>
                      {selected.ville && <div><p className="text-xs text-gray-400">Ville</p><p className="font-medium">{selected.ville}</p></div>}
                      {selected.telephone && <div><p className="text-xs text-gray-400">Téléphone</p><p className="font-medium">{selected.telephone}</p></div>}
                      {selected.email && <div><p className="text-xs text-gray-400">Email</p><p className="font-medium">{selected.email}</p></div>}
                      {selected.uai && <div><p className="text-xs text-gray-400">UAI</p><p className="font-medium">{selected.uai}</p></div>}
                      {selected.academie && <div><p className="text-xs text-gray-400">Académie</p><p className="font-medium">{selected.academie}</p></div>}
                      {selected.notes && <div className="col-span-2"><p className="text-xs text-gray-400">Notes</p><p className="text-gray-600">{selected.notes}</p></div>}
                    </div>
                  )}
                  <button onClick={handleDeleteClient} className="mt-3 text-xs text-red-500 hover:underline">Supprimer ce client</button>
                </div>

                {/* Section 2 — Contacts */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Contacts ({selected.contacts.length})</h3>
                    <button onClick={() => setShowContactForm(!showContactForm)} className="text-xs text-[var(--color-primary)] hover:underline">{showContactForm ? 'Annuler' : '+ Ajouter'}</button>
                  </div>
                  {showContactForm && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input placeholder="Prénom *" value={contactForm.prenom} onChange={e => setContactForm(f => ({ ...f, prenom: e.target.value }))} className={inputCls} />
                      <input placeholder="Nom *" value={contactForm.nom} onChange={e => setContactForm(f => ({ ...f, nom: e.target.value }))} className={inputCls} />
                      <input placeholder="Email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                      <input placeholder="Téléphone" value={contactForm.telephone} onChange={e => setContactForm(f => ({ ...f, telephone: e.target.value }))} className={inputCls} />
                      <input placeholder="Rôle (ex: Directeur)" value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))} className={inputCls} />
                      <button onClick={handleAddContact} className="rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold py-2 hover:opacity-90">Ajouter</button>
                    </div>
                  )}
                  {selected.contacts.length === 0 ? <p className="text-xs text-gray-400">Aucun contact.</p> : (
                    <div className="space-y-2">
                      {selected.contacts.map(c => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}{c.role ? ` — ${c.role}` : ''}</p>
                            <p className="text-xs text-gray-500">{c.email ?? ''}{c.telephone ? ` · ${c.telephone}` : ''}</p>
                          </div>
                          <button onClick={async () => { await deleteContact(c.id); await reload(); }} className="text-xs text-red-400 hover:text-red-600">&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3 — Rappels */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">Rappels ({selected.rappels.length})</h3>
                      {selected.rappels.filter(r => r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] < today).length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          {selected.rappels.filter(r => r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] < today).length} en retard
                        </span>
                      )}
                    </div>
                    <button onClick={() => setShowRappelForm(!showRappelForm)} className="text-xs text-[var(--color-primary)] hover:underline">{showRappelForm ? 'Annuler' : '+ Ajouter'}</button>
                  </div>
                  {showRappelForm && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <select value={rappelForm.type} onChange={e => setRappelForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                        {Object.entries(RAPPEL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input type="date" value={rappelForm.dateEcheance} onChange={e => setRappelForm(f => ({ ...f, dateEcheance: e.target.value }))} className={inputCls} />
                      <input placeholder="Description *" value={rappelForm.description} onChange={e => setRappelForm(f => ({ ...f, description: e.target.value }))} className={`col-span-2 ${inputCls}`} />
                      <button onClick={handleAddRappel} className="col-span-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold py-2 hover:opacity-90">Créer le rappel</button>
                    </div>
                  )}
                  {selected.rappels.length === 0 ? <p className="text-xs text-gray-400">Aucun rappel.</p> : (
                    <div className="space-y-2">
                      {selected.rappels.map(r => {
                        const overdue = r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] < today;
                        return (
                          <div key={r.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${overdue ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{RAPPEL_TYPE_LABELS[r.type] ?? r.type}</span>
                                <span className="text-xs text-gray-500">{new Date(r.dateEcheance).toLocaleDateString('fr-FR')}</span>
                                {r.statut === 'FAIT' && <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]">Fait</span>}
                              </div>
                              <p className="text-xs text-gray-700 mt-0.5">{r.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.statut === 'A_FAIRE' && (
                                <button onClick={async () => { await updateRappelStatut(r.id, 'FAIT'); await reload(); }} className="text-xs text-[var(--color-success)] hover:underline">Fait</button>
                              )}
                              <button onClick={async () => { await deleteRappel(r.id); await reload(); }} className="text-xs text-red-400 hover:text-red-600">&times;</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 4 — Séjours */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Séjours liés ({selected.sejours.length})</h3>
                  {selected.sejours.length === 0 ? <p className="text-xs text-gray-400">Aucun séjour lié.</p> : (
                    <div className="space-y-2">
                      {selected.sejours.map(sc => (
                        <div key={sc.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                          <p className="text-xs text-gray-600">Séjour {sc.sejourId.substring(0, 8)}...</p>
                          <Link href={`/dashboard/sejour/${sc.sejourId}`} className="text-xs text-[var(--color-primary)] hover:underline">Espace collab &rarr;</Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modale nouveau client */}
      {showNewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewClient(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Nouveau client</h2>
            <div className="space-y-3">
              <input placeholder="Nom *" value={newForm.nom} onChange={e => setNewForm(f => ({ ...f, nom: e.target.value }))} className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                  {Object.entries(TYPE_CLIENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={newForm.statut} onChange={e => setNewForm(f => ({ ...f, statut: e.target.value }))} className={inputCls}>
                  {Object.entries(STATUT_CLIENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Ville" value={newForm.ville} onChange={e => setNewForm(f => ({ ...f, ville: e.target.value }))} className={inputCls} />
                <input placeholder="UAI" value={newForm.uai} onChange={e => setNewForm(f => ({ ...f, uai: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Téléphone" value={newForm.telephone} onChange={e => setNewForm(f => ({ ...f, telephone: e.target.value }))} className={inputCls} />
                <input placeholder="Email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>
              <textarea placeholder="Notes" value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreateClient} disabled={saving || !newForm.nom} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Créer</button>
              <button onClick={() => setShowNewClient(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale import prospects */}
      {/* Modale prévisualisation CSV */}
      {showImportCSV && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImportCSV(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Aperçu import CSV — {csvPreview.length} client{csvPreview.length > 1 ? 's' : ''} détecté{csvPreview.length > 1 ? 's' : ''}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Vérifiez les données avant de confirmer. Les doublons (même nom ou même UAI) seront ignorés.</p>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 font-medium text-gray-600">Nom</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Type</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Statut</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Ville</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Email</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">UAI</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 font-medium text-gray-900">{r['Nom']}</td>
                      <td className="py-1.5 text-gray-600">{TYPE_CLIENT_LABELS[r['Type']] ?? r['Type'] ?? '—'}</td>
                      <td className="py-1.5">
                        {r['Statut'] && STATUT_CLIENT_LABELS[r['Statut']] ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_CLIENT_LABELS[r['Statut']].cls}`}>
                            {STATUT_CLIENT_LABELS[r['Statut']].label}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-1.5 text-gray-600">{r['Ville'] || '—'}</td>
                      <td className="py-1.5 text-gray-600">{r['Email'] || '—'}</td>
                      <td className="py-1.5 text-gray-500 font-mono">{r['UAI'] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvResult && (
              <div className="px-6 py-2 bg-[var(--color-success-light)] border-t border-[var(--color-success)]/20">
                <p className="text-xs text-[var(--color-success)] font-medium">
                  {csvResult.imported} client{csvResult.imported > 1 ? 's' : ''} importé{csvResult.imported > 1 ? 's' : ''}, {csvResult.skipped} doublon{csvResult.skipped > 1 ? 's' : ''} ignoré{csvResult.skipped > 1 ? 's' : ''}
                </p>
              </div>
            )}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleConfirmCSVImport}
                disabled={csvImporting || csvPreview.length === 0}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {csvImporting ? 'Import en cours...' : `Confirmer l'import (${csvPreview.length} clients)`}
              </button>
              <button onClick={() => { setShowImportCSV(false); setCsvPreview([]); setCsvResult(null); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Importer des prospects</h2>
            <p className="text-sm text-gray-500 mb-4">Import depuis l&apos;annuaire de l&apos;Éducation Nationale par académie.</p>
            <div className="space-y-3">
              <select value={importAcademie} onChange={e => setImportAcademie(e.target.value)} className={inputCls}>
                <option value="">Sélectionner une académie</option>
                {ACADEMIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                {['Collège', 'Lycée', 'École'].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={importTypes.includes(t)} onChange={e => setImportTypes(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t))} className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]" />
                    <span className="text-sm text-gray-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            {importResult && (
              <div className="mt-3 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-4 py-3 text-sm text-[var(--color-success)]">
                {importResult.imported} établissement{importResult.imported > 1 ? 's' : ''} importé{importResult.imported > 1 ? 's' : ''}, {importResult.skipped} déjà présent{importResult.skipped > 1 ? 's' : ''}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={handleImport} disabled={importing || !importAcademie} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {importing ? 'Import en cours...' : 'Lancer l\'import'}
              </button>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
