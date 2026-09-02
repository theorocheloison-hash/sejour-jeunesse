'use client';

import { useEffect, useState } from 'react';
import { updateSejour } from '@/src/lib/sejour';
import type { SejourCollabInfo, DevisBudget } from '@/src/lib/collaboration';

const STATUTS_DEVIS_SIGNES = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];

/**
 * Prix par élève + date limite d'inscription (extrait de l'ancienne page
 * autorisations, SC4). D12 : le prix PROVISOIRE est calculé et affiché sur le
 * devis même non signé (aligné budget prévisionnel) ; l'ENREGISTREMENT de
 * sejour.prix (qui active le paiement et déclenche le mail aux parents) reste
 * conditionné à la signature du devis.
 */
export default function PrixParEleve({
  sejourId,
  sejour,
  devis,
  nbInscrits,
  onSaved,
}: {
  sejourId: string;
  sejour: SejourCollabInfo;
  devis: DevisBudget | null;
  nbInscrits: number;
  onSaved: () => void;
}) {
  const devisSigne = !!devis && STATUTS_DEVIS_SIGNES.includes(devis.statut);
  const montantTTC = devis ? Number(devis.montantTTC ?? devis.montantTotal ?? 0) : 0;
  const prixEnregistre = Number(sejour.prix ?? 0);

  const [nbElevesDefinitif, setNbElevesDefinitif] = useState('');
  const [prixParEleve, setPrixParEleve] = useState('');
  const [dateLimite, setDateLimite] = useState('');
  const [prixManuel, setPrixManuel] = useState(false);
  const [savingPrix, setSavingPrix] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prixSaved, setPrixSaved] = useState(false);
  const [editingPrix, setEditingPrix] = useState(false);

  // Initialisation depuis les données séjour (prix déjà posé → état enregistré).
  useEffect(() => {
    setNbElevesDefinitif((prev) => prev || String(nbInscrits || sejour.placesTotales || ''));
    if (prixEnregistre > 0) {
      setPrixSaved(true);
      setPrixParEleve((prev) => prev || String(prixEnregistre));
      if (sejour.dateLimiteInscription) {
        setDateLimite((prev) => prev || sejour.dateLimiteInscription!.slice(0, 10));
      }
    }
  }, [prixEnregistre, nbInscrits, sejour.placesTotales, sejour.dateLimiteInscription]);

  // Prix provisoire recalculé quand le nombre d'élèves change (sauf saisie manuelle).
  useEffect(() => {
    if (prixManuel || montantTTC <= 0 || prixSaved) return;
    const nb = parseInt(nbElevesDefinitif, 10);
    if (nb > 0) {
      setPrixParEleve((montantTTC / nb).toFixed(2));
    }
  }, [nbElevesDefinitif, montantTTC, prixManuel, prixSaved]);

  const handleSavePrix = async () => {
    if (!sejourId || !devisSigne) return;
    const prix = parseFloat(prixParEleve);
    if (isNaN(prix) || prix <= 0) return;
    setSavingPrix(true);
    setSaveError(null);
    try {
      await updateSejour(sejourId, {
        prix,
        dateLimiteInscription: dateLimite || undefined,
      });
      setPrixSaved(true);
      setEditingPrix(false);
      onSaved();
    } catch {
      setSaveError('Erreur lors de la sauvegarde du prix.');
    } finally {
      setSavingPrix(false);
    }
  };

  const nbPourEstime = parseInt(nbElevesDefinitif, 10) || nbInscrits;
  const prixEstime = montantTTC > 0 && nbPourEstime > 0
    ? (montantTTC / nbPourEstime).toFixed(2)
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Prix par élève
      </h2>

      {/* Récapitulatif indicatif — calculé sur le devis affiché, même non signé (D12) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
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

      {!devisSigne && (
        <p className="text-xs font-medium text-amber-700 mb-3">
          Prix provisoire — en attente de validation du devis. Vous pourrez l&apos;enregistrer
          et activer le paiement des familles une fois le devis signé.
        </p>
      )}

      <p className="text-xs text-gray-400 mb-5">
        Ce calcul est indicatif — ajustez selon le nombre d&apos;élèves définitif attendu
      </p>

      {saveError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

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
          {!prixSaved && devisSigne && (
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
            disabled={!devisSigne || savingPrix || !prixParEleve || parseFloat(prixParEleve) <= 0}
            title={!devisSigne ? 'Le devis doit être signé pour enregistrer le prix' : undefined}
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
  );
}
