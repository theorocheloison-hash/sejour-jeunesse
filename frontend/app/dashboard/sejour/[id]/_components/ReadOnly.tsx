import React from 'react';

/**
 * Motif réutilisable « lecture seule » pour les onglets d'un séjour.
 *
 * - ReadOnlyBanner : bandeau d'information en tête d'onglet.
 * - ReadOnlyGate  : enveloppe un ou plusieurs contrôles pour porter la bulle
 *   « Lecture seule » au SURVOL + le style grisé. Le grisage/désactivation réel
 *   des contrôles se fait par `disabled` sur chaque contrôle ; ce wrapper apporte
 *   la bulle + le style, pas le mécanisme principal.
 *   Piège : un <button disabled> n'émet pas d'événements hover → le `title` natif
 *   serait invisible. La bulle est donc portée par le <span title> ENVELOPPANT,
 *   qui garde ses pointer-events ; seuls les enfants sont neutralisés.
 */
export function ReadOnlyBanner() {
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
      <span aria-hidden>🔒</span>
      <span>Vous consultez ce séjour en lecture seule.</span>
    </div>
  );
}

export function ReadOnlyGate({ active, label = 'Lecture seule', children }: { active: boolean; label?: string; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <span title={label} className="inline-block opacity-50 cursor-not-allowed [&_*]:pointer-events-none">
      {children}
    </span>
  );
}
