'use client';

import { useState } from 'react';
import {
  createAccompagnateur,
  type AccompagnateurMission,
} from '@/src/lib/accompagnateur';

/**
 * Accompagnateurs — ordres de mission (extrait de l'ancienne page autorisations,
 * SC4). Verrouillé tant que le devis n'est pas signé (D11) : les accompagnateurs
 * n'interviennent qu'après signature.
 */
export default function Accompagnateurs({
  sejourId,
  devisSigne,
  accompagnateurs,
  onChanged,
}: {
  sejourId: string;
  devisSigne: boolean;
  accompagnateurs: AccompagnateurMission[];
  onChanged: () => void;
}) {
  const [accPrenom, setAccPrenom] = useState('');
  const [accNom, setAccNom] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accTelephone, setAccTelephone] = useState('');
  const [accAccesCollaboratif, setAccAccesCollaboratif] = useState(false);
  const [accRoleCollaboratif, setAccRoleCollaboratif] = useState<'LECTURE' | 'EDITION'>('LECTURE');
  const [accDiplome, setAccDiplome] = useState('');
  const [accQualificationAutre, setAccQualificationAutre] = useState('');
  const [creatingAcc, setCreatingAcc] = useState(false);
  const [accError, setAccError] = useState<string | null>(null);
  const [copiedAccId, setCopiedAccId] = useState<string | null>(null);

  const handleCreateAcc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sejourId) return;
    setCreatingAcc(true);
    setAccError(null);
    try {
      await createAccompagnateur({
        sejourId,
        prenom: accPrenom.trim(),
        nom: accNom.trim(),
        email: accEmail.trim(),
        telephone: accTelephone.trim() || undefined,
        accesCollaboratif: accAccesCollaboratif,
        roleCollaboratif: accAccesCollaboratif ? accRoleCollaboratif : undefined,
        diplome: accDiplome || undefined,
        qualificationAutre: accDiplome === 'AUTRE' ? (accQualificationAutre.trim() || undefined) : undefined,
      });
      setAccPrenom('');
      setAccNom('');
      setAccEmail('');
      setAccTelephone('');
      setAccAccesCollaboratif(false);
      setAccRoleCollaboratif('LECTURE');
      setAccDiplome('');
      setAccQualificationAutre('');
      onChanged();
    } catch {
      setAccError("Erreur lors de l'ajout de l'accompagnateur.");
    } finally {
      setCreatingAcc(false);
    }
  };

  const copyAccLink = async (tokenAcces: string, accId: string) => {
    const url = `${window.location.origin}/ordre-mission/${tokenAcces}`;
    await navigator.clipboard.writeText(url);
    setCopiedAccId(accId);
    setTimeout(() => setCopiedAccId(null), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        Accompagnateurs — Ordres de mission
      </h2>

      {!devisSigne ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Signez le devis pour ajouter les accompagnateurs.
        </div>
      ) : (
        <>
          {accError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {accError}
            </div>
          )}

          <form onSubmit={handleCreateAcc} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-5">
            <input
              type="text"
              placeholder="Prénom"
              value={accPrenom}
              onChange={(e) => setAccPrenom(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Nom"
              value={accNom}
              onChange={(e) => setAccNom(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              value={accEmail}
              onChange={(e) => setAccEmail(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
            <input
              type="tel"
              placeholder="Téléphone (optionnel)"
              value={accTelephone}
              onChange={(e) => setAccTelephone(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={creatingAcc}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              {creatingAcc ? 'Envoi…' : 'Ajouter'}
            </button>

            <div className="sm:col-span-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={accDiplome}
                onChange={(e) => setAccDiplome(e.target.value)}
                className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                aria-label="Diplôme / Qualification"
              >
                <option value="">Diplôme / Qualification (optionnel)</option>
                <option value="BAFA">BAFA</option>
                <option value="BAFD">BAFD</option>
                <option value="BPJEPS">BPJEPS</option>
                <option value="DEJEPS">DEJEPS</option>
                <option value="DESJEPS">DESJEPS</option>
                <option value="CPJEPS">CPJEPS</option>
                <option value="PSC1">PSC1</option>
                <option value="AUTRE">Autre…</option>
              </select>
              {accDiplome === 'AUTRE' && (
                <input
                  type="text"
                  placeholder="Préciser la qualification"
                  value={accQualificationAutre}
                  onChange={(e) => setAccQualificationAutre(e.target.value)}
                  className="w-full sm:flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
                />
              )}
            </div>

            <div className="sm:col-span-5 flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accAccesCollaboratif}
                  onChange={(e) => {
                    setAccAccesCollaboratif(e.target.checked);
                    if (e.target.checked) setAccRoleCollaboratif('LECTURE');
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]"
                />
                <span className="text-sm text-gray-700">Accès à l&apos;espace collaboratif</span>
              </label>
              {accAccesCollaboratif && (
                <select
                  value={accRoleCollaboratif}
                  onChange={(e) => setAccRoleCollaboratif(e.target.value as 'LECTURE' | 'EDITION')}
                  className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="LECTURE">Consultation — lecture seule</option>
                  <option value="EDITION">Collaboration — lecture et écriture</option>
                </select>
              )}
            </div>
          </form>

          <p className="text-xs text-gray-400 mb-4">
            Un email avec le lien de signature sera automatiquement envoyé à l&apos;accompagnateur.
          </p>
        </>
      )}

      {accompagnateurs.length > 0 ? (
        <div className={`space-y-2 ${!devisSigne ? 'mt-4' : ''}`}>
          {accompagnateurs.map((a) => {
            const isSigned = !!a.signeeAt;
            return (
              <div
                key={a.id}
                className="bg-gray-50 rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {a.prenom} {a.nom}
                    </span>
                    {isSigned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2.5 py-0.5 text-xs font-medium">
                        Signé le{' '}
                        {new Date(a.signeeAt!).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-medium">
                        En attente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{a.email}{a.telephone ? ` — ${a.telephone}` : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyAccLink(a.tokenAcces, a.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                >
                  {copiedAccId === a.id ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[var(--color-success)]">Copié !</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copier le lien
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        devisSigne && (
          <p className="text-sm text-gray-400 text-center py-3">
            Aucun accompagnateur ajouté pour ce séjour.
          </p>
        )
      )}
    </div>
  );
}
