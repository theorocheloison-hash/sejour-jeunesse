import type { TypeZone } from '@/src/lib/sejour';

export interface SejourFormData {
  titre: string;
  dateDebut: string;
  dateFin: string;
  nbEleves: string;
  niveauClasse: string;
  thematiquesPedagogiques: string[];
  informationsComplementaires: string;
  typeZone: TypeZone | '';
  zoneGeographique: string;
  dateButoireDevis: string;
  nombreAccompagnateurs: string;
  heureArrivee: string;
  heureDepart: string;
  transportDemande: boolean;
  activitesSouhaitees: string;
  budgetMaxParEleve: string;
}

export const INITIAL_DATA: SejourFormData = {
  titre: '',
  dateDebut: '',
  dateFin: '',
  nbEleves: '',
  niveauClasse: '',
  thematiquesPedagogiques: [],
  informationsComplementaires: '',
  typeZone: '',
  zoneGeographique: '',
  dateButoireDevis: '',
  nombreAccompagnateurs: '',
  heureArrivee: '',
  heureDepart: '',
  transportDemande: false,
  activitesSouhaitees: '',
  budgetMaxParEleve: '',
};

export const ZONE_OPTIONS: { value: TypeZone; emoji: string; label: string }[] = [
  { value: 'FRANCE',      emoji: '\uD83C\uDDEB\uD83C\uDDF7', label: 'France enti\u00e8re' },
  { value: 'REGION',      emoji: '\uD83D\uDCCD', label: 'R\u00e9gion' },
  { value: 'DEPARTEMENT', emoji: '\uD83C\uDFD9\uFE0F', label: 'D\u00e9partement' },
  { value: 'VILLE',       emoji: '\uD83C\uDFD8\uFE0F', label: 'Ville' },
];

export const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function formatDate(iso: string) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="divide-y divide-gray-200">{children}</div>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right font-medium break-words max-w-xs">{value}</span>
    </div>
  );
}

export function zoneLabel(typeZone: TypeZone | '', zoneGeographique: string) {
  if (!typeZone) return '';
  const opt = ZONE_OPTIONS.find((o) => o.value === typeZone);
  if (typeZone === 'FRANCE') return `${opt?.emoji} France enti\u00e8re`;
  return `${opt?.emoji} ${opt?.label} : ${zoneGeographique}`;
}
