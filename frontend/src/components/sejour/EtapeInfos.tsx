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

      {/* ── Informations complémentaires pour l'hébergeur ── */}
      <div className="border-t border-gray-200 pt-5 mt-2">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Informations compl&eacute;mentaires (optionnel)</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date d'arriv&eacute;e *">
            <input type="date" value={form.dateDebut} onChange={set('dateDebut')} className={inputCls} required />
          </Field>
          <Field label="Heure d'arriv&eacute;e souhait&eacute;e">
            <input type="time" value={form.heureArrivee} onChange={set('heureArrivee')} className={inputCls} />
          </Field>
          <Field label="Date de d&eacute;part *">
            <input type="date" value={form.dateFin} min={form.dateDebut} onChange={set('dateFin')} className={inputCls} required />
          </Field>
          <Field label="Heure de d&eacute;part souhait&eacute;e">
            <input type="time" value={form.heureDepart} onChange={set('heureDepart')} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Nombre d'&eacute;l&egrave;ves *">
            <input type="number" value={form.nbEleves} onChange={set('nbEleves')} min={1} placeholder="Ex : 25" className={inputCls} required />
          </Field>
          <Field label="Nombre d'accompagnateurs">
            <input type="number" value={form.nombreAccompagnateurs} onChange={set('nombreAccompagnateurs')} min={0} placeholder="Ex : 3" className={inputCls} />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Budget max par &eacute;l&egrave;ve (&euro;)">
            <input type="number" value={form.budgetMaxParEleve} onChange={set('budgetMaxParEleve')} min={0} step="0.01" placeholder="Ex : 350" className={inputCls} />
          </Field>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transport aller-retour &eacute;tablissement &harr; h&eacute;bergement
          </label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="transportAller"
                value="DEJA_TRANSPORTEUR"
                checked={form.transportAller === 'DEJA_TRANSPORTEUR'}
                onChange={() => setForm(prev => ({ ...prev, transportAller: 'DEJA_TRANSPORTEUR' }))}
                className="mt-0.5 h-4 w-4 border-gray-300 text-indigo-600"
              />
              <span className="text-sm text-gray-700">J&apos;ai d&eacute;j&agrave; un transporteur</span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="transportAller"
                value="BESOIN_TRANSPORTEUR"
                checked={form.transportAller === 'BESOIN_TRANSPORTEUR'}
                onChange={() => setForm(prev => ({ ...prev, transportAller: 'BESOIN_TRANSPORTEUR' }))}
                className="mt-0.5 h-4 w-4 border-gray-300 text-indigo-600"
              />
              <span className="text-sm text-gray-700">
                J&apos;ai besoin d&apos;un transporteur
                <span className="ml-1 text-xs text-gray-400">(l&apos;h&eacute;bergeur pourra l&apos;inclure dans le devis)</span>
              </span>
            </label>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transport sur place
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transportSurPlace"
                checked={form.transportSurPlace === true}
                onChange={() => setForm(prev => ({ ...prev, transportSurPlace: true }))}
                className="h-4 w-4 border-gray-300 text-indigo-600"
              />
              <span className="text-sm text-gray-700">Oui, je suis autonome</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transportSurPlace"
                checked={form.transportSurPlace === false}
                onChange={() => setForm(prev => ({ ...prev, transportSurPlace: false }))}
                className="h-4 w-4 border-gray-300 text-indigo-600"
              />
              <span className="text-sm text-gray-700">Non</span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <Field label="Activit&eacute;s souhait&eacute;es">
            <textarea value={form.activitesSouhaitees} onChange={set('activitesSouhaitees')} rows={2} placeholder="Ex : ski alpin, raquettes, ESF..." className={`${inputCls} resize-none`} />
          </Field>
        </div>
      </div>
    </div>
  );
}
