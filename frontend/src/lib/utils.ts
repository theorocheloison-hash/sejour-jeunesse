/**
 * Formate un nombre de participants en distinguant élèves et accompagnateurs.
 *
 * `placesTotales` stocke l'effectif ÉLÈVES uniquement ; les accompagnateurs sont
 * comptés séparément (`nombreAccompagnateurs`). Le total réel = élèves + accompagnateurs.
 *
 * - accompagnateurs > 0 : « 45 participants (40 élèves + 5 accompagnateurs) »
 * - accompagnateurs 0/null : « 40 participants »
 */
export function formatParticipants(
  placesTotales: number,
  nombreAccompagnateurs?: number | null,
): string {
  const eleves = placesTotales ?? 0;
  const accompagnateurs = nombreAccompagnateurs ?? 0;
  if (accompagnateurs > 0) {
    const total = eleves + accompagnateurs;
    return `${total} participants (${eleves} élèves + ${accompagnateurs} accompagnateurs)`;
  }
  return `${eleves} participant${eleves > 1 ? 's' : ''}`;
}

/**
 * Formatage de date fr-FR unifié (§4.12) — remplace les ~25 redéfinitions locales.
 *
 * Styles (recensés dans docs/refacto-helpers-4.12.md) :
 * - 'numeric'       → « 05/06/2026 » (défaut fr-FR)
 * - 'court'         → « 05 juin 2026 » (mois abrégé)
 * - 'long'          → « 05 juin 2026 » (mois en toutes lettres)
 * - 'jourMoisCourt' → « 05 juin » (sans année)
 */
export type FormatDateStyle = 'numeric' | 'court' | 'long' | 'jourMoisCourt';

const DATE_FORMATS: Record<FormatDateStyle, Intl.DateTimeFormatOptions | undefined> = {
  numeric: undefined,
  court: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: '2-digit', month: 'long', year: 'numeric' },
  jourMoisCourt: { day: '2-digit', month: 'short' },
};

/**
 * `style` est volontairement obligatoire : chaque site d'appel déclare le
 * format qui reproduit son comportement d'origine (aucun défaut imposé).
 * `fallback` omis = pas de garde null : les sites d'origine sans garde
 * conservent le comportement natif de `new Date()` à l'identique.
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: FormatDateStyle,
  fallback?: string,
): string {
  if (fallback !== undefined && !date) return fallback;
  return new Date(date as string | Date).toLocaleDateString('fr-FR', DATE_FORMATS[style]);
}

/**
 * Date relative (« à l'instant », « il y a N min/h/jours », « hier »), avec
 * chute sur « 5 juin » (ou « 5 juin 2026 » si `avecAnnee`) au-delà de 7 jours.
 */
export function formatDateRelative(iso: string, opts?: { avecAnnee?: boolean }): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return d.toLocaleDateString(
    'fr-FR',
    opts?.avecAnnee
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  );
}

/**
 * Libellé de dates d'une demande : plage ferme « JJ/MM/AAAA → JJ/MM/AAAA » ou
 * dates flexibles « 📅 Mois · Année · note · ~Nn ». Copie unifiée des pages
 * demandes organisateur/hébergeur (byte-identiques avant §4.12).
 */
export const afficherDatesDemande = (d: { dateDebut?: string | null, dateFin?: string | null, moisSouhaite?: number | null, anneeSouhaitee?: number | null, noteDateFlexible?: string | null, dureeNuits?: number | null }) => {
  const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  if (d.dateDebut && d.dateFin) return `${new Date(d.dateDebut).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})} → ${new Date(d.dateFin).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}`;
  const parts: string[] = [];
  if (d.moisSouhaite) parts.push(MOIS[d.moisSouhaite-1]);
  if (d.anneeSouhaitee) parts.push(String(d.anneeSouhaitee));
  if (d.noteDateFlexible) parts.push(d.noteDateFlexible);
  if (d.dureeNuits) parts.push(`~${d.dureeNuits}n`);
  return parts.length > 0 ? '📅 ' + parts.join(' · ') : 'Dates à définir';
};
