'use client'

export function ActeursSchema() {
  const acteurs = [
    { id: 'rectorat',    label: 'Rectorat',    role: 'Valide réglementairement le dossier complet',      x: '50%',  y: '8%'  },
    { id: 'directeur',   label: 'Directeur',   role: 'Approuve le séjour et le choix de l\'hébergeur',   x: '8%',   y: '42%' },
    { id: 'hebergeur',   label: 'Hébergeur',   role: 'Répond aux appels d\'offres, émet devis et factures', x: '92%', y: '42%' },
    { id: 'enseignant',  label: 'Enseignant',  role: 'Crée le séjour, lance l\'appel d\'offres',         x: '20%',  y: '88%' },
    { id: 'parents',     label: 'Parents',     role: 'Signent l\'autorisation, règlent en 1 à 10 fois',  x: '80%',  y: '88%' },
  ]

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <svg viewBox="0 0 640 420" style={{ width: '100%', height: 'auto' }}>
        {/* Lignes de connexion vers le centre (320, 210) */}
        {acteurs.map(a => {
          const cx = parseFloat(a.x) / 100 * 640
          const cy = parseFloat(a.y) / 100 * 420
          return (
            <line key={a.id}
              x1={cx} y1={cy} x2={320} y2={210}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
              opacity="0.4"
            />
          )
        })}

        {/* Nœud central LIAVO */}
        <rect x={270} y={185} width={100} height={50} rx={10}
          fill="var(--color-primary)" />
        <text x={320} y={215} textAnchor="middle"
          fill="white" fontSize="16" fontWeight="500"
          fontFamily="var(--font-sans)" letterSpacing="0.04em">
          Liavo
        </text>
        <circle cx={320} cy={188} r={5} fill="var(--color-accent)" />

        {/* Nœuds acteurs */}
        {acteurs.map(a => {
          const cx = parseFloat(a.x) / 100 * 640
          const cy = parseFloat(a.y) / 100 * 420
          return (
            <g key={a.id}>
              <rect x={cx - 52} y={cy - 18} width={104} height={36} rx={8}
                fill="var(--color-primary-light)"
                stroke="var(--color-border-strong)"
                strokeWidth="0.5"
              />
              <text x={cx} y={cy + 5} textAnchor="middle"
                fill="var(--color-primary)" fontSize="13" fontWeight="500"
                fontFamily="var(--font-sans)">
                {a.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Légendes rôles sous le schéma — grille 2 colonnes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px 24px',
        marginTop: 24,
      }}>
        {acteurs.map(a => (
          <div key={a.id}>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-sans)',
            }}>
              {a.label}
            </span>
            <span style={{
              fontSize: 12, color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-sans)',
              marginLeft: 6,
            }}>
              — {a.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
