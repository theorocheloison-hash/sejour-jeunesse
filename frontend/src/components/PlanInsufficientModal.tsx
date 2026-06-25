'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlanInsufficientEvent {
  planRequired: string;
  planActuel: string;
  message: string;
}

const PLAN_LABELS: Record<string, string> = {
  ESSENTIEL: 'Essentiel',
  COMPLET: 'Complet',
  PILOTAGE: 'Pilotage',
};

export default function PlanInsufficientModal() {
  const [info, setInfo] = useState<PlanInsufficientEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PlanInsufficientEvent>).detail;
      setInfo(detail);
    };
    window.addEventListener('plan-insufficient', handler);
    return () => window.removeEventListener('plan-insufficient', handler);
  }, []);

  if (!info) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={() => setInfo(null)}>
      <div
        style={{
          background: 'white', borderRadius: 16, padding: '32px 28px',
          maxWidth: 420, width: '90%', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#FEF3E2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C87D2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1B4060', margin: '0 0 8px' }}>
          Fonctionnalité réservée
        </h3>
        <p style={{ fontSize: 14, color: '#4a4a4a', lineHeight: 1.6, margin: '0 0 24px' }}>
          {info.message}
        </p>
        <Link
          href="/dashboard/hebergeur/abonnement"
          onClick={() => setInfo(null)}
          style={{
            display: 'inline-block', background: '#1B4060', color: 'white',
            padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Voir les plans →
        </Link>
        <button
          onClick={() => setInfo(null)}
          style={{
            display: 'block', margin: '12px auto 0', fontSize: 13,
            color: '#888', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
