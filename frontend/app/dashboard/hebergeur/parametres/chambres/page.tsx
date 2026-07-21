'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getChambres,
  createChambre,
  updateChambre,
  deleteChambre,
  dupliquerChambre,
  ajouterLits,
  updateLit,
  deleteLit,
} from '@/src/lib/chambres';
import type { Chambre, CreateLitInput, Lit, TypeLit } from '@/src/lib/chambres';

/**
 * Plan des chambres (module chambres, sous-chantier 5 — plan validé :
 * docs/run-chambres-5.md). D13 : rendu SPATIAL — grille par étage, chambres
 * dans l'ordre physique (etage + ordre, l'ordre du couloir), jamais une liste
 * plate alphabétique. Plan COMPLET : les mutations en plan insuffisant
 * déclenchent le PlanInsufficientModal global (aucune erreur brute ici).
 */

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

// Libellés + places par défaut (miroir des défauts serveur — affichage seulement)
const TYPES_LITS: { type: TypeLit; label: string; labelCourt: string; places: number }[] = [
  { type: 'SUPERPOSE', label: 'Lits superposés', labelCourt: 'superposé', places: 2 },
  { type: 'SIMPLE', label: 'Lits simples', labelCourt: 'simple', places: 1 },
  { type: 'DOUBLE', label: 'Lits doubles', labelCourt: 'double', places: 2 },
  { type: 'TIROIR', label: 'Lits tiroir', labelCourt: 'tiroir', places: 1 },
  { type: 'BB', label: 'Lits bébé', labelCourt: 'bébé', places: 1 },
  { type: 'APPOINT', label: "Matelas d'appoint", labelCourt: 'appoint', places: 1 },
];

const SANS_ETAGE = 'Sans étage';

// Liste fixe V1 (run 5.1) — la saisie libre complète, ne remplace jamais.
const EQUIPEMENTS_CHAMBRE = [
  'Salle de bain', 'WC privés', 'Douche', 'Lavabo', 'TV', 'Climatisation',
  'Sèche-cheveux', 'Balcon', 'Terrasse', 'PMR', 'Mezzanine',
];

type Compteurs = Record<TypeLit, number>;
const COMPTEURS_VIDES: Compteurs = { SUPERPOSE: 0, SIMPLE: 0, DOUBLE: 0, TIROIR: 0, BB: 0, APPOINT: 0 };

const PLACES_DEFAUT = Object.fromEntries(
  TYPES_LITS.map((t) => [t.type, t.places]),
) as Record<TypeLit, number>;

/** Places d'un lit à créer : éditées, sinon défaut du type (miroir serveur). */
const placesEffectives = (l: CreateLitInput) => l.places ?? PLACES_DEFAUT[l.type];

/** « 3× superposé, 1× simple » dans l'ordre canonique des types. */
function resumeLits(lits: Lit[]): string {
  const parType = new Map<string, number>();
  for (const l of lits) parType.set(l.type, (parType.get(l.type) ?? 0) + 1);
  return TYPES_LITS.filter((t) => parType.has(t.type))
    .map((t) => `${parType.get(t.type)}× ${t.labelCourt}`)
    .join(', ');
}

// 403 PLAN_INSUFFICIENT → le modal global gère, la page se tait.
function estPlanInsuffisant(e: unknown): boolean {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error === 'PLAN_INSUFFICIENT';
}

// ─── Modal création / édition ───────────────────────────────────────────────

interface ModalCreate {
  mode: 'create';
  etage: string; // pré-rempli par « Enregistrer et créer la suivante »
  lits: CreateLitInput[]; // types + places de la précédente (JAMAIS les libellés)
  equipements: string[];
}
interface ModalEdit {
  mode: 'edit';
  chambre: Chambre;
}
type ModalState = ModalCreate | ModalEdit | null;

export default function PlanChambresPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [chambres, setChambres] = useState<Chambre[]>([]);
  const [loading, setLoading] = useState(true);
  const [voirInactives, setVoirInactives] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [dupliquerPour, setDupliquerPour] = useState<{ id: string; nombre: number } | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'HEBERGEUR')) router.replace('/login');
  }, [isLoading, user, router]);

  const load = useCallback(async (inactives: boolean) => {
    try {
      setChambres(await getChambres(inactives));
    } catch {
      setErreur('Impossible de charger le plan des chambres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'HEBERGEUR') load(voirInactives);
  }, [user, voirInactives, load]);

  // D13 : groupes d'étages ordonnés par min(ordre) des chambres du groupe —
  // l'API trie l'étiquette alphabétiquement (« 1er » passerait avant « RDC »),
  // l'ordre du couloir saisi fait foi. Fallback alphabétique à égalité.
  const groupes = useMemo(() => {
    const parEtage = new Map<string, Chambre[]>();
    for (const c of chambres) {
      const cle = c.etage ?? SANS_ETAGE;
      if (!parEtage.has(cle)) parEtage.set(cle, []);
      parEtage.get(cle)!.push(c);
    }
    return [...parEtage.entries()]
      .map(([etage, liste]) => ({ etage, liste, minOrdre: Math.min(...liste.map((c) => c.ordre)) }))
      .sort((a, b) => a.minOrdre - b.minOrdre || a.etage.localeCompare(b.etage, 'fr'));
  }, [chambres]);

  const totaux = useMemo(
    () => ({
      capacite: chambres.filter((c) => c.actif).reduce((s, c) => s + c.capacite, 0),
      nb: chambres.filter((c) => c.actif).length,
    }),
    [chambres],
  );

  const signaler = (msg: string) => {
    setMessage(msg);
    setErreur(null);
  };

  const executer = async (action: () => Promise<void>, messageErreur: string) => {
    setBusy(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      if (!estPlanInsuffisant(e)) setErreur(messageErreur);
    } finally {
      await load(voirInactives);
      setBusy(false);
    }
  };

  const handleDelete = (c: Chambre) => {
    if (!window.confirm(`Supprimer « ${c.nom} » ?`)) return;
    executer(async () => {
      const res = await deleteChambre(c.id);
      signaler(
        res.deleted
          ? `Chambre « ${c.nom} » supprimée.`
          : `Chambre « ${c.nom} » désactivée — son historique d'occupations est conservé.`,
      );
    }, 'La suppression a échoué. Réessayez.');
  };

  const handleDupliquer = (id: string, nombre: number) => {
    setDupliquerPour(null);
    executer(async () => {
      const copies = await dupliquerChambre(id, nombre);
      signaler(`${copies.length} chambre${copies.length > 1 ? 's' : ''} créée${copies.length > 1 ? 's' : ''}.`);
    }, 'La duplication a échoué. Réessayez.');
  };

  const handleReactiver = (c: Chambre) => {
    executer(async () => {
      await updateChambre(c.id, { actif: true });
      signaler(`Chambre « ${c.nom} » réactivée.`);
    }, 'La réactivation a échoué. Réessayez.');
  };

  // ←/→ (pattern galerie photos) : échange avec la voisine du même étage.
  // Renumérotation séquentielle du groupe plutôt qu'un échange des deux ordres :
  // un simple swap serait un no-op quand les deux valent 0 (défaut de création).
  // Seuls les ordres qui changent sont PATCHés ; l'état revient du serveur.
  const handleDeplacer = (c: Chambre, delta: -1 | 1) => {
    const groupe = groupes.find((g) => g.etage === (c.etage ?? SANS_ETAGE));
    if (!groupe) return;
    const liste = [...groupe.liste];
    const idx = liste.findIndex((x) => x.id === c.id);
    const cible = idx + delta;
    if (idx < 0 || cible < 0 || cible >= liste.length) return;
    [liste[idx], liste[cible]] = [liste[cible], liste[idx]];
    const patches = liste
      .map((x, i) => ({ id: x.id, ancien: x.ordre, ordre: i }))
      .filter((p) => p.ancien !== p.ordre);
    if (patches.length === 0) return;
    executer(async () => {
      await Promise.all(patches.map((p) => updateChambre(p.id, { ordre: p.ordre })));
    }, 'Le déplacement a échoué. Réessayez.');
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Plan des chambres</h1>
        <button
          onClick={() => setModal({ mode: 'create', etage: '', lits: [], equipements: [] })}
          className="rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          + Nouvelle chambre
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            Capacité totale : <strong className="text-gray-900">{totaux.capacite} place{totaux.capacite > 1 ? 's' : ''}</strong>
            {' '}· {totaux.nb} chambre{totaux.nb > 1 ? 's' : ''}
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={voirInactives}
              onChange={(e) => setVoirInactives(e.target.checked)}
              className="rounded border-gray-300"
            />
            Voir les inactives
          </label>
        </div>

        {message && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-green-600 hover:text-green-800 shrink-0">×</button>
          </div>
        )}
        {erreur && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            <span>{erreur}</span>
            <button onClick={() => setErreur(null)} className="text-red-500 hover:text-red-700 shrink-0">×</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : chambres.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400 mb-3">Aucune chambre pour l&apos;instant.</p>
            <p className="text-xs text-gray-400">
              Créez vos chambres dans l&apos;ordre du couloir, étage par étage — le plan se
              retrouvera partout (affectation, rooming list).
            </p>
          </div>
        ) : (
          groupes.map(({ etage, liste }) => (
            <section key={etage} className="mb-8">
              <h2 className="flex items-center gap-3 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {etage}
                <span className="flex-1 border-t border-gray-200" />
              </h2>
              <div className="flex flex-wrap gap-3">
                {liste.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`w-[230px] rounded-xl border bg-white px-4 py-3 shadow-sm ${c.actif ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.nom}</p>
                      <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                        {c.capacite} pl.
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 min-h-[16px]">
                      {c.lits.length > 0 ? resumeLits(c.lits) : 'Aucun lit — inutilisable'}
                    </p>
                    {c.notes && <p className="text-[11px] text-gray-400 truncate mt-0.5">𝑖 {c.notes}</p>}
                    {c.equipements.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.equipements.slice(0, 3).map((eq) => (
                          <span key={eq} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{eq}</span>
                        ))}
                        {c.equipements.length > 3 && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500" title={c.equipements.slice(3).join(', ')}>
                            +{c.equipements.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {!c.actif && (
                      <span className="inline-block mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                        Inactive
                      </span>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      {c.actif ? (
                        <>
                          <button title="Modifier" disabled={busy} onClick={() => setModal({ mode: 'edit', chambre: c })} className="rounded p-1 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-50 disabled:opacity-40">✎</button>
                          <button title="Dupliquer" disabled={busy} onClick={() => setDupliquerPour({ id: c.id, nombre: 1 })} className="rounded p-1 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-50 disabled:opacity-40">⧉</button>
                          <button title="Déplacer vers la gauche" disabled={busy || idx === 0} onClick={() => handleDeplacer(c, -1)} className="rounded p-1 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-50 disabled:opacity-30">←</button>
                          <button title="Déplacer vers la droite" disabled={busy || idx === liste.length - 1} onClick={() => handleDeplacer(c, 1)} className="rounded p-1 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-50 disabled:opacity-30">→</button>
                          <span className="flex-1" />
                          <button title="Supprimer" disabled={busy} onClick={() => handleDelete(c)} className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">🗑</button>
                        </>
                      ) : (
                        <button disabled={busy} onClick={() => handleReactiver(c)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                          Réactiver
                        </button>
                      )}
                    </div>
                    {dupliquerPour?.id === c.id && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">×</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={dupliquerPour.nombre}
                          onChange={(e) => setDupliquerPour({ id: c.id, nombre: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                          className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <button onClick={() => handleDupliquer(c.id, dupliquerPour.nombre)} className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs font-semibold text-white">OK</button>
                        <button onClick={() => setDupliquerPour(null)} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {modal && (
        <ChambreModal
          modal={modal}
          onClose={() => setModal(null)}
          onDone={async (msg, suivante) => {
            signaler(msg);
            await load(voirInactives);
            if (suivante) setModal(suivante);
            else setModal(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

function ChambreModal({
  modal,
  onClose,
  onDone,
}: {
  modal: ModalCreate | ModalEdit;
  onClose: () => void;
  onDone: (message: string, suivante?: ModalCreate) => Promise<void>;
}) {
  const isEdit = modal.mode === 'edit';
  const [nom, setNom] = useState(isEdit ? modal.chambre.nom : '');
  const [etage, setEtage] = useState(isEdit ? (modal.chambre.etage ?? '') : modal.etage);
  const [notes, setNotes] = useState(isEdit ? (modal.chambre.notes ?? '') : '');
  // Run 5.1 (B) : la LISTE des lits à créer est la source de vérité, les
  // compteurs une vue dérivée — synchronisation structurelle, plus de double état.
  const [litsAjout, setLitsAjout] = useState<CreateLitInput[]>(isEdit ? [] : modal.lits);
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [equipements, setEquipements] = useState<string[]>(
    isEdit ? modal.chambre.equipements : modal.equipements,
  );
  const [equipementLibre, setEquipementLibre] = useState('');
  const [lits, setLits] = useState<Lit[]>(isEdit ? modal.chambre.lits : []);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const nomRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nomRef.current?.focus();
  }, []);

  const compteurs: Compteurs = useMemo(() => {
    const c = { ...COMPTEURS_VIDES };
    for (const l of litsAjout) c[l.type] = (c[l.type] ?? 0) + 1;
    return c;
  }, [litsAjout]);

  // + ajoute en fin de liste ; − retire le DERNIER lit du type (libellé compris).
  const setCompteur = (type: TypeLit, delta: number) =>
    setLitsAjout((prev) => {
      if (delta > 0) return prev.length >= 30 ? prev : [...prev, { type }];
      const idx = prev.map((l) => l.type).lastIndexOf(type);
      return idx < 0 ? prev : prev.filter((_, i) => i !== idx);
    });

  const majLitAjout = (i: number, patch: Partial<CreateLitInput>) =>
    setLitsAjout((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const retirerLitAjout = (i: number) => setLitsAjout((prev) => prev.filter((_, j) => j !== i));

  /** Payload du contrat : libellés trimés, vides omis. */
  const litsPourEnvoi = (): CreateLitInput[] =>
    litsAjout.map((l) => ({
      type: l.type,
      ...(l.places !== undefined ? { places: l.places } : {}),
      ...(l.libelle?.trim() ? { libelle: l.libelle.trim() } : {}),
    }));

  const toggleEquipement = (eq: string) =>
    setEquipements((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));

  const ajouterEquipementLibre = () => {
    const eq = equipementLibre.trim();
    if (!eq || equipements.includes(eq) || equipements.length >= 20) return;
    setEquipements((prev) => [...prev, eq]);
    setEquipementLibre('');
  };

  const capaciteLits = lits.reduce((s, l) => s + l.places, 0);
  const capaciteAjout = litsAjout.reduce((s, l) => s + placesEffectives(l), 0);
  const nbAjout = litsAjout.length;

  const gererErreur = (e: unknown, msg: string) => {
    if (!estPlanInsuffisant(e)) setErreur(msg);
  };

  // ── Création (avec enchaînement « et créer la suivante » — D3) ──
  const creer = async (enchainer: boolean) => {
    if (!nom.trim()) {
      setErreur('Le nom de la chambre est requis.');
      return;
    }
    setSaving(true);
    setErreur(null);
    try {
      await createChambre({
        nom: nom.trim(),
        ...(etage.trim() ? { etage: etage.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(equipements.length > 0 ? { equipements } : {}),
        ...(nbAjout > 0 ? { lits: litsPourEnvoi() } : {}),
      });
      await onDone(
        `Chambre « ${nom.trim() } » créée.`,
        // Étage, lits (types + places, JAMAIS les libellés — « lit haut fenêtre »
        // dupliqué serait un mensonge) et équipements pré-remplis de la
        // précédente : la saisie d'un centre entier s'enchaîne sans fermer/rouvrir.
        enchainer
          ? {
              mode: 'create',
              etage,
              lits: litsAjout.map((l) =>
                l.places !== undefined ? { type: l.type, places: l.places } : { type: l.type },
              ),
              equipements: [...equipements],
            }
          : undefined,
      );
    } catch (e) {
      gererErreur(e, 'La création a échoué. Vérifiez les champs et réessayez.');
      setSaving(false);
    }
  };

  // ── Édition ──
  const enregistrerEdition = async () => {
    if (!isEdit) return;
    if (!nom.trim()) {
      setErreur('Le nom de la chambre est requis.');
      return;
    }
    setSaving(true);
    setErreur(null);
    try {
      await updateChambre(modal.chambre.id, {
        nom: nom.trim(),
        etage: etage.trim() ? etage.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        equipements, // liste complète recalculée (sémantique set)
      });
      if (nbAjout > 0) await ajouterLits(modal.chambre.id, litsPourEnvoi());
      await onDone(`Chambre « ${nom.trim()} » enregistrée.`);
    } catch (e) {
      gererErreur(e, "L'enregistrement a échoué. Réessayez.");
      setSaving(false);
    }
  };

  const patchLit = async (litId: string, data: { type?: TypeLit; places?: number; libelle?: string | null }) => {
    try {
      const maj = await updateLit(litId, data);
      setLits((prev) => prev.map((l) => (l.id === litId ? { ...l, ...maj } : l)));
    } catch (e) {
      gererErreur(e, 'La modification du lit a échoué (1 à 6 places).');
    }
  };

  const supprimerLit = async (litId: string) => {
    try {
      await deleteLit(litId);
      setLits((prev) => prev.filter((l) => l.id !== litId));
    } catch (e) {
      gererErreur(e, 'La suppression du lit a échoué.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {isEdit ? `Modifier « ${modal.chambre.nom} »` : 'Nouvelle chambre'}
        </h2>

        {erreur && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erreur}</div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
              <input ref={nomRef} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Chambre 12" className={inputCls} maxLength={100} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Étage</label>
              <input value={etage} onChange={(e) => setEtage(e.target.value)} placeholder="RDC, 1er, Chalet annexe…" className={inputCls} maxLength={50} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="lavabo, vue vallée…" className={inputCls} />
          </div>

          {/* ── Lits existants (édition) ── */}
          {isEdit && lits.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">
                Lits ({capaciteLits} place{capaciteLits > 1 ? 's' : ''})
              </p>
              <div className="space-y-1.5">
                {lits.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <select
                      value={l.type}
                      onChange={(e) => patchLit(l.id, { type: e.target.value as TypeLit })}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      {TYPES_LITS.map((t) => (
                        <option key={t.type} value={t.type}>{t.labelCourt}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      defaultValue={l.places}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v >= 1 && v <= 6 && v !== l.places) patchLit(l.id, { places: v });
                      }}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                      title="Places (1–6) — pour un dortoir, créez plusieurs lits"
                    />
                    <input
                      defaultValue={l.libelle ?? ''}
                      placeholder="libellé (optionnel)"
                      maxLength={50}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (l.libelle ?? '')) patchLit(l.id, { libelle: v || null });
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <button title="Supprimer ce lit" onClick={() => supprimerLit(l.id)} className="rounded p-1 text-gray-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Saisie rapide (compteurs → tableau du contrat) ── */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">{isEdit ? 'Ajouter des lits' : 'Lits'}</p>
            <div className="space-y-1">
              {TYPES_LITS.map((t) => (
                <div key={t.type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {t.label} <span className="text-xs text-gray-400">({t.places} pl.)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCompteur(t.type, -1)} className="h-7 w-7 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50" aria-label={`Retirer un ${t.labelCourt}`}>−</button>
                    <span className="w-6 text-center text-sm font-medium text-gray-900">{compteurs[t.type] ?? 0}</span>
                    <button onClick={() => setCompteur(t.type, 1)} className="h-7 w-7 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50" aria-label={`Ajouter un ${t.labelCourt}`}>+</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Run 5.1 (B) : détail des lits à créer — libellés/places sans second passage */}
            {!isEdit && nbAjout > 0 && (
              <button
                onClick={() => setDetailOuvert((v) => !v)}
                className="mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                {detailOuvert ? 'Replier' : `Détailler les lits (${nbAjout})`}
              </button>
            )}
            {!isEdit && detailOuvert && nbAjout > 0 && (
              <div className="mt-2 space-y-1.5">
                {litsAjout.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={l.type}
                      onChange={(e) => majLitAjout(i, { type: e.target.value as TypeLit })}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      {TYPES_LITS.map((t) => (
                        <option key={t.type} value={t.type}>{t.labelCourt}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={l.places ?? PLACES_DEFAUT[l.type]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v >= 1 && v <= 6) majLitAjout(i, { places: v });
                      }}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                      title="Places (1–6) — pour un dortoir, créez plusieurs lits"
                    />
                    <input
                      value={l.libelle ?? ''}
                      placeholder="libellé (optionnel)"
                      maxLength={50}
                      onChange={(e) => majLitAjout(i, { libelle: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <button title="Retirer ce lit" onClick={() => retirerLitAjout(i)} className="rounded p-1 text-gray-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-700">
              {isEdit ? (
                <>Capacité après ajout : <strong>{capaciteLits + capaciteAjout} places</strong></>
              ) : (
                <>Capacité : <strong>{capaciteAjout} place{capaciteAjout > 1 ? 's' : ''}</strong></>
              )}
            </p>
          </div>

          {/* ── Équipements (run 5.1 — liste fixe + saisie libre, chips sur la carte) ── */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Équipements</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[...EQUIPEMENTS_CHAMBRE, ...equipements.filter((e) => !EQUIPEMENTS_CHAMBRE.includes(e))].map((eq) => (
                <label key={eq} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={equipements.includes(eq)}
                    onChange={() => toggleEquipement(eq)}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  <span className="truncate">{eq}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                value={equipementLibre}
                onChange={(e) => setEquipementLibre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    ajouterEquipementLibre();
                  }
                }}
                placeholder="Autre équipement…"
                maxLength={50}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              />
              <button
                onClick={ajouterEquipementLibre}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {isEdit ? 'Fermer' : 'Annuler'}
          </button>
          {!isEdit && (
            <button
              onClick={() => creer(true)}
              disabled={saving}
              className="rounded-lg border border-[var(--color-primary)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 disabled:opacity-50"
            >
              Enregistrer et créer la suivante
            </button>
          )}
          <button
            onClick={() => (isEdit ? enregistrerEdition() : creer(false))}
            disabled={saving}
            className="rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
