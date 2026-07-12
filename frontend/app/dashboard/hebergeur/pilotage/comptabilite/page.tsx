'use client';

import { useEffect, useState } from 'react';
import {
  exportFacturesCSV,
  exportVersementsCSV,
  exportFacturesZip,
  getFacturesPdfPreview,
  type FacturesPdfPreview,
} from '@/src/lib/pilotage';

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  return {
    dateDebut: `${year}-01-01`,
    dateFin: `${year}-12-31`,
  };
}

const inputCls = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

function fmtDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

function DownloadIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function PilotageComptabilitePage() {
  const [dates, setDates] = useState(getDefaultDates);

  const [loadingFactures, setLoadingFactures] = useState(false);
  const [erreurFactures, setErreurFactures] = useState<string | null>(null);
  const [loadingVersements, setLoadingVersements] = useState(false);
  const [erreurVersements, setErreurVersements] = useState<string | null>(null);
  const [loadingZip, setLoadingZip] = useState(false);
  const [erreurZip, setErreurZip] = useState<string | null>(null);

  const [preview, setPreview] = useState<FacturesPdfPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!dates.dateDebut || !dates.dateFin) return;
    // Les raccourcis ("Trimestre en cours") changent les 2 dates d'un coup et
    // peuvent enchaîner 2 requêtes : le flag ignore empêche la réponse d'une
    // période abandonnée d'écraser la bonne.
    let ignore = false;
    setPreviewLoading(true);
    getFacturesPdfPreview(dates.dateDebut, dates.dateFin)
      .then(p => { if (!ignore) setPreview(p); })
      .catch(() => { if (!ignore) setPreview(null); })
      .finally(() => { if (!ignore) setPreviewLoading(false); });
    return () => { ignore = true; };
  }, [dates.dateDebut, dates.dateFin]);

  async function lancerExport(
    fn: () => Promise<void>,
    setLoading: (b: boolean) => void,
    setErreur: (m: string | null) => void,
  ) {
    setErreur(null);
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Échec du téléchargement');
    } finally {
      setLoading(false);
    }
  }

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

  const zipDisabled = loadingZip || (preview !== null && preview.avecPdf === 0);

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
        <div>
          <button
            onClick={() => lancerExport(() => exportFacturesCSV(dates.dateDebut, dates.dateFin), setLoadingFactures, setErreurFactures)}
            disabled={loadingFactures}
            className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all group text-left disabled:opacity-60 disabled:cursor-wait"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-[var(--color-primary)] shrink-0">
              {loadingFactures ? <Spinner /> : <DownloadIcon />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Exporter les factures</p>
              <p className="text-xs text-gray-400">CSV — numéro, type (acompte, solde, avoir), client, montant, échéance, statut</p>
            </div>
          </button>
          {erreurFactures && <p className="mt-2 text-xs text-red-600">{erreurFactures}</p>}
        </div>

        <div>
          <button
            onClick={() => lancerExport(() => exportVersementsCSV(dates.dateDebut, dates.dateFin), setLoadingVersements, setErreurVersements)}
            disabled={loadingVersements}
            className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all group text-left disabled:opacity-60 disabled:cursor-wait"
          >
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
              {loadingVersements ? <Spinner /> : <DownloadIcon />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-green-600">Exporter les versements</p>
              <p className="text-xs text-gray-400">CSV — date, montant, mode, facture liée, client</p>
            </div>
          </button>
          {erreurVersements && <p className="mt-2 text-xs text-red-600">{erreurVersements}</p>}
        </div>
      </div>

      {/* Archive ZIP des PDF de factures */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
            <DownloadIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Télécharger les factures (PDF)</p>
            <p className="text-xs text-gray-400">Archive ZIP de tous les PDF de la période, index CSV inclus.</p>
            <p className="text-xs text-gray-500 mt-1">
              {previewLoading
                ? 'Analyse de la période…'
                : preview
                  ? `${preview.total} facture${preview.total > 1 ? 's' : ''} sur la période — ${preview.avecPdf} PDF disponible${preview.avecPdf > 1 ? 's' : ''}`
                  : ' '}
            </p>
          </div>
          <button
            onClick={() => lancerExport(() => exportFacturesZip(dates.dateDebut, dates.dateFin), setLoadingZip, setErreurZip)}
            disabled={zipDisabled}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingZip ? <Spinner size={16} /> : <DownloadIcon size={16} />}
            {loadingZip ? 'Préparation de l\'archive…' : 'Télécharger le ZIP'}
          </button>
        </div>

        {preview !== null && preview.avecPdf === 0 && !previewLoading && (
          <p className="mt-3 text-xs text-gray-500">
            Aucun PDF archivé sur cette période — rien à télécharger.
          </p>
        )}

        {preview !== null && preview.sansPdf.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <p className="font-semibold">
              {preview.sansPdf.length} facture{preview.sansPdf.length > 1 ? 's' : ''} sans PDF archivé :{' '}
              {preview.sansPdf.map(f => `${f.numero} (émise le ${fmtDateFr(f.dateEmission)})`).join(', ')}
            </p>
            <p className="mt-1">Elles seront listées dans un fichier _PDF_MANQUANTS.txt à l'intérieur de l'archive.</p>
          </div>
        )}

        {erreurZip && <p className="mt-3 text-xs text-red-600">{erreurZip}</p>}
      </div>
    </div>
  );
}
