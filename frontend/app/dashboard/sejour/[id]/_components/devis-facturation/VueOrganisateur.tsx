'use client';

import React, { useState, useRef } from 'react';
import type { Devis as DevisType } from '@/src/lib/devis';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import SecureFileLink from '@/src/components/SecureFileLink';
import SignatureDevisPanel from '@/src/components/devis/SignatureDevisPanel';
import api from '@/src/lib/api';
import type { SejourCollabInfo, BudgetData } from '@/src/lib/collaboration';
import { signerDevisConnecte, envoyerDirectionConnecte, uploadSignatureConnecte } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import DevisPdfViewer from './DevisPdfViewer';

/**
 * Vue ORGANISATEUR / SIGNATAIRE de l'onglet Devis & facturation — extraite de
 * TabDevisFacturation (étape 3a). Le parent délègue ici dès que
 * user.role !== 'HEBERGEUR'. Source du devis : budgetData.devis (getBudgetData) —
 * jamais getDevisForSejour (hébergeur-only). Reproduction verbatim des blocs
 * organisateur : état vide, builder pdfProps, actions signature/scan, badge signé,
 * viewer PDF, SignatureDevisPanel (EN_ATTENTE + EN_ATTENTE_VALIDATION), convention
 * lecture seule, modale invitation direction.
 */
export interface VueOrganisateurProps {
  sejour: SejourCollabInfo;
  user: User;
  budgetData: BudgetData | null;
  onReload?: () => Promise<void>;
  onError: (m: string) => void;
}

export default function VueOrganisateur({
  sejour,
  user,
  budgetData,
  onReload,
  onError,
}: VueOrganisateurProps) {
  // Contrat consulté (garde de la case d'acceptation dans SignatureDevisPanel côté organisateur).
  const [contratOuvert, setContratOuvert] = useState(false);

  // ── Invitation direction (devis collab) ─────────────────────
  const [showInvitationDirection, setShowInvitationDirection] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationSending, setInvitationSending] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const signatureFileRef = useRef<HTMLInputElement>(null);

  const devisAffiche = budgetData?.devis ?? null;

  /** Recharge le devis : ORGANISATEUR → onReload parent (budgetData). */
  const reloadDevis = async () => {
    await onReload?.();
  };

  return (
    <>
      <div>
        {!devisAffiche && (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Aucun devis pour ce séjour.</p>
          </div>
        )}

        {devisAffiche && budgetData?.sejour && (() => {
          const d = devisAffiche! as unknown as DevisType;
          const s = budgetData.sejour;
          const c = d.centre;
          const createur = s?.createur;
          const htCalc = Number(d.montantHT) || (d.lignes ?? []).reduce((sum: number, l: any) => sum + Number(l.totalHT), 0);
          const ttcCalc = Number(d.montantTTC) || Number(d.montantTotal) || 0;
          const tvaCalc = Number(d.montantTVA) || (ttcCalc - htCalc);

          const pdfProps: DevisPDFProps = {
            typeDocument: 'DEVIS',
            numeroDocument: d.numeroDevis ?? `DEV-${d.id.substring(0, 8).toUpperCase()}`,
            dateDocument: d.createdAt,
            dateValidite: new Date(new Date(d.createdAt).getTime() + 30 * 86400000).toISOString(),
            nomEmetteur: d.nomEntreprise || c?.nom || '',
            adresseEmetteur: d.adresseEntreprise || [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', '),
            siretEmetteur: d.siretEntreprise || c?.siret || undefined,
            emailEmetteur: d.emailEntreprise || c?.email || undefined,
            telEmetteur: d.telEntreprise || c?.telephone || undefined,
            tvaEmetteur: c?.tvaIntracommunautaire ?? undefined,
            ibanEmetteur: c?.iban ?? undefined,
            nomDestinataire: [sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' ') || (createur ? `${createur.prenom} ${createur.nom}` : ''),
            etablissementNom: sejour?.clientOrganisation ?? undefined,
            adresseDestinataire:
              [sejour?.clientAdresse,
               [sejour?.clientCodePostal, sejour?.clientVille].filter(Boolean).join(' ')]
                .filter(Boolean).join(', ') || undefined,
            emailDestinataire: sejour?.clientEmail ?? createur?.email ?? undefined,
            telDestinataire: createur?.telephone ?? undefined,
            titreSejour: s?.titre ?? '',
            lieuSejour: s?.lieu ?? '',
            dateDebutSejour: s?.dateDebut ?? undefined,
            dateFinSejour: s?.dateFin ?? undefined,
            nombreEleves: s?.placesTotales ?? undefined,
            nombreAccompagnateurs: s?.nombreAccompagnateurs ?? undefined,
            niveauClasse: s?.niveauClasse ?? undefined,
            lignes: (d.lignes ?? []).map((l: any) => ({
              description: l.description,
              quantite: Number(l.quantite),
              prixUnitaire: Number(l.prixUnitaire),
              tva: Number(l.tva),
              totalHT: Number(l.totalHT),
              totalTTC: Number(l.totalTTC),
            })),
            montantHT: htCalc,
            montantTVA: tvaCalc,
            montantTTC: ttcCalc,
            montantAcompte: Number(d.montantAcompte) || undefined,
            montantSolde: Number(d.montantSolde) || undefined,
            pourcentageAcompte: Number(d.pourcentageAcompte) || undefined,
            conditionsAnnulation: d.conditionsAnnulation ?? undefined,
            signatureDirecteur: d.signatureDirecteur ?? null,
            logoUrl: c?.logoUrl ?? null,
          };

          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <DevisPDFButton
                    data={pdfProps}
                    filename={`devis-${pdfProps.numeroDocument}.pdf`}
                    label="Télécharger le devis"
                  />
                  {user.role === 'ORGANISATEUR' && d.statut === 'SELECTIONNE' && !d.signatureDirecteur && (
                    <>
                      <button
                        onClick={() => { setShowInvitationDirection(true); setInvitationSent(false); setInvitationEmail(''); }}
                        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        Envoyer à la direction pour signature
                      </button>
                      <button
                        onClick={() => signatureFileRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81" />
                        </svg>
                        Joindre un document signé (scan)
                      </button>
                      <input
                        ref={signatureFileRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            await api.post(`/devis/${d.id}/upload-signature`, formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            await reloadDevis();
                          } catch (err) {
                            console.error('[upload-signature]', err);
                            onError('Une erreur est survenue. Veuillez réessayer.');
                          } finally {
                            if (signatureFileRef.current) signatureFileRef.current.value = '';
                          }
                        }}
                      />
                    </>
                  )}
                  {d.signatureDirecteur && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {d.statut === 'SIGNE_DIRECTION' ? 'Signé par la direction' : 'Signé'}
                      {d.nomSignataireDirecteur && <> — {d.nomSignataireDirecteur}</>}
                      {d.dateSignatureDirecteur && <> le {new Date(d.dateSignatureDirecteur).toLocaleDateString('fr-FR')}</>}
                    </span>
                  )}
                  {d.signatureDocumentUrl && (
                    <SecureFileLink
                      url={d.signatureDocumentUrl}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50"
                    >
                      Voir le document signé
                    </SecureFileLink>
                  )}
                </div>
              </div>
              <DevisPdfViewer documentUrl={d.documentUrl ?? null} pdfProps={pdfProps} />

              {/* C4 — Signature du devis depuis l'espace connecté (ORGANISATEUR),
                  devis DIRECT rattaché (sejourDirectId), endpoints id-based JWT.
                  Placé APRÈS l'aperçu : on lit le devis, puis on signe. */}
              {user.role === 'ORGANISATEUR' && d.sejourDirectId && d.statut === 'EN_ATTENTE' && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Signer ce devis</h3>
                  {d.contratUrl && (
                    <div>
                      <span onClick={() => setContratOuvert(true)}>
                        <SecureFileLink
                          url={d.contratUrl}
                          download
                          className="inline-flex items-center gap-2 rounded-lg border border-[#1B4060] px-4 py-2 text-sm font-semibold text-[#1B4060] hover:bg-blue-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Télécharger le contrat (PDF)
                        </SecureFileLink>
                      </span>
                      {!contratOuvert && (
                        <p className="mt-2 text-xs text-amber-600 font-medium">Veuillez ouvrir et lire le contrat avant de signer.</p>
                      )}
                      {contratOuvert && (
                        <p className="mt-2 text-xs text-green-600 font-medium">✓ Contrat consulté</p>
                      )}
                    </div>
                  )}
                  <SignatureDevisPanel
                    contratUrl={d.contratUrl ?? null}
                    contratOuvert={contratOuvert}
                    onSigner={b => signerDevisConnecte(d.id, b).then(() => reloadDevis())}
                    onEnvoyerDirection={b => envoyerDirectionConnecte(d.id, b).then(() => reloadDevis())}
                    onUpload={f => uploadSignatureConnecte(d.id, f).then(() => reloadDevis())}
                  />
                </div>
              )}
              {user.role === 'ORGANISATEUR' && d.sejourDirectId && d.statut === 'EN_ATTENTE_VALIDATION' && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4">
                  <p className="text-sm font-medium text-blue-800">Devis en attente de validation par votre direction.</p>
                  <SignatureDevisPanel
                    contratUrl={d.contratUrl ?? null}
                    contratOuvert={contratOuvert}
                    ongletsDisponibles={['upload']}
                    onSigner={b => signerDevisConnecte(d.id, b).then(() => reloadDevis())}
                    onEnvoyerDirection={b => envoyerDirectionConnecte(d.id, b).then(() => reloadDevis())}
                    onUpload={f => uploadSignatureConnecte(d.id, f).then(() => reloadDevis())}
                  />
                </div>
              )}

              {/* Convention — lien lecture seule pour l'enseignant (ORGANISATEUR / SIGNATAIRE).
                  Affiché uniquement si l'hébergeur a déjà généré la convention. */}
              {(user.role === 'ORGANISATEUR' || user.role === 'SIGNATAIRE') && d.conventionUrl && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Convention de séjour</h3>
                  <SecureFileLink
                    url={d.conventionUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    📄 Convention séjour scolaire
                  </SecureFileLink>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Modale invitation direction ─── */}
      {showInvitationDirection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            {invitationSent ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
                  <svg className="h-7 w-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Invitation envoyée</h3>
                <p className="text-sm text-gray-500 mb-6">
                  La direction recevra un email avec un lien pour consulter et signer le devis.
                </p>
                <button
                  onClick={() => setShowInvitationDirection(false)}
                  className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Envoyer le devis pour signature</h3>
                <p className="text-sm text-gray-500 mb-4">
                  La direction recevra un email avec un lien pour consulter et signer le devis.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de la direction</label>
                    <input
                      type="email"
                      value={invitationEmail}
                      onChange={(e) => setInvitationEmail(e.target.value)}
                      placeholder="direction@etablissement.fr"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={invitationSending}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setShowInvitationDirection(false)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      disabled={invitationSending}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={async () => {
                        if (!invitationEmail.trim() || !sejour || !devisAffiche) return;
                        setInvitationSending(true);
                        try {
                          await api.post('/invitations-directeur', {
                            sejourId: sejour.id,
                            devisId: devisAffiche.id,
                            emailDirecteur: invitationEmail.trim(),
                            enseignantPrenom: user.firstName,
                            sejourTitre: sejour.titre,
                            etablissementNom: user.organisation?.nom ?? '',
                            etablissementUai: user.organisation?.uai ?? '',
                            organisationId: user.organisation?.id ?? undefined,
                            typeContexte: 'SCOLAIRE',
                          });
                          setInvitationSent(true);
                        } catch (err) {
                          console.error('[invitations-directeur]', err);
                          onError('Une erreur est survenue. Veuillez réessayer.');
                        } finally {
                          setInvitationSending(false);
                        }
                      }}
                      disabled={invitationSending || !invitationEmail.trim()}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {invitationSending ? 'Envoi...' : 'Envoyer l\'invitation'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
