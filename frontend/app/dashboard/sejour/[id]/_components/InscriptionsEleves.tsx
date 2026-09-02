'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  createAutorisation,
  getAutorisationsBySejour,
  importAutorisationsCsv,
  envoyerInvitations,
  type AutorisationParentale,
} from '@/src/lib/autorisation';

/**
 * Mode « Je fais remplir par les familles » (D14) — extrait de l'ancienne page
 * organisateur/sejours/[id]/autorisations (SC4) : ajout manuel (SANS envoi de
 * mail, S7), import CSV, liste avec statut d'envoi, sélection et « Envoyer aux
 * familles (N) », copie de lien d'autorisation.
 */
export default function InscriptionsEleves({
  sejourId,
  onChanged,
}: {
  sejourId: string;
  /** Appelé après toute mutation (le parent recharge participants → états de blocs). */
  onChanged: () => void;
}) {
  const [autorisations, setAutorisations] = useState<AutorisationParentale[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulaire ajout élève
  const [eleveNom, setEleveNom] = useState('');
  const [elevePrenom, setElevePrenom] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Copie lien
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Import CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[]; columnsDetected?: string[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Sélection / envoi invitations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [invitationsResult, setInvitationsResult] = useState<{ sent: number; total: number; errors: string[] } | null>(null);

  const loadAutorisations = useCallback(async () => {
    if (!sejourId) return;
    try {
      setAutorisations(await getAutorisationsBySejour(sejourId));
      setLoadError(null);
    } catch {
      setLoadError('Impossible de charger les élèves.');
    }
  }, [sejourId]);

  useEffect(() => { loadAutorisations(); }, [loadAutorisations]);

  const rafraichir = useCallback(async () => {
    await loadAutorisations();
    onChanged();
  }, [loadAutorisations, onChanged]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sejourId) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createAutorisation({
        sejourId,
        eleveNom: eleveNom.trim(),
        elevePrenom: elevePrenom.trim(),
        parentEmail: parentEmail.trim(),
      });
      setEleveNom('');
      setElevePrenom('');
      setParentEmail('');
      await rafraichir();
    } catch {
      setCreateError("Erreur lors de l'ajout de l'élève.");
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async () => {
    if (!sejourId || !importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await importAutorisationsCsv(sejourId, importFile);
      setImportResult(result);
      if (result.created > 0) await rafraichir();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setImportError(e.response?.data?.message ?? "Erreur lors de l'import du fichier.");
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
    setDragActive(false);
  };

  const handleEnvoyerInvitations = async (ids?: string[]) => {
    if (!sejourId) return;
    setSendingInvitations(true);
    setInvitationsResult(null);
    try {
      const result = await envoyerInvitations(sejourId, ids);
      setInvitationsResult(result);
      setSelectedIds(new Set());
      await rafraichir();
    } catch {
      setInvitationsResult({ sent: 0, total: 0, errors: ["Erreur lors de l'envoi aux familles."] });
    } finally {
      setSendingInvitations(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eligibleIds = autorisations.filter((a) => !a.signeeAt && !a.emailEnvoye && a.parentEmail).map((a) => a.id);
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allEligibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(eligibleIds));
  };
  const nbEnAttenteEnvoi = eligibleIds.length;

  const copyLink = async (tokenAcces: string, id: string) => {
    const url = `${window.location.origin}/autorisation/${tokenAcces}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Élèves — autorisations parentales</h2>
      <p className="text-xs text-gray-500 mb-4">
        Ajoutez vos élèves (aucun mail ne part à l&apos;ajout), puis envoyez le lien de
        signature aux parents au moment de votre choix.
      </p>

      {createError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {createError}
        </div>
      )}
      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Prénom"
          value={elevePrenom}
          onChange={(e) => setElevePrenom(e.target.value)}
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
        />
        <input
          type="text"
          placeholder="Nom"
          value={eleveNom}
          onChange={(e) => setEleveNom(e.target.value)}
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
        />
        <input
          type="email"
          placeholder="Email du parent"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          {creating ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
          </svg>
          Importer un fichier CSV
        </button>
      </div>

      {/* Résultat envoi invitations */}
      {invitationsResult && (
        <div className="mt-5 rounded-xl bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-success)]">
            {invitationsResult.sent} invitation{invitationsResult.sent > 1 ? 's' : ''} envoyée{invitationsResult.sent > 1 ? 's' : ''} sur {invitationsResult.total}
          </p>
          {invitationsResult.errors.length > 0 && (
            <ul className="text-xs text-red-700 mt-1 list-disc list-inside">
              {invitationsResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Toolbar sélection / envoi */}
      {nbEnAttenteEnvoi > 0 && (
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline self-start"
          >
            {allEligibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <button
            type="button"
            onClick={() => handleEnvoyerInvitations(selectedIds.size > 0 ? Array.from(selectedIds) : undefined)}
            disabled={sendingInvitations}
            className="ml-auto rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingInvitations
              ? 'Envoi…'
              : selectedIds.size > 0
                ? `Envoyer aux familles (${selectedIds.size})`
                : `Envoyer aux familles (${nbEnAttenteEnvoi})`}
          </button>
        </div>
      )}

      {/* Liste des élèves */}
      {autorisations.length > 0 ? (
        <div className="mt-4 space-y-3">
          {autorisations.map((a) => {
            const isSigned = !!a.signeeAt;
            const emailEnvoye = !!a.emailEnvoye;
            const selectable = !isSigned && !emailEnvoye && !!a.parentEmail;
            return (
              <div
                key={a.id}
                className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    aria-label={`Sélectionner ${a.elevePrenom} ${a.eleveNom}`}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {a.elevePrenom} {a.eleveNom}
                    </span>
                    {isSigned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2.5 py-0.5 text-xs font-medium">
                        Signé le{' '}
                        {new Date(a.signeeAt!).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    ) : emailEnvoye ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2.5 py-0.5 text-xs font-medium">
                        Invitation envoyée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-medium">
                        Non envoyé
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{a.parentEmail ?? 'Pas d’email parent'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(a.tokenAcces, a.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                >
                  {copiedId === a.id ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[var(--color-success)]">Copié !</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copier le lien
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        !loadError && (
          <p className="mt-4 text-sm text-gray-400 text-center py-3">
            Aucun élève pour l&apos;instant. Ajoutez-les ci-dessus ou importez un CSV.
          </p>
        )
      )}

      {/* ── Modale import CSV ─────────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Importer une liste d&apos;élèves (CSV)</h3>
              <button
                type="button"
                onClick={closeImportModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Fermer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
                <p className="font-semibold mb-3">Comment préparer votre fichier ?</p>
                <ol className="space-y-2.5 list-decimal list-inside">
                  <li>
                    <span className="font-medium">Depuis Pronote :</span> allez dans votre classe, cliquez sur le bouton d&apos;export en haut à droite de la liste d&apos;élèves, collez dans Excel, ajoutez une colonne &quot;Email parent&quot; avec l&apos;adresse email de chaque responsable, puis enregistrez en .csv
                  </li>
                  <li>
                    <span className="font-medium">Depuis ONDE :</span> menu &quot;Listes et Documents&quot;, puis &quot;Extractions&quot;, puis &quot;Élèves de l&apos;école ou leurs responsables&quot;, sélectionnez votre classe, téléchargez le fichier CSV
                  </li>
                  <li>
                    <span className="font-medium">Fichier libre :</span> préparez un fichier avec 3 colonnes minimum (Nom, Prénom, Email parent) et enregistrez en .csv
                  </li>
                </ol>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setImportFile(f);
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragActive
                    ? 'border-[var(--color-primary)] bg-blue-50'
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <svg className="h-10 w-10 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {importFile ? (
                  <p className="text-sm text-gray-900 font-medium">{importFile.name}</p>
                ) : (
                  <p className="text-sm text-gray-500">Glissez-déposez votre fichier CSV ici</p>
                )}
                <label className="inline-block mt-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Parcourir
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>

              {importError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--color-success)]">
                    {importResult.created} élève{importResult.created > 1 ? 's' : ''} importé{importResult.created > 1 ? 's' : ''}
                  </p>
                  {importResult.columnsDetected && importResult.columnsDetected.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Colonnes détectées : {importResult.columnsDetected.join(', ')}
                    </p>
                  )}
                  {importResult.skipped > 0 && (
                    <p className="text-sm text-gray-500">
                      {importResult.skipped} ignoré{importResult.skipped > 1 ? 's' : ''} (doublons ou lignes vides)
                    </p>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                      <p className="text-xs font-semibold text-red-700 mb-1">Erreurs :</p>
                      <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
                        {importResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeImportModal}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!importFile || importing}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Import…' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
