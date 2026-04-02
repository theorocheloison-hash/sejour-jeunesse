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

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'VENUE') {
      getAbonnementStatut().then(setAbo).catch(() => {});
    }
  }, [user]);

  // TODO: Stripe — remplacer le corps par un appel a l'API de checkout Stripe
  function handleUpgrade(plan: 'ESSENTIEL' | 'COMPLET', annual: boolean) {
    const subject = encodeURIComponent('Abonnement ' + plan + ' LIAVO \u2014 ' + (annual ? 'Annuel' : 'Mensuel'));
    const body = encodeURIComponent('Bonjour, je souhaite activer le plan ' + plan + ' (' + (annual ? 'annuel' : 'mensuel') + ') pour mon centre.');
    window.location.href = 'mailto:contact@liavo.fr?subject=' + subject + '&body=' + body;
  }

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Abonnement</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 32 }}>Gerez votre plan et vos acces.</p>

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
              Plan {abo.type === 'MENSUEL' ? 'Mensuel' : 'Annuel'}
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
              Contactez-nous pour reactiver :{' '}
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
              Plan Decouverte &mdash; gratuit
            </span>
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
