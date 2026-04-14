'use client';

import { useState } from 'react';

interface PricingTableProps {
  showCurrentPlan?: boolean;
  currentStatut?: 'INACTIF' | 'ACTIF' | 'SUSPENDU' | null;
  onUpgrade?: (plan: 'ESSENTIEL' | 'COMPLET', annual: boolean) => void;
}

function CheckIcon({ color, bg }: { color: string; bg: string }) {
  return (
    <span style={{
      flexShrink: 0, width: 14, height: 14, borderRadius: '50%',
      background: bg, display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', marginTop: 1,
    }}>
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1.5,5 4,7.5 8.5,2.5" />
      </svg>
    </span>
  );
}

function DashIcon() {
  return (
    <span style={{
      flexShrink: 0, width: 14, height: 14, borderRadius: '50%',
      background: '#F0EFEB', display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', marginTop: 1,
    }}>
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#D3D1C7" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="5" x2="8" y2="5" />
      </svg>
    </span>
  );
}

function FeatureRow({ label, disabled, checkColor, checkBg }: {
  label: string; disabled?: boolean; checkColor?: string; checkBg?: string;
}) {
  return (
    <li style={{
      display: 'flex', alignItems: 'flex-start', gap: 7,
      fontSize: 12, lineHeight: 1.5,
      color: disabled ? 'var(--color-text-muted, #888780)' : 'var(--color-text, #2C2C2A)',
    }}>
      {disabled
        ? <DashIcon />
        : <CheckIcon color={checkColor!} bg={checkBg!} />
      }
      {label}
    </li>
  );
}

export default function PricingTable({ showCurrentPlan, currentStatut, onUpgrade }: PricingTableProps) {
  const [isAnnual, setIsAnnual] = useState(false);

  const isCurrentDecouverte = !showCurrentPlan || !currentStatut || currentStatut === 'INACTIF';

  function handleUpgradePlan(plan: 'ESSENTIEL' | 'COMPLET') {
    if (onUpgrade) {
      onUpgrade(plan, isAnnual);
      return;
    }
    // Fallback landing : mailto
    const label = plan === 'ESSENTIEL' ? 'Essentiel' : 'Complet';
    const subject = encodeURIComponent(`Abonnement ${label} LIAVO — ${isAnnual ? 'Annuel' : 'Mensuel'}`);
    const body = encodeURIComponent(`Bonjour, je souhaite activer le plan ${label} (${isAnnual ? 'annuel' : 'mensuel'}) pour mon centre.`);
    window.location.href = `mailto:contact@liavo.fr?subject=${subject}&body=${body}`;
  }

  const cardBase: React.CSSProperties = {
    background: 'var(--color-surface, #FFFFFF)',
    border: '0.5px solid var(--color-border, #D3D1C7)',
    borderRadius: 12,
    padding: '1.25rem',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  };

  const featureList: React.CSSProperties = {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: 7, flex: 1,
  };

  const divider: React.CSSProperties = {
    height: '0.5px',
    background: 'var(--color-border, #D3D1C7)',
    margin: '12px 0',
  };

  const ctaBase: React.CSSProperties = {
    marginTop: 16, width: '100%', padding: '9px 0',
    borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: '1.5px solid transparent',
    textAlign: 'center', textDecoration: 'none',
    display: 'block', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: '2rem' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: !isAnnual ? 'var(--color-text, #2C2C2A)' : 'var(--color-text-muted, #888780)' }}>
          Mensuel
        </span>
        <button
          onClick={() => setIsAnnual(a => !a)}
          style={{
            position: 'relative', width: 44, height: 24,
            background: '#1B4060', borderRadius: 12,
            border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: 3,
            width: 18, height: 18, background: 'white', borderRadius: '50%',
            transition: 'transform 0.2s',
            transform: isAnnual ? 'translateX(20px)' : 'translateX(0)',
            display: 'block',
          }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, color: isAnnual ? 'var(--color-text, #2C2C2A)' : 'var(--color-text-muted, #888780)' }}>
          Annuel
        </span>
        {isAnnual && (
          <span style={{
            background: '#E6F4EE', color: '#1E5C42',
            fontSize: 11, fontWeight: 600, padding: '3px 8px',
            borderRadius: 20, letterSpacing: '0.02em',
          }}>
            2 mois offerts
          </span>
        )}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 12,
        marginBottom: '2rem',
      }}>

        {/* ── Découverte ── */}
        <div style={cardBase}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-muted, #888780)', marginBottom: 8 }}>
            Découverte
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text, #2C2C2A)', lineHeight: 1 }}>Gratuit</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #888780)', marginBottom: 12, minHeight: 16 }}>&nbsp;</div>
          <div style={divider} />
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #888780)', lineHeight: 1.5, marginBottom: 12 }}>
            Pour créer votre profil et découvrir les demandes sur votre zone.
          </div>
          <ul style={featureList}>
            <FeatureRow label="Profil public du centre" checkColor="#1E5C42" checkBg="#E6F4EE" />
            <FeatureRow label="Visibilité des demandes sur votre zone" checkColor="#1E5C42" checkBg="#E6F4EE" />
            <FeatureRow label="Réponse aux demandes" disabled />
            <FeatureRow label="Devis et facturation" disabled />
          </ul>
          {onUpgrade ? (
            <button
              disabled={isCurrentDecouverte}
              style={{
                ...ctaBase,
                background: 'transparent',
                borderColor: 'var(--color-border, #D3D1C7)',
                color: 'var(--color-text-muted, #888780)',
                opacity: isCurrentDecouverte ? 0.5 : 1,
                cursor: isCurrentDecouverte ? 'default' : 'pointer',
              }}
            >
              {isCurrentDecouverte ? 'Votre plan actuel' : 'Rétrograder'}
            </button>
          ) : (
            <a href="/register?type=venue" style={{ ...ctaBase, background: 'transparent', borderColor: 'var(--color-border, #D3D1C7)', color: 'var(--color-text-muted, #888780)' }}>
              Créer un compte
            </a>
          )}
        </div>

        {/* ── Essentiel ── */}
        <div style={{ ...cardBase, border: '2px solid #1B4060' }}>
          <div style={{
            position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
            background: '#1B4060', color: 'white',
            fontSize: 11, fontWeight: 600, padding: '3px 12px',
            borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.04em',
          }}>
            Le plus choisi
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#1B4060', marginBottom: 8 }}>
            Essentiel
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--color-text, #2C2C2A)', lineHeight: 1 }}>
              {isAnnual ? '24' : '29'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted, #888780)', fontWeight: 400 }}>€ HT/mois</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #888780)', marginBottom: 12, minHeight: 16 }}>
            {isAnnual
              ? <span>290€ HT/an · <span style={{ color: '#1E5C42', fontWeight: 600 }}>58€ économisés</span></span>
              : <span>&nbsp;</span>
            }
          </div>
          <div style={divider} />
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #888780)', lineHeight: 1.5, marginBottom: 12 }}>
            Pour répondre aux demandes et gérer votre facturation de A à Z.
          </div>
          <ul style={featureList}>
            <FeatureRow label="Tout Découverte" checkColor="#1B4060" checkBg="#E6EEF4" />
            <FeatureRow label="Réponse aux demandes de séjour" checkColor="#1B4060" checkBg="#E6EEF4" />
            <FeatureRow label="Constructeur de devis + catalogue" checkColor="#1B4060" checkBg="#E6EEF4" />
            <FeatureRow label="Signature électronique directeur" checkColor="#1B4060" checkBg="#E6EEF4" />
            <FeatureRow label="Génération facture + export Chorus Pro" checkColor="#1B4060" checkBg="#E6EEF4" />
          </ul>
          <button
            onClick={() => handleUpgradePlan('ESSENTIEL')}
            style={{ ...ctaBase, background: '#1B4060', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            {onUpgrade ? 'Activer ce plan' : 'Commencer'}
          </button>
        </div>

        {/* ── Complet ── */}
        <div style={{ ...cardBase, border: '1.5px solid #C87D2E' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#C87D2E', marginBottom: 8 }}>
            Complet
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--color-text, #2C2C2A)', lineHeight: 1 }}>
              {isAnnual ? '49' : '59'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted, #888780)', fontWeight: 400 }}>€ HT/mois</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #888780)', marginBottom: 12, minHeight: 16 }}>
            {isAnnual
              ? <span>590€ HT/an · <span style={{ color: '#1E5C42', fontWeight: 600 }}>118€ économisés</span></span>
              : <span>&nbsp;</span>
            }
          </div>
          <div style={divider} />
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #888780)', lineHeight: 1.5, marginBottom: 12 }}>
            Pour piloter chaque séjour et fidéliser vos clients dans la durée.
          </div>
          <ul style={featureList}>
            <FeatureRow label="Tout Essentiel" checkColor="#C87D2E" checkBg="#FEF3E2" />
            <FeatureRow label="Espace collaboratif hébergeur + enseignant" checkColor="#C87D2E" checkBg="#FEF3E2" />
            <FeatureRow label="Planning, messagerie, documents partagés" checkColor="#C87D2E" checkBg="#FEF3E2" />
            <FeatureRow label="CRM hébergeur (clients, contacts, rappels)" checkColor="#C87D2E" checkBg="#FEF3E2" />
          </ul>
          <button
            onClick={() => handleUpgradePlan('COMPLET')}
            style={{ ...ctaBase, background: '#C87D2E', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            {onUpgrade ? 'Activer ce plan' : 'Commencer'}
          </button>
        </div>

      </div>

    </div>
  );
}
