'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAbonnementStatut, checkoutAbonnement, annulerAbonnement } from '@/src/lib/abonnement';
import type { AbonnementStatut } from '@/src/lib/abonnement';
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

function AbonnementContent() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [abo, setAbo] = useState<AbonnementStatut | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAbonnementStatut()
      .then(setAbo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function reloadStatut() {
    const statut = await getAbonnementStatut().catch(() => null);
    if (statut) setAbo(statut);
  }

  async function handleUpgrade(plan: 'ESSENTIEL' | 'COMPLET' | 'PILOTAGE', annual: boolean) {
    setCheckoutLoading(true);
    try {
      const result = await checkoutAbonnement(plan, annual ? 'ANNUEL' : 'MENSUEL');
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erreur lors de la création du paiement. Réessayez.';
      alert(msg);
      setCheckoutLoading(false);
    }
    // Pas de finally : window.location.href quitte la page en cas de succès.
  }

  async function handleAnnuler() {
    const dateFin = formatDateFr(abo?.actifJusquAu ?? null);
    if (!window.confirm('Êtes-vous sûr ? Votre abonnement restera actif jusqu\'au ' + dateFin + '.')) {
      return;
    }
    try {
      await annulerAbonnement();
      await reloadStatut();
    } catch {
      alert('Erreur lors de l\'annulation. Réessayez.');
    }
  }

  if (isLoading || !user) return null;

  const checkoutSuccess = searchParams.get('checkout') === 'success';

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

        {/* ── Retour de Mollie (checkout=success) ─────────────────────── */}
        {checkoutSuccess && !loading && (
          abo?.mandatActif ? (
            <div style={{
              backgroundColor: '#E6F4EE', border: '1px solid #1E5C42',
              borderRadius: 12, padding: '16px 20px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                <strong>Abonnement activé !</strong> Merci pour votre confiance.
              </span>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#E8F0F8', border: '1px solid #1B4060',
              borderRadius: 12, padding: '16px 20px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.6 }}>
                Votre paiement SEPA est en cours de traitement. L&apos;activation sera effective sous 2 jours ouvrés. Vous recevrez un email de confirmation.
              </span>
            </div>
          )
        )}

        {/* ── Bandeau statut ──────────────────────────────────────────── */}
        {!loading && abo && (() => {
          // 1. Essai en cours
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
              </div>
            );
          }
          // 2. Essai expiré
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
              </div>
            );
          }
          // 3. Abonnement actif payé
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
          // 4. Découverte / défaut
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

        {/* ── Plans ───────────────────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          {checkoutLoading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              backgroundColor: 'rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              borderRadius: 12,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid #C8C6BC', borderTopColor: '#1B4060',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>
                Redirection vers Mollie...
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          <PricingTable
            showCurrentPlan
            currentStatut={abo?.statut ?? null}
            onUpgrade={handleUpgrade}
          />
        </div>
      </main>
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense fallback={null}>
      <AbonnementContent />
    </Suspense>
  );
}
