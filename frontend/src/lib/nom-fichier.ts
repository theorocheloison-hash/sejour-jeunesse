/**
 * Nom de fichier de téléchargement d'un document (devis/facture) : le numéro
 * complet, assaini. Le fallback DOC-{id court} ne sert qu'aux documents sans
 * numéro — ne JAMAIS tronquer un numéro (« DEV-2026-0044 » coupé à 8 donnait
 * « DEV-2026 » : tous les devis d'une même année portaient le même nom).
 */
export const nomFichierDocument = (
  numero?: string | null, fallbackId?: string,
) => `${(numero ?? `DOC-${(fallbackId ?? '').substring(0, 8)}`)
       .replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
