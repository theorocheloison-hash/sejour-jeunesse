'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import CentreSelector from '@/src/components/hebergeur/CentreSelector';
import type { CentrePermissions } from '@/src/hooks/usePermissions';

const PLAN_RANK: Record<string, number> = {
  DECOUVERTE: 0,
  ESSENTIEL: 1,
  COMPLET: 2,
  PILOTAGE: 3,
};

interface HebergeurSidebarProps {
  centre: {
    nom: string | null;
    ville: string | null;
    imageUrl?: string | null;
  } | null;
  planAbonnement?: string | null;
  demandesCount: number;
  rappelsCount: number;
  actionsFactCount: number;
  sejoursNonLusCount: number;
  permissions: CentrePermissions | null;
  permissionsLoading: boolean;
  onLogout: () => void;
  /** Drawer mobile (< md) : ouvert/fermé. Sans effet en ≥ md (sidebar toujours visible). */
  open: boolean;
  /** Ferme le drawer mobile (backdrop, clic sur un lien de navigation). */
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: { count: number; color: 'red' | 'orange' };
  requiredPlan?: 'ESSENTIEL' | 'COMPLET' | 'PILOTAGE';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Heroicons outline path data
const ICONS = {
  squares2x2:        'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  envelope:          'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  documentText:      'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  users:             'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  calendarDays:      'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  bars3BottomLeft:   'M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5',
  folderOpen:        'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
  buildingStorefront:'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z',
  creditCard:        'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 005.25 21z',
  clipboardDocList:  'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  chartBarSquare:    'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z',
  clipboardCheck:    'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75',
  arrowRightOnRect:  'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  userPlus:          'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
};

// Mapping route → module de permission (pour filtrer la navigation)
const ROUTE_PERMISSION: Record<string, keyof Omit<CentrePermissions, 'isOwner'>> = {
  '/dashboard/hebergeur/planning': 'planning',
  '/dashboard/hebergeur/disponibilites': 'planning',
  '/dashboard/hebergeur/sejours': 'sejours',
  '/dashboard/hebergeur/demandes': 'sejours',
  '/dashboard/hebergeur/devis': 'devis',
  '/dashboard/hebergeur/rentabilite': 'facturation',
  '/dashboard/hebergeur/pilotage': 'facturation',
  '/dashboard/hebergeur/clients': 'crm',
  '/dashboard/hebergeur/catalogue': 'parametres',
  '/dashboard/hebergeur/profil': 'parametres',
  '/dashboard/hebergeur/documents': 'parametres',
  '/dashboard/hebergeur/parametres/inscription': 'parametres',
  '/dashboard/hebergeur/abonnement': 'parametres',
  '/dashboard/hebergeur/equipe': 'parametres',
};

const NAV_GROUPS_BASE: { label: string; items: Omit<NavItem, 'badge'>[] }[] = [
  {
    label: '',
    items: [
      { href: '/dashboard/hebergeur', label: 'Tableau de bord', icon: ICONS.squares2x2 },
    ],
  },
  {
    label: 'Activité',
    items: [
      { href: '/dashboard/hebergeur/sejours',   label: 'Séjours',  icon: ICONS.clipboardDocList },
      { href: '/dashboard/hebergeur/planning',   label: 'Planning', icon: ICONS.calendarDays },
      { href: '/dashboard/hebergeur/demandes',   label: 'Demandes', icon: ICONS.envelope },
      { href: '/dashboard/hebergeur/inviter-enseignant', label: 'Inviter', icon: ICONS.userPlus },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/dashboard/hebergeur/devis',    label: 'Devis & Facturation', icon: ICONS.documentText },
      { href: '/dashboard/hebergeur/clients',  label: 'CRM clients',         icon: ICONS.users, requiredPlan: 'COMPLET' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { href: '/dashboard/hebergeur/pilotage', label: 'Pilotage', icon: ICONS.chartBarSquare, requiredPlan: 'PILOTAGE' },
    ],
  },
  {
    label: 'Paramètres',
    items: [
      { href: '/dashboard/hebergeur/catalogue',        label: 'Catalogue & tarifs',   icon: ICONS.bars3BottomLeft },
      { href: '/dashboard/hebergeur/profil',           label: 'Profil',               icon: ICONS.buildingStorefront },
      { href: '/dashboard/hebergeur/documents',        label: 'Documents',            icon: ICONS.folderOpen },
      { href: '/dashboard/hebergeur/parametres/inscription', label: 'Fiche d\'inscription', icon: ICONS.clipboardCheck },
      { href: '/dashboard/hebergeur/equipe',           label: 'Mon équipe',           icon: ICONS.users, requiredPlan: 'COMPLET' },
      { href: '/dashboard/hebergeur/abonnement',       label: 'Abonnement',           icon: ICONS.creditCard },
    ],
  },
];

export default function HebergeurSidebar({
  centre,
  planAbonnement,
  demandesCount,
  rappelsCount,
  actionsFactCount,
  sejoursNonLusCount,
  permissions,
  permissionsLoading,
  onLogout,
  open,
  onClose,
}: HebergeurSidebarProps) {
  const pathname = usePathname();
  const { user, isMultiCentre, centres, centreActif } = useAuth();
  // Statut du centre courant — déjà chargé par AuthContext (mes-centres), aucun appel ajouté.
  const centreActifPending = centres.find((c) => c.id === centreActif)?.statut === 'PENDING';

  const groups: NavGroup[] = NAV_GROUPS_BASE.map((g) => ({
    ...g,
    items: g.items
      .filter((item) => {
        // Pas encore chargé → ne rien masquer (évite le flash ; cas fréquent = propriétaire)
        if (!permissions || permissionsLoading) return true;
        if (permissions.isOwner) return true;
        // Équipe → propriétaire uniquement
        if (item.href === '/dashboard/hebergeur/equipe') return false;
        const mod = ROUTE_PERMISSION[item.href];
        if (!mod) return true;
        return permissions[mod] !== 'NONE';
      })
      .map((item) => {
        let badge: NavItem['badge'] = undefined;
        if (item.href === '/dashboard/hebergeur/demandes' && demandesCount > 0) {
          badge = { count: demandesCount, color: 'red' };
        } else if (item.href === '/dashboard/hebergeur/devis' && actionsFactCount > 0) {
          badge = { count: actionsFactCount, color: 'orange' };
        } else if (item.href === '/dashboard/hebergeur/clients' && rappelsCount > 0) {
          badge = { count: rappelsCount, color: 'red' };
        } else if (item.href === '/dashboard/hebergeur/sejours' && sejoursNonLusCount > 0) {
          badge = { count: sejoursNonLusCount, color: 'red' };
        }
        return { ...item, badge };
      }),
  })).filter((g) => g.items.length > 0);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : (user?.email?.[0] ?? 'H').toUpperCase();
  const fullName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : (user?.email ?? '');

  // Paramètres collapsé par défaut, auto-expand si on est sur une page Paramètres
  const parametresRoutes = [
    '/dashboard/hebergeur/catalogue',
    '/dashboard/hebergeur/disponibilites',
    '/dashboard/hebergeur/profil',
    '/dashboard/hebergeur/documents',
    '/dashboard/hebergeur/parametres',
    '/dashboard/hebergeur/equipe',
    '/dashboard/hebergeur/abonnement',
  ];
  const isOnParametresPage = parametresRoutes.some((r) => pathname.startsWith(r));
  const [parametresOpen, setParametresOpen] = useState(isOnParametresPage);

  // Auto-ouvrir Paramètres si navigation vers une page Paramètres
  useEffect(() => {
    if (isOnParametresPage) setParametresOpen(true);
  }, [isOnParametresPage]);

  return (
    <aside
      className={`flex flex-col h-screen w-[220px] min-w-[220px] top-0 overflow-y-auto print:hidden
        fixed left-0 z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}
        md:sticky md:z-auto md:translate-x-0 md:transition-none`}
      style={{ background: '#1B4060' }}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <Link
        href="/dashboard/hebergeur"
        onClick={onClose}
        className="shrink-0 flex items-center gap-2"
        style={{ padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}
      >
        <img
          src="/web-app-manifest-192x192.png"
          alt="Liavo"
          width={28}
          height={28}
          style={{ borderRadius: 6 }}
        />
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>Liavo</span>
      </Link>

      {/* ── Contexte centre ──────────────────────────────────── */}
      {isMultiCentre ? (
        <CentreSelector />
      ) : (
        <div
          className="shrink-0"
          style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
            Centre
          </p>
          <p
            className="truncate"
            style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}
          >
            {centre?.nom ?? '—'}
          </p>
          {centre?.ville && (
            <p
              className="truncate"
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
            >
              {centre.ville}
            </p>
          )}
          {centreActifPending && (
            <span
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: 10,
                fontWeight: 600,
                color: '#C87D2E',
                background: 'rgba(200,125,46,0.18)',
                border: '1px solid rgba(200,125,46,0.45)',
              }}
            >
              En validation
            </span>
          )}
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: '12px 8px' }}
      >
        {isMultiCentre && (() => {
          const href = '/dashboard/hebergeur/global';
          const active = pathname === href;
          return (
            <Link
              href={href}
              onClick={onClose}
              className="hover:!bg-white/15 hover:!text-white"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                color: active ? '#fff' : 'rgba(255,255,255,0.85)',
                background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                marginBottom: 12,
              }}
            >
              <svg
                width={16}
                height={16}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}
                style={{ flexShrink: 0 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.squares2x2} />
              </svg>
              <span className="truncate">Vue globale</span>
            </Link>
          );
        })()}
        {groups.map((group, gIdx) => {
          const isParametres = group.label === 'Paramètres';
          const showItems = isParametres ? parametresOpen : true;
          return (
          <div key={group.label} style={{ marginTop: gIdx === 0 ? 0 : 16 }}>
            {group.label && (
              isParametres ? (
                <button
                  type="button"
                  onClick={() => setParametresOpen((o) => !o)}
                  className="hover:!text-white/70"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    padding: '0 8px',
                    marginBottom: 4,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {group.label}
                  <svg
                    width={12}
                    height={12}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    style={{
                      transition: 'transform 150ms',
                      transform: parametresOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              ) : (
                <p
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    padding: '0 8px',
                    marginBottom: 4,
                  }}
                >
                  {group.label}
                </p>
              )
            )}
            {showItems && (
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                // Sous-routes (ex. /pilotage/ca) highlightent leur parent ; le tableau
                // de bord racine reste en match exact pour ne pas s'allumer partout.
                const active = item.href === '/dashboard/hebergeur'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/');
                const baseStyle: React.CSSProperties = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 8px',
                  borderRadius: 7,
                  fontSize: 13,
                  textDecoration: 'none',
                  transition: 'background 120ms, color 120ms',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
                };
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      style={baseStyle}
                      className="hover:!bg-white/10 hover:!text-white/90"
                    >
                      <svg
                        width={15}
                        height={15}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.7}
                        style={{ opacity: 0.85, flexShrink: 0 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className="truncate">{item.label}</span>
                      {item.badge && item.badge.count > 0 && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            background: item.badge.color === 'orange' ? '#EA580C' : '#EF4444',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 500,
                            padding: '1px 6px',
                            borderRadius: 10,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.badge.count}
                        </span>
                      )}
                      {item.requiredPlan && (PLAN_RANK[planAbonnement ?? 'DECOUVERTE'] ?? 0) < (PLAN_RANK[item.requiredPlan] ?? 0) && !item.badge?.count && (
                        <svg
                          width={12}
                          height={12}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          style={{ marginLeft: 'auto', opacity: 0.4, flexShrink: 0 }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          );
        })}

        {/* ── Ajouter un centre (propriétaires uniquement) ──── */}
        {(!permissions || permissions.isOwner) && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link
            href="/dashboard/hebergeur/centres/nouveau"
            onClick={onClose}
            className="hover:!bg-white/10 hover:!text-white/80"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 8px',
              borderRadius: 7,
              fontSize: 13,
              textDecoration: 'none',
              color: 'rgba(255,255,255,0.5)',
              transition: 'background 120ms, color 120ms',
            }}
          >
            <svg
              width={15}
              height={15}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.7}
              style={{ opacity: 0.85, flexShrink: 0 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="truncate">Ajouter un centre</span>
          </Link>
        </div>
        )}
      </nav>

      {/* ── Footer user ─────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-2"
        style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 500, flexShrink: 0 }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
            {fullName}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
            Hébergeur
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Déconnexion"
          aria-label="Déconnexion"
          className="shrink-0 hover:!text-white"
          style={{ color: 'rgba(255,255,255,0.4)', padding: 4 }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.arrowRightOnRect} />
          </svg>
        </button>
      </div>
    </aside>
  );
}
