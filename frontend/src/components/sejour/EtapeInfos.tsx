'use client';

import { useMemo } from 'react';
import { NIVEAUX, THEMATIQUES } from '@/src/data/thematiques-pedagogiques';
import type { Niveau } from '@/src/data/thematiques-pedagogiques';
import { Field, inputCls } from './shared';
import type { SejourFormData } from './shared';

interface Props {
  form: SejourFormData;
  setForm: React.Dispatch<React.SetStateAction<SejourFormData>>;
}

export default function EtapeInfos({ form, setForm }: Props) {
  const set = (field: keyof SejourFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const thematiquesDisponibles = useMemo(() => {
    if (!form.niveauClasse) return [];
    return THEMATIQUES[form.niveauClasse as Niveau] ?? [];
  }, [form.niveauClasse]);

  const toggleThematique = (t: string) => {
    setForm((prev) => ({
      ...prev,
      thematiquesPedagogiques: prev.thematiquesPedagogiques.includes(t)
        ? prev.thematiquesPedagogiques.filter((x) => x !== t)
        : [...prev.thematiquesPedagogiques, t],
    }));
  };

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Informations g&eacute;n&eacute;rales</h2>

      <Field label="Titre du s&eacute;jour *">
        <input type="text" value={form.titre} onChange={set('titre')} placeholder="Ex : S&eacute;jour d&eacute;couverte des Alpes" className={inputCls} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de d&eacute;but *">
          <input type="date" value={form.dateDebut} onChange={set('dateDebut')} className={inputCls} required />
        </Field>
        <Field label="Date de fin *">
          <input type="date" value={form.dateFin} min={form.dateDebut} onChange={set('dateFin')} className={inputCls} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre d'&eacute;l&egrave;ves *">
          <input type="number" value={form.nbEleves} onChange={set('nbEleves')} min={1} placeholder="Ex : 25" className={inputCls} required />
        </Field>
        <Field label="Niveau de classe *">
          <select
            value={form.niveauClasse}
            onChange={(e) => setForm((prev) => ({ ...prev, niveauClasse: e.target.value, thematiquesPedagogiques: [] }))}
            className={inputCls}
          >
            <option value="">S&eacute;lectionnez un niveau</option>
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
      </div>

      {form.niveauClasse && thematiquesDisponibles.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Th&eacute;matiques p&eacute;dagogiques * <span className="text-xs font-normal text-gray-400">(min. 1)</span>
          </label>
          <div className="space-y-2">
            {thematiquesDisponibles.map((t) => (
              <label key={t} className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.thematiquesPedagogiques.includes(t)}
                  onChange={() => toggleThematique(t)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Field label="Informations compl&eacute;mentaires (optionnel)">
        <textarea value={form.informationsComplementaires} onChange={set('informationsComplementaires')} rows={3} placeholder="Pr&eacute;cisez ici tout &eacute;l&eacute;ment sp&eacute;cifique &agrave; votre projet : contraintes particuli&egrave;res, besoins sp&eacute;ciaux, contexte de classe..." className={`${inputCls} resize-none`} />
      </Field>
    </div>
  );
}
