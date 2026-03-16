'use client'

interface LogoProps {
  variant?: 'light' | 'dark'
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { icon: 28, wordmark: 16, tagline: 10 },
  md: { icon: 42, wordmark: 21, tagline: 11 },
  lg: { icon: 56, wordmark: 28, tagline: 13 },
}

export function Logo({
  variant = 'light',
  showTagline = true,
  size = 'md'
}: LogoProps) {
  const s = sizes[size]
  const wordmarkColor = variant === 'dark' ? '#FFFFFF' : '#1B4060'
  const taglineColor  = variant === 'dark' ? 'rgba(255,255,255,0.5)' : '#888780'
  const iconBg        = variant === 'dark' ? 'rgba(255,255,255,0.1)' : '#1B4060'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={s.icon} height={s.icon} viewBox="0 0 42 42" fill="none">
        <rect width="42" height="42" rx="10" fill={iconBg}/>
        <rect x="15" y="7" width="13" height="13" rx="2.5"
              transform="rotate(45 21 13.5)"
              fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"/>
        <circle cx="21" cy="13.5" r="2.2" fill="#C87D2E"/>
        <line x1="21" y1="22" x2="21" y2="32"
              stroke="white" strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
        <line x1="14" y1="32" x2="28" y2="32"
              stroke="white" strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
      </svg>
      <div>
        <div style={{
          fontSize: s.wordmark,
          fontWeight: 500,
          color: wordmarkColor,
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-sans)',
        }}>
          Liavo
        </div>
        {showTagline && (
          <div style={{
            fontSize: s.tagline,
            color: taglineColor,
            letterSpacing: '0.01em',
            marginTop: 2,
            fontFamily: 'var(--font-sans)',
          }}>
            Coordonnez vos séjours
          </div>
        )}
      </div>
    </div>
  )
}
