'use client';
import { useEffect, useRef, useState } from 'react';
import { createSejourDirect } from '@/src/lib/collaboration';
import type { SejourPlanning } from '@/src/lib/collaboration';
import { getMesClients } from '@/src/lib/clients';
import type { Client } from '@/src/lib/clients';
import api from '@/src/lib/api';

// Normalisation accent-insensible — partagée avec le planning.
export function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export const SOUS_TYPES_SEJOUR = [
  { value: 'CLASSE_DECOUVERTE', label: 'Classe de découverte' },
  { value: 'COLONIE_VACANCES', label: 'Colonie de vacances' },
  { value: 'CAMP_SPORTIF', label: 'Camp sportif' },
  { value: 'SEJOUR_LINGUISTIQUE', label: 'Séjour linguistique' },
  { value: 'AUTRE_SEJOUR', label: 'Autre séjour' },
];

export const SOUS_TYPES_EVENEMENT = [
  { value: 'MARIAGE', label: 'Mariage' },
  { value: 'ANNIVERSAIRE', label: 'Anniversaire' },
  { value: 'SEMINAIRE', label: 'Séminaire' },
  { value: 'TEAM_BUILDING', label: 'Team building' },
  { value: 'REUNION_FAMILLE', label: 'Réunion de famille' },
  { value: 'AUTRE_EVENEMENT', label: 'Autre événement' },
];

export interface StructResult {
  nom: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  siren: string | null;
  siret: string | null;
  source: string;
}

export interface CreateSejourModalProps {
  natureSejour: 'SEJOUR' | 'EVENEMENT';
  initialDates?: { dateDebut: string; dateFin: string } | null;
  initialClient?: {
    nom?: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    organisation?: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    clientId?: string;
  } | null;
  onClose: () => void;
  onCreated: (sejour: SejourPlanning) => void;
}

export default function CreateSejourModal({
  natureSejour,
  initialDates,
  initialClient,
  onClose,
  onCreated,
}: CreateSejourModalProps) {
  // Checkbox « Dates à définir » : quand cochée, on masque les champs date et on
  // envoie dateDebut/dateFin = undefined au backend (séjour exploratoire sans dates).
  const [datesADefinir, setDatesADefinir] = useState(false);

  const [form, setForm] = useState({
    titre: '',
    typeSejour: natureSejour === 'SEJOUR' ? 'CLASSE_DECOUVERTE' : 'MARIAGE',
    dateDebut: initialDates?.dateDebut ?? '',
    dateFin: initialDates?.dateFin ?? '',
    nombreParticipants: '',
    nombreAccompagnants: '',
    clientNom: initialClient?.nom ?? '',
    clientPrenom: initialClient?.prenom ?? '',
    clientEmail: initialClient?.email ?? '',
    clientTelephone: initialClient?.telephone ?? '',
    clientAdresse: initialClient?.adresse ?? '',
    clientCodePostal: initialClient?.codePostal ?? '',
    clientVille: initialClient?.ville ?? '',
    description: '',
    moisSouhaite: '',
    anneeSouhaitee: '',
    noteDateFlexible: '',
    dureeNuits: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type de client : Particulier (mariage, anniversaire…) ou Professionnel (SIRET).
  // Si un client est pré-rempli avec une organisation, on bascule directement en Professionnel.
  const [clientType, setClientType] = useState<'PARTICULIER' | 'PROFESSIONNEL'>(
    initialClient?.organisation
      ? 'PROFESSIONNEL'
      : natureSejour === 'EVENEMENT'
        ? 'PARTICULIER'
        : 'PROFESSIONNEL'
  );

  // Autocomplétion du contact depuis les clients existants du CRM
  const [crmClients, setCrmClients] = useState<Client[]>([]);
  const [showContactSuggest, setShowContactSuggest] = useState(false);

  const [structNom, setStructNom] = useState('');
  const [structVille, setStructVille] = useState('');
  const [structCodePostal, setStructCodePostal] = useState('');
  const [structResults, setStructResults] = useState<StructResult[]>([]);
  const [structSearching, setStructSearching] = useState(false);
  // Pré-sélection de l'organisation si fournie via initialClient (skip la recherche).
  const [selectedOrg, setSelectedOrg] = useState<{ nom: string; adresse: string | null; ville: string | null } | null>(
    initialClient?.organisation
      ? { nom: initialClient.organisation, adresse: initialClient.adresse ?? null, ville: initialClient.ville ?? null }
      : null
  );
  const structDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const structAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (structDebounceRef.current) clearTimeout(structDebounceRef.current);
      if (structAbortRef.current) structAbortRef.current.abort();
    };
  }, []);

  // Charger les clients du CRM pour l'autocomplétion du contact
  useEffect(() => {
    getMesClients().then(setCrmClients).catch(() => {});
  }, []);

  const fireStructSearch = (nom: string, ville: string, cp: string) => {
    if (structDebounceRef.current) clearTimeout(structDebounceRef.current);
    const q = [nom.trim(), cp.trim(), ville.trim()].filter(Boolean).join(' ');
    if (q.length < 2) { setStructResults([]); return; }

    structDebounceRef.current = setTimeout(async () => {
      if (structAbortRef.current) structAbortRef.current.abort();
      const controller = new AbortController();
      structAbortRef.current = controller;
      setStructSearching(true);
      try {
        const res = await api.get('/organisations/search', { params: { q }, signal: controller.signal });
        setStructResults(res.data?.results ?? []);
      } catch { /* aborted */ }
      finally { if (!controller.signal.aborted) setStructSearching(false); }
    }, 300);
  };

  const selectStruct = (r: StructResult) => {
    setSelectedOrg({ nom: r.nom, adresse: r.adresse, ville: r.ville });
    setStructResults([]);
    setStructNom(r.nom);
    setStructVille(r.ville ?? '');
    // Pré-remplir l'adresse du destinataire depuis l'organisation trouvée
    setForm(f => ({
      ...f,
      clientAdresse: r.adresse ?? f.clientAdresse,
      clientCodePostal: r.codePostal ?? f.clientCodePostal,
      clientVille: r.ville ?? f.clientVille,
    }));
  };

  const clearStruct = () => {
    setSelectedOrg(null);
    setStructNom('');
    setStructVille('');
    setStructCodePostal('');
    setStructResults([]);
  };

  // Suggestions de contacts existants (CRM) filtrées sur le nom saisi
  const contactSuggestions = (() => {
    const q = normalise(form.clientNom.trim());
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const out: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }[] = [];
    const push = (s: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }) => {
      const key = `${normalise(s.prenom)}|${normalise(s.nom)}|${s.email.toLowerCase()}`;
      if (!s.nom && !s.prenom) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    };
    for (const c of crmClients) {
      const isParticulier = c.type === 'PARTICULIER';
      const organisation = isParticulier ? null : c.nom;
      // Un particulier est souvent stocké en tant que Client (nom = nom de famille)
      if (isParticulier) {
        push({ prenom: '', nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', organisation: null });
      }
      // Tout client (quelle que soit son organisation) : indexer le nom du client lui-même
      if (!isParticulier) {
        // Chercher sur clientNom : le nom de l'organisation / famille / couple
        push({ prenom: '', nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', organisation: c.nom });
      }
      for (const ct of c.contacts ?? []) {
        push({ prenom: ct.prenom ?? '', nom: ct.nom ?? '', email: ct.email ?? '', telephone: ct.telephone ?? '', organisation });
      }
    }
    return out
      .filter(s => normalise(`${s.prenom} ${s.nom}`).includes(q) || normalise(s.nom).includes(q))
      .slice(0, 8);
  })();

  const selectContact = (s: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }) => {
    setForm(f => ({
      ...f,
      clientNom: s.nom,
      clientPrenom: s.prenom || f.clientPrenom,
      clientEmail: s.email || f.clientEmail,
      clientTelephone: s.telephone || f.clientTelephone,
    }));
    // Contact rattaché à une structure → bascule en mode Professionnel et pré-sélectionne l'organisation
    if (s.organisation) {
      setClientType('PROFESSIONNEL');
      setSelectedOrg({ nom: s.organisation, adresse: null, ville: null });
    }
    setShowContactSuggest(false);
  };

  const sousTypes = natureSejour === 'SEJOUR' ? SOUS_TYPES_SEJOUR : SOUS_TYPES_EVENEMENT;
  const labelParticipants = natureSejour === 'SEJOUR' ? 'Nombre de participants' : 'Nombre de personnes';
  const labelContact = natureSejour === 'SEJOUR' ? 'Structure organisatrice' : 'Client';

  const handleSubmit = async () => {
    if (!form.titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!datesADefinir && (!form.dateDebut || !form.dateFin)) {
      setError('Renseignez les dates ou cochez « Dates à définir »');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sejour = await createSejourDirect({
        titre: form.titre.trim(),
        natureSejour,
        typeSejour: form.typeSejour,
        dateDebut: datesADefinir ? undefined : form.dateDebut,
        dateFin: datesADefinir ? undefined : form.dateFin,
        nombreParticipants: parseInt(form.nombreParticipants) || 0,
        nombreAccompagnateurs: parseInt(form.nombreAccompagnants) || undefined,
        clientNom: form.clientNom.trim() || undefined,
        clientPrenom: form.clientPrenom.trim() || undefined,
        clientEmail: form.clientEmail.trim() || undefined,
        clientTelephone: form.clientTelephone.trim() || undefined,
        clientOrganisation: selectedOrg?.nom || undefined,
        clientAdresse: form.clientAdresse.trim() || undefined,
        clientCodePostal: form.clientCodePostal.trim() || undefined,
        clientVille: form.clientVille.trim() || undefined,
        // Client CRM existant : le backend lie directement et ne crée pas de client fantôme.
        clientId: initialClient?.clientId ?? undefined,
        ...(datesADefinir ? {
          moisSouhaite: form.moisSouhaite ? parseInt(form.moisSouhaite) : undefined,
          anneeSouhaitee: form.anneeSouhaitee ? parseInt(form.anneeSouhaitee) : undefined,
          noteDateFlexible: form.noteDateFlexible || undefined,
          dureeNuits: form.dureeNuits ? parseInt(form.dureeNuits) : undefined,
        } : {}),
      });
      onCreated(sejour);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {natureSejour === 'SEJOUR' ? '📋 Nouveau séjour' : '🎉 Nouvel événement'}
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          {datesADefinir
            ? 'Les dates pourront être renseignées plus tard.'
            : 'Les dates seront bloquées au planning dès la création.'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select value={form.typeSejour} onChange={set('typeSejour')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              {sousTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Titre</label>
            <input type="text" value={form.titre} onChange={set('titre')}
              placeholder={natureSejour === 'SEJOUR' ? 'ex: Classe de neige 4ème' : 'ex: Mariage Dupont-Martin'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>

          {/* Checkbox « Dates à définir » au-dessus des champs date */}
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={datesADefinir}
              onChange={e => setDatesADefinir(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            Dates à définir (appel exploratoire sans dates précises)
          </label>

          {!datesADefinir && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
                <input type="date" value={form.dateDebut} onChange={set('dateDebut')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
                <input type="date" value={form.dateFin} onChange={set('dateFin')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
          )}

          {datesADefinir && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-3">
              <p className="text-xs text-blue-700 font-medium">Période souhaitée (optionnel)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Mois</label>
                  <select value={form.moisSouhaite} onChange={set('moisSouhaite')}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    <option value="">--</option>
                    {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m,i) => (
                      <option key={i+1} value={String(i+1)}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Année</label>
                  <input type="number" value={form.anneeSouhaitee} onChange={set('anneeSouhaitee')}
                    placeholder="2027" min="2025" max="2030"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Précision</label>
                <input type="text" value={form.noteDateFlexible} onChange={set('noteDateFlexible')}
                  placeholder='ex: "Semaine de Pâques"'
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Durée estimée (nuits)</label>
                <input type="number" value={form.dureeNuits} onChange={set('dureeNuits')}
                  placeholder="ex: 5" min="1" max="30"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{labelParticipants}</label>
              <input type="number" min="0" value={form.nombreParticipants} onChange={set('nombreParticipants')}
                placeholder="ex: 48"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Accompagnants</label>
              <input type="number" min="0" value={form.nombreAccompagnants} onChange={set('nombreAccompagnants')}
                placeholder="ex: 4"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">{labelContact}</p>
            {/* Choix explicite Particulier / Professionnel */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setClientType('PARTICULIER'); clearStruct(); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${clientType === 'PARTICULIER' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                👤 Particulier
              </button>
              <button
                type="button"
                onClick={() => setClientType('PROFESSIONNEL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${clientType === 'PROFESSIONNEL' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                🏢 Professionnel (SIRET)
              </button>
            </div>
          </div>

          {clientType === 'PROFESSIONNEL' && (!selectedOrg ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Renseignez les 3 champs pour trouver plus facilement la structure.</p>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={structNom} placeholder="Nom"
                  onChange={e => { setStructNom(e.target.value); fireStructSearch(e.target.value, structVille, structCodePostal); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={structCodePostal} placeholder="Code postal"
                  onChange={e => { setStructCodePostal(e.target.value); fireStructSearch(structNom, structVille, e.target.value); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={structVille} placeholder="Ville"
                  onChange={e => { setStructVille(e.target.value); fireStructSearch(structNom, e.target.value, structCodePostal); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              {structSearching && <p className="text-xs text-gray-400">Recherche en cours…</p>}
              {structResults.length > 0 && (
                <div className="rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                  {structResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => selectStruct(r)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <span className="font-medium text-gray-900">{r.nom}</span>
                      {r.ville && <span className="text-gray-400"> — {r.ville}</span>}
                      <span className="text-gray-300 ml-1">({r.source === 'API_SIRENE' ? 'SIRENE' : r.source})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedOrg.nom}</p>
                {selectedOrg.ville && <p className="text-xs text-gray-400">{selectedOrg.adresse ? `${selectedOrg.adresse}, ` : ''}{selectedOrg.ville}</p>}
              </div>
              <button type="button" onClick={clearStruct} className="text-xs text-red-500 hover:underline">Changer</button>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" value={form.clientPrenom} onChange={set('clientPrenom')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                autoComplete="off"
                value={form.clientNom}
                onChange={e => { setForm(f => ({ ...f, clientNom: e.target.value })); setShowContactSuggest(true); }}
                onFocus={() => setShowContactSuggest(true)}
                onBlur={() => setTimeout(() => setShowContactSuggest(false), 150)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              {/* Suggestions de clients existants du CRM */}
              {showContactSuggest && contactSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                  {contactSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectContact(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{`${s.prenom} ${s.nom}`.trim()}</span>
                      {s.organisation && <span className="text-gray-400"> — {s.organisation}</span>}
                      {s.email && <span className="block text-[11px] text-gray-400">{s.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Adresse du destinataire (figée sur le devis/facture) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
            <input type="text" value={form.clientAdresse} onChange={set('clientAdresse')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code postal</label>
              <input type="text" value={form.clientCodePostal} onChange={set('clientCodePostal')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
              <input type="text" value={form.clientVille} onChange={set('clientVille')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.clientEmail} onChange={set('clientEmail')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.clientTelephone} onChange={set('clientTelephone')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.titre.trim()}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Création…' : natureSejour === 'SEJOUR' ? 'Créer le séjour' : 'Créer l\'événement'}
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
