'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getMesSejoursPlanning, getMesNonLus } from '@/src/lib/collaboration';
import type { SejourPlanning, NonLusResponse } from '@/src/lib/collaboration';
import { PLANNING_COULEURS, derivePlanningStatut } from '@/src/lib/planning-statut';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

const STATUT_FILTRES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'OPTION', label: 'Option' },
  { value: 'CONFIRME', label: 'Confirmé' },
  { value: 'ACOMPTE_VERSE', label: 'Acompte versé' },
  { value: 'SOLDE', label: 'Soldé' },
];

const NATURE_FILTRES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'SEJOUR', label: 'Séjours' },
  { value: 'EVENEMENT', label: 'Événements' },
];

export default function HebergeurSejoursPage() {
  const [sejours, setSejours] = useState<SejourPlanning[]>([]);
  const [nonLus, setNonLus] = useState<NonLusResponse>({ total: 0, parSejour: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('ALL');
  const [filtreNature, setFiltreNature] = useState('ALL');

  useEffect(() => {
    Promise.all([
      getMesSejoursPlanning(),
      getMesNonLus(),
    ]).then(([s, nl]) => {
      setSejours(s);
      setNonLus(nl);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Nombre de non-lus par séjour (messages + documents + journal)
  const nonLuMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of nonLus.parSejour) {
      m.set(x.sejourId, x.messages + x.documents + x.journal);
    }
    return m;
  }, [nonLus]);

  const filtered = useMemo(() => {
    let list = sejours;
    if (filtreStatut !== 'ALL') list = list.filter(s => derivePlanningStatut(s) === filtreStatut);
    if (filtreNature !== 'ALL') list = list.filter(s => s.natureSejour === filtreNature);
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.titre.toLowerCase().includes(q) ||
        (s.clientNom ?? '').toLowerCase().includes(q) ||
        (s.clientOrganisation ?? '').toLowerCase().includes(q) ||
        (s.createur?.prenom ?? '').toLowerCase().includes(q) ||
        (s.createur?.nom ?? '').toLowerCase().includes(q)
      );
    }
    // Tri : non-lus en tête, puis séjours à venir (le plus proche en tête), puis passés (le plus récent en tête).
    list = [...list].sort((a, b) => {
      const aNonLu = nonLuMap.get(a.id) ?? 0;
      const bNonLu = nonLuMap.get(b.id) ?? 0;
      // Non-lus d'abord
      if (aNonLu > 0 && bNonLu === 0) return -1;
      if (aNonLu === 0 && bNonLu > 0) return 1;
      // Au sein des non-lus ou des lus : futur d'abord, puis passé
      const now = new Date().toISOString().slice(0, 10);
      const aFuture = (a.dateDebut ?? '') >= now;
      const bFuture = (b.dateDebut ?? '') >= now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      if (aFuture && bFuture) return (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '');
      return (b.dateDebut ?? '').localeCompare(a.dateDebut ?? '');
    });
    return list;
  }, [sejours, filtreStatut, filtreNature, searchQuery, nonLuMap]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Séjours</h1>
        <span className="text-xs text-gray-500">
          {sejours.length} dossier{sejours.length > 1 ? 's' : ''}
          {nonLus.total > 0 ? ` · ${nonLus.total} non lu${nonLus.total > 1 ? 's' : ''}` : ''}
        </span>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Recherche */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher (titre, client, organisateur)..."
          className={`${inputCls} mb-4`}
        />

        {/* Filtres */}
        <div className="flex flex-col gap-2 mb-5">
          <div className="flex flex-wrap gap-1.5">
            {STATUT_FILTRES.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltreStatut(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filtreStatut === f.value ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NATURE_FILTRES.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltreNature(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filtreNature === f.value ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Aucun séjour.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => {
              const statut = derivePlanningStatut(s);
              const couleur = PLANNING_COULEURS[statut];
              const nonLuCount = nonLuMap.get(s.id) ?? 0;
              const dateDebut = s.dateDebut ? new Date(s.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
              const dateFin = s.dateFin ? new Date(s.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
              const isEvenement = s.natureSejour === 'EVENEMENT';
              const clientLabel = s.clientOrganisation ?? s.clientNom ?? (s.createur ? `${s.createur.prenom} ${s.createur.nom}` : '');

              return (
                <Link
                  key={s.id}
                  href={`/dashboard/sejour/${s.id}`}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  {/* Badge non-lu */}
                  {nonLuCount > 0 && (
                    <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-red-500" title={`${nonLuCount} non lu(s)`} />
                  )}

                  {/* Contenu principal */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {isEvenement ? '🎉 ' : ''}{s.titre}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {clientLabel}{clientLabel && dateDebut ? ' · ' : ''}{dateDebut}{dateDebut && dateFin ? ' → ' : ''}{dateFin}
                      {s.placesTotales ? ` · ${s.placesTotales} pers.` : ''}
                    </p>
                  </div>

                  {/* Badge statut */}
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: couleur?.bg, color: couleur?.text }}
                  >
                    {couleur?.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
