import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Page introuvable
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          La page que vous cherchez n&apos;existe pas.
        </p>
        <Link
          href="/"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4f46e5',
            color: 'white',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
