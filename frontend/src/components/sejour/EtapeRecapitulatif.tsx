'use client';

import { Section, Row, formatDate, zoneLabel } from './shared';
import type { SejourFormData } from './shared';

interface Props {
  form: SejourFormData;
}

export default function EtapeRecapitulatif({ form }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">R&eacute;capitulatif</h2>

      <div className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 overflow-hidden text-sm">
        <Section title="Informations g&eacute;n&eacute;rales">
          <Row label="Titre" value={form.titre} />
          <Row label="Date de d&eacute;but" value={formatDate(form.dateDebut)} />
          <Row label="Date de fin" value={formatDate(form.dateFin)} />
          <Row label="Nombre d'&eacute;l&egrave;ves" value={form.nbEleves} />
          <Row label="Niveau de classe" value={form.niveauClasse} />
        </Section>
        <Section title="Th&eacute;matiques p&eacute;dagogiques">
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {form.thematiquesPedagogiques.map((t) => (
              <span key={t} className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {t}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Appel d'offres">
          <Row label="Zone g&eacute;ographique" value={zoneLabel(form.typeZone, form.zoneGeographique)} />
          <Row label="Date butoire" value={formatDate(form.dateButoireDevis)} />
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
