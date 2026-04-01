'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDemandes } from '@/src/lib/demande';
import { getDevisForDemande, updateDevisStatut } from '@/src/lib/devis';
import type { Demande } from '@/src/lib/demande';
import type { Devis, StatutDevis } from '@/src/lib/devis';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';

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

  const buildPdfProps = (dv: Devis): DevisPDFProps => {
    const ens = dv.demande?.enseignant;
    const sejour = dv.demande?.sejour;
    const htCalc = Number(dv.montantHT) || (dv.lignes ?? []).reduce((sum, l) => sum + Number(l.totalHT), 0);
    const ttcCalc = Number(dv.montantTTC) || Number(dv.montantTotal) || 0;
    const tvaCalc = Number(dv.montantTVA) || (ttcCalc - htCalc);
    return {
      typeDocument: 'DEVIS',
      numeroDocument: dv.numeroDevis ?? `DEV-${dv.id.substring(0, 8).toUpperCase()}`,
      dateDocument: dv.createdAt,
      dateValidite: new Date(new Date(dv.createdAt).getTime() + 30 * 86400000).toISOString(),
      nomEmetteur: dv.nomEntreprise ?? dv.centre?.nom ?? '',
      adresseEmetteur: dv.adresseEntreprise ?? [dv.centre?.adresse, dv.centre?.codePostal, dv.centre?.ville].filter(Boolean).join(', '),
      siretEmetteur: dv.siretEntreprise ?? dv.centre?.siret ?? undefined,
      emailEmetteur: dv.emailEntreprise ?? dv.centre?.email ?? undefined,
      telEmetteur: dv.telEntreprise ?? dv.centre?.telephone ?? undefined,
      nomDestinataire: ens ? `${ens.prenom} ${ens.nom}` : '',
      etablissementNom: ens?.etablissementNom ?? undefined,
      adresseDestinataire: ens?.etablissementAdresse ?? undefined,
      emailDestinataire: ens?.email ?? undefined,
      telDestinataire: ens?.telephone ?? undefined,
      titreSejour: sejour?.titre ?? dv.demande?.titre ?? '',
      lieuSejour: dv.demande?.villeHebergement,
      dateDebutSejour: sejour?.dateDebut ?? undefined,
      dateFinSejour: sejour?.dateFin ?? undefined,
      nombreEleves: dv.demande?.nombreEleves,
      niveauClasse: sejour?.niveauClasse ?? undefined,
      lignes: (dv.lignes ?? []).map(l => ({
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
      montantAcompte: dv.montantAcompte != null ? Number(dv.montantAcompte) : undefined,
      pourcentageAcompte: dv.pourcentageAcompte ?? undefined,
      conditionsAnnulation: dv.conditionsAnnulation ?? dv.centre?.conditionsAnnulation ?? undefined,
      signatureDirecteur: dv.signatureDirecteur ?? undefined,
    };
  };

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
                                  <DevisPDFButton
                                    data={buildPdfProps(dv)}
                                    filename={`devis-${dv.numeroDevis ?? dv.id.substring(0, 8)}.pdf`}
                                    label="Voir le détail"
                                  />
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

    </div>
  );
}
