'use client';

/** Bloc de chargement commun aux apercus PDF (generation client ou URL signee). */
export default function ChargementPdf({ texte = 'Génération du PDF...' }: { texte?: string }) {
  return (
    <div className="flex justify-center items-center h-48 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        {texte}
      </div>
    </div>
  );
}
