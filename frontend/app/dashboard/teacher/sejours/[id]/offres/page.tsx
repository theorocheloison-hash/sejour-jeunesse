'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDemandes } from '@/src/lib/demande';
import { getComparatif, updateDevisStatut } from '@/src/lib/devis';
import type { Demande } from '@/src/lib/demande';
import type { Devis, StatutDevis } from '@/src/lib/devis';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';

const STATUT_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE:            { label: 'En attente',            cls: 'bg-orange-100 text-orange-700' },
  ACCEPTE:               { label: 'Accepté',               cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  REFUSE:                { label: 'Refusé',                cls: 'bg-red-100 text-red-700' },
  EN_ATTENTE_VALIDATION: { label: 'Soumis au directeur',   cls: 'bg-blue-100 text-blue-700' },
  SELECTIONNE:           { label: 'Sélectionné',           cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  NON_RETENU:            { label: 'Non retenu',            cls: 'bg-gray-100 text-gray-600' },
};

export default function OffresPage() {
  const params = useParams();
  const router = useRouter();
  const sejourId = params.id as string;
  const { user, isLoading } = useAuth();

  const [demande, setDemande] = useState<Demande | null>(null);
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TEACHER')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    // Find the demande linked to this sejour
    getMesDemandes().then((demandes) => {
      const d = demandes.find((dem) => dem.sejourId === sejourId);
      if (d) {
        setDemande(d);
        getComparatif(d.id).then(setDevisList).catch(() => setError('Impossible de charger les devis.'));
      } else {
        setError('Aucune demande trouvée pour ce séjour.');
      }
    }).catch(() => setError('Erreur de chargement.'));
  }, [user, sejourId]);

  const handleStatut = async (devisId: string, statut: StatutDevis) => {
    setUpdatingId(devisId);
    try {
      await updateDevisStatut(devisId, statut);
      if (demande) {
        const updated = await getComparatif(demande.id);
        setDevisList(updated);
      }
    } catch { /* ignore */ }
    setUpdatingId(null);
  };

  const buildPdfProps = (d: Devis): DevisPDFProps => {
    const ens = d.demande?.enseignant;
    const sejour = d.demande?.sejour;
    const htCalc = Number(d.montantHT) || (d.lignes ?? []).reduce((sum, l) => sum + Number(l.totalHT), 0);
    const ttcCalc = Number(d.montantTTC) || Number(d.montantTotal) || 0;
    const tvaCalc = Number(d.montantTVA) || (ttcCalc - htCalc);
    return {
      typeDocument: 'DEVIS',
      numeroDocument: d.numeroDevis ?? `DEV-${d.id.substring(0, 8).toUpperCase()}`,
      dateDocument: d.createdAt,
      nomEmetteur: d.nomEntreprise ?? d.centre?.nom ?? '',
      adresseEmetteur: d.adresseEntreprise ?? [d.centre?.adresse, d.centre?.codePostal, d.centre?.ville].filter(Boolean).join(', '),
      siretEmetteur: d.siretEntreprise ?? d.centre?.siret ?? undefined,
      emailEmetteur: d.emailEntreprise ?? d.centre?.email ?? undefined,
      telEmetteur: d.telEntreprise ?? d.centre?.telephone ?? undefined,
      tvaEmetteur: d.centre?.tvaIntracommunautaire ?? undefined,
      ibanEmetteur: d.centre?.iban ?? undefined,
      nomDestinataire: ens ? `${ens.prenom} ${ens.nom}` : '',
      etablissementNom: ens?.etablissementNom ?? undefined,
      adresseDestinataire: ens?.etablissementAdresse ?? undefined,
      emailDestinataire: ens?.email ?? undefined,
      telDestinataire: ens?.telephone ?? undefined,
      titreSejour: sejour?.titre ?? d.demande?.titre ?? '',
      lieuSejour: d.demande?.villeHebergement,
      dateDebutSejour: sejour?.dateDebut ?? undefined,
      dateFinSejour: sejour?.dateFin ?? undefined,
      nombreEleves: d.demande?.nombreEleves,
      niveauClasse: sejour?.niveauClasse ?? undefined,
      lignes: (d.lignes ?? []).map(l => ({
        description: l.description,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tva: l.tva,
        totalHT: l.totalHT,
        totalTTC: l.totalTTC,
      })),
      montantHT: htCalc,
      montantTVA: tvaCalc,
      montantTTC: ttcCalc,
      montantAcompte: d.montantAcompte != null ? Number(d.montantAcompte) : undefined,
      pourcentageAcompte: d.pourcentageAcompte ?? undefined,
      conditionsAnnulation: d.conditionsAnnulation ?? undefined,
      dateValidite: new Date(new Date(d.createdAt).getTime() + 30 * 86400000).toISOString(),
    };
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Offres reçues</h1>
        <p className="text-sm text-gray-500 mb-8">Comparez les devis des centres d&apos;hébergement</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {devisList.length === 0 && !error ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Aucun devis reçu pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Centre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ville</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Par élève</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Annulation</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Coordonnées</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {devisList.map((d) => {
                  const badge = STATUT_BADGE[d.statut] ?? STATUT_BADGE.EN_ATTENTE;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDevis(d)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.centre?.nom ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{d.centre?.ville ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{d.montantTotal} €</td>
                      <td className="px-4 py-3 text-right text-gray-600">{d.montantParEleve} €</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{d.description ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{d.conditionsAnnulation ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d.centre?.telephone || d.centre?.email ? (
                          <div className="flex flex-col gap-0.5 text-xs text-gray-600">
                            {d.centre.telephone && (
                              <a href={`tel:${d.centre.telephone}`} className="hover:text-blue-600">
                                📞 {d.centre.telephone}
                              </a>
                            )}
                            {d.centre.email && (
                              <a href={`mailto:${d.centre.email}`} className="hover:text-blue-600">
                                ✉️ {d.centre.email}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Coordonnées non renseignées</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {d.statut === 'EN_ATTENTE' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatut(d.id, 'SELECTIONNE'); }}
                              disabled={updatingId === d.id}
                              className="rounded-lg bg-[var(--color-success)] px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              Sélectionner
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modale détail devis */}
        {selectedDevis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedDevis(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{selectedDevis.centre?.nom ?? 'Devis'}</h2>
                  <p className="text-xs text-gray-500">{selectedDevis.centre?.ville} — {selectedDevis.numeroDevis}</p>
                </div>
                <button onClick={() => setSelectedDevis(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
                {/* Montants */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[var(--color-primary-light)] px-4 py-3">
                    <p className="text-xs text-gray-500">Total TTC</p>
                    <p className="text-xl font-bold text-[var(--color-primary)]">{selectedDevis.montantTTC != null ? Number(selectedDevis.montantTTC).toLocaleString('fr-FR', {minimumFractionDigits:2}) : selectedDevis.montantTotal} &euro;</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-500">Par &eacute;l&egrave;ve</p>
                    <p className="text-xl font-bold text-gray-900">{selectedDevis.montantParEleve} &euro;</p>
                  </div>
                </div>
                {/* Lignes */}
                {selectedDevis.lignes && selectedDevis.lignes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">D&eacute;tail des prestations</p>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[var(--color-primary)] text-white">
                          <th className="text-left px-3 py-2">Description</th>
                          <th className="text-right px-3 py-2">Qt&eacute;</th>
                          <th className="text-right px-3 py-2">PU HT</th>
                          <th className="text-right px-3 py-2">TVA</th>
                          <th className="text-right px-3 py-2">Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDevis.lignes.map((l, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-gray-900">{l.description}</td>
                            <td className="px-3 py-2 text-right">{l.quantite}</td>
                            <td className="px-3 py-2 text-right">{Number(l.prixUnitaire).toLocaleString('fr-FR', {minimumFractionDigits:2})} &euro;</td>
                            <td className="px-3 py-2 text-right">{l.tva} %</td>
                            <td className="px-3 py-2 text-right font-medium">{Number(l.totalHT).toLocaleString('fr-FR', {minimumFractionDigits:2})} &euro;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Acompte */}
                {selectedDevis.pourcentageAcompte != null && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-xs text-gray-500">Acompte demand&eacute; ({selectedDevis.pourcentageAcompte}%)</p>
                    <p className="text-base font-semibold text-amber-700">{Number(selectedDevis.montantAcompte ?? 0).toLocaleString('fr-FR', {minimumFractionDigits:2})} &euro;</p>
                  </div>
                )}
                {/* Conditions annulation */}
                {selectedDevis.conditionsAnnulation && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conditions d&apos;annulation</p>
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">{selectedDevis.conditionsAnnulation}</p>
                  </div>
                )}
                {/* Contact hébergeur */}
                {(selectedDevis.centre?.telephone || selectedDevis.centre?.email) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact h&eacute;bergeur</p>
                    <div className="flex gap-4 text-xs text-gray-600">
                      {selectedDevis.centre?.telephone && <span>{selectedDevis.centre.telephone}</span>}
                      {selectedDevis.centre?.email && <span>{selectedDevis.centre.email}</span>}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
                <DevisPDFButton
                  data={buildPdfProps(selectedDevis)}
                  filename={`devis-${(selectedDevis.numeroDevis ?? selectedDevis.id).substring(0, 8)}.pdf`}
                  label="Télécharger le devis PDF"
                />
                {selectedDevis.statut === 'EN_ATTENTE' && (
                  <button
                    onClick={async () => {
                      await handleStatut(selectedDevis.id, 'SELECTIONNE');
                      setSelectedDevis(null);
                    }}
                    disabled={updatingId === selectedDevis.id}
                    className="flex-1 rounded-lg bg-[var(--color-success)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    S&eacute;lectionner ce devis
                  </button>
                )}
                <button onClick={() => setSelectedDevis(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
