/**
 * Texte explicatif du justificatif d'identité de structure, adapté par type
 * (société / association / collectivité). Réutilisé partout où un justificatif
 * de revendication est demandé.
 */
export function JustificatifHint({ className = '' }: { className?: string }) {
  return (
    <div className={`text-xs text-gray-500 leading-relaxed ${className}`}>
      <p className="font-medium text-gray-700">Justificatif d&apos;identité de votre structure :</p>
      <ul className="mt-1 space-y-0.5 list-disc pl-4">
        <li>Sociétés (SAS, SARL, SASU…) : extrait Kbis de moins de 3 mois</li>
        <li>Associations : récépissé de déclaration en préfecture ou extrait RNA</li>
        <li>Collectivités : arrêté ou délibération</li>
      </ul>
    </div>
  );
}
