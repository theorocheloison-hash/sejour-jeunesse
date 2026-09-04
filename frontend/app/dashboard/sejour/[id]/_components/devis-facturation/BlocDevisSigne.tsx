'use client';

/**
 * Carte verte « ✅ Devis signé » — pur affichage, aucun state.
 * Le scan uploadé ne renseigne pas le nom du signataire : on retombe alors
 * sur « Document signé » + date seule. Partagé DIRECT / COLLABORATIF ;
 * la condition d'affichage reste dans chaque branche du parent.
 */
export interface BlocDevisSigneProps {
  nomSignataire: string | null;
  dateSignature: string | Date | null;
}

export default function BlocDevisSigne({ nomSignataire, dateSignature }: BlocDevisSigneProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-green-800">✅ Devis signé</p>
      <p className="text-xs text-green-700 mt-1">
        {nomSignataire
          ? `Signé par ${nomSignataire}`
          : 'Document signé'}
        {dateSignature && (
          ` le ${new Date(dateSignature).toLocaleDateString('fr-FR')} à ${new Date(dateSignature).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        )}
      </p>
    </div>
  );
}
