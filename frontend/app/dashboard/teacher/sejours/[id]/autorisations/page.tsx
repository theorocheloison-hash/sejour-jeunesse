'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { Logo } from '@/app/components/Logo';
import {
  createAutorisation,
  getAutorisationsBySejour,
  type AutorisationParentale,
} from '@/src/lib/autorisation';
import { getMesSejours, updateSejour, type Sejour } from '@/src/lib/sejour';
import {
  createAccompagnateur,
  getAccompagnateursBySejour,
  type AccompagnateurMission,
} from '@/src/lib/accompagnateur';

export default function GestionAutorisationsPage() {
  const { id: sejourId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [autorisations, setAutorisations] = useState<AutorisationParentale[]>([]);
  const [sejour, setSejour] = useState<Sejour | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulaire ajout élève
  const [eleveNom, setEleveNom] = useState('');
  const [elevePrenom, setElevePrenom] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Copie lien
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Accompagnateurs
  const [accompagnateurs, setAccompagnateurs] = useState<AccompagnateurMission[]>([]);
  const [accPrenom, setAccPrenom] = useState('');
  const [accNom, setAccNom] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accTelephone, setAccTelephone] = useState('');
  const [creatingAcc, setCreatingAcc] = useState(false);
  const [accError, setAccError] = useState<string | null>(null);
  const [copiedAccId, setCopiedAccId] = useState<string | null>(null);

  // Prix par élève
  const [nbElevesDefinitif, setNbElevesDefinitif] = useState('');
  const [prixParEleve, setPrixParEleve] = useState('');
  const [dateLimite, setDateLimite] = useState('');
  const [prixManuel, setPrixManuel] = useState(false);
  const [savingPrix, setSavingPrix] = useState(false);
  const [prixSaved, setPrixSaved] = useState(false);
  const [editingPrix, setEditingPrix] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!sejourId) return;
    try {
      const [autData, sejours, accData] = await Promise.all([
        getAutorisationsBySejour(sejourId),
        getMesSejours(),
        getAccompagnateursBySejour(sejourId),
      ]);
      setAutorisations(autData);
      setAccompagnateurs(accData);
      const found = sejours.find((s) => s.id === sejourId);
      if (found) {
        setSejour(found);
        // Initialize nb eleves with current autorisation count
        if (!nbElevesDefinitif) {
          setNbElevesDefinitif(String(autData.length || found.placesTotales));
        }
        // If prix already set (> 0), show saved state
        if (Number(found.prix) > 0) {
          setPrixSaved(true);
          setPrixParEleve(String(Number(found.prix)));
          if (found.dateLimiteInscription) {
            setDateLimite(found.dateLimiteInscription.slice(0, 10));
          }
        }
      }
    } catch {
      setLoadError('Impossible de charger les données.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sejourId]);

  useEffect(() => {
    if (user && sejourId) loadData();
  }, [user, sejourId, loadData]);

  // Montant TTC du devis sélectionné (0 si aucun devis)
  const devisSelectionne = sejour?.demandes
    ?.flatMap((d) => d.devis ?? [])
    .find((dv) => dv.statut === 'SELECTIONNE');
  const montantTTC = devisSelectionne
    ? Number(devisSelectionne.montantTTC ?? devisSelectionne.montantTotal)
    : 0;

  // Recalculate prix when nbEleves changes (unless manual)
  useEffect(() => {
    if (prixManuel || montantTTC <= 0 || prixSaved) return;
    const nb = parseInt(nbElevesDefinitif, 10);
    if (nb > 0) {
      setPrixParEleve((montantTTC / nb).toFixed(2));
    }
  }, [nbElevesDefinitif, montantTTC, prixManuel, prixSaved]);

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
      await loadData();
    } catch {
      setCreateError("Erreur lors de la création de l'autorisation.");
    } finally {
      setCreating(false);
    }
  };

  const handleSavePrix = async () => {
    if (!sejourId) return;
    const prix = parseFloat(prixParEleve);
    if (isNaN(prix) || prix <= 0) return;
    setSavingPrix(true);
    try {
      await updateSejour(sejourId, {
        prix,
        dateLimiteInscription: dateLimite || undefined,
      });
      setPrixSaved(true);
      setEditingPrix(false);
      await loadData();
    } catch {
      setCreateError('Erreur lors de la sauvegarde du prix.');
    } finally {
      setSavingPrix(false);
    }
  };

  const handleCreateAcc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sejourId) return;
    setCreatingAcc(true);
    setAccError(null);
    try {
      await createAccompagnateur({
        sejourId,
        prenom: accPrenom.trim(),
        nom: accNom.trim(),
        email: accEmail.trim(),
        telephone: accTelephone.trim() || undefined,
      });
      setAccPrenom('');
      setAccNom('');
      setAccEmail('');
      setAccTelephone('');
      await loadData();
    } catch {
      setAccError("Erreur lors de l'ajout de l'accompagnateur.");
    } finally {
      setCreatingAcc(false);
    }
  };

  const copyAccLink = async (tokenAcces: string, accId: string) => {
    const url = `${window.location.origin}/ordre-mission/${tokenAcces}`;
    await navigator.clipboard.writeText(url);
    setCopiedAccId(accId);
    setTimeout(() => setCopiedAccId(null), 2000);
  };

  const copyLink = async (tokenAcces: string, id: string) => {
    const url = `${window.location.origin}/autorisation/${tokenAcces}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  const nbInscrits = autorisations.length;
  const prixEstime = montantTTC > 0 && nbInscrits > 0
    ? (montantTTC / nbInscrits).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" showTagline={false} />
            </div>
            <Link
              href="/dashboard/teacher"
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium transition-colors"
            >
              &larr; Retour au tableau de bord
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Autorisations parentales
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Ajoutez les élèves et envoyez les liens de signature aux parents.
        </p>

        {/* ── Section prix par élève ─────────────────────────────── */}
        {sejour?.statut === 'CONVENTION' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Calcul du prix par élève
            </h2>

            {/* Récapitulatif indicatif */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <p className="text-xs text-blue-600 font-medium">Montant total devis TTC</p>
                <p className="text-lg font-bold text-blue-800">
                  {montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </p>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3">
                <p className="text-xs text-purple-600 font-medium">Inscrits actuels</p>
                <p className="text-lg font-bold text-purple-800">{nbInscrits} élève{nbInscrits > 1 ? 's' : ''}</p>
              </div>
              {prixEstime && (
                <div className="rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-4 py-3">
                  <p className="text-xs text-[var(--color-success)] font-medium">Prix/élève estimé</p>
                  <p className="text-lg font-bold text-[var(--color-success)]">{prixEstime} €</p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-5">
              Ce calcul est indicatif — ajustez selon le nombre d&apos;élèves définitif attendu
            </p>

            {/* Bandeau état paiement */}
            {prixSaved && !editingPrix ? (
              <>
                <div className="rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-4 py-3 mb-4">
                  <p className="text-sm text-[var(--color-success)] font-semibold">
                    Paiement activé — {Number(prixParEleve).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €/élève — les parents peuvent régler en 1 à 10 fois sans frais
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPrix(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  Modifier
                </button>
              </>
            ) : (
              <>
                {!prixSaved && (
                  <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 mb-5">
                    <p className="text-sm text-orange-800">
                      Paiement non encore activé — définissez le prix par élève pour permettre aux parents de régler en ligne
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div>
                    <label htmlFor="nbEleves" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre d&apos;élèves définitif
                    </label>
                    <input
                      id="nbEleves"
                      type="number"
                      min="1"
                      value={nbElevesDefinitif}
                      onChange={(e) => {
                        setNbElevesDefinitif(e.target.value);
                        setPrixManuel(false);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="prixEleve" className="block text-sm font-medium text-gray-700 mb-1">
                      Prix par élève (€)
                    </label>
                    <input
                      id="prixEleve"
                      type="number"
                      min="0"
                      step="0.01"
                      value={prixParEleve}
                      onChange={(e) => {
                        setPrixParEleve(e.target.value);
                        setPrixManuel(true);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="dateLimite" className="block text-sm font-medium text-gray-700 mb-1">
                      Date limite d&apos;inscription
                    </label>
                    <input
                      id="dateLimite"
                      type="date"
                      value={dateLimite}
                      onChange={(e) => setDateLimite(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePrix}
                  disabled={savingPrix || !prixParEleve || parseFloat(prixParEleve) <= 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-success)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-success)] focus:ring-offset-2"
                >
                  {savingPrix ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Valider et activer le paiement
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Accompagnateurs ─────────────────────────────────── */}
        {sejour?.statut === 'CONVENTION' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Accompagnateurs — Ordres de mission
            </h2>

            {accError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {accError}
              </div>
            )}

            <form onSubmit={handleCreateAcc} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-5">
              <input
                type="text"
                placeholder="Prénom"
                value={accPrenom}
                onChange={(e) => setAccPrenom(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Nom"
                value={accNom}
                onChange={(e) => setAccNom(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={accEmail}
                onChange={(e) => setAccEmail(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Téléphone (optionnel)"
                value={accTelephone}
                onChange={(e) => setAccTelephone(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={creatingAcc}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                {creatingAcc ? 'Envoi…' : 'Ajouter'}
              </button>
            </form>

            <p className="text-xs text-gray-400 mb-4">
              Un email avec le lien de signature sera automatiquement envoyé à l&apos;accompagnateur.
            </p>

            {accompagnateurs.length > 0 ? (
              <div className="space-y-2">
                {accompagnateurs.map((a) => {
                  const isSigned = !!a.signeeAt;
                  return (
                    <div
                      key={a.id}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900">
                            {a.prenom} {a.nom}
                          </span>
                          {isSigned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2.5 py-0.5 text-xs font-medium">
                              Signé le{' '}
                              {new Date(a.signeeAt!).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-medium">
                              En attente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{a.email}{a.telephone ? ` — ${a.telephone}` : ''}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyAccLink(a.tokenAcces, a.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                      >
                        {copiedAccId === a.id ? (
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
              <p className="text-sm text-gray-400 text-center py-3">
                Aucun accompagnateur ajouté pour ce séjour.
              </p>
            )}
          </div>
        )}

        {/* ── Formulaire d'ajout ───────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Ajouter un élève
          </h2>

          {createError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {createError}
            </div>
          )}

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
        </div>

        {/* ── Liste des autorisations ──────────────────────────── */}
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {autorisations.length > 0 ? (
          <div className="space-y-3">
            {autorisations.map((a) => {
              const isSigned = !!a.signeeAt;
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  {/* Infos élève */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">
                        {a.elevePrenom} {a.eleveNom}
                      </span>
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2.5 py-0.5 text-xs font-medium">
                          Signé le{' '}
                          {new Date(a.signeeAt!).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-medium">
                          En attente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{a.parentEmail}</p>
                  </div>

                  {/* Bouton copier le lien */}
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
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
              <p className="text-sm text-gray-500">
                Aucune autorisation pour ce séjour. Ajoutez un élève ci-dessus.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
