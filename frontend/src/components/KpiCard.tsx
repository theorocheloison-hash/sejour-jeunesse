// Carte KPI unifiée (§4.12) — remplace les copies locales des dashboards
// admin et réseau (markup identique, la variante admin n'utilise pas
// description/onClick). La variante pilotage/ca reste locale (markup différent,
// tooltip InfoTip obligatoire) — voir docs/refacto-helpers-4.12.md.

export default function KpiCard({ label, value, description, accent, onClick }: {
  label: string;
  value: number | string;
  description?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${onClick ? 'cursor-pointer hover:border-[var(--color-primary)] hover:shadow-md transition-all' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
