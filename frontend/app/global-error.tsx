'use client';

/**
 * Un deploy pendant qu'un onglet est ouvert invalide les IDs de Server Actions
 * (« Failed to find Server Action … This request might be from an older or newer
 * deployment ») — bénin, un rechargement règle. Détection best-effort sur le
 * message ; jamais de reload() automatique, l'utilisateur garde la main
 * (formulaire en cours, etc.).
 */
function isStaleDeploymentError(error: Error & { digest?: string }): boolean {
  return /server action|deployment/i.test(error.message ?? '');
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const staleDeploy = isStaleDeploymentError(error);

  return (
    <html lang="fr">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 16px' }}>
            {staleDeploy ? (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1B4060' }}>
                  Une nouvelle version de LIAVO a été déployée
                </h2>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                  Cette page date de la version précédente. Rechargez-la pour continuer — vous ne perdrez que la saisie en cours.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#1B4060',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Recharger la page
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Une erreur est survenue
                </h2>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{error.message}</p>
                <button
                  onClick={reset}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Réessayer
                </button>
              </>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
