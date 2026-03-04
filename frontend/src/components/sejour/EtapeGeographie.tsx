'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { TypeZone } from '@/src/lib/sejour';
import { REGIONS, DEPARTEMENTS } from '@/src/data/thematiques-pedagogiques';
import { Field, inputCls, ZONE_OPTIONS, zoneLabel } from './shared';
import type { SejourFormData } from './shared';

interface Props {
  form: SejourFormData;
  setForm: React.Dispatch<React.SetStateAction<SejourFormData>>;
}

export default function EtapeGeographie({ form, setForm }: Props) {
  const [zoneFilter, setZoneFilter] = useState('');
  const [villeResults, setVilleResults] = useState<string[]>([]);
  const [villeLoading, setVilleLoading] = useState(false);

  const set = (field: keyof SejourFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const filteredItems = useMemo(() => {
    const list = form.typeZone === 'REGION' ? [...REGIONS] : form.typeZone === 'DEPARTEMENT' ? [...DEPARTEMENTS] : [];
    if (!zoneFilter) return list;
    return list.filter((item) => item.toLowerCase().includes(zoneFilter.toLowerCase()));
  }, [form.typeZone, zoneFilter]);

  const searchVilles = useCallback(async (q: string) => {
    if (q.length < 2) { setVilleResults([]); return; }
    setVilleLoading(true);
    try {
      const res = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,departement&boost=population&limit=8`);
      const data = await res.json() as Array<{ nom: string; departement?: { code: string; nom: string } }>;
      setVilleResults(data.map((c) => c.departement ? `${c.nom} (${c.departement.code})` : c.nom));
    } catch {
      setVilleResults([]);
    }
    setVilleLoading(false);
  }, []);

  useEffect(() => {
    if (form.typeZone !== 'VILLE' || !zoneFilter || form.zoneGeographique) return;
    const timer = setTimeout(() => searchVilles(zoneFilter), 300);
    return () => clearTimeout(timer);
  }, [zoneFilter, form.typeZone, form.zoneGeographique, searchVilles]);

  const selectZoneType = (type: TypeZone) => {
    setForm((prev) => ({
      ...prev,
      typeZone: type,
      zoneGeographique: type === 'FRANCE' ? 'France' : '',
    }));
    setZoneFilter('');
    setVilleResults([]);
  };

  const selectZoneValue = (value: string) => {
    setForm((prev) => ({ ...prev, zoneGeographique: value }));
    setZoneFilter('');
    setVilleResults([]);
  };

  const clearZone = () => {
    setForm((prev) => ({ ...prev, zoneGeographique: '', typeZone: '' }));
    setZoneFilter('');
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoneFilter(e.target.value);
    if (form.zoneGeographique) setForm((prev) => ({ ...prev, zoneGeographique: '' }));
  };

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Appel d&apos;offres h&eacute;bergement</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Zone g&eacute;ographique souhait&eacute;e *</label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {ZONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectZoneType(opt.value)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                form.typeZone === opt.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {(form.typeZone === 'REGION' || form.typeZone === 'DEPARTEMENT') && (
          <div className="relative">
            <input
              type="text"
              value={form.zoneGeographique || zoneFilter}
              onChange={handleFilterChange}
              placeholder={form.typeZone === 'REGION' ? 'Tapez pour rechercher une r\u00e9gion\u2026' : 'Tapez pour rechercher un d\u00e9partement\u2026'}
              className={inputCls}
            />
            {zoneFilter && !form.zoneGeographique && filteredItems.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredItems.map((item) => (
                  <button key={item} type="button" onClick={() => selectZoneValue(item)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {form.typeZone === 'VILLE' && (
          <div className="relative">
            <input
              type="text"
              value={form.zoneGeographique || zoneFilter}
              onChange={handleFilterChange}
              placeholder="Tapez le nom d'une ville\u2026"
              className={inputCls}
            />
            {villeLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="h-4 w-4 block animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            )}
            {zoneFilter && !form.zoneGeographique && villeResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {villeResults.map((v) => (
                  <button key={v} type="button" onClick={() => selectZoneValue(v)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {form.zoneGeographique && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
              {zoneLabel(form.typeZone, form.zoneGeographique)}
            </span>
            <button type="button" onClick={clearZone} className="text-xs text-gray-400 hover:text-gray-600">
              Modifier
            </button>
          </div>
        )}
      </div>

      <Field label="Date butoire de r&eacute;ponse des h&eacute;bergements *">
        <input type="date" value={form.dateButoireDevis} onChange={set('dateButoireDevis')} min={new Date().toISOString().split('T')[0]} className={inputCls} required />
      </Field>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
        <p className="text-sm text-blue-700">
          Tous les h&eacute;bergements de la zone s&eacute;lectionn&eacute;e recevront votre demande et pourront y r&eacute;pondre avant cette date.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/dashboard/teacher/hebergements"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Parcourir le catalogue
        </Link>
      </div>
    </div>
  );
}
