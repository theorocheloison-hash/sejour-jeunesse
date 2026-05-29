'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getMesClients, createClient, updateClient, deleteClient,
  addContact, deleteContact,
  addRappel, updateRappelStatut, deleteRappel, rattacherSejour,
  importerProspects, downloadTemplateClients, importerClientsCSV, downloadTemplateContacts, importerContactsCSV,
  searchEtablissement,
  STATUT_CLIENT_LABELS, STATUT_DERIVE_LABELS, deriveClientStatus,
  TYPE_CLIENT_LABELS, RAPPEL_TYPE_LABELS, ACADEMIES,
} from '@/src/lib/clients';
import { createSejourDirect } from '@/src/lib/collaboration';
import type { Client, ContactClient, Rappel, EtablissementEN } from '@/src/lib/clients';
import { getActivitesClient, createActiviteClient, envoyerBrochureClient } from '@/src/lib/clients';
import type { ActiviteClient } from '@/src/lib/clients';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

const PIPELINE_COLONNES = ['PROSPECT', 'EN_COURS', 'DEVIS_ENVOYE', 'CONFIRME', 'ACOMPTE_VERSE', 'SOLDE'] as const;

function matchesSearch(c: Client, query: string): boolean {
  if (query.length < 2) return true;
  const q = query.toLowerCase();
  return (
    c.nom.toLowerCase().includes(q) ||
    (c.ville ?? '').toLowerCase().includes(q) ||
    (c.uai ?? '').toLowerCase().includes(q) ||
    c.contacts.some(ct =>
      `${ct.prenom} ${ct.nom}`.toLowerCase().includes(q) ||
      (ct.email ?? '').toLowerCase().includes(q)
    )
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function ClientsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedId = searchParams.get('selected');
  const { user, isLoading, centres, centreActif } = useAuth();
  const centreNom = centres.find(c => c.id === centreActif)?.nom ?? centres[0]?.nom ?? 'notre centre';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('ALL');
  const [viewMode, setViewMode] = useState<'liste' | 'pipeline'>('liste');
  const [showPerdus, setShowPerdus] = useState(false);

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
  const [etabSuggestions, setEtabSuggestions] = useState<EtablissementEN[]>([]);
  const [etabSearching, setEtabSearching] = useState(false);
  const [etabFromApi, setEtabFromApi] = useState(false);
  const etabDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CSV import
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>>>([]);
  const [csvImporting, setCSVImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Contacts CSV import
  const [showImportContacts, setShowImportContacts] = useState(false);
  const [contactsCSVPreview, setContactsCSVPreview] = useState<Array<Record<string, string>>>([]);
  const [contactsImporting, setContactsImporting] = useState(false);
  const [contactsResult, setContactsResult] = useState<{ imported: number; skipped: number; clientNotFound: number } | null>(null);

  const [activites, setActivites] = useState<ActiviteClient[]>([]);
  const [activitesLoading, setActivitesLoading] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ type: 'NOTE', description: '' });
  const [sendingBrochure, setSendingBrochure] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role === 'HEBERGEUR') {
      getMesClients().then((data) => {
        setClients(data);
        if (preselectedId && !selectedId) {
          setSelectedId(preselectedId);
        }
      }).finally(() => setLoading(false));
    }
  }, [isLoading, user]);

  useEffect(() => {
    setActivites([]);
    if (!selectedId) return;
    setActivitesLoading(true);
    getActivitesClient(selectedId)
      .then(setActivites)
      .catch(() => {})
      .finally(() => setActivitesLoading(false));
  }, [selectedId]);

  const selected = useMemo(() => clients.find(c => c.id === selectedId) ?? null, [clients, selectedId]);

  // Statut dérivé (pipeline) calculé une fois par client
  const statutDerive = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) m[c.id] = deriveClientStatus(c);
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    let list = clients;
    if (filtreStatut !== 'ALL') list = list.filter(c => statutDerive[c.id] === filtreStatut);
    if (searchQuery.length >= 2) list = list.filter(c => matchesSearch(c, searchQuery));
    return list;
  }, [clients, filtreStatut, searchQuery, statutDerive]);

  const statutCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) {
      const s = statutDerive[c.id];
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [clients, statutDerive]);

  const today = new Date().toISOString().split('T')[0];

  const clientsAvecRappels = useMemo(() => {
    return clients
      .filter(c => c.rappels.some(r =>
        r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] <= today
      ))
      .map(c => ({
        id: c.id,
        nom: c.nom,
        rappelsUrgents: c.rappels.filter(r =>
          r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] <= today
        ),
      }))
      .sort((a, b) => {
        // En retard (< today) avant aujourd'hui (= today)
        const aEnRetard = a.rappelsUrgents.some(r => r.dateEcheance.split('T')[0] < today);
        const bEnRetard = b.rappelsUrgents.some(r => r.dateEcheance.split('T')[0] < today);
        if (aEnRetard && !bEnRetard) return -1;
        if (!aEnRetard && bEnRetard) return 1;
        return 0;
      });
  }, [clients, today]);

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
      setEtabSuggestions([]);
      setEtabFromApi(false);
    } finally { setSaving(false); }
  };

  const handleEtabSearch = (value: string) => {
    setNewForm(f => ({ ...f, nom: value }));
    setEtabFromApi(false);
    setEtabSuggestions([]);
    if (etabDebounceRef.current) clearTimeout(etabDebounceRef.current);
    if (value.trim().length < 2) return;
    setEtabSearching(true);
    etabDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchEtablissement(value.trim());
        setEtabSuggestions(results);
      } catch { /* ignore */ }
      finally { setEtabSearching(false); }
    }, 350);
  };

  const handleSelectEtab = (etab: EtablissementEN) => {
    const type = etab.type === 'Collège' ? 'COLLEGE'
      : etab.type === 'Lycée' ? 'LYCEE'
      : etab.type === 'Ecole' ? 'ECOLE'
      : 'ETABLISSEMENT_SCOLAIRE';
    setNewForm(f => ({
      ...f,
      nom: etab.nom,
      type,
      ville: etab.ville ?? f.ville,
      email: etab.email ?? f.email,
      telephone: etab.telephone ?? f.telephone,
      uai: etab.uai ?? f.uai,
    }));
    setEtabFromApi(true);
    setEtabSuggestions([]);
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
      const text = (ev.target?.result as string).replace(/^\uFEFF/, '');
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() && !l.startsWith('---'));
      if (lines.length < 2) return;
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(line => {
        const cols = parseCSVLine(line);
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
      // Normaliser les clés CSV (majuscules) vers les clés backend (minuscules)
      const COL_MAP: Record<string, string> = {
        'Nom': 'nom',
        'Type': 'type',
        'Statut': 'statut',
        'Ville': 'ville',
        'Code postal': 'codePostal',
        'CodePostal': 'codePostal',
        'Téléphone': 'telephone',
        'Telephone': 'telephone',
        'Email': 'email',
        'UAI': 'uai',
        'Notes': 'notes',
      };
      const normalized = csvPreview.map(row => {
        const obj: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => {
          const mappedKey = COL_MAP[k] ?? k.toLowerCase();
          obj[mappedKey] = v;
        });
        return obj;
      });
      const result = await importerClientsCSV(normalized);
      setCsvResult({ imported: result.imported, skipped: result.skipped });
      setCsvPreview([]);
      await getMesClients().then(setClients);
    } catch (err) {
      console.error('[importerClientsCSV]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      await getMesClients().then(setClients).catch(() => {});
    }
    setCSVImporting(false);
  };

  const CONTACT_COL_MAP: Record<string, string> = {
    'Établissement': 'etablissement', 'Etablissement': 'etablissement',
    'Prénom': 'prenom', 'Prenom': 'prenom',
    'Nom': 'nom', 'Email': 'email',
    'Téléphone': 'telephone', 'Telephone': 'telephone',
    'Rôle': 'role', 'Role': 'role',
  };

  const handleContactsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setContactsResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, '');
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() && !l.startsWith('---'));
      if (lines.length < 2) return;
      const rawHeaders = parseCSVLine(lines[0]);
      const normalizedHeaders = rawHeaders.map(h => CONTACT_COL_MAP[h] ?? h.toLowerCase());
      const rows = lines.slice(1).map(line => {
        const cols = parseCSVLine(line);
        const obj: Record<string, string> = {};
        normalizedHeaders.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
        return obj;
      }).filter(r => r['etablissement']?.trim() && (r['prenom']?.trim() || r['nom']?.trim()));
      setContactsCSVPreview(rows);
      setShowImportContacts(true);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleConfirmContactsImport = async () => {
    setContactsImporting(true);
    try {
      const result = await importerContactsCSV(contactsCSVPreview);
      setContactsResult({ imported: result.imported, skipped: result.skipped, clientNotFound: result.clientNotFound });
      setContactsCSVPreview([]);
      await getMesClients().then(setClients);
    } catch (err) {
      console.error('[importerContactsCSV]', err);
      setErreur('Une erreur est survenue. Veuillez réessayer.');
      await getMesClients().then(setClients).catch(() => {});
    }
    setContactsImporting(false);
  };

  const handleAddNote = async () => {
    if (!selectedId || !noteForm.description.trim()) return;
    const created = await createActiviteClient(selectedId, {
      type: noteForm.type,
      description: noteForm.description,
    });
    setActivites(prev => [created, ...prev]);
    setShowNoteForm(false);
    setNoteForm({ type: 'NOTE', description: '' });
  };

  const handleEnvoyerBrochure = async () => {
    if (!selectedId) return;
    setSendingBrochure(true);
    try {
      await envoyerBrochureClient(selectedId);
      const updated = await getActivitesClient(selectedId);
      setActivites(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur envoi brochure');
    } finally {
      setSendingBrochure(false);
    }
  };

  const ACTIVITE_CONFIG: Record<string, { icon: string; cls: string; label: string }> = {
    DEVIS:      { icon: '📄', cls: 'bg-blue-50 text-blue-700',       label: 'Devis' },
    SIGNATURE:  { icon: '✍️', cls: 'bg-green-50 text-green-700',     label: 'Signature' },
    VERSEMENT:  { icon: '💶', cls: 'bg-emerald-50 text-emerald-700', label: 'Versement' },
    BROCHURE:   { icon: '📬', cls: 'bg-amber-50 text-amber-700',     label: 'Brochure' },
    APPEL:      { icon: '📞', cls: 'bg-purple-50 text-purple-700',   label: 'Appel' },
    EMAIL:      { icon: '✉️', cls: 'bg-indigo-50 text-indigo-700',   label: 'Email' },
    VISITE:     { icon: '🏠', cls: 'bg-orange-50 text-orange-700',   label: 'Visite' },
    NOTE:       { icon: '📝', cls: 'bg-gray-50 text-gray-600',       label: 'Note' },
  };

  if (isLoading || !user) return null;

  const prospectCount = clients.filter(c => statutDerive[c.id] === 'PROSPECT').length;
  const clientCount = clients.filter(c => !['PROSPECT', 'PERDU'].includes(statutDerive[c.id])).length;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hebergeur" className="text-sm text-[var(--color-primary)] hover:underline">&larr; Tableau de bord</Link>
          <h1 className="text-base font-semibold text-gray-900">Clients & Prospects</h1>
          <span className="text-xs text-gray-500">{clientCount} clients, {prospectCount} prospects</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Groupe établissements */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50">
            <span className="text-[10px] text-gray-400 font-medium mr-1 italic">Établissements</span>
            <button onClick={downloadTemplateClients} title="Télécharger le modèle CSV établissements" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Modèle
            </button>
            <label title="Importer des établissements depuis un CSV" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Importer
              <input type="file" accept=".csv" className="hidden" onChange={handleCSVFileUpload} />
            </label>
          </div>

          {/* Groupe contacts */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50">
            <span className="text-[10px] text-gray-400 font-medium mr-1 italic">Contacts</span>
            <button onClick={downloadTemplateContacts} title="Télécharger le modèle CSV contacts (personnes rattachées à un établissement)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              Modèle
            </button>
            <label title="Importer des contacts depuis un CSV (personnes liées à vos établissements)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Importer
              <input type="file" accept=".csv" className="hidden" onChange={handleContactsFileUpload} />
            </label>
          </div>
          <button onClick={() => setShowImport(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Importer prospects EN
          </button>
          <button onClick={() => setShowNewClient(true)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            + Nouveau client
          </button>
        </div>
      </nav>

      {clientsAvecRappels.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-sm font-semibold text-amber-800">
                  {clientsAvecRappels.length} client{clientsAvecRappels.length > 1 ? 's' : ''} à traiter
                </p>
              </div>
              <span className="text-xs text-amber-600">
                {clientsAvecRappels.reduce((sum, c) => sum + c.rappelsUrgents.length, 0)} rappel{clientsAvecRappels.reduce((sum, c) => sum + c.rappelsUrgents.length, 0) > 1 ? 's' : ''} en attente
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {clientsAvecRappels.map(c => {
                const enRetard = c.rappelsUrgents.some(r => r.dateEcheance.split('T')[0] < today);
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedId(c.id); setEditMode(false); }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm ${
                      enRetard
                        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                        : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-100'
                    } ${selectedId === c.id ? 'ring-2 ring-[var(--color-primary)] ring-offset-1' : ''}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${enRetard ? 'bg-red-500' : 'bg-amber-500'}`} />
                    {c.nom}
                    <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold">
                      {c.rappelsUrgents.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {erreur && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <span>{erreur}</span>
            <button onClick={() => setErreur(null)} className="text-red-500 hover:text-red-700 shrink-0">×</button>
          </div>
        )}
        {/* Search + filters + viewMode toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher (nom, ville, UAI)..." className={`flex-1 ${inputCls}`} />
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode('liste')}
              title="Vue liste"
              className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all ${viewMode === 'liste' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              title="Vue pipeline (kanban)"
              className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all ${viewMode === 'pipeline' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v15h-4.5zM9.75 4.5h4.5v9h-4.5zM15.75 4.5h4.5v6h-4.5z" /></svg>
            </button>
          </div>
        </div>
        {viewMode === 'liste' && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button onClick={() => setFiltreStatut('ALL')} className={`rounded-full px-3 py-1 text-xs font-medium ${filtreStatut === 'ALL' ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              Tous ({clients.length})
            </button>
            {Object.entries(STATUT_DERIVE_LABELS).map(([key, { label }]) => (
              <button key={key} onClick={() => setFiltreStatut(key)} className={`rounded-full px-3 py-1 text-xs font-medium ${filtreStatut === key ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {label} ({statutCounts[key] ?? 0})
              </button>
            ))}
          </div>
        )}
        {viewMode === 'pipeline' && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowPerdus(s => !s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {showPerdus ? 'Masquer les perdus' : `Afficher les perdus (${statutCounts['PERDU'] ?? 0})`}
            </button>
          </div>
        )}

        {/* Layout liste + détail OU pipeline + détail */}
        <div className="flex gap-6">
          {/* Colonne gauche : liste OU kanban */}
          <div className={viewMode === 'liste' ? 'w-1/3 space-y-2 max-h-[75vh] overflow-y-auto' : 'flex-1 min-w-0 overflow-x-auto'}>
            {viewMode === 'liste' ? (
              loading ? (
                <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Aucun client.</p>
              ) : filtered.map(c => {
                const st = STATUT_DERIVE_LABELS[statutDerive[c.id]] ?? STATUT_DERIVE_LABELS.PROSPECT;
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
              })
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${(showPerdus ? PIPELINE_COLONNES.length + 1 : PIPELINE_COLONNES.length)}, minmax(180px, 1fr))` }}>
                {(showPerdus ? [...PIPELINE_COLONNES, 'PERDU'] : [...PIPELINE_COLONNES]).map(colonne => {
                  const cfg = STATUT_DERIVE_LABELS[colonne] ?? STATUT_DERIVE_LABELS.PROSPECT;
                  const clientsColonne = clients.filter(c =>
                    statutDerive[c.id] === colonne &&
                    (searchQuery.length < 2 || matchesSearch(c, searchQuery))
                  );
                  return (
                    <div key={colonne} className="flex flex-col rounded-xl border border-gray-200 bg-gray-50 max-h-[calc(100vh-280px)]">
                      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-gray-50 px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
                        <span className="text-[10px] font-medium text-gray-500">{clientsColonne.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {clientsColonne.length === 0 ? (
                          <p className="text-center text-[10px] text-gray-400 py-3">Aucun</p>
                        ) : clientsColonne.map(c => {
                          const ca = c.montantCA ?? 0;
                          const nbContacts = c.contacts.length;
                          const nomCourt = c.nom.length > 30 ? `${c.nom.slice(0, 30)}…` : c.nom;
                          return (
                            <button
                              key={c.id}
                              onClick={() => { setSelectedId(c.id); setEditMode(false); }}
                              className={`w-full text-left rounded-lg border bg-white px-3 py-2 transition-all hover:shadow-sm ${selectedId === c.id ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]' : 'border-gray-200'}`}
                            >
                              <p className="text-xs font-semibold text-gray-900 truncate">{nomCourt}</p>
                              {c.ville && <p className="text-[10px] text-gray-500 truncate">{c.ville}</p>}
                              {(nbContacts > 0 || ca > 0) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {nbContacts > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                                      {nbContacts} contact{nbContacts > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {ca > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      {ca.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Détail droite — affiché en liste, ou en pipeline quand un client est sélectionné */}
          {(viewMode === 'liste' || selected) && (
          <div className={viewMode === 'liste' ? 'flex-1' : 'w-[420px] shrink-0 max-h-[calc(100vh-280px)] overflow-y-auto'}>
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
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={editForm.statut === 'PERDU'}
                            onChange={e => setEditForm(f => ({ ...f, statut: e.target.checked ? 'PERDU' : 'PROSPECT' }))}
                            className="rounded border-gray-300"
                          />
                          Marquer comme perdu
                        </label>
                      </div>
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
                      <div><p className="text-xs text-gray-400">Statut</p><p><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(STATUT_DERIVE_LABELS[statutDerive[selected.id]] ?? STATUT_DERIVE_LABELS.PROSPECT).cls}`}>{(STATUT_DERIVE_LABELS[statutDerive[selected.id]] ?? STATUT_DERIVE_LABELS.PROSPECT).label}</span></p></div>
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
                        const isToday = r.statut === 'A_FAIRE' && r.dateEcheance.split('T')[0] === today;
                        return (
                          <div key={r.id} className={`rounded-xl border p-4 transition-all ${
                            r.statut === 'FAIT' ? 'border-gray-100 bg-gray-50 opacity-60' :
                            overdue ? 'border-red-200 bg-red-50' :
                            isToday ? 'border-amber-200 bg-amber-50' :
                            'border-gray-200 bg-white'
                          }`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                    overdue ? 'bg-red-100 text-red-700' :
                                    isToday ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {RAPPEL_TYPE_LABELS[r.type] ?? r.type}
                                  </span>
                                  <span className={`text-xs font-medium ${overdue ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-gray-500'}`}>
                                    {new Date(r.dateEcheance).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </span>
                                  {overdue && <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wide">En retard</span>}
                                  {isToday && <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">Aujourd&apos;hui</span>}
                                  {r.statut === 'FAIT' && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    Traité
                                  </span>}
                                </div>
                                <p className="text-sm text-gray-700">{r.description}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {r.statut === 'A_FAIRE' && (
                                  <button
                                    onClick={async () => { await updateRappelStatut(r.id, 'FAIT'); await reload(); }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    Marquer fait
                                  </button>
                                )}
                                <button
                                  onClick={async () => { await deleteRappel(r.id); await reload(); }}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 4 — Séjours liés */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Séjours liés ({selected.sejours.length})</h3>

                  {selected.sejours.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun séjour lié</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.sejours.map(sc => {
                        const sej = sc.sejour;
                        if (!sej) return (
                          <div key={sc.id} className="text-xs text-gray-400 italic">Séjour supprimé</div>
                        );

                        const STATUT_SEJOUR_BADGE: Record<string, { label: string; cls: string }> = {
                          OPTION: { label: 'Option', cls: 'bg-amber-100 text-amber-700' },
                          CONVENTION: { label: 'Convention', cls: 'bg-blue-100 text-blue-700' },
                          SIGNE_DIRECTION: { label: 'Signé direction', cls: 'bg-purple-100 text-purple-700' },
                          DRAFT: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-500' },
                        };
                        const badge = STATUT_SEJOUR_BADGE[sej.statut] ?? { label: sej.statut, cls: 'bg-gray-100 text-gray-500' };
                        const dateDebut = sej.dateDebut ? new Date(sej.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
                        const dateFin = sej.dateFin ? new Date(sej.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                        const isEvenement = sej.natureSejour === 'EVENEMENT';

                        return (
                          <Link
                            key={sc.id}
                            href={`/dashboard/sejour/${sej.id}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {isEvenement ? '🎉 ' : ''}{sej.titre}
                              </p>
                              {dateDebut && (
                                <p className="text-xs text-gray-400">{dateDebut} → {dateFin}</p>
                              )}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Boutons création */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={async () => {
                        if (!selected) return;
                        try {
                          const newSejour = await createSejourDirect({
                            titre: `Séjour ${selected.nom}`,
                            natureSejour: 'SEJOUR',
                            dateDebut: new Date().toISOString().split('T')[0],
                            dateFin: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
                            nombreParticipants: 30,
                            clientNom: selected.nom,
                            clientEmail: selected.email ?? selected.contacts[0]?.email ?? undefined,
                            clientTelephone: selected.telephone ?? selected.contacts[0]?.telephone ?? undefined,
                            clientOrganisation: selected.nom,
                            clientOrganisationId: selected.organisationId ?? undefined,
                          });
                          await rattacherSejour(selected.id, newSejour.id);
                          router.push(`/dashboard/sejour/${newSejour.id}`);
                        } catch {
                          setErreur('Erreur lors de la création du séjour');
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      + Nouveau séjour
                    </button>
                    <button
                      onClick={async () => {
                        if (!selected) return;
                        try {
                          const newSejour = await createSejourDirect({
                            titre: `Événement ${selected.nom}`,
                            natureSejour: 'EVENEMENT',
                            dateDebut: new Date().toISOString().split('T')[0],
                            dateFin: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
                            nombreParticipants: 50,
                            clientNom: selected.nom,
                            clientEmail: selected.email ?? selected.contacts[0]?.email ?? undefined,
                            clientTelephone: selected.telephone ?? selected.contacts[0]?.telephone ?? undefined,
                            clientOrganisation: selected.nom,
                            clientOrganisationId: selected.organisationId ?? undefined,
                          });
                          await rattacherSejour(selected.id, newSejour.id);
                          router.push(`/dashboard/sejour/${newSejour.id}`);
                        } catch {
                          setErreur('Erreur lors de la création de l\'événement');
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      + Nouvel événement
                    </button>
                  </div>
                </div>

                {/* Section 5 — Devis & Factures */}
                {selected.devis && selected.devis.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Devis & Factures ({selected.devis.length})
                    </h3>
                    <div className="space-y-2">
                      {selected.devis.map(d => {
                        const isFacture = d.typeDocument === 'FACTURE_ACOMPTE' || d.typeDocument === 'FACTURE_SOLDE';
                        const montant = d.montantTTC ?? Number(d.montantTotal ?? 0);
                        const label = d.typeDocument === 'FACTURE_ACOMPTE' ? 'Facture acompte'
                          : d.typeDocument === 'FACTURE_SOLDE' ? 'Facture solde'
                          : 'Devis';
                        const ref = d.numeroFacture ?? d.numeroDevis ?? d.id.substring(0, 8).toUpperCase();
                        const statutCls = d.statut === 'SELECTIONNE' ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                          : d.statut === 'EN_ATTENTE' ? 'bg-orange-100 text-orange-700'
                          : d.statut === 'NON_RETENU' ? 'bg-gray-100 text-gray-500'
                          : 'bg-gray-100 text-gray-600';
                        const statutLabel = d.statut === 'SELECTIONNE' ? 'Retenu'
                          : d.statut === 'EN_ATTENTE' ? 'En attente'
                          : d.statut === 'NON_RETENU' ? 'Non retenu'
                          : d.statut;
                        return (
                          <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${isFacture ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {label}
                                </span>
                                <span className="text-xs font-mono text-gray-500">{ref}</span>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statutCls}`}>
                                  {statutLabel}
                                </span>
                              </div>
                              {d.demande?.sejour && (
                                <p className="text-xs text-gray-500 truncate">
                                  {d.demande.sejour.titre} · {new Date(d.demande.sejour.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                              {isFacture && (
                                <p className="text-xs mt-0.5">
                                  {d.acompteVerse
                                    ? <span className="text-[var(--color-success)] font-medium">✓ Paiement reçu</span>
                                    : <span className="text-amber-600">En attente — {Number(d.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                  }
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right ml-3">
                              <p className="text-sm font-semibold text-gray-900">
                                {montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              </p>
                              <Link href="/dashboard/hebergeur/devis" className="text-xs text-[var(--color-primary)] hover:underline">
                                Voir &rarr;
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 6 — Activité */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Activité</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleEnvoyerBrochure}
                        disabled={sendingBrochure}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {sendingBrochure ? '...' : '📬 Envoyer la brochure'}
                      </button>
                      <a
                        href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Visite — ${selected?.nom ?? ''}`)}&details=${encodeURIComponent(`Visite de ${centreNom}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        🗓 Planifier visite
                      </a>
                      <button
                        onClick={() => setShowNoteForm(s => !s)}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        {showNoteForm ? 'Annuler' : '+ Note'}
                      </button>
                    </div>
                  </div>

                  {showNoteForm && (
                    <div className="mb-3 flex flex-col gap-2">
                      <select
                        value={noteForm.type}
                        onChange={e => setNoteForm(f => ({ ...f, type: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="NOTE">Note</option>
                        <option value="APPEL">Appel</option>
                        <option value="EMAIL">Email</option>
                        <option value="VISITE">Visite</option>
                      </select>
                      <textarea
                        value={noteForm.description}
                        onChange={e => setNoteForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Description de l'activité..."
                        rows={2}
                        className={`${inputCls} resize-none`}
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={!noteForm.description.trim()}
                        className="rounded-lg bg-[var(--color-primary)] py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  )}

                  {activitesLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                    </div>
                  ) : activites.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucune activité enregistrée.</p>
                  ) : (
                    <div className="space-y-2">
                      {activites.map(a => {
                        const cfg = ACTIVITE_CONFIG[a.type] ?? ACTIVITE_CONFIG['NOTE'];
                        return (
                          <div key={a.id} className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                            <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${cfg.cls}`}>
                              {cfg.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-gray-700 truncate">{a.description}</span>
                                <span className="shrink-0 text-[10px] text-gray-400">
                                  {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
                                {cfg.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Modale nouveau client */}
      {showNewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowNewClient(false); setEtabSuggestions([]); setEtabFromApi(false); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Nouveau client</h2>
            <div className="space-y-3">
              <div className="relative">
                <div className="relative">
                  <input
                    placeholder="Nom ou code UAI de l'établissement *"
                    value={newForm.nom}
                    onChange={e => handleEtabSearch(e.target.value)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {etabSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent inline-block" />
                    </div>
                  )}
                </div>
                {etabSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
                    {etabSuggestions.map((etab, i) => (
                      <button
                        key={etab.uai || i}
                        type="button"
                        onClick={() => handleSelectEtab(etab)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">{etab.nom}</p>
                        <p className="text-xs text-gray-500">
                          {etab.type && <span className="mr-2">{etab.type}</span>}
                          {etab.ville && <span className="mr-2">{etab.ville}</span>}
                          {etab.uai && <span className="font-mono text-gray-400">{etab.uai}</span>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {etabFromApi && (
                  <p className="mt-1 text-xs text-[var(--color-success)] flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Établissement chargé depuis l&apos;annuaire Éducation Nationale
                  </p>
                )}
              </div>
              <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                {Object.entries(TYPE_CLIENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Ville" value={newForm.ville} onChange={e => setNewForm(f => ({ ...f, ville: e.target.value }))} className={inputCls} />
                <input
                  placeholder="UAI"
                  value={newForm.uai}
                  onChange={e => !etabFromApi && setNewForm(f => ({ ...f, uai: e.target.value }))}
                  readOnly={etabFromApi}
                  className={`${inputCls} ${etabFromApi ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  title={etabFromApi ? 'Code UAI chargé automatiquement' : ''}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Téléphone" value={newForm.telephone} onChange={e => setNewForm(f => ({ ...f, telephone: e.target.value }))} className={inputCls} />
                <input placeholder="Email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>
              <textarea placeholder="Notes" value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreateClient} disabled={saving || !newForm.nom} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Créer</button>
              <button onClick={() => { setShowNewClient(false); setEtabSuggestions([]); setEtabFromApi(false); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale import prospects */}
      {/* Modale prévisualisation contacts CSV */}
      {showImportContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImportContacts(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">
                Aperçu import contacts — {contactsCSVPreview.length} contact{contactsCSVPreview.length > 1 ? 's' : ''} détecté{contactsCSVPreview.length > 1 ? 's' : ''}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Les contacts dont l&apos;établissement est introuvable dans LIAVO seront ignorés. Importez d&apos;abord les clients si nécessaire.
              </p>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 font-medium text-gray-600 max-w-[140px]">Établissement</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Prénom</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Nom</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Email</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Téléphone</th>
                    <th className="text-left py-1.5 font-medium text-gray-600">Rôle</th>
                  </tr>
                </thead>
                <tbody>
                  {contactsCSVPreview.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 font-medium text-gray-900 max-w-[140px] truncate">{r['etablissement']}</td>
                      <td className="py-1.5 text-gray-700">{r['prenom'] || '—'}</td>
                      <td className="py-1.5 text-gray-700">{r['nom'] || '—'}</td>
                      <td className="py-1.5 text-gray-500 max-w-[140px] truncate">{r['email'] || '—'}</td>
                      <td className="py-1.5 text-gray-500">{r['telephone'] || '—'}</td>
                      <td className="py-1.5 text-gray-400">{r['role'] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {contactsResult && (
              <div className="px-6 py-2 border-t border-gray-200 bg-[var(--color-success-light)]">
                <p className="text-xs font-medium text-[var(--color-success)]">
                  {contactsResult.imported} contact{contactsResult.imported > 1 ? 's' : ''} importé{contactsResult.imported > 1 ? 's' : ''}
                  {contactsResult.skipped > 0 && `, ${contactsResult.skipped} doublon${contactsResult.skipped > 1 ? 's' : ''} ignoré${contactsResult.skipped > 1 ? 's' : ''}`}
                </p>
                {contactsResult.clientNotFound > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    {contactsResult.clientNotFound} établissement{contactsResult.clientNotFound > 1 ? 's' : ''} introuvable{contactsResult.clientNotFound > 1 ? 's' : ''} — importez d&apos;abord les clients correspondants
                  </p>
                )}
              </div>
            )}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleConfirmContactsImport}
                disabled={contactsImporting || contactsCSVPreview.length === 0}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {contactsImporting ? 'Import en cours...' : `Confirmer l'import (${contactsCSVPreview.length} contacts)`}
              </button>
              <button
                onClick={() => { setShowImportContacts(false); setContactsCSVPreview([]); setContactsResult(null); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

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
                {[
                  { label: 'Collège', values: ['Collège'] },
                  { label: 'Lycée', values: ['Lycée'] },
                  { label: 'École', values: ['Ecole élémentaire', 'Ecole maternelle', 'Ecole primaire'] },
                ].map(({ label, values }) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.every(v => importTypes.includes(v))}
                      onChange={e => setImportTypes(prev =>
                        e.target.checked
                          ? [...new Set([...prev, ...values])]
                          : prev.filter(x => !values.includes(x))
                      )}
                      className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
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

export default function ClientsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    }>
      <ClientsPage />
    </Suspense>
  );
}
