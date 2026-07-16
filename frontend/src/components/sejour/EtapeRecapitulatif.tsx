'use client';

import { Section, Row, zoneLabel, buildPeriodeLabel, TYPE_ACCUEIL_ACM_OPTIONS } from './shared';
import { formatDate } from '@/src/lib/utils';
import type { SejourFormData } from './shared';

interface Props {
  form: SejourFormData;
  estHorsScolaireUser?: boolean;
}

export default function EtapeRecapitulatif({ form, estHorsScolaireUser = false }: Props) {
  const typeAccueilLabel = TYPE_ACCUEIL_ACM_OPTIONS.find((o) => o.value === form.typeAccueilACM)?.label ?? form.typeAccueilACM;
  const projetTronque = form.projetEducatif.length > 100
    ? `${form.projetEducatif.slice(0, 100)}…`
    : form.projetEducatif;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">R&eacute;capitulatif</h2>

      <div className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 overflow-hidden text-sm">
        <Section title="Informations g&eacute;n&eacute;rales">
          <Row label="Titre" value={form.titre} />
          <Row label="Dates / P&eacute;riode" value={buildPeriodeLabel(form)} />
          <Row label={estHorsScolaireUser ? 'Nombre de participants' : 'Nombre d\'élèves'} value={form.nbEleves} />
          {estHorsScolaireUser ? (
            <>
              <Row label="Tranche d'&acirc;ge" value={form.ageMin && form.ageMax ? `${form.ageMin}-${form.ageMax} ans` : '—'} />
              <Row label="Type d'accueil ACM" value={typeAccueilLabel || '—'} />
              <Row label="Moins de 6 ans" value={form.moinsde6ans ? 'Oui' : 'Non'} />
              {form.projetEducatif && <Row label="Projet &eacute;ducatif" value={projetTronque} />}
            </>
          ) : (
            <Row label="Niveau de classe" value={form.niveauClasse} />
          )}
        </Section>
        {!estHorsScolaireUser && (
          <Section title="Th&eacute;matiques p&eacute;dagogiques">
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {form.thematiquesPedagogiques.map((t) => (
                <span key={t} className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}
        <Section title="Appel d'offres">
          <Row label="Zone g&eacute;ographique" value={
            form.departementsCibles.length
              ? `Département(s) ${form.departementsCibles.join(', ')}`
              : zoneLabel(form.typeZone, form.zoneGeographique)
          } />
          <Row label="Date butoire" value={formatDate(form.dateButoireDevis, 'long', '—')} />
        </Section>
        {form.informationsComplementaires && (
          <Section title="Informations compl&eacute;mentaires">
            <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-line">{form.informationsComplementaires}</div>
          </Section>
        )}
      </div>
    </div>
  );
}
