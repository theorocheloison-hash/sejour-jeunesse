/**
 * Encart de réassurance données (RGPD) — statique, aucune logique, aucun fetch.
 * Source unique du texte, réutilisé bloc Inscriptions + page parent.
 */
export default function ReassuranceDonnees() {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
      <svg
        className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
      <p className="text-xs text-gray-600">
        Vos données sont hébergées en France (Paris et Gravelines) et ne quittent jamais le
        territoire. LIAVO est édité par un hébergeur de séjours. Ces informations ne sont
        accessibles qu&apos;à l&apos;hébergeur qui accueille le séjour, à l&apos;enseignant
        organisateur et aux accompagnateurs qu&apos;il autorise.
      </p>
    </div>
  );
}
