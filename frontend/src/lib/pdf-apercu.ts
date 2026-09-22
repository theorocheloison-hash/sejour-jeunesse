/**
 * Fragment du lecteur PDF de Chrome : masque sa barre d'outils dans un <iframe>.
 * Son bouton de telechargement natif ignore le nom de fichier que nous posons
 * (il sort l'identifiant interne du blob ou la cle S3) — on ne laisse donc que
 * nos propres boutons comme chemin de telechargement.
 * ATTENTION : c'est un FRAGMENT — il doit rester en toute fin d'URL, apres les
 * parametres de signature S3. Concatener, ne jamais reconstruire l'URL.
 */
export const PDF_SANS_BARRE = '#toolbar=0';
