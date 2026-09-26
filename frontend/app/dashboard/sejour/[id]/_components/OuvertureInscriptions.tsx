'use client';

import { useEffect, useState } from 'react';
import { CHAMPS_INSCRIPTION, PHRASE_DONNEES_SANTE } from '@/src/lib/champs-inscription';
import {
  createModeleInscription,
  getChampsVerrouillesSejour,
  listModelesInscription,
  updateChampsInscriptionSejour,
  type ModeleInscription,
} from '@/src/lib/inscription-config';

/**
 * Écran d'ouverture/édition des inscriptions d'un séjour (hébergeur, Lot 4b).
 * Cases = Bloc B uniquement, ordre et libellés canoniques (décision A).
 * Enregistrer = écrire le snapshot figé → 1ʳᵉ écriture = OUVRIR (B1).
 * « Définir comme modèle » enregistre dans la bibliothèque du centre, sans ouvrir.
 */

const BLOC_B = CHAMPS_INSCRIPTION.filter((c) => c.bloc === 'B');

interface Props {
  sejourId: string;
  champsInscription: { champsActifs: string[] } | null;
  onOpened: () => void;
}

export default function OuvertureInscriptions({ sejourId, champsInscription, onOpened }: Props) {
  const [coches, setCoches] = useState<Set<string>>(
    () => new Set(champsInscription?.champsActifs ?? []),
  );
  const [modeles, setModeles] = useState<ModeleInscription[]>([]);
  // Clés Bloc B déjà remplies par ≥1 inscrit (Lot 5c-B) : grisées, indécochables.
  // Échec de chargement silencieux → comportement d'avant (garde-fou au save).
  const [verrouilles, setVerrouilles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nomModele, setNomModele] = useState('');
  const [saveModeleOpen, setSaveModeleOpen] = useState(false);

  useEffect(() => {
    listModelesInscription().then(setModeles).catch(() => {});
    getChampsVerrouillesSejour(sejourId)
      .then((res) => {
        setVerrouilles(new Set(res));
        // Un champ verrouillé est forcément demandé : l'affichage coché et
        // l'ensemble envoyé au save restent alignés.
        setCoches((prev) => new Set([...prev, ...res]));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (cle: string) => {
    if (verrouilles.has(cle)) return; // garde en plus du disabled
    setError(null);
    setSuccess(null);
    setCoches((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) next.delete(cle);
      else next.add(cle);
      return next;
    });
  };

  const appliquerModele = (id: string) => {
    const modele = modeles.find((m) => m.id === id);
    if (!modele) return;
    setError(null);
    setSuccess(null);
    // Un modèle ne peut jamais décocher un champ verrouillé.
    setCoches(new Set([...modele.champsActifs, ...verrouilles]));
  };

  const messageErreur = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

  const enregistrer = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateChampsInscriptionSejour(sejourId, [...coches]);
      onOpened();
    } catch (err) {
      setError(messageErreur(err, "Impossible d'enregistrer les champs demandés."));
    } finally {
      setSaving(false);
    }
  };

  const definirCommeModele = async () => {
    if (!nomModele.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const modele = await createModeleInscription(nomModele.trim(), [...coches]);
      setModeles((prev) => [...prev, modele].sort((a, b) => a.nom.localeCompare(b.nom)));
      setSuccess(`Modèle « ${modele.nom} » enregistré.`);
      setNomModele('');
      setSaveModeleOpen(false);
    } catch (err) {
      setError(messageErreur(err, "Impossible d'enregistrer le modèle."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">
        {champsInscription ? 'Champs demandés aux inscriptions' : 'Ouvrir les inscriptions'}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Cochez les informations à collecter pour chaque participant de ce séjour.
      </p>

      {/* Bloc A : toujours demandé, non configurable */}
      <div className="rounded-lg bg-[var(--color-primary-light)] px-3 py-2 text-xs text-[var(--color-primary)] mb-4">
        Nom, prénom, date de naissance et contact du responsable sont toujours demandés.
      </div>
      <p className="text-xs text-gray-500 -mt-2 mb-4">
        {PHRASE_DONNEES_SANTE} Toutes les données sont sécurisées et hébergées en France.
      </p>

      {/* Appliquer un modèle */}
      {modeles.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label htmlFor="modele-inscription" className="text-sm text-gray-700">
            Appliquer un modèle :
          </label>
          <select
            id="modele-inscription"
            defaultValue=""
            onChange={(e) => { if (e.target.value) appliquerModele(e.target.value); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="">—</option>
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}</option>
            ))}
          </select>
        </div>
      )}

      {/* Cases Bloc B — ordre canonique ; champs déjà remplis = verrouillés */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {BLOC_B.map((champ) => {
          const locked = verrouilles.has(champ.cle);
          return (
            <label
              key={champ.cle}
              title={locked ? 'Déjà renseigné par des inscrits — ne peut plus être retiré' : undefined}
              className={`flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 ${
                locked ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={locked || coches.has(champ.cle)}
                disabled={locked}
                onChange={() => toggle(champ.cle)}
                className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] disabled:opacity-60"
              />
              <span className={`text-sm ${locked ? 'text-gray-400' : 'text-gray-700'}`}>
                {champ.libelle}
                {locked && <span className="ml-1 text-xs" aria-hidden>🔒</span>}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={enregistrer}
          disabled={saving}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {champsInscription ? 'Enregistrer' : 'Ouvrir les inscriptions'}
        </button>

        {saveModeleOpen ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nomModele}
              onChange={(e) => setNomModele(e.target.value)}
              placeholder="Nom du modèle"
              maxLength={100}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={definirCommeModele}
              disabled={saving || !nomModele.trim()}
              className="rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => { setSaveModeleOpen(false); setNomModele(''); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSaveModeleOpen(true)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Définir comme modèle
          </button>
        )}
      </div>
    </section>
  );
}
