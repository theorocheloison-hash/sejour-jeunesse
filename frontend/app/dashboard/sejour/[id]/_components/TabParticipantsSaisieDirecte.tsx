'use client';

import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/src/lib/collaboration';
import {
  createBatchDirect,
  updateAutorisationFields,
  deleteAutorisation,
  type ParticipantDirectInput,
} from '@/src/lib/autorisation';

type ChampType = 'text' | 'number' | 'select';
interface ChampCustom {
  nom: string;
  type: ChampType;
  obligatoire: boolean;
  options?: string[];
}
interface ChampsInscription {
  champsActifs: string[];
  champsCustom: ChampCustom[];
}

interface Props {
  sejourId: string;
  champsInscription: ChampsInscription | null;
  participants: Participant[];
  onReload: () => void;
}

const DEFAULT_CHAMPS_ACTIFS = [
  'taille', 'poids', 'pointure', 'niveauSki', 'regimeAlimentaire',
  'eleveDateNaissance', 'nomParent', 'telephoneUrgence', 'infosMedicales',
];

const LABELS: Record<string, string> = {
  taille: 'Taille', poids: 'Poids', pointure: 'Pointure',
  niveauSki: 'Ski', regimeAlimentaire: 'Régime',
  eleveDateNaissance: 'Naissance', nomParent: 'Parent',
  telephoneUrgence: 'Tél. urgence', infosMedicales: 'Médical',
};

const NUMBER_FIELDS = new Set(['taille', 'poids', 'pointure']);
const DATE_FIELDS = new Set(['eleveDateNaissance']);

// Champs scalaires comparés pour la détection de modification
const COMPARE_KEYS = [
  'eleveNom', 'elevePrenom', 'parentEmail', 'hebergementCategorie',
  'taille', 'poids', 'pointure', 'niveauSki', 'regimeAlimentaire',
  'eleveDateNaissance', 'nomParent', 'telephoneUrgence', 'infosMedicales',
];

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
  input:
    'border-0 bg-transparent focus:bg-blue-50 focus:outline-none w-full px-1 py-0.5 text-sm',
  cell: 'px-2 py-1.5 text-sm border-b border-gray-100',
  th: 'px-2 py-1.5 text-left bg-gray-50 text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-gray-200 whitespace-nowrap',
};

function extractValues(row: Row): Record<string, any> {
  const o: Record<string, any> = {};
  for (const k of COMPARE_KEYS) o[k] = row[k] ?? '';
  o.champsPersonnalises = row.champsPersonnalises ?? {};
  return o;
}

function participantToRow(p: Participant): Row {
  const custom = p.champsPersonnalises ?? {};
  const row: Row = {
    _localId: crypto.randomUUID(),
    _status: 'existing',
    _original: null,
    id: p.id,
    eleveNom: p.eleveNom ?? '',
    elevePrenom: p.elevePrenom ?? '',
    parentEmail: p.parentEmail ?? '',
    hebergementCategorie: p.hebergementCategorie ?? '',
    taille: p.taille != null ? String(p.taille) : '',
    poids: p.poids != null ? String(p.poids) : '',
    pointure: p.pointure != null ? String(p.pointure) : '',
    niveauSki: p.niveauSki ?? '',
    regimeAlimentaire: p.regimeAlimentaire ?? '',
    eleveDateNaissance: p.eleveDateNaissance ? p.eleveDateNaissance.split('T')[0] : '',
    nomParent: p.nomParent ?? '',
    telephoneUrgence: p.telephoneUrgence ?? '',
    infosMedicales: p.infosMedicales ?? '',
    champsPersonnalises: Object.fromEntries(
      Object.entries(custom as Record<string, unknown>).map(([k, v]) => [
        k,
        v == null ? '' : String(v),
      ]),
    ),
  };
  row._original = extractValues(row);
  return row;
}

function emptyRow(): Row {
  return {
    _localId: crypto.randomUUID(),
    _status: 'new',
    _original: null,
    eleveNom: '', elevePrenom: '', parentEmail: '', hebergementCategorie: '',
    taille: '', poids: '', pointure: '', niveauSki: '', regimeAlimentaire: '',
    eleveDateNaissance: '', nomParent: '', telephoneUrgence: '', infosMedicales: '',
    champsPersonnalises: {},
  };
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
  const champsActifs = champsInscription?.champsActifs ?? DEFAULT_CHAMPS_ACTIFS;
  const champsCustom = champsInscription?.champsCustom ?? [];

  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showReadOnly, setShowReadOnly] = useState(false);

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

  function updateCell(localId: string, field: string, value: any, isCustom = false) {
    setBanner(null);
    setRows((prev) =>
      prev.map((r) => {
        if (r._localId !== localId) return r;
        const next: Row = isCustom
          ? { ...r, champsPersonnalises: { ...(r.champsPersonnalises ?? {}), [field]: value } }
          : { ...r, [field]: value };
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
    const custom: Record<string, any> = {};
    for (const c of champsCustom) {
      const v = r.champsPersonnalises?.[c.nom];
      if (v !== undefined && v !== '') custom[c.nom] = v;
    }
    return {
      eleveNom: r.eleveNom.trim(),
      elevePrenom: r.elevePrenom.trim(),
      parentEmail: strOrNull(r.parentEmail),
      // Le select ne produit que '', FILLE, GARCON, AUTRE → cast sûr
      hebergementCategorie: strOrNull(r.hebergementCategorie) as
        | 'FILLE' | 'GARCON' | 'AUTRE' | null,
      taille: numOrNull(r.taille),
      poids: numOrNull(r.poids),
      pointure: numOrNull(r.pointure),
      niveauSki: strOrNull(r.niveauSki),
      regimeAlimentaire: strOrNull(r.regimeAlimentaire),
      eleveDateNaissance: r.eleveDateNaissance || null,
      nomParent: strOrNull(r.nomParent),
      telephoneUrgence: strOrNull(r.telephoneUrgence),
      infosMedicales: strOrNull(r.infosMedicales),
      champsPersonnalises: Object.keys(custom).length ? custom : null,
    };
  }

  function apiValue(field: string, raw: any): any {
    if (NUMBER_FIELDS.has(field)) return numOrNull(raw);
    if (DATE_FIELDS.has(field)) return raw || null;
    if (field === 'eleveNom' || field === 'elevePrenom') return (raw ?? '').toString().trim();
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
    if (
      JSON.stringify(r.champsPersonnalises ?? {}) !==
      JSON.stringify(orig.champsPersonnalises ?? {})
    ) {
      diff.champsPersonnalises = r.champsPersonnalises ?? {};
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

  // Export CSV — lecture pure des props (TOUS les participants, signés inclus)
  function handleExport() {
    const columns: { key: string; label: string }[] = [
      { key: 'eleveNom', label: 'Nom' },
      { key: 'elevePrenom', label: 'Prénom' },
      ...champsActifs.map((f) => ({ key: f, label: LABELS[f] ?? f })),
      ...champsCustom.map((c) => ({ key: `custom:${c.nom}`, label: c.nom })),
      { key: 'parentEmail', label: 'Email parent' },
    ];
    const headerLine = columns.map((c) => c.label).join(';');
    const dataLines = participants.map((p) =>
      columns
        .map((c) => {
          let val = '';
          if (c.key === 'eleveNom') val = p.eleveNom;
          else if (c.key === 'elevePrenom') val = p.elevePrenom;
          else if (c.key === 'parentEmail') val = p.parentEmail ?? '';
          else if (c.key === 'eleveDateNaissance') {
            val = p.eleveDateNaissance
              ? new Date(p.eleveDateNaissance).toLocaleDateString('fr-FR')
              : '';
          } else if (c.key.startsWith('custom:')) {
            const raw = p.champsPersonnalises?.[c.key.replace('custom:', '')];
            val = raw == null ? '' : String(raw);
          } else {
            const raw = (p as any)[c.key];
            val = raw == null ? '' : String(raw);
          }
          if (val.includes(';') || val.includes('"') || val.includes('\n')) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        })
        .join(';'),
    );
    const csv = [headerLine, ...dataLines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleRows = rows.filter((r) => r._status !== 'deleted');

  function renderStandardCell(row: Row, field: string) {
    const val = row[field] ?? '';
    const onChange = (v: string) => updateCell(row._localId, field, v);
    if (NUMBER_FIELDS.has(field)) {
      return (
        <input
          type="number"
          className={`${cls.input} w-16`}
          value={val}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    if (DATE_FIELDS.has(field)) {
      return (
        <input
          type="date"
          className={`${cls.input} w-32`}
          value={val}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    return (
      <input
        type="text"
        className={cls.input}
        value={val}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  function renderCustomCell(row: Row, champ: ChampCustom) {
    const val = row.champsPersonnalises?.[champ.nom] ?? '';
    const onChange = (v: string) => updateCell(row._localId, champ.nom, v, true);
    if (champ.type === 'select') {
      return (
        <select
          className={`${cls.input} w-full`}
          value={val}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {(champ.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={champ.type === 'number' ? 'number' : 'text'}
        className={`${cls.input} ${champ.type === 'number' ? 'w-16' : ''}`}
        value={val}
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
            onClick={handleExport}
            disabled={participants.length === 0}
            className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 Exporter CSV
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
              <th className={`${cls.th} sticky left-0 bg-gray-50 z-10`}>Nom</th>
              <th className={`${cls.th} sticky left-0 bg-gray-50 z-10`}>Prénom</th>
              <th className={cls.th}>Sexe</th>
              {champsActifs.map((f) => (
                <th key={f} className={cls.th}>
                  {LABELS[f] ?? f}
                </th>
              ))}
              {champsCustom.map((c) => (
                <th key={c.nom} className={cls.th}>
                  {c.nom}
                  {c.obligatoire ? ' *' : ''}
                </th>
              ))}
              <th className={cls.th}>Email parent</th>
              <th className={cls.th} />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  className="px-2 py-4 text-center text-sm text-gray-400"
                  colSpan={4 + champsActifs.length + champsCustom.length + 1}
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
                      className={cls.input}
                      value={row.eleveNom}
                      onChange={(e) => updateCell(row._localId, 'eleveNom', e.target.value)}
                      placeholder="Nom"
                    />
                  </td>
                  <td className={`${cls.cell} sticky left-0 bg-white`}>
                    <input
                      type="text"
                      className={cls.input}
                      value={row.elevePrenom}
                      onChange={(e) => updateCell(row._localId, 'elevePrenom', e.target.value)}
                      placeholder="Prénom"
                    />
                  </td>
                  <td className={cls.cell}>
                    <select
                      className={`${cls.input} w-24`}
                      value={row.hebergementCategorie ?? ''}
                      onChange={(e) => updateCell(row._localId, 'hebergementCategorie', e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="FILLE">Fille</option>
                      <option value="GARCON">Garçon</option>
                      <option value="AUTRE">Autre</option>
                    </select>
                  </td>
                  {champsActifs.map((f) => (
                    <td key={f} className={cls.cell}>
                      {renderStandardCell(row, f)}
                    </td>
                  ))}
                  {champsCustom.map((c) => (
                    <td key={c.nom} className={cls.cell}>
                      {renderCustomCell(row, c)}
                    </td>
                  ))}
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
    </div>
  );
}
