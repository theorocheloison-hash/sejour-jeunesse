'use client';

import { useState } from 'react';
import { updateResponsableInscriptions } from '@/src/lib/inscription-config';

/**
 * B4 — « qui tient la main » sur les inscriptions d'un séjour COLLABORATIF,
 * posé par l'hébergeur une fois les champs demandés choisis. Exclusif et
 * réversible : la bascule ne touche aucune donnée (inscrits conservés), seuls
 * les droits changent ; l'organisateur est prévenu par le serveur.
 */
interface Props {
  sejourId: string;
  responsable: 'ORGANISATEUR' | 'HEBERGEUR';
  nbInscrits: number;
  /** Rechargement du séjour (droits + responsable) après bascule. */
  onChanged: () => void;
}

const OPTIONS: Array<{ valeur: 'ORGANISATEUR' | 'HEBERGEUR'; titre: string; texte: string }> = [
  {
    valeur: 'ORGANISATEUR',
    titre: 'L’organisateur',
    texte: 'Il importe sa liste avec le modèle Excel, ou envoie directement les autorisations parentales aux familles par email.',
  },
  {
    valeur: 'HEBERGEUR',
    titre: 'Mon centre',
    texte: 'Vous saisissez la liste, ou vous importez le modèle Excel que vous avez envoyé au préalable à l’organisateur pour qu’il le remplisse en dehors de LIAVO.',
  },
];

export default function ChoixResponsableInscriptions({ sejourId, responsable, nbInscrits, onChanged }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const choisir = async (valeur: 'ORGANISATEUR' | 'HEBERGEUR') => {
    if (valeur === responsable || enCours) return;
    const inscrits = nbInscrits > 0
      ? `${nbInscrits} élève${nbInscrits > 1 ? 's' : ''} déjà inscrit${nbInscrits > 1 ? 's' : ''} : ${nbInscrits > 1 ? 'ils sont conservés' : 'il est conservé'}.\n`
      : '';
    const message = valeur === 'HEBERGEUR'
      ? `Votre centre gérera la liste des inscrits. L’organisateur la consultera en lecture.\n${inscrits}L’organisateur sera prévenu par email.`
      : `L’organisateur reprendra la main sur la liste des inscrits.\n${inscrits}Il sera prévenu par email.`;
    if (!window.confirm(message)) return;
    setEnCours(true);
    setErreur(null);
    try {
      await updateResponsableInscriptions(sejourId, valeur);
      onChanged();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErreur(typeof msg === 'string' ? msg : 'Le changement n’a pas pu être enregistré. Réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Qui gère la liste des inscrits ?</h3>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label
            key={o.valeur}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
              responsable === o.valeur
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                : 'border-gray-200 hover:bg-gray-50'
            } ${enCours ? 'opacity-60 cursor-wait' : ''}`}
          >
            <input
              type="radio"
              name={`responsable-inscriptions-${sejourId}`}
              className="mt-0.5 h-4 w-4 text-[var(--color-primary)]"
              checked={responsable === o.valeur}
              disabled={enCours}
              onChange={() => choisir(o.valeur)}
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{o.titre}</span>
              <span className="block text-xs text-gray-500">{o.texte}</span>
            </span>
          </label>
        ))}
      </div>
      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
