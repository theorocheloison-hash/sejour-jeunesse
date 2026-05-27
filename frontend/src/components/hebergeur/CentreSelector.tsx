'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';

const truncate = (s: string, n = 20) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function CentreSelector() {
  const { centres, centreActif, setCentreActif, isMultiCentre } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!isMultiCentre) return null;

  const current = centres.find(c => c.id === centreActif) ?? centres[0];

  return (
    <div ref={containerRef} className="relative" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
        Centre actif
      </p>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-left"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          padding: '8px 10px',
          color: '#fff',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <span className="flex-1 truncate">{current ? truncate(current.nom) : '—'}</span>
        <svg
          width={14}
          height={14}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ opacity: 0.7, transition: 'transform 120ms', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 z-30 overflow-hidden"
          style={{
            top: 'calc(100% - 6px)',
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Link
            href="/dashboard/hebergeur/global"
            onClick={() => setOpen(false)}
            className="block hover:bg-gray-50"
            style={{
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-primary)',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            🏠 Vue globale
          </Link>
          <ul className="max-h-64 overflow-y-auto">
            {centres.map(c => {
              const active = c.id === centreActif;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setCentreActif(c.id); }}
                    className="w-full text-left hover:bg-gray-50"
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      color: active ? 'var(--color-primary)' : '#111827',
                      fontWeight: active ? 600 : 400,
                      background: active ? 'rgba(27,64,96,0.06)' : 'transparent',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                      display: 'block',
                    }}
                  >
                    <span className="block truncate">{c.nom}</span>
                    <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)' }} className="block truncate">{c.ville}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
