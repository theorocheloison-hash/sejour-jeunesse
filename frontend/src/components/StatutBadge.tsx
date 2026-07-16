// Badge de statut unifié (§4.12) — remplace les 4 copies locales
// (organisateur, signataire, réseau ×2). Le mapping statut→couleur→libellé
// reste la donnée du site d'appel : le composant n'en impose aucun.

export interface StatutBadgeEntry {
  label: string;
  cls: string;
}

export default function StatutBadge({
  statut,
  config,
  fallback,
  compact,
}: {
  statut: string;
  config: Record<string, StatutBadgeEntry>;
  /** Entrée utilisée si `statut` est absent de `config`. Défaut : statut brut en gris (comportement DemandeStatutBadge). */
  fallback?: StatutBadgeEntry;
  /** `px-2` (badges réseau) au lieu de `px-2.5`. */
  compact?: boolean;
}) {
  const { label, cls } = config[statut] ?? fallback ?? { label: statut, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full ${compact ? 'px-2' : 'px-2.5'} py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
