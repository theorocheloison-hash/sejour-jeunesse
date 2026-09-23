export type DiagnosticEmail = 'ACADEMIQUE' | 'ACADEMIQUE_MALFORME' | null;

// Délivrabilité : les messageries académiques bloquent souvent nos emails Brevo
// (constat 08/2026). ACADEMIQUE couvre les sous-domaines (edu.ac-lyon.fr) et les
// TLD outre-mer (.nc/.pf/.wf). ACADEMIQUE_MALFORME = domaine qui commence par
// « ac- » sans être académique plausible (cas réel : ac-grenoble.frle.fr).
const ACADEMIQUE_RE = /(^|\.)ac-[a-z]+(-[a-z]+)*\.(fr|nc|pf|wf)$/;

export function diagnostiquerEmail(email: string): DiagnosticEmail {
  const normalise = email.trim().toLowerCase();
  const at = normalise.lastIndexOf('@');
  if (at < 0) return null;
  const domaine = normalise.slice(at + 1);
  if (!domaine) return null;
  if (ACADEMIQUE_RE.test(domaine)) return 'ACADEMIQUE';
  if (domaine.startsWith('ac-')) return 'ACADEMIQUE_MALFORME';
  return null;
}
