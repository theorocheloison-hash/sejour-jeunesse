'use client';

import SecureFileLink from '@/src/components/SecureFileLink';

/**
 * Carte verte « ✅ Devis signé » — pur affichage, aucun state.
 * Le scan uploadé ne renseigne pas le nom du signataire : on retombe alors
 * sur « Document signé » + date seule. Partagé DIRECT / COLLABORATIF ;
 * la condition d'affichage reste dans chaque branche du parent.
 * `signatureDocumentUrl` (optionnel) affiche le lien vers le scan signé —
 * sans la prop, rendu strictement identique.
 */
export interface BlocDevisSigneProps {
  nomSignataire: string | null;
  dateSignature: string | Date | null;
  signatureDocumentUrl?: string | null;
}

export default function BlocDevisSigne({ nomSignataire, dateSignature, signatureDocumentUrl }: BlocDevisSigneProps) {
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
      {signatureDocumentUrl && (
        <SecureFileLink
          url={signatureDocumentUrl}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50"
        >
          Voir le document signé
        </SecureFileLink>
      )}
    </div>
  );
}
