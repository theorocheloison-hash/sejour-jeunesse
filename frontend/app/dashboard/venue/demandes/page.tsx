'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDemandesOuvertes, ignorerDemande } from '@/src/lib/demande';
import { uploadDevisPdf } from '@/src/lib/devis';
import type { Demande } from '@/src/lib/demande';

export default function VenueDemandesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openUpload, setOpenUpload] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [detailDemande, setDetailDemande] = useState<Demande | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  const load = async () => {
    try {
      const data = await getDemandesOuvertes();
      setDemandes(data);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('403') || (typeof e === 'object' && e !== null && 'response' in e)) {
        setError('Abonnement inactif — activez votre abonnement pour voir les demandes.');
      } else {
        setError('Impossible de charger les demandes.');
      }
    }
  };

  useEffect(() => {
    if (user?.role === 'VENUE') load();
  }, [user]);

  const handleFileSelect = (file: File | undefined) => {
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleUpload = async (demandeId: string) => {
    if (!pdfFile) return;
    setSending(true);
    setSuccessId(null);
    try {
      await uploadDevisPdf(demandeId, pdfFile);
      setSuccessId(demandeId);
      setOpenUpload(null);
      setPdfFile(null);
    } catch {
      setError('Erreur lors de l\'envoi du devis PDF.');
    } finally {
      setSending(false);
    }
  };

  const handleIgnorer = async (demandeId: string) => {
    await ignorerDemande(demandeId);
    setDemandes(prev => prev.filter(d => d.id !== demandeId));
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Demandes des enseignants</h1>
        <p className="text-sm text-gray-500 mb-8">Consultez les demandes ouvertes et envoyez vos devis</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {demandes.length === 0 && !error ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Aucune demande ouverte pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {demandes.map((d) => {
              const dateDebut = new Date(d.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const dateFin = new Date(d.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{d.titre}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        <span>{d.villeHebergement}</span>
                        <span>{dateDebut} &rarr; {dateFin}</span>
                        <span>{d.nombreEleves} élève{d.nombreEleves > 1 ? 's' : ''}</span>
                        {d.enseignant && <span>{d.enseignant.prenom} {d.enseignant.nom}</span>}
                      </div>
                      {d.description && <p className="mt-2 text-sm text-gray-600">{d.description}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => setDetailDemande(d)}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.574-3.007-9.964-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Voir le détail
                      </button>
                      {successId === d.id ? (
                        <span className="text-sm font-medium text-[var(--color-success)]">Devis envoyé !</span>
                      ) : (
                        <>
                          <Link
                            href={`/dashboard/venue/devis/nouveau?demandeId=${d.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)] transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Créer un devis
                          </Link>
                          <button
                            onClick={() => { setOpenUpload(openUpload === d.id ? null : d.id); setPdfFile(null); setSuccessId(null); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                            </svg>
                            {openUpload === d.id ? 'Annuler' : 'Charger un PDF'}
                          </button>
                          <button
                            onClick={() => handleIgnorer(d.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Ne pas répondre
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {openUpload === d.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                          dragging
                            ? 'border-indigo-400 bg-[var(--color-primary-light)]'
                            : pdfFile
                              ? 'border-[var(--color-success)] bg-[var(--color-success-light)]'
                              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                        }`}
                      >
                        {pdfFile ? (
                          <div className="flex items-center justify-center gap-3">
                            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-900">{pdfFile.name}</p>
                              <p className="text-xs text-gray-500">{(pdfFile.size / 1024).toFixed(0)} Ko</p>
                            </div>
                            <button onClick={() => setPdfFile(null)} className="ml-2 text-gray-400 hover:text-red-500">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <p className="text-sm text-gray-600 mb-1">
                              Glissez-déposez votre devis PDF ici
                            </p>
                            <p className="text-xs text-gray-400 mb-3">ou</p>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                              </svg>
                              Parcourir
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e.target.files?.[0])}
                            />
                            <p className="mt-3 text-xs text-gray-400">PDF uniquement</p>
                          </>
                        )}
                      </div>

                      {pdfFile && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleUpload(d.id)}
                            disabled={sending}
                            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sending ? (
                              <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Envoi...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                Envoyer ce devis
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modale détail demande */}
      {detailDemande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailDemande(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{detailDemande.titre}</h2>
              <button onClick={() => setDetailDemande(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Dates</p>
                  <p className="font-medium">{new Date(detailDemande.dateDebut).toLocaleDateString('fr-FR')} &rarr; {new Date(detailDemande.dateFin).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Destination</p>
                  <p className="font-medium">{detailDemande.villeHebergement}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Élèves</p>
                  <p className="font-medium">{detailDemande.nombreEleves}</p>
                </div>
                {detailDemande.nombreAccompagnateurs != null && (
                  <div>
                    <p className="text-xs text-gray-400">Accompagnateurs</p>
                    <p className="font-medium">{detailDemande.nombreAccompagnateurs}</p>
                  </div>
                )}
                {detailDemande.heureArrivee && (
                  <div>
                    <p className="text-xs text-gray-400">Heure d&apos;arrivée</p>
                    <p className="font-medium">{detailDemande.heureArrivee}</p>
                  </div>
                )}
                {detailDemande.heureDepart && (
                  <div>
                    <p className="text-xs text-gray-400">Heure de départ</p>
                    <p className="font-medium">{detailDemande.heureDepart}</p>
                  </div>
                )}
                {detailDemande.budgetMaxParEleve != null && (
                  <div>
                    <p className="text-xs text-gray-400">Budget max / élève</p>
                    <p className="font-medium">{detailDemande.budgetMaxParEleve} &euro;</p>
                  </div>
                )}
              </div>
              {detailDemande.transportAller && (
                <div className="col-span-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  {detailDemande.transportAller === 'BESOIN_TRANSPORTEUR'
                    ? 'Transport aller demandé — à inclure dans le devis'
                    : "Transport aller : déjà prévu par l'enseignant"}
                </div>
              )}
              {detailDemande.transportSurPlace !== null && detailDemande.transportSurPlace !== undefined && (
                <div className="col-span-2 text-sm text-gray-600">
                  Transport sur place : {detailDemande.transportSurPlace ? 'Autonome' : 'Non prévu'}
                </div>
              )}

              {detailDemande.activitesSouhaitees && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Activités souhaitées</p>
                  <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{detailDemande.activitesSouhaitees}</p>
                </div>
              )}

              {detailDemande.description && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Description</p>
                  <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{detailDemande.description}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">Contact enseignant</p>
                <p className="font-medium">{detailDemande.enseignant?.prenom} {detailDemande.enseignant?.nom}</p>
                <p className="text-gray-500">{detailDemande.enseignant?.email}</p>
              </div>

              {detailDemande.dateButoireReponse && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                  <p className="text-xs font-medium text-orange-700">
                    Date limite de réponse : {new Date(detailDemande.dateButoireReponse).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <Link
                href={`/dashboard/venue/devis/nouveau?demandeId=${detailDemande.id}`}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white text-center hover:opacity-90"
              >
                Créer un devis
              </Link>
              <button onClick={() => setDetailDemande(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
