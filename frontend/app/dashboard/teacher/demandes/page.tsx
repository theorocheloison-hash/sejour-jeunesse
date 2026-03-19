'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDemandes } from '@/src/lib/demande';
import { getDevisForDemande, updateDevisStatut } from '@/src/lib/devis';
import type { Demande } from '@/src/lib/demande';
import type { Devis, StatutDevis } from '@/src/lib/devis';

const STATUT_DEVIS_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE:            { label: 'En attente',          cls: 'bg-orange-100 text-orange-700' },
  ACCEPTE:               { label: 'Accepté',             cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  REFUSE:                { label: 'Refusé',              cls: 'bg-red-100 text-red-700' },
  EN_ATTENTE_VALIDATION: { label: 'Soumis au directeur', cls: 'bg-blue-100 text-blue-700' },
  SELECTIONNE:           { label: 'Sélectionné',         cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  NON_RETENU:            { label: 'Non retenu',          cls: 'bg-gray-100 text-gray-600' },
};

export default function TeacherDemandesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [devisMap, setDevisMap] = useState<Record<string, Devis[]>>({});
  const [updatingDevis, setUpdatingDevis] = useState<string | null>(null);
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TEACHER')) router.push('/login');
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    try {
      setDemandes(await getMesDemandes());
    } catch {
      setError('Impossible de charger les demandes.');
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'TEACHER') load();
  }, [user, load]);

  const toggleDevis = async (demandeId: string) => {
    if (expandedId === demandeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(demandeId);
    if (!devisMap[demandeId]) {
      try {
        const devis = await getDevisForDemande(demandeId);
        setDevisMap((prev) => ({ ...prev, [demandeId]: devis }));
      } catch { /* ignore */ }
    }
  };

  const handleStatut = async (devisId: string, statut: StatutDevis, demandeId: string) => {
    setUpdatingDevis(devisId);
    try {
      await updateDevisStatut(devisId, statut);
      const devis = await getDevisForDemande(demandeId);
      setDevisMap((prev) => ({ ...prev, [demandeId]: devis }));
    } catch { /* ignore */ }
    setUpdatingDevis(null);
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mes demandes de devis</h1>
        <p className="text-sm text-gray-500 mb-8">Les demandes sont créées automatiquement quand vous soumettez un séjour</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {demandes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">Aucune demande pour le moment. Soumettez un séjour pour créer un appel d&apos;offres.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {demandes.map((d) => {
              const dateDebut = new Date(d.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const dateFin = new Date(d.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const devisCount = d._count?.devis ?? 0;
              const expanded = expandedId === d.id;
              const devis = devisMap[d.id] ?? [];

              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{d.titre}</h3>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {d.statut}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{d.villeHebergement}</span>
                        <span>{dateDebut} &rarr; {dateFin}</span>
                        <span>{d.nombreEleves} élève{d.nombreEleves > 1 ? 's' : ''}</span>
                        {d.regionCible && <span>{d.regionCible}</span>}
                        {d.dateButoireReponse && (
                          <span>Butoire : {new Date(d.dateButoireReponse).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDevis(d.id)}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {devisCount} devis reçu{devisCount > 1 ? 's' : ''} {expanded ? '\u25B2' : '\u25BC'}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                      {devis.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucun devis reçu pour cette demande.</p>
                      ) : (
                        devis.map((dv) => {
                          const badge = STATUT_DEVIS_BADGE[dv.statut] ?? STATUT_DEVIS_BADGE.EN_ATTENTE;
                          return (
                            <div key={dv.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-900">{dv.centre?.nom ?? 'Centre'}</span>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                    <span>Total : {dv.montantTotal} €</span>
                                    <span>Par élève : {dv.montantParEleve} €</span>
                                    {dv.centre?.ville && <span>{dv.centre.ville}</span>}
                                    {dv.centre?.capacite && <span>{dv.centre.capacite} lits</span>}
                                  </div>
                                  {dv.description && <p className="mt-1 text-xs text-gray-600">{dv.description}</p>}
                                  {dv.conditionsAnnulation && <p className="mt-1 text-xs text-gray-400">Annulation : {dv.conditionsAnnulation}</p>}
                                  {dv.statut === 'SELECTIONNE' && dv.lignes && dv.lignes.length > 0 && (
                                    <div className="mt-3 overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-gray-200">
                                            <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Description</th>
                                            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Qté</th>
                                            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Prix unit.</th>
                                            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Total TTC</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {dv.lignes.map((l, i) => (
                                            <tr key={l.id ?? i} className="border-b border-gray-100">
                                              <td className="py-1.5 px-2 text-gray-900">{l.description}</td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">{l.quantite}</td>
                                              <td className="py-1.5 px-2 text-right text-gray-600">{l.prixUnitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;</td>
                                              <td className="py-1.5 px-2 text-right font-medium text-gray-900">{l.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} &euro;</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                  <button
                                    onClick={() => setSelectedDevis(dv)}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                  >
                                    Voir le détail
                                  </button>
                                  {dv.statut === 'EN_ATTENTE' && (
                                    <button
                                      onClick={() => handleStatut(dv.id, 'EN_ATTENTE_VALIDATION', d.id)}
                                      disabled={updatingDevis === dv.id}
                                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Soumettre au directeur
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Print CSS ─── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #devis-print-zone, #devis-print-zone * { visibility: visible; }
          #devis-print-zone { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {/* ── Modale détail devis ─── */}
      {selectedDevis && (() => {
        const dv = selectedDevis;
        const c = dv.centre;
        const ens = dv.demande?.enseignant;
        const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const dateDevis = new Date(dv.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const lignes = dv.lignes ?? [];

        const tvaByRate = lignes.reduce<Record<number, { ht: number; tva: number }>>((acc, l) => {
          if (!acc[l.tva]) acc[l.tva] = { ht: 0, tva: 0 };
          acc[l.tva].ht += l.totalHT;
          acc[l.tva].tva += l.totalTTC - l.totalHT;
          return acc;
        }, {});
        const totalHT = lignes.reduce((sum, l) => sum + l.totalHT, 0);
        const totalTTC = lignes.reduce((sum, l) => sum + l.totalTTC, 0);
        const totalTVA = totalTTC - totalHT;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center print:static print:block">
            <div className="absolute inset-0 bg-black/50 print:hidden" onClick={() => setSelectedDevis(null)} />
            <div id="devis-print-zone" className="relative z-10 bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto p-8 space-y-8">

              {/* Boutons haut */}
              <div className="flex justify-end gap-3 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors"
                >
                  Imprimer
                </button>
                <button
                  onClick={() => setSelectedDevis(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Fermer
                </button>
              </div>

              {/* En-tête : émetteur + destinataire */}
              <div className="grid grid-cols-2 gap-8">
                {/* Émetteur (hébergeur) */}
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="font-bold text-gray-900 text-base">{dv.nomEntreprise ?? c?.nom ?? '—'}</p>
                  {(dv.adresseEntreprise ?? c?.adresse) && <p>{dv.adresseEntreprise ?? c?.adresse}</p>}
                  {c && <p>{c.codePostal} {c.ville}</p>}
                  {(dv.telEntreprise ?? c?.telephone) && <p>Tél. : {dv.telEntreprise ?? c?.telephone}</p>}
                  {(dv.emailEntreprise ?? c?.email) && <p>Email : {dv.emailEntreprise ?? c?.email}</p>}
                  {(dv.siretEntreprise ?? c?.siret) && <p>N° SIRET : {dv.siretEntreprise ?? c?.siret}</p>}
                </div>

                {/* Destinataire (établissement) */}
                <div className="text-sm text-gray-700 space-y-1">
                  {ens?.etablissementNom && <p className="font-bold text-gray-900 text-base">{ens.etablissementNom}</p>}
                  {ens?.prenom && <p>{ens.prenom} {ens.nom}</p>}
                  {ens?.etablissementAdresse && <p>{ens.etablissementAdresse}</p>}
                  {ens?.etablissementVille && <p>{ens.etablissementVille}</p>}
                  {(ens?.etablissementTelephone ?? ens?.telephone) && <p>Tél. : {ens?.etablissementTelephone ?? ens?.telephone}</p>}
                  {(ens?.etablissementEmail ?? ens?.email) && <p>Email : {ens?.etablissementEmail ?? ens?.email}</p>}
                </div>
              </div>

              {/* Titre central */}
              <div className="text-center border-y border-gray-200 py-4 space-y-1">
                {dv.demande?.titre && <p className="text-lg font-bold text-gray-900 uppercase">{dv.demande.titre}</p>}
                {dv.numeroDevis && <p className="text-base font-semibold text-gray-700">DEVIS N° {dv.numeroDevis}</p>}
                <p className="text-sm text-gray-500">Le {dateDevis}</p>
              </div>

              {/* Tableau des lignes */}
              {lignes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 pr-4 font-semibold text-gray-700">Désignation</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-700">Qté</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-700">PU HT</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-700">TVA %</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-700">Total HT</th>
                        <th className="text-right py-2 pl-2 font-semibold text-gray-700">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l, i) => (
                        <tr key={l.id ?? i} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-900">{l.description}</td>
                          <td className="py-2 px-2 text-right text-gray-600">{l.quantite}</td>
                          <td className="py-2 px-2 text-right text-gray-600">{fmt(l.prixUnitaire)} &euro;</td>
                          <td className="py-2 px-2 text-right text-gray-600">{l.tva} %</td>
                          <td className="py-2 px-2 text-right text-gray-600">{fmt(l.totalHT)} &euro;</td>
                          <td className="py-2 pl-2 text-right font-semibold text-gray-900">{fmt(l.totalTTC)} &euro;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Aucune ligne de devis.</p>
              )}

              {/* Récapitulatif TVA + totaux */}
              <div className="flex justify-end">
                <div className="w-80 space-y-1 text-sm">
                  {Object.entries(tvaByRate).map(([taux, vals]) => (
                    <div key={taux} className="flex justify-between text-gray-600">
                      <span>TVA {taux} % — Base HT</span>
                      <span>{fmt(vals.ht)} &euro;</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Total HT</span>
                      <span>{fmt(totalHT)} &euro;</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>TVA</span>
                      <span>{fmt(totalTVA)} &euro;</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-300 pt-2">
                      <span>Total TTC</span>
                      <span>{fmt(totalTTC)} &euro;</span>
                    </div>
                  </div>

                  {/* Conditions de paiement */}
                  {dv.pourcentageAcompte && dv.montantAcompte && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 space-y-1">
                      <p className="font-semibold text-gray-700">Conditions de paiement :</p>
                      <p>• {dv.pourcentageAcompte} % soit {fmt(dv.montantAcompte)} &euro; — Acompte</p>
                      <p>• {100 - dv.pourcentageAcompte} % soit {fmt(totalTTC - dv.montantAcompte)} &euro; — Solde</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Conditions annulation */}
              {dv.conditionsAnnulation && (
                <div className="text-xs text-gray-500 border-t border-gray-100 pt-4">
                  <p className="font-semibold text-gray-700 mb-1">Conditions d&apos;annulation :</p>
                  <p>{dv.conditionsAnnulation}</p>
                </div>
              )}

              {/* Bon pour accord */}
              <div className="border-t border-gray-200 pt-6 text-sm text-gray-600">
                <p>Bon pour accord</p>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
