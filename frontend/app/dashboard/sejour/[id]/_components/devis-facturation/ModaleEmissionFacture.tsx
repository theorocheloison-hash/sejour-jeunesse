'use client';

import React, { useEffect, useState } from 'react';
import CatalogueSuggestionInput from '@/src/components/CatalogueSuggestionInput';
import { getCatalogue } from '@/src/lib/centre';
import type { ProduitCatalogue } from '@/src/lib/centre';
import { round2, resolvePrixCatalogueTTC, formatMontant } from '@/src/lib/devis-calculs';
import {
  emettreFactureAcompte,
  emettreFactureSolde,
  emettreFactureTotal,
} from '@/src/lib/devis';
import type { Devis, Facture } from '@/src/lib/devis';

type TypeEmission = 'ACOMPTE' | 'TOTAL' | 'SOLDE';

interface LigneEmissionForm {
  description: string;
  quantite: number;
  prixUnitaire: number; // PU TTC saisi (convention builders — le HT est dérivé à l'envoi)
  tva: number;
  produitCatalogueId?: string;
}

interface ModaleEmissionFactureProps {
  type: TypeEmission;
  devis: Devis;
  factures: Facture[];
  onEmitted: () => Promise<void> | void;
  onClose: () => void;
  onError: (message: string) => void;
}

const TITRES: Record<TypeEmission, string> = {
  ACOMPTE: "Facturer l'acompte",
  TOTAL: 'Facturer le total',
  SOLDE: 'Facturer le solde',
};

/**
 * Modèle B « devis figé / facture ajustable » : le devis signé est immuable, c'est
 * ICI que l'hébergeur ajuste les lignes (effectif qui change…) avant d'émettre.
 * La facture snapshotte les lignes révisées ; le devis n'est jamais touché.
 * Éditeur de lignes dupliqué de la modale complémentaire (PU TTC saisi / HT stocké).
 */
export default function ModaleEmissionFacture({
  type,
  devis,
  factures,
  onEmitted,
  onClose,
  onError,
}: ModaleEmissionFactureProps) {
  // Miroir front du backend estIntegralementAnnulee (avoir 1-1 couvrant tout le montant).
  const estIntegralementAnnulee = (f: Facture): boolean =>
    !!f.avoirAssocie &&
    Math.round(Math.abs(f.avoirAssocie.montantFacture) * 100) === Math.round(f.montantFacture * 100);

  // Pré-remplissage : lignes de la facture non-AVOIR la plus récente (active OU
  // annulée — après un avoir plein, on repart de ce qui avait été facturé), sinon
  // les lignes du devis. PU TTC reconstitué depuis totalTTC/quantite (idempotence
  // des arrondis, même convention que openEditComplementaire).
  const [lignes, setLignes] = useState<LigneEmissionForm[]>(() => {
    const derniereFacture = factures
      .filter((f) => f.typeFacture !== 'AVOIR')
      .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())[0] ?? null;
    const source = (derniereFacture?.lignes?.length ? derniereFacture.lignes : devis.lignes) ?? [];
    return source.map((l) => ({
      description: l.description,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.quantite) > 0
        ? round2(Number(l.totalTTC) / Number(l.quantite))
        : round2(Number(l.prixUnitaire) * (1 + Number(l.tva) / 100)),
      tva: Number(l.tva),
      produitCatalogueId: ('produitCatalogueId' in l ? l.produitCatalogueId : undefined) ?? undefined,
    }));
  });

  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalogue().then(setCatalogue).catch(() => {});
  }, []);

  const addLigne = () =>
    setLignes((prev) => [...prev, { description: '', quantite: 1, prixUnitaire: 0, tva: 0 }]);
  const removeLigne = (index: number) =>
    setLignes((prev) => prev.filter((_, i) => i !== index));
  const updateLigne = (index: number, field: 'description' | 'quantite' | 'prixUnitaire' | 'tva', value: string) =>
    setLignes((prev) => prev.map((l, i) => i === index
      ? { ...l, [field]: field === 'description' ? value : Number(value) || 0 }
      : l));
  const selectProduit = (index: number, produit: ProduitCatalogue) =>
    setLignes((prev) => prev.map((l, i) => i === index
      ? {
          ...l,
          description: produit.nom,
          prixUnitaire: resolvePrixCatalogueTTC(produit),
          tva: produit.tva ?? 0,
          produitCatalogueId: produit.id,
        }
      : l));

  // PU saisi TTC → PU HT stocké (convention backend, comme calcCompTotaux).
  const lignesCalculees = lignes.map((l) => {
    const puTTC = l.prixUnitaire;
    const puHT = round2(puTTC / (1 + l.tva / 100));
    const totalTTC = round2(puTTC * l.quantite);
    const totalHT = round2(puHT * l.quantite);
    return { ...l, prixUnitaire: puHT, totalHT, totalTTC };
  });
  const ttcRevise = round2(lignesCalculees.reduce((s, l) => s + l.totalTTC, 0));

  // ── Récapitulatif par type ──
  const pourcentageAcompte = Number(devis.pourcentageAcompte ?? 30);
  const montantAcompteEstime = round2(ttcRevise * pourcentageAcompte / 100);

  // SOLDE : acompte actif le plus récent + avoir éventuel (miroir de la garde backend).
  const factureAcompte = factures
    .filter((f) => f.typeFacture === 'ACOMPTE' && !estIntegralementAnnulee(f))
    .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())[0] ?? null;
  const avoirSurAcompte = factures.find(
    (f) => f.typeFacture === 'AVOIR' && f.factureAnnuleeId === factureAcompte?.id,
  ) ?? null;
  const encaisseBrut = factureAcompte
    ? Math.max(factureAcompte.montantVerseTotal ?? 0, factureAcompte.montantFacture)
    : 0;
  // avoir.montantFacture est négatif → réduit l'encaissé net.
  const encaisseNet = round2(encaisseBrut + (avoirSurAcompte?.montantFacture ?? 0));
  const soldeEstime = round2(Math.max(0, ttcRevise - encaisseNet));
  // Le backend refuse un solde si TTC ≤ acompte encaissé BRUT sans avoir sur l'acompte.
  const soldeBloque = type === 'SOLDE' && !!factureAcompte && ttcRevise <= encaisseBrut && !avoirSurAcompte;

  const lignesVides = lignesCalculees.length === 0 || lignesCalculees.every((l) => l.totalTTC === 0);

  const handleSubmit = async () => {
    if (lignesVides) {
      setError('Ajoutez au moins une ligne avec un montant');
      return;
    }
    const lignesApi = lignesCalculees.map((l) => ({
      description: l.description,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      tva: l.tva,
      totalHT: l.totalHT,
      totalTTC: l.totalTTC,
    }));
    setSending(true);
    setError(null);
    try {
      if (type === 'ACOMPTE') await emettreFactureAcompte(devis.id, lignesApi);
      else if (type === 'SOLDE') await emettreFactureSolde(devis.id, lignesApi);
      else await emettreFactureTotal(devis.id, lignesApi);
      await onEmitted();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Erreur lors de l'émission de la facture";
      setError(msg);
      onError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">{TITRES[type]}</h2>
        <p className="text-xs text-gray-400 mb-4">
          Ajustez les lignes si besoin (effectif, prestations…) — le devis signé reste inchangé,
          la facture fera foi.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {/* Lignes */}
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 font-medium">Description</th>
              <th className="py-1 font-medium w-16 text-right">Qté</th>
              <th className="py-1 font-medium w-24 text-right">PU TTC</th>
              <th className="py-1 font-medium w-16 text-right">TVA %</th>
              <th className="py-1 font-medium w-24 text-right">Total TTC</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lignesCalculees.map((l, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <CatalogueSuggestionInput
                    value={lignes[i].description}
                    onChange={(v) => updateLigne(i, 'description', v)}
                    catalogue={catalogue}
                    onSelect={(p) => selectProduit(i, p)}
                    placeholder="ex: Pension complète"
                    className="w-full rounded border border-gray-300 px-2 py-1"
                  />
                </td>
                <td className="py-1">
                  <input type="number" min={0} value={lignes[i].quantite} onChange={(e) => updateLigne(i, 'quantite', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                </td>
                <td className="py-1">
                  <input type="number" min={0} step="0.01" value={lignes[i].prixUnitaire} onChange={(e) => updateLigne(i, 'prixUnitaire', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                </td>
                <td className="py-1">
                  <input type="number" min={0} step="0.1" value={lignes[i].tva} onChange={(e) => updateLigne(i, 'tva', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                </td>
                <td className="py-1 text-right font-medium">{formatMontant(l.totalTTC)} €</td>
                <td className="py-1 text-center">
                  {lignes.length > 1 && (
                    <button onClick={() => removeLigne(i)} className="text-red-400 hover:text-red-600" title="Supprimer">×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={addLigne}
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ajouter une ligne
        </button>

        {/* Récapitulatif */}
        <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between font-bold">
            <span>Total TTC révisé</span>
            <span className="text-[var(--color-primary)]">{formatMontant(ttcRevise)} €</span>
          </div>
          {type === 'ACOMPTE' && (
            <div className="flex justify-between text-amber-700">
              <span>Montant de la facture d&apos;acompte</span>
              <span className="font-semibold">{formatMontant(montantAcompteEstime)} € ({pourcentageAcompte} %)</span>
            </div>
          )}
          {type === 'SOLDE' && factureAcompte && (
            <div className="flex justify-between text-gray-600">
              <span>Déjà encaissé : {formatMontant(encaisseNet)} €</span>
              <span className="font-semibold text-gray-900">
                Solde : {formatMontant(soldeEstime)} € <span className="font-normal text-gray-400">(estimation, calcul final à l&apos;émission)</span>
              </span>
            </div>
          )}
        </div>

        {soldeBloque && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            Le total révisé est inférieur ou égal à l&apos;acompte encaissé.
            Émettez d&apos;abord un avoir sur la facture d&apos;acompte.
          </p>
        )}

        <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          ⚖️ Après émission, cette facture ne pourra plus être modifiée (art. 289 du CGI).
          Toute correction passera par un avoir.
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={sending || lignesVides || soldeBloque}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {sending ? 'Émission…' : `📄 ${TITRES[type]}`}
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
