'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/src/lib/api';
import { useAuth } from '@/src/contexts/AuthContext';
import { createCentre } from '@/src/lib/centre';

// ─── Types ───────────────────────────────────────────────────────────────

interface CentrePublic {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone: string | null;
  email: string | null;
  capacite: number;
  description: string | null;
  departement: string | null;
  siret: string | null;
}

type Mode = 'search' | 'claim' | 'manual';

// ─── Page ────────────────────────────────────────────────────────────────

export default function NouveauCentrePage() {
  const router = useRouter();
  const { isMultiCentre } = useAuth();

  const [mode, setMode] = useState<Mode>('search');

  // — Recherche catalogue
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CentrePublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // — SIRET lookup (préremplit manuel)
  const [siretLookup, setSiretLookup] = useState('');
  const [siretLoading, setSiretLoading] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);

  // — Centre sélectionné (pour claim)
  const [selectedCentre, setSelectedCentre] = useState<CentrePublic | null>(null);

  // — Formulaire manuel
  const [form, setForm] = useState({
    nom: '',
    siret: '',
    adresse: '',
    ville: '',
    codePostal: '',
    capacite: '',
    telephone: '',
    email: '',
    description: '',
  });

  // — Claim
  const [claimFile, setClaimFile] = useState<File | null>(null);
  const [claimSiret, setClaimSiret] = useState('');

  // — UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ kind: 'claim' | 'manual'; message: string } | null>(null);

  const retourHref = isMultiCentre ? '/dashboard/hebergeur/global' : '/dashboard/hebergeur';

  // ── Recherche debounced ──
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get<CentrePublic[]>(
          `/centres/search-public?search=${encodeURIComponent(search.trim())}`,
        );
        setResults(data);
        setHasSearched(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── SIRET lookup → préremplit le formulaire manuel ──
  const handleSiretLookup = useCallback(async () => {
    setSiretError(null);
    const cleaned = siretLookup.replace(/[\s\-]/g, '');
    if (cleaned.length !== 14 || !/^\d{14}$/.test(cleaned)) {
      setSiretError('Le SIRET doit contenir exactement 14 chiffres');
      return;
    }
    setSiretLoading(true);
    try {
      const { data } = await api.get(`/auth/sirene/${cleaned}`);
      if (!data.found) {
        setSiretError('SIRET introuvable. Renseignez les informations manuellement.');
        return;
      }
      setForm(f => ({
        ...f,
        nom: f.nom || data.raisonSociale,
        adresse: f.adresse || data.adresse,
        ville: f.ville || data.ville,
        codePostal: f.codePostal || data.codePostal,
        siret: data.siret,
      }));
      setMode('manual');
    } catch {
      setSiretError('Erreur lors de la recherche. Renseignez les informations manuellement.');
    } finally {
      setSiretLoading(false);
    }
  }, [siretLookup]);

  // ── Sélection d'un centre pour claim ──
  const handleSelectCentre = (c: CentrePublic) => {
    setSelectedCentre(c);
    setClaimSiret(c.siret ?? '');
    setError(null);
    setMode('claim');
  };

  // ── Soumission claim ──
  const handleClaimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCentre) return;
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('catalogueId', selectedCentre.id);
      if (claimSiret) fd.append('siretExtrait', claimSiret);
      if (claimFile) fd.append('document', claimFile);
      const { data } = await api.post('/centres/claim-from-catalogue', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const message = data?.claimStatut === 'EN_ATTENTE_VALIDATION'
        ? 'Votre demande a été soumise avec votre justificatif. Notre équipe la vérifiera dans les plus brefs délais.'
        : 'Votre demande a été enregistrée. Ajoutez un justificatif (Kbis, récépissé RNA ou attestation) pour permettre sa validation.';
      setSuccess({ kind: 'claim', message });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erreur lors de la soumission de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Soumission création manuelle ──
  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const capacite = parseInt(form.capacite, 10);
    if (!form.nom || !form.adresse || !form.ville || !form.codePostal || !form.capacite || Number.isNaN(capacite)) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      await createCentre({
        nom: form.nom,
        adresse: form.adresse,
        ville: form.ville,
        codePostal: form.codePostal,
        capacite,
        siret: form.siret || undefined,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        description: form.description || undefined,
      });
      setSuccess({
        kind: 'manual',
        message: 'Votre centre est en attente de validation par notre équipe. Vous recevrez une notification dès qu\'il sera activé. En attendant, vous pouvez continuer à utiliser vos centres existants.',
      });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erreur lors de la création du centre.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Rendu ──
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-transparent";

  // Écran de succès
  if (success) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)', padding: '40px 24px' }}>
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div
              className="mx-auto flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ background: 'var(--color-success-light)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg mb-2" style={{ color: 'var(--color-success)', fontWeight: 500 }}>
              {success.kind === 'claim' ? 'Demande envoyée' : 'Centre créé avec succès ✓'}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>{success.message}</p>
            <Link
              href={retourHref}
              className="inline-block rounded-lg px-5 py-2.5 text-sm text-white"
              style={{ background: 'var(--color-primary)', fontWeight: 500 }}
            >
              ← Retour à mes centres
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', padding: '40px 24px' }}>
      <div className="max-w-3xl mx-auto">

        {/* Back link */}
        <Link
          href={retourHref}
          className="inline-flex items-center gap-1 mb-6 text-sm"
          style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Retour à mes centres
        </Link>

        <h1 className="text-2xl mb-2" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Ajouter un centre</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          Recherchez votre centre dans notre catalogue, ou créez-le manuellement.
        </p>

        {error && (
          <div
            className="mb-5 rounded-lg px-4 py-3 text-sm"
            style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}
          >
            {error}
          </div>
        )}

        {/* ─── ÉTAPE 1 — RECHERCHE ─── */}
        {mode === 'search' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-5">
              <label className="block text-sm mb-2" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                Rechercher mon centre
              </label>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Tapez le nom de votre centre ou la ville où il se trouve.
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom du centre, ville…"
                  className={input}
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent inline-block" />
                  </div>
                )}
              </div>

              {/* Résultats */}
              {results.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {results.map(c => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate" style={{ fontWeight: 500 }}>{c.nom}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {[c.ville, c.codePostal, c.departement].filter(Boolean).join(' · ')}
                          {c.capacite ? ` · ${c.capacite} places` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectCentre(c)}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-white whitespace-nowrap hover:opacity-90 transition"
                        style={{ background: 'var(--color-primary)', fontWeight: 500 }}
                      >
                        C&apos;est mon centre →
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {hasSearched && !isSearching && results.length === 0 && (
                <p className="mt-4 text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  Aucun centre trouvé pour « {search} ».
                </p>
              )}
            </div>

            {/* SIRET lookup */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-5">
              <label className="block text-sm mb-2" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                Ou recherchez par SIRET
              </label>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Saisissez le SIRET de votre structure pour pré-remplir le formulaire de création.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={siretLookup}
                  onChange={(e) => setSiretLookup(e.target.value)}
                  placeholder="14 chiffres"
                  className={input}
                />
                <button
                  type="button"
                  onClick={handleSiretLookup}
                  disabled={siretLoading}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm text-white hover:opacity-90 transition disabled:opacity-50"
                  style={{ background: 'var(--color-primary)', fontWeight: 500 }}
                >
                  {siretLoading ? '…' : 'Rechercher'}
                </button>
              </div>
              {siretError && (
                <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>{siretError}</p>
              )}
            </div>

            {/* Création manuelle */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className="text-sm underline hover:no-underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Mon centre n&apos;apparaît pas dans le catalogue → Créer manuellement
              </button>
            </div>
          </>
        )}

        {/* ─── ÉTAPE 2a — CLAIM ─── */}
        {mode === 'claim' && selectedCentre && (
          <form onSubmit={handleClaimSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg mb-1" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Revendiquer ce centre</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
              Pour vérifier que vous êtes bien le gestionnaire de ce centre, fournissez un document justificatif (extrait Kbis pour une société, récépissé de déclaration pour une association, ou tout document attestant de votre lien avec cet établissement).
            </p>

            {/* Récap centre */}
            <div className="rounded-lg p-4 mb-5" style={{ background: 'var(--color-bg)' }}>
              <p className="text-sm text-gray-900" style={{ fontWeight: 500 }}>{selectedCentre.nom}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {selectedCentre.adresse}{selectedCentre.adresse && ', '}{selectedCentre.codePostal} {selectedCentre.ville}
              </p>
              {selectedCentre.capacite > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Capacité : {selectedCentre.capacite} places
                </p>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>
                  Document justificatif
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setClaimFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:text-white file:px-3 file:py-1.5 file:text-xs file:cursor-pointer hover:file:opacity-90"
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Formats acceptés : PDF, JPG, PNG.
                </p>
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>
                  SIRET <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={claimSiret}
                  onChange={(e) => setClaimSiret(e.target.value)}
                  placeholder="14 chiffres"
                  className={input}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => { setMode('search'); setSelectedCentre(null); }}
                className="text-sm" style={{ color: 'var(--color-text-muted)' }}
              >
                ← Choisir un autre centre
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-5 py-2.5 text-sm text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ background: 'var(--color-primary)', fontWeight: 500 }}
              >
                {submitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
              </button>
            </div>
          </form>
        )}

        {/* ─── ÉTAPE 2b — CRÉATION MANUELLE ─── */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg mb-1" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Créer mon centre manuellement</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
              Votre centre sera créé en statut « en attente » et vérifié par un administrateur avant d&apos;être utilisable.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>Nom du centre *</label>
                <input
                  type="text" required
                  value={form.nom}
                  onChange={(e) => setForm(f => ({ ...f, nom: e.target.value }))}
                  className={input}
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>
                  SIRET <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.siret}
                    onChange={(e) => setForm(f => ({ ...f, siret: e.target.value }))}
                    placeholder="14 chiffres"
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setSiretError(null);
                      const cleaned = form.siret.replace(/[\s\-]/g, '');
                      if (cleaned.length !== 14 || !/^\d{14}$/.test(cleaned)) {
                        setSiretError('Le SIRET doit contenir exactement 14 chiffres');
                        return;
                      }
                      setSiretLoading(true);
                      try {
                        const { data } = await api.get(`/auth/sirene/${cleaned}`);
                        if (!data.found) {
                          setSiretError('SIRET introuvable.');
                          return;
                        }
                        setForm(f => ({
                          ...f,
                          nom: f.nom || data.raisonSociale,
                          adresse: f.adresse || data.adresse,
                          ville: f.ville || data.ville,
                          codePostal: f.codePostal || data.codePostal,
                          siret: data.siret,
                        }));
                      } catch {
                        setSiretError('Erreur lors de la recherche.');
                      } finally {
                        setSiretLoading(false);
                      }
                    }}
                    disabled={siretLoading}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs whitespace-nowrap hover:bg-gray-50 transition disabled:opacity-50"
                    style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontWeight: 500 }}
                  >
                    {siretLoading ? '…' : 'Lookup SIRENE'}
                  </button>
                </div>
                {siretError && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{siretError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>Adresse *</label>
                <input
                  type="text" required
                  value={form.adresse}
                  onChange={(e) => setForm(f => ({ ...f, adresse: e.target.value }))}
                  className={input}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>Ville *</label>
                  <input
                    type="text" required
                    value={form.ville}
                    onChange={(e) => setForm(f => ({ ...f, ville: e.target.value }))}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>Code postal *</label>
                  <input
                    type="text" required
                    value={form.codePostal}
                    onChange={(e) => setForm(f => ({ ...f, codePostal: e.target.value }))}
                    className={input}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>Capacité d&apos;accueil *</label>
                <input
                  type="number" required min={1}
                  value={form.capacite}
                  onChange={(e) => setForm(f => ({ ...f, capacite: e.target.value }))}
                  placeholder="nombre de places"
                  className={input}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>
                    Téléphone <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.telephone}
                    onChange={(e) => setForm(f => ({ ...f, telephone: e.target.value }))}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>
                    Email <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className={input}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-gray-700" style={{ fontWeight: 500 }}>
                  Description <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className={`${input} resize-none`}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMode('search')}
                className="text-sm" style={{ color: 'var(--color-text-muted)' }}
              >
                ← Retour à la recherche
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-5 py-2.5 text-sm text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ background: 'var(--color-primary)', fontWeight: 500 }}
              >
                {submitting ? 'Création en cours…' : 'Créer mon centre'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
