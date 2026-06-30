'use client';

import { useState } from 'react';
import { exportFacturesURL, exportVersementsURL } from '@/src/lib/pilotage';

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  return {
    dateDebut: `${year}-01-01`,
    dateFin: `${year}-12-31`,
  };
}

const inputCls = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export default function PilotageComptabilitePage() {
  const [dates, setDates] = useState(getDefaultDates);

  const shortcuts = [
    { label: 'Année en cours', fn: () => { const y = new Date().getFullYear(); setDates({ dateDebut: `${y}-01-01`, dateFin: `${y}-12-31` }); } },
    { label: 'Trimestre en cours', fn: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const y = now.getFullYear();
      setDates({ dateDebut: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, dateFin: `${y}-${String(q * 3 + 3).padStart(2, '0')}-${q === 0 || q === 3 ? '31' : '30'}` });
    }},
    { label: 'Mois en cours', fn: () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const last = new Date(y, now.getMonth() + 1, 0).getDate();
      setDates({ dateDebut: `${y}-${m}-01`, dateFin: `${y}-${m}-${last}` });
    }},
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Export comptable</h2>
        <p className="text-sm text-gray-500 mb-4">
          Exportez vos factures et versements au format CSV pour votre comptable. Le fichier s'ouvre directement dans Excel.
        </p>
      </div>

      {/* Sélecteur de période */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs text-gray-400 font-medium mb-3">Période</p>
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-gray-600">Du</label>
          <input type="date" value={dates.dateDebut} onChange={e => setDates(d => ({ ...d, dateDebut: e.target.value }))} className={inputCls} />
          <label className="text-sm text-gray-600">au</label>
          <input type="date" value={dates.dateFin} onChange={e => setDates(d => ({ ...d, dateFin: e.target.value }))} className={inputCls} />
        </div>
        <div className="flex gap-2">
          {shortcuts.map(s => (
            <button key={s.label} onClick={s.fn} className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Boutons d'export */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href={exportFacturesURL(dates.dateDebut, dates.dateFin)}
          download
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-[var(--color-primary)]">
            <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Exporter les factures</p>
            <p className="text-xs text-gray-400">CSV — numéro, client, montant, échéance, statut</p>
          </div>
        </a>

        <a
          href={exportVersementsURL(dates.dateDebut, dates.dateFin)}
          download
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-green-600">Exporter les versements</p>
            <p className="text-xs text-gray-400">CSV — date, montant, mode, facture liée, client</p>
          </div>
        </a>
      </div>
    </div>
  );
}
