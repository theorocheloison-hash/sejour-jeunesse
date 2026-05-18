'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAbonnementStatut } from '@/src/lib/abonnement';
import type { AbonnementStatut } from '@/src/lib/abonnement';
import PricingTable from '@/app/components/PricingTable';

export default function AbonnementPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [abo, setAbo] = useState<AbonnementStatut | null>(null);
  const [upgradeRequested, setUpgradeRequested] = useState(false);
  const [planChoisi, setPlanChoisi] = useState<string | null>(null);
  const [annuelChoisi, setAnnuelChoisi] = useState(false);


  useEffect(() => {
    if (user?.role === 'HEBERGEUR') {
      getAbonnementStatut().then(setAbo).catch(() => {});
    }
  }, [user]);

  function handleUpgrade(plan: 'ESSENTIEL' | 'COMPLET', annual: boolean) {
    setPlanChoisi(plan);
    setAnnuelChoisi(annual);
    setUpgradeRequested(true);
  }

  if (isLoading || !user) return null;

  const PLAN_LABELS: Record<string, string> = {
    DECOUVERTE: 'Plan Découverte',
    ESSENTIEL: 'Plan Essentiel',
    COMPLET: 'Plan Complet',
  };
  const nomPlan = abo?.statut === 'ACTIF' && abo.plan
    ? `${PLAN_LABELS[abo.plan] ?? abo.plan} — ${abo.type === 'MENSUEL' ? 'Mensuel' : 'Annuel'}`
    : null;

  const PLAN_LABELS_UPGRADE: Record<string, string> = {
    ESSENTIEL: 'Plan Essentiel',
    COMPLET: 'Plan Complet',
  };
  const planLabel = planChoisi ? PLAN_LABELS_UPGRADE[planChoisi] ?? planChoisi : 'un abonnement';
  const periodeLabel = annuelChoisi ? 'annuel' : 'mensuel';
  const mailtoBody = `Bonjour,%0A%0AJe souhaite activer le ${planLabel} (${periodeLabel}) sur LIAVO.%0A%0AMon centre : [votre nom de centre]%0A%0AMerci.`;
  const mailtoSubject = `Activation ${planLabel} ${periodeLabel} — LIAVO`;

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
        {abo?.statut === 'ACTIF' ? (
          <div style={{
            backgroundColor: '#E6F4EE', border: '1px solid #1E5C42',
            borderRadius: 12, padding: '16px 20px', marginBottom: 32,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#1E5C42',
              backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: 20,
            }}>
              Abonnement actif
            </span>
            <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
              {nomPlan}
            </span>
            {abo.actifJusquAu && (
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                &middot; Actif jusqu&apos;au{' '}
                <strong>
                  {new Date(abo.actifJusquAu).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </strong>
              </span>
            )}
          </div>
        ) : abo?.statut === 'SUSPENDU' ? (
          <div style={{
            backgroundColor: '#FDECEA', border: '1px solid #9C2B2B',
            borderRadius: 12, padding: '16px 20px', marginBottom: 32,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#9C2B2B',
              backgroundColor: '#FFFFFF', padding: '3px 10px', borderRadius: 20,
            }}>
              Abonnement suspendu
            </span>
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              Contactez-nous pour réactiver :{' '}
              <a href="mailto:contact@liavo.fr" style={{ color: '#9C2B2B', fontWeight: 500 }}>contact@liavo.fr</a>
            </span>
          </div>
        ) : (
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
        )}

        {upgradeRequested && (
          <div style={{
            backgroundColor: '#E8F0F8',
            border: '1px solid #1B4060',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}>
            <svg style={{ width: 20, height: 20, color: '#1B4060', flexShrink: 0, marginTop: 2 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#1B4060' }}>
                Activation de votre abonnement
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#4a4a4a', lineHeight: 1.6 }}>
                {`Le paiement en ligne sera disponible prochainement.
                Pour activer le ${planLabel} (${periodeLabel}) dès maintenant,
                contactez-nous — nous vous répondons sous 24h.`}
              </p>
              <a
                href={`mailto:contact@liavo.fr?subject=${encodeURIComponent(mailtoSubject).replace(/%20/g, '+')}&body=${mailtoBody}`}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#1B4060',
                  color: '#fff',
                  padding: '9px 20px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Contacter LIAVO → contact@liavo.fr
              </a>
            </div>
          </div>
        )}

        <PricingTable
          showCurrentPlan
          currentStatut={abo?.statut ?? null}
          onUpgrade={handleUpgrade}
        />
      </main>
    </div>
  );
}
