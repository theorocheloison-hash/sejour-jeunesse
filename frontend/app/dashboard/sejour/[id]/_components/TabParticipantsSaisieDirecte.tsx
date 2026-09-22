'use client';

import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/src/lib/collaboration';
import {
  createBatchDirect,
  updateAutorisationFields,
  deleteAutorisation,
  type ParticipantDirectInput,
} from '@/src/lib/autorisation';
import {
  CHAMP_PAR_CLE,
  CLES_BLOC_B,
  type ChampInscription,
} from '@/src/lib/champs-inscription';
import ImportCsvModal from './ImportCsvModal';

/**
 * Grille de saisie directe (Lot 5b) — pilotée par le SNAPSHOT du séjour
 * (sejour.champsInscription, figé à l'ouverture par l'hébergeur) et par la
 * constante CHAMPS_INSCRIPTION (libellés, types, bornes, options, aide).
 * Colonnes : Bloc A fixe à gauche (Nom, Prénom, Naissance), Bloc B configurable
 * au centre (ordre canonique), contact fixe à droite. Plus de champs custom,
 * plus de défaut à 9 colonnes : snapshot null (séjour non ouvert — cas
 * organisateur invité DIRECT) → colonnes fixes seules.
 */

interface Props {
  sejourId: string;
  champsInscription: { champsActifs: string[] } | null;
  participants: Participant[];
  onReload: () => void;
}

// Colonnes DB du Bloc B (ordre canonique) + accès au champ par colonne.
const COLONNES_B = CLES_BLOC_B.map((k) => CHAMP_PAR_CLE[k].colonne);
const COLONNE_VERS_CHAMP: Record<string, ChampInscription> = Object.fromEntries(
  CLES_BLOC_B.map((k) => [CHAMP_PAR_CLE[k].colonne, CHAMP_PAR_CLE[k]]),
);

// Champs scalaires comparés pour la détection de modification :
// Bloc A + toutes les colonnes Bloc B (dont allergies, attestationAquatique) + contact.
const COMPARE_KEYS = [
  'eleveNom', 'elevePrenom', 'eleveDateNaissance',
  ...COLONNES_B,
  'nomParent', 'telephoneUrgence', 'parentEmail',
];

// Rappel d'unité dans les champs numériques vides (lisibilité grille)
const PLACEHOLDER_NUMBER: Record<string, string> = {
  taille: 'cm',
  poids: 'kg',
  pointure: 'pointure',
};

interface Row {
  _localId: string;
  _status: 'existing' | 'new' | 'modified' | 'deleted';
  _original: Record<string, any> | null;
  id?: string;
  eleveNom: string;
  elevePrenom: string;
  parentEmail: string;
  [key: string]: any;
}

const cls = {
  // Champ visible au repos (fond + bordure fine), focus net — partagé par tous
  // les inputs/selects de la grille.
  input:
    'bg-gray-50 border border-gray-200 rounded focus:bg-white focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none w-full px-1 py-0.5 text-sm',
  cell: 'px-2 py-1.5 text-sm border-b border-gray-100',
  th: 'px-2 py-1.5 text-left bg-gray-50 text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-gray-200 whitespace-nowrap',
};

function extractValues(row: Row): Record<string, any> {
  const o: Record<string, any> = {};
  for (const k of COMPARE_KEYS) o[k] = row[k] ?? '';
  return o;
}

function participantToRow(p: Participant): Row {
  const row: Row = {
    _localId: crypto.randomUUID(),
    _status: 'existing',
    _original: null,
    id: p.id,
    eleveNom: p.eleveNom ?? '',
    elevePrenom: p.elevePrenom ?? '',
    eleveDateNaissance: p.eleveDateNaissance ? p.eleveDateNaissance.split('T')[0] : '',
    hebergementCategorie: p.hebergementCategorie ?? '',
    taille: p.taille != null ? String(p.taille) : '',
    poids: p.poids != null ? String(p.poids) : '',
    pointure: p.pointure != null ? String(p.pointure) : '',
    niveauSki: p.niveauSki ?? '',
    attestationAquatique: p.attestationAquatique ?? '',
    regimeAlimentaire: p.regimeAlimentaire ?? '',
    allergies: p.allergies ?? '',
    infosMedicales: p.infosMedicales ?? '',
    nomParent: p.nomParent ?? '',
    telephoneUrgence: p.telephoneUrgence ?? '',
    parentEmail: p.parentEmail ?? '',
  };
  row._original = extractValues(row);
  return row;
}

function emptyRow(): Row {
  const row: Row = {
    _localId: crypto.randomUUID(),
    _status: 'new',
    _original: null,
    eleveNom: '', elevePrenom: '', eleveDateNaissance: '',
    nomParent: '', telephoneUrgence: '', parentEmail: '',
  };
  for (const c of COLONNES_B) row[c] = '';
  return row;
}

function numOrNull(v: any): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function strOrNull(v: any): string | null {
  const s = (v ?? '').toString().trim();
  return s || null;
}

export default function TabParticipantsSaisieDirecte({
  sejourId,
  champsInscription,
  participants,
  onReload,
}: Props) {
  // Bloc B actif : filter sur CLES_BLOC_B → ordre canonique garanti.
  // Snapshot null → aucune colonne Bloc B (fallback sobre, pas de défaut).
  const actifs = champsInscription?.champsActifs ?? [];
  const colonnesB: ChampInscription[] = CLES_BLOC_B
    .filter((k) => actifs.includes(k))
    .map((k) => CHAMP_PAR_CLE[k]);

  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showReadOnly, setShowReadOnly] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  const readOnlyParticipants = participants.filter((p) => p.signeeAt !== null);

  // Sync props → state, sans écraser un travail en cours (cascade 2)
  useEffect(() => {
    const pending = rowsRef.current.some((r) => r._status !== 'existing');
    if (pending) return;
    setRows(participants.filter((p) => p.signeeAt === null).map(participantToRow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  function updateCell(localId: string, field: string, value: any) {
    setBanner(null);
    setRows((prev) =>
      prev.map((r) => {
        if (r._localId !== localId) return r;
        const next: Row = { ...r, [field]: value };
        if (next._status === 'new' || next._status === 'deleted') return next;
        const changed =
          JSON.stringify(extractValues(next)) !== JSON.stringify(next._original);
        next._status = changed ? 'modified' : 'existing';
        return next;
      }),
    );
  }

  function addRow() {
    setBanner(null);
    setRows((prev) => [...prev, emptyRow()]);
  }

  function deleteRow(localId: string) {
    setBanner(null);
    setRows((prev) =>
      prev.flatMap((r) => {
        if (r._localId !== localId) return [r];
        if (r._status === 'new') return []; // pas en base → suppression locale
        return [{ ...r, _status: 'deleted' as const }];
      }),
    );
  }

  function rowToCreateInput(r: Row): ParticipantDirectInput {
    return {
      eleveNom: r.eleveNom.trim(),
      elevePrenom: r.elevePrenom.trim(),
      eleveDateNaissance: r.eleveDateNaissance || null,
      // Le select ne produit que '', FILLE, GARCON, AUTRE → cast sûr
      hebergementCategorie: strOrNull(r.hebergementCategorie) as
        | 'FILLE' | 'GARCON' | 'AUTRE' | null,
      taille: numOrNull(r.taille),
      poids: numOrNull(r.poids),
      pointure: numOrNull(r.pointure),
      niveauSki: strOrNull(r.niveauSki),
      // Les selects envoient null pour l'option vide, jamais ''
      attestationAquatique: strOrNull(r.attestationAquatique),
      regimeAlimentaire: strOrNull(r.regimeAlimentaire),
      allergies: strOrNull(r.allergies),
      infosMedicales: strOrNull(r.infosMedicales),
      nomParent: strOrNull(r.nomParent),
      telephoneUrgence: strOrNull(r.telephoneUrgence),
      parentEmail: strOrNull(r.parentEmail),
    };
  }

  // Conversion vers l'API, pilotée par le type du champ dans la constante
  function apiValue(field: string, raw: any): any {
    if (field === 'eleveNom' || field === 'elevePrenom') return (raw ?? '').toString().trim();
    if (field === 'eleveDateNaissance') return raw || null;
    if (COLONNE_VERS_CHAMP[field]?.type === 'number') return numOrNull(raw);
    return strOrNull(raw);
  }

  // Diff vs _original → uniquement les champs modifiés
  function rowToUpdateDiff(r: Row): Record<string, any> {
    const orig = r._original ?? {};
    const diff: Record<string, any> = {};
    for (const k of COMPARE_KEYS) {
      if (JSON.stringify(r[k] ?? '') !== JSON.stringify(orig[k] ?? '')) {
        diff[k] = apiValue(k, r[k]);
      }
    }
    return diff;
  }

  const toCreate = rows.filter(
    (r) => r._status === 'new' && r.eleveNom.trim() && r.elevePrenom.trim(),
  );
  const toModify = rows.filter((r) => r._status === 'modified' && r.id);
  const toDelete = rows.filter((r) => r._status === 'deleted' && r.id);
  const pendingCount = toCreate.length + toModify.length + toDelete.length;

  async function handleSave() {
    if (
      toDelete.length > 0 &&
      !window.confirm(
        `Supprimer ${toDelete.length} participant(s) ? Ceux affectés à une chambre ou un groupe en seront retirés.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setBanner(null);
    let created = 0;
    let modified = 0;
    let deleted = 0;
    const errors: string[] = [];

    try {
      if (toCreate.length) {
        const res = await createBatchDirect(sejourId, toCreate.map(rowToCreateInput));
        created = res.created;
        if (res.errors?.length) errors.push(...res.errors);
        if (res.skipped) errors.push(`${res.skipped} ignoré(s) (doublon ou incomplet)`);
      }

      const updRes = await Promise.allSettled(
        toModify.map((r) => updateAutorisationFields(r.id!, rowToUpdateDiff(r))),
      );
      updRes.forEach((res, i) => {
        if (res.status === 'fulfilled') modified++;
        else errors.push(`Échec modification ${toModify[i].elevePrenom} ${toModify[i].eleveNom}`);
      });

      const delRes = await Promise.allSettled(
        toDelete.map((r) => deleteAutorisation(r.id!)),
      );
      delRes.forEach((res, i) => {
        if (res.status === 'fulfilled') deleted++;
        else errors.push(`Échec suppression ${toDelete[i].elevePrenom} ${toDelete[i].eleveNom}`);
      });

      const recap = `✓ ${created} créé(s), ${modified} modifié(s), ${deleted} supprimé(s)`;
      if (errors.length) {
        setBanner({ type: 'error', msg: `${recap} — Erreurs : ${errors.join(' ; ')}` });
      } else {
        setBanner({ type: 'success', msg: recap });
        setRows([]); // reset → re-init depuis les props rechargées
      }
      onReload();
    } catch (e: any) {
      setBanner({
        type: 'error',
        msg: e?.response?.data?.message || "Erreur lors de l'enregistrement.",
      });
    } finally {
      setSaving(false);
    }
  }

  const visibleRows = rows.filter((r) => r._status !== 'deleted');

  // Rendu d'une cellule Bloc B, piloté par le type du champ (constante)
  function renderChampCell(row: Row, champ: ChampInscription) {
    const field = champ.colonne;
    const val = row[field] ?? '';
    const onChange = (v: string) => updateCell(row._localId, field, v);
    if (champ.type === 'number') {
      return (
        <input
          type="number"
          min={champ.min}
          max={champ.max}
          className={`${cls.input} w-16`}
          value={val}
          placeholder={PLACEHOLDER_NUMBER[champ.cle]}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    if (champ.type === 'select') {
      // Lot 5c-A — régime alimentaire UNIQUEMENT : « Autre » ouvre un champ
      // « préciser ». Mode Autre détecté par la VALEUR (non vide, hors options
      // canoniques) — aucun état React, la valeur libre vit dans regimeAlimentaire.
      if (champ.cle === 'regimeAlimentaire') {
        const canoniquesHorsAutre = (champ.options ?? [])
          .map((o) => o.value)
          .filter((v) => v !== 'Autre');
        const modeAutre = val !== '' && !canoniquesHorsAutre.includes(val);
        return (
          <div className="flex items-center gap-1">
            <select
              className={`${cls.input} w-full`}
              value={modeAutre ? 'Autre' : val}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">—</option>
              {(champ.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {modeAutre && (
              <input
                type="text"
                className={`${cls.input} w-28`}
                placeholder="préciser"
                value={val === 'Autre' ? '' : val}
                title={val === 'Autre' ? undefined : val}
                onChange={(e) => onChange(e.target.value || 'Autre')}
              />
            )}
          </div>
        );
      }
      return (
        <select
          className={`${cls.input} ${champ.cle === 'sexe' ? 'w-24' : 'w-full'}`}
          value={val}
          onChange={(e) => onChange(e.target.value)}
          title={champ.aide}
        >
          <option value="">—</option>
          {(champ.options ?? [])
            // Attestation : « Non concerné » retiré de la saisie — conservé
            // seulement si c'est la valeur existante de la ligne (affichage).
            .filter(
              (o) =>
                !(
                  champ.cle === 'attestationAquatique' &&
                  o.value === 'NON_CONCERNE' &&
                  val !== 'NON_CONCERNE'
                ),
            )
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      );
    }
    // text — colonne large pour allergies / infosMedicales, texte complet au survol
    const large = champ.cle === 'allergies' || champ.cle === 'infosMedicales';
    return (
      <input
        type="text"
        className={`${cls.input} ${large ? 'min-w-[180px]' : ''}`}
        value={val}
        title={val || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Saisie directe des participants</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Renseignez les participants directement, puis enregistrez en une fois.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            title="Ajoutez plusieurs participants d'un coup. Téléchargez d'abord notre modèle dans la fenêtre, remplissez-le, puis déposez-le — c'est ce qui garantit que toutes vos données soient reconnues."
            className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            📥 Importer des participants
          </button>
          <button
            onClick={handleSave}
            disabled={saving || pendingCount === 0}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {saving ? 'Enregistrement…' : `Enregistrer${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm ${
            banner.type === 'success'
              ? 'bg-[var(--color-success-light)] border border-[var(--color-success)] text-[var(--color-success)]'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {banner.msg}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {/* Bloc A fixe */}
              <th className={`${cls.th} sticky left-0 bg-gray-50 z-10`}>Nom</th>
              <th className={`${cls.th} sticky left-0 bg-gray-50 z-10`}>Prénom</th>
              <th className={cls.th}>Date de naissance</th>
              {/* Bloc B configurable — ordre canonique */}
              {colonnesB.map((champ) => (
                <th key={champ.cle} className={cls.th} title={champ.aide}>
                  {champ.libelle}
                </th>
              ))}
              {/* Contact fixe — saisissable dans la grille (B2) : nom, tél d'urgence, email */}
              <th className={cls.th}>Nom du parent</th>
              <th className={cls.th}>Tél. d'urgence</th>
              <th className={cls.th}>Email parent</th>
              <th className={cls.th} />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  className="px-2 py-4 text-center text-sm text-gray-400"
                  colSpan={3 + colonnesB.length + 3 + 1}
                >
                  Aucun participant. Cliquez sur « + Ajouter une ligne ».
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row._localId} className="hover:bg-gray-50/50">
                  <td className={`${cls.cell} sticky left-0 bg-white`}>
                    <input
                      type="text"
                      className={`${cls.input} font-medium`}
                      value={row.eleveNom}
                      onChange={(e) => updateCell(row._localId, 'eleveNom', e.target.value)}
                      placeholder="Nom"
                    />
                  </td>
                  <td className={`${cls.cell} sticky left-0 bg-white`}>
                    <input
                      type="text"
                      className={`${cls.input} font-medium`}
                      value={row.elevePrenom}
                      onChange={(e) => updateCell(row._localId, 'elevePrenom', e.target.value)}
                      placeholder="Prénom"
                    />
                  </td>
                  <td className={cls.cell}>
                    <input
                      type="date"
                      className={`${cls.input} w-32`}
                      value={row.eleveDateNaissance}
                      onChange={(e) => updateCell(row._localId, 'eleveDateNaissance', e.target.value)}
                    />
                  </td>
                  {colonnesB.map((champ) => (
                    <td key={champ.cle} className={cls.cell}>
                      {renderChampCell(row, champ)}
                    </td>
                  ))}
                  <td className={cls.cell}>
                    <input
                      type="text"
                      className={cls.input}
                      value={row.nomParent}
                      onChange={(e) => updateCell(row._localId, 'nomParent', e.target.value)}
                      placeholder="nom (optionnel)"
                    />
                  </td>
                  <td className={cls.cell}>
                    <input
                      type="tel"
                      className={`${cls.input} w-28`}
                      value={row.telephoneUrgence}
                      onChange={(e) => updateCell(row._localId, 'telephoneUrgence', e.target.value)}
                      placeholder="tél (optionnel)"
                    />
                  </td>
                  <td className={cls.cell}>
                    <input
                      type="text"
                      className={cls.input}
                      value={row.parentEmail}
                      onChange={(e) => updateCell(row._localId, 'parentEmail', e.target.value)}
                      placeholder="email (optionnel)"
                    />
                  </td>
                  <td className={`${cls.cell} text-center`}>
                    <button
                      onClick={() => deleteRow(row._localId)}
                      className="text-gray-400 hover:text-red-500"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="text-sm text-[var(--color-primary)] hover:underline">
        + Ajouter une ligne
      </button>

      {/* Section lecture seule — participants signés */}
      {readOnlyParticipants.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => setShowReadOnly((s) => !s)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            🔒 {readOnlyParticipants.length} participant
            {readOnlyParticipants.length > 1 ? 's' : ''} signé
            {readOnlyParticipants.length > 1 ? 's' : ''} (lecture seule){' '}
            {showReadOnly ? '▲' : '▶'}
          </button>
          {showReadOnly && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 mt-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={cls.th}>Nom</th>
                    <th className={cls.th}>Prénom</th>
                    <th className={cls.th}>Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {readOnlyParticipants.map((p) => (
                    <tr key={p.id}>
                      <td className={cls.cell}>{p.eleveNom}</td>
                      <td className={cls.cell}>{p.elevePrenom}</td>
                      <td className={cls.cell}>
                        {p.signeeAt
                          ? `Signée le ${new Date(p.signeeAt).toLocaleDateString('fr-FR')}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modale d'import CSV (liste complète, modèle vide téléchargeable) */}
      {showImport && (
        <ImportCsvModal
          sejourId={sejourId}
          champsActifs={champsInscription?.champsActifs ?? []}
          nbInscrits={participants.length}
          onImported={onReload}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
