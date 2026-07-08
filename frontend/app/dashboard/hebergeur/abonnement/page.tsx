'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAbonnementStatut, souscrireAbonnement, annulerAbonnement, getFacturesLiavo, demanderExtension } from '@/src/lib/abonnement';
import type { AbonnementStatut, FactureLiavo } from '@/src/lib/abonnement';
import PricingTable from '@/app/components/PricingTable';

const PLAN_LABELS: Record<string, string> = {
  DECOUVERTE: 'Découverte',
  ESSENTIEL: 'Essentiel',
  COMPLET: 'Complet',
  PILOTAGE: 'Pilotage',
};

function formatDateFr(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function AbonnementPage() {
  const { user, isLoading } = useAuth();
  const [abo, setAbo] = useState<AbonnementStatut | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIbanForm, setShowIbanForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAnnual, setSelectedAnnual] = useState(false);
  const [iban, setIban] = useState('');
  const [titulaire, setTitulaire] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cgvAcceptee, setCgvAcceptee] = useState(false);
  const [factures, setFactures] = useState<FactureLiavo[]>([]);
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionMessage, setExtensionMessage] = useState<string | null>(null);
  const [extensionError, setExtensionError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAbonnementStatut().catch(() => null),
      getFacturesLiavo().catch(() => []),
    ]).then(([statut, facts]) => {
      if (statut) setAbo(statut);
      setFactures(facts);
    }).finally(() => setLoading(false));
  }, []);

  function handleUpgrade(plan: 'ESSENTIEL' | 'COMPLET' | 'PILOTAGE', annual: boolean) {
    setSelectedPlan(plan);
    setSelectedAnnual(annual);
    setShowIbanForm(true);
    setFormError(null);
    setSuccessMessage(null);
    setCgvAcceptee(false);
  }

  async function handleSubmitIban() {
    const ibanClean = iban.replace(/\s+/g, '').toUpperCase();
    if (ibanClean.length < 15) { setFormError('IBAN trop court'); return; }
    if (!titulaire.trim()) { setFormError('Titulaire requis'); return; }
    if (!selectedPlan) return;
    if (!cgvAcceptee) { setFormError('Vous devez accepter les Conditions Générales de Vente'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      await souscrireAbonnement(selectedPlan, selectedAnnual ? 'ANNUEL' : 'MENSUEL', ibanClean, titulaire.trim(), cgvAcceptee);
      setShowIbanForm(false);
      setSuccessMessage('Abonnement activé ! Votre premier prélèvement sera effectué sous 2-3 jours ouvrés.');
      setIban('');
      setTitulaire('');
      const updated = await getAbonnementStatut();
      setAbo(updated);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Erreur lors de l\'activation. Vérifiez votre IBAN et réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemanderExtension() {
    setExtensionLoading(true);
    setExtensionError(null);
    setExtensionMessage(null);
    try {
      await demanderExtension();
      const updated = await getAbonnementStatut();
      setAbo(updated);
      setExtensionMessage('+14 jours ajoutés à votre essai.');
    } catch (err: any) {
      // Remonte notamment « Une extension a déjà été accordée pour cet essai. »
      setExtensionError(err?.response?.data?.message || "Erreur lors de la demande d'extension. Réessayez.");
    } finally {
      setExtensionLoading(false);
    }
  }

  async function handleAnnuler() {
    const dateFin = formatDateFr(abo?.actifJusquAu ?? null);
    if (!window.confirm('Êtes-vous sûr ? Votre abonnement restera actif jusqu\'au ' + dateFin + '.')) {
      return;
    }
    try {
      await annulerAbonnement();
      const updated = await getAbonnementStatut().catch(() => null);
      if (updated) setAbo(updated);
    } catch {
      alert('Erreur lors de l\'annulation. Réessayez.');
    }
  }

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/hebergeur" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Abonnement</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 32 }}>Gérez votre plan et vos accès.</p>

        {/* ── Bandeau statut ──────────────────────────────────────────── */}
        {!loading && (() => {
          // 1. Succès souscription
          if (successMessage) {
            return (
              <div style={{
                backgroundColor: '#E6F4EE', border: '1px solid #1E5C42',
                borderRadius: 12, padding: '16px 20px', marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{successMessage}</span>
              </div>
            );
          }
          if (!abo) return null;
          // 2. Essai en cours
          if (abo.isTrial && abo.actif) {
            return (
              <div style={{
                backgroundColor: '#FFF8E6', border: '1px solid #C87D2E',
                borderRadius: 12, padding: '16px 20px', marginBottom: 32,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#C87D2E',
                  backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: 20,
                }}>
                  Essai gratuit
                </span>
                <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  Plan Pilotage &middot; <strong>{abo.joursRestants} jours restants</strong>
                </span>
                <button
                  onClick={handleDemanderExtension}
                  disabled={extensionLoading}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: 13,
                    color: '#C87D2E', textDecoration: 'underline',
                    cursor: extensionLoading ? 'wait' : 'pointer',
                  }}
                >
                  {extensionLoading ? 'Demande en cours…' : 'Demander 14 jours de plus'}
                </button>
                {extensionMessage && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1E5C42' }}>{extensionMessage}</span>
                )}
                {extensionError && (
                  <span style={{ fontSize: 13, color: '#9C2B2B' }}>{extensionError}</span>
                )}
              </div>
            );
          }
          // 3. Essai expiré
          if (abo.trialExpire) {
            return (
              <div style={{
                backgroundColor: '#FDECEA', border: '1px solid #9C2B2B',
                borderRadius: 12, padding: '16px 20px', marginBottom: 32,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  Votre essai gratuit a expiré. Activez un abonnement pour retrouver l&apos;accès complet.
                </span>
                <button
                  onClick={handleDemanderExtension}
                  disabled={extensionLoading}
                  style={{
                    backgroundColor: '#C87D2E', color: '#FFFFFF', border: 'none',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                    cursor: extensionLoading ? 'wait' : 'pointer',
                    opacity: extensionLoading ? 0.6 : 1,
                  }}
                >
                  {extensionLoading ? 'Demande en cours…' : 'Demander 14 jours de plus'}
                </button>
                {extensionError && (
                  <span style={{ fontSize: 13, color: '#9C2B2B' }}>{extensionError}</span>
                )}
              </div>
            );
          }
          // 4. Abonnement actif payé
          if (abo.actif && abo.mandatActif) {
            return (
              <>
                <div style={{
                  backgroundColor: '#E6F4EE', border: '1px solid #1E5C42',
                  borderRadius: 12, padding: '16px 20px', marginBottom: abo.mollieSubscriptionId ? 8 : 32,
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: '#1E5C42',
                    backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: 20,
                  }}>
                    Abonnement actif
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                    Plan {PLAN_LABELS[abo.plan] ?? abo.plan} &middot; {abo.type === 'MENSUEL' ? 'Mensuel' : 'Annuel'}
                  </span>
                  {abo.actifJusquAu && (
                    <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                      &middot; Actif jusqu&apos;au <strong>{formatDateFr(abo.actifJusquAu)}</strong>
                    </span>
                  )}
                </div>
                {abo.mandatActif && abo.mollieSubscriptionId && (
                  <button
                    onClick={handleAnnuler}
                    style={{
                      display: 'block', marginBottom: 32, background: 'none', border: 'none',
                      padding: 0, fontSize: 13, color: 'var(--color-text-muted)',
                      textDecoration: 'underline', cursor: 'pointer',
                    }}
                  >
                    Annuler le renouvellement automatique
                  </button>
                )}
              </>
            );
          }
          // 4bis. Plan actif sans mandat (plan offert / admin)
          if (abo.actif && !abo.mandatActif && !abo.isTrial && abo.plan !== 'DECOUVERTE') {
            return (
              <div style={{
                backgroundColor: '#E6F4EE', border: '1px solid #1E5C42',
                borderRadius: 12, padding: '16px 20px', marginBottom: 32,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#1E5C42',
                  backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: 20,
                }}>
                  Plan actif
                </span>
                <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  Plan {PLAN_LABELS[abo.plan] ?? abo.plan}
                </span>
              </div>
            );
          }
          // 5. Découverte / défaut
          return (
            <div style={{
              backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: '16px 20px', marginBottom: 32,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)',
                backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: 20,
                border: '1px solid var(--color-border)',
              }}>
                Plan Découverte — gratuit
              </span>
            </div>
          );
        })()}

        {/* ── Formulaire IBAN (souscription SEPA) ──────────────────────── */}
        {showIbanForm && selectedPlan && (
          <div style={{
            background: 'white', border: '1px solid var(--color-border, #D3D1C7)',
            borderRadius: 12, padding: 24, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1B4060', margin: 0 }}>
                Activer le plan {PLAN_LABELS[selectedPlan]} — {selectedAnnual ? 'Annuel' : 'Mensuel'}
              </h3>
              <button onClick={() => { setShowIbanForm(false); setCgvAcceptee(false); }} style={{ background: 'none', border: 'none', fontSize: 13, color: '#888', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>

            <p style={{ fontSize: 14, color: '#4a4a4a', marginBottom: 20 }}>
              Montant : <strong>{selectedAnnual
                ? `${(((selectedPlan === 'ESSENTIEL' ? 290 : selectedPlan === 'COMPLET' ? 490 : 690) * 100) / 100).toFixed(0)}€ HT/an`
                : `${selectedPlan === 'ESSENTIEL' ? 29 : selectedPlan === 'COMPLET' ? 49 : 69}€ HT/mois`
              }</strong>
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>IBAN</label>
              <input
                type="text"
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                style={{ width: '100%', border: '1px solid #D3D1C7', borderRadius: 8, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Titulaire du compte</label>
              <input
                type="text"
                placeholder="Nom du titulaire"
                value={titulaire}
                onChange={(e) => setTitulaire(e.target.value)}
                style={{ width: '100%', border: '1px solid #D3D1C7', borderRadius: 8, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                id="cgv-checkbox"
                checked={cgvAcceptee}
                onChange={(e) => setCgvAcceptee(e.target.checked)}
                style={{ marginTop: 3, accentColor: '#1B4060' }}
              />
              <label htmlFor="cgv-checkbox" style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                J&apos;accepte les{' '}
                <a href="/legal/cgv-hebergeurs" target="_blank" rel="noopener noreferrer" style={{ color: '#1B4060', textDecoration: 'underline' }}>
                  Conditions Générales de Vente
                </a>
              </label>
            </div>

            {formError && (
              <p style={{ fontSize: 13, color: '#9C2B2B', marginBottom: 12 }}>{formError}</p>
            )}

            <button
              onClick={handleSubmitIban}
              disabled={submitting || !cgvAcceptee}
              style={{
                width: '100%', background: '#1B4060', color: 'white', border: 'none',
                borderRadius: 8, padding: '12px 0', fontSize: 14, fontWeight: 600,
                cursor: submitting ? 'wait' : (!cgvAcceptee ? 'not-allowed' : 'pointer'), opacity: (submitting || !cgvAcceptee) ? 0.7 : 1,
              }}
            >
              {submitting ? 'Activation en cours...' : 'Activer le prélèvement SEPA'}
            </button>

            <p style={{ fontSize: 11, color: '#888', marginTop: 10, lineHeight: 1.5 }}>
              En activant, vous autorisez LIAVO SASU (SIREN 102 994 910) à prélever le montant indiqué sur ce compte via prélèvement SEPA Core.
              Vous pouvez annuler à tout moment depuis cette page.
            </p>
          </div>
        )}

        <PricingTable
          showCurrentPlan
          currentStatut={abo?.statut ?? null}
          onUpgrade={handleUpgrade}
          /* Plan réellement souscrit uniquement — jamais pendant l'essai (conversion) */
          currentPlan={abo && !abo.isTrial && abo.actif ? abo.plan : null}
        />

        {factures.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1B4060', marginBottom: 16 }}>
              Mes factures
            </h2>
            <div style={{
              border: '1px solid var(--color-border, #D3D1C7)', borderRadius: 12,
              overflow: 'hidden', background: 'white',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f5f7fa', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>N°</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Date</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Description</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Montant HT</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151', textAlign: 'center' }}>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {factures.map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '10px 16px', color: '#374151', fontWeight: 500 }}>{f.numero}</td>
                      <td style={{ padding: '10px 16px', color: '#4a4a4a' }}>{formatDateFr(f.dateEmission)}</td>
                      <td style={{ padding: '10px 16px', color: '#4a4a4a' }}>{f.description}</td>
                      <td style={{ padding: '10px 16px', color: '#374151', fontWeight: 500, textAlign: 'right' }}>
                        {(f.montantHT / 100).toFixed(2)} €
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        {f.pdfUrl ? (
                          <a href={f.pdfUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#1B4060', textDecoration: 'underline', fontSize: 13 }}>
                            Télécharger
                          </a>
                        ) : (
                          <span style={{ color: '#999', fontSize: 13 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
