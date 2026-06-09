'use client';

import { useMemo } from 'react';
import { NIVEAUX, THEMATIQUES } from '@/src/data/thematiques-pedagogiques';
import type { Niveau } from '@/src/data/thematiques-pedagogiques';
import { Field, inputCls, TYPE_ACCUEIL_ACM_OPTIONS } from './shared';
import type { SejourFormData } from './shared';

interface Props {
  form: SejourFormData;
  setForm: React.Dispatch<React.SetStateAction<SejourFormData>>;
  estHorsScolaireUser?: boolean;
}

export default function EtapeInfos({ form, setForm, estHorsScolaireUser = false }: Props) {
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

  // Ratio d'encadrement (HORS_SCOLAIRE) : 1 anim. pour 8 (moins de 6 ans) ou 12 (autres)
  const nbParticipants = parseInt(form.nbEleves, 10) || 0;
  const nbAccomp = parseInt(form.nombreAccompagnateurs, 10) || 0;
  const ratioRequis = form.moinsde6ans ? 8 : 12;
  const ratioOK = nbAccomp > 0 && nbParticipants / nbAccomp <= ratioRequis;
  const showRatioAlert = estHorsScolaireUser && !ratioOK && nbParticipants > 0 && nbAccomp > 0;

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Informations g&eacute;n&eacute;rales</h2>

      <Field label="Titre du s&eacute;jour *">
        <input type="text" value={form.titre} onChange={set('titre')} placeholder="Ex : S&eacute;jour d&eacute;couverte des Alpes" className={inputCls} required />
      </Field>

      {!estHorsScolaireUser && (
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
      )}

      {!estHorsScolaireUser && form.niveauClasse && thematiquesDisponibles.length > 0 && (
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

      {estHorsScolaireUser && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tranche d&apos;&acirc;ge des participants *</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={form.ageMin} onChange={set('ageMin')} min={0} max={17} placeholder="&Acirc;ge minimum" className={inputCls} required />
              <input type="number" value={form.ageMax} onChange={set('ageMax')} min={0} max={17} placeholder="&Acirc;ge maximum" className={inputCls} required />
            </div>
          </div>

          <Field label="Type d'accueil ACM *">
            <select value={form.typeAccueilACM} onChange={set('typeAccueilACM')} className={inputCls} required>
              <option value="">S&eacute;lectionnez un type</option>
              {TYPE_ACCUEIL_ACM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>

          <div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.moinsde6ans}
                onChange={(e) => setForm((prev) => ({ ...prev, moinsde6ans: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Pr&eacute;sence d&apos;enfants de moins de 6 ans</span>
            </label>
            {form.moinsde6ans && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Un avis de la PMI (Protection Maternelle et Infantile) est requis pour les moins de 6 ans. Contactez votre SDJES au moins 2 mois avant le s&eacute;jour.
              </div>
            )}
          </div>

          <Field label="Projet &eacute;ducatif *">
            <textarea
              value={form.projetEducatif}
              onChange={set('projetEducatif')}
              rows={3}
              placeholder="D&eacute;crivez les objectifs &eacute;ducatifs et le d&eacute;roulement pr&eacute;vu du s&eacute;jour (requis pour la d&eacute;claration TAM)"
              className={`${inputCls} resize-none`}
              required
            />
          </Field>
        </>
      )}

      <Field label="Informations compl&eacute;mentaires (optionnel)">
        <textarea value={form.informationsComplementaires} onChange={set('informationsComplementaires')} rows={3} placeholder="Pr&eacute;cisez ici tout &eacute;l&eacute;ment sp&eacute;cifique &agrave; votre projet : contraintes particuli&egrave;res, besoins sp&eacute;ciaux, contexte de classe..." className={`${inputCls} resize-none`} />
      </Field>

      {/* ── Informations complémentaires pour l'hébergeur ── */}
      <div className="border-t border-gray-200 pt-5 mt-2">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Informations compl&eacute;mentaires (optionnel)</h2>

        <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
          <input type="checkbox" checked={form.datesFlexibles}
            onChange={e => setForm(p => ({ ...p, datesFlexibles: e.target.checked, dateDebut: '', dateFin: '' }))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">Je n&apos;ai pas encore de dates pr&eacute;cises</span>
        </label>

        {!form.datesFlexibles ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de d&eacute;but *">
              <input type="date" value={form.dateDebut} onChange={set('dateDebut')} className={inputCls} />
            </Field>
            <Field label="Date de fin *">
              <input type="date" value={form.dateFin} min={form.dateDebut} onChange={set('dateFin')} className={inputCls} />
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mois souhait&eacute;">
                <select value={form.moisSouhaite} onChange={set('moisSouhaite')} className={inputCls}>
                  <option value="">-- Mois --</option>
                  {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
                    <option key={i+1} value={String(i+1)}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ann&eacute;e">
                <input type="number" value={form.anneeSouhaitee} onChange={set('anneeSouhaitee')}
                  placeholder="ex: 2027" min="2025" max="2030" className={inputCls} />
              </Field>
            </div>
            <Field label="Pr&eacute;cision (optionnel)">
              <input type="text" value={form.noteDateFlexible} onChange={set('noteDateFlexible')}
                placeholder='ex: "Semaine de Pâques", "début janvier"' className={inputCls} />
            </Field>
            <Field label="Dur&eacute;e estim&eacute;e (nuits)">
              <input type="number" value={form.dureeNuits} onChange={set('dureeNuits')}
                placeholder="ex: 5" min="1" max="30" className={inputCls} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Heure d'arriv&eacute;e souhait&eacute;e">
            <input type="time" value={form.heureArrivee} onChange={set('heureArrivee')} className={inputCls} />
          </Field>
          <Field label="Heure de d&eacute;part souhait&eacute;e">
            <input type="time" value={form.heureDepart} onChange={set('heureDepart')} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label={`${estHorsScolaireUser ? 'Nombre de participants' : 'Nombre d\'élèves'} *`}>
            <input type="number" value={form.nbEleves} onChange={set('nbEleves')} min={1} placeholder="Ex : 25" className={inputCls} required />
          </Field>
          <Field label={estHorsScolaireUser ? 'Nombre d\'animateurs' : 'Nombre d\'accompagnateurs'}>
            <input type="number" value={form.nombreAccompagnateurs} onChange={set('nombreAccompagnateurs')} min={0} placeholder="Ex : 3" className={inputCls} />
          </Field>
        </div>

        {showRatioAlert && (
          <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            Ratio d&apos;encadrement insuffisant : 1 animateur pour {ratioRequis} enfants maximum requis (actuellement 1 pour {Math.ceil(nbParticipants / nbAccomp)}).
          </div>
        )}

        <div className="mt-4">
          <Field label={`Budget max par ${estHorsScolaireUser ? 'participant' : 'élève'} (€)`}>
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
