import type { TypeZone } from '@/src/lib/sejour';
import { formatDate } from '@/src/lib/utils';

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
  departementsCibles: string[];
  dateButoireDevis: string;
  nombreAccompagnateurs: string;
  heureArrivee: string;
  heureDepart: string;
  transportAller: string;
  transportSurPlace: boolean;
  activitesSouhaitees: string;
  budgetMaxParEleve: string;
  ageMin: string;
  ageMax: string;
  moinsde6ans: boolean;
  typeAccueilACM: string;
  projetEducatif: string;
  datesFlexibles: boolean;
  moisSouhaite: string;      // '1' à '12' ou ''
  anneeSouhaitee: string;    // ex: '2027' ou ''
  noteDateFlexible: string;  // texte libre
  dureeNuits: string;        // ex: '5' ou ''
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
  departementsCibles: [],
  dateButoireDevis: '',
  nombreAccompagnateurs: '',
  heureArrivee: '',
  heureDepart: '',
  transportAller: '',
  transportSurPlace: false,
  activitesSouhaitees: '',
  budgetMaxParEleve: '',
  ageMin: '',
  ageMax: '',
  moinsde6ans: false,
  typeAccueilACM: '',
  projetEducatif: '',
  datesFlexibles: false,
  moisSouhaite: '',
  anneeSouhaitee: '',
  noteDateFlexible: '',
  dureeNuits: '',
};

export const TYPE_ACCUEIL_ACM_OPTIONS: { value: string; label: string }[] = [
  { value: 'SEJOUR_VACANCES',  label: 'Séjour de vacances avec hébergement' },
  { value: 'ALSH',             label: 'Accueil de loisirs sans hébergement' },
  { value: 'SEJOUR_SPORTIF',   label: 'Séjour sportif spécifique' },
  { value: 'SEJOUR_ARTISTIQUE',label: 'Séjour artistique / culturel' },
  { value: 'SCOUTISME',        label: 'Séjour de scoutisme' },
  { value: 'AUTRE',            label: 'Autre' },
];

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

export function buildPeriodeLabel(form: Pick<SejourFormData, 'datesFlexibles' | 'dateDebut' | 'dateFin' | 'moisSouhaite' | 'anneeSouhaitee' | 'noteDateFlexible' | 'dureeNuits'>): string {
  const MOIS = ['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'];
  if (!form.datesFlexibles && form.dateDebut && form.dateFin) {
    return `${formatDate(form.dateDebut, 'long', '\u2014')} \u2192 ${formatDate(form.dateFin, 'long', '\u2014')}`;
  }
  const parts: string[] = [];
  if (form.moisSouhaite) parts.push(MOIS[parseInt(form.moisSouhaite) - 1]);
  if (form.anneeSouhaitee) parts.push(form.anneeSouhaitee);
  if (form.noteDateFlexible) parts.push(form.noteDateFlexible);
  if (form.dureeNuits) parts.push(`~${form.dureeNuits} nuits`);
  return parts.length > 0 ? parts.join(' \u00b7 ') : 'P\u00e9riode \u00e0 d\u00e9finir';
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
