'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { Logo } from '@/app/components/Logo';
import { getInvitation, accepterInvitation } from '@/src/lib/invitation-collaboration';
import type { InvitationCollaboration } from '@/src/lib/invitation-collaboration';

type Status = 'loading' | 'ready' | 'not_found' | 'already_accepted' | 'accepting' | 'accepted' | 'error';

export default function RejoindreInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<Status>('loading');
  const [invitation, setInvitation] = useState<InvitationCollaboration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!Cookies.get('token');

  const loadInvitation = useCallback(async () => {
    try {
      const data = await getInvitation(token);
      setInvitation(data);
      setStatus('ready');
    } catch (err: any) {
      if (err?.response?.status === 404) setStatus('not_found');
      else if (err?.response?.status === 409) setStatus('already_accepted');
      else setStatus('not_found');
    }
  }, [token]);

  const handleAccept = useCallback(async () => {
    setStatus('accepting');
    try {
      await accepterInvitation(token);
      setStatus('accepted');
      setTimeout(() => router.push('/dashboard/teacher'), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erreur lors de l\'acceptation');
      setStatus('error');
    }
  }, [token, router]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  // Auto-accept if logged in as teacher
  useEffect(() => {
    if (status === 'ready' && isLoggedIn) {
      handleAccept();
    }
  }, [status, isLoggedIn, handleAccept]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Logo size="md" showTagline={false} />
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text)', marginTop: 24 }}>Invitation introuvable</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    );
  }

  if (status === 'already_accepted') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Logo size="md" showTagline={false} />
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-success)', marginTop: 24 }}>Invitation déjà acceptée</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>Cette invitation a déjà été utilisée.</p>
          <Link href="/dashboard/teacher" style={{ display: 'inline-block', marginTop: 20, fontSize: 14, fontWeight: 500, color: 'var(--color-primary)', textDecoration: 'none' }}>
            Aller au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'accepting') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 16 }}>Création du séjour en cours...</p>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Logo size="md" showTagline={false} />
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-success)', marginTop: 24 }}>Séjour créé avec succès</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>Redirection vers votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Logo size="md" showTagline={false} />
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-danger)', marginTop: 24 }}>Erreur</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  // status === 'ready' && !isLoggedIn
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo size="md" showTagline={false} />
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            fontSize: 12, fontWeight: 500,
            padding: '4px 12px', borderRadius: 'var(--radius-pill)',
            marginBottom: 20,
          }}>
            Invitation à collaborer
          </div>

          {/* Centre info */}
          <h2 style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-primary)', margin: 0 }}>
            {invitation!.centre.nom}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {invitation!.centre.ville} — {invitation!.centre.adresse}
          </p>

          {/* Séparateur accent */}
          <div style={{ width: 32, height: 2, backgroundColor: 'var(--color-accent)', margin: '20px 0', borderRadius: 1 }} />

          {/* Infos séjour */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Séjour</span>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text)', margin: '2px 0 0' }}>
                {invitation!.titreSejourSuggere}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Dates</span>
              <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '2px 0 0' }}>
                Du {fmt(invitation!.dateDebut)} au {fmt(invitation!.dateFin)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Élèves</span>
              <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '2px 0 0' }}>
                {invitation!.nbElevesEstime} élèves
              </p>
            </div>
            {invitation!.message && (
              <div style={{
                marginTop: 8, padding: 12,
                backgroundColor: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14, color: 'var(--color-text-muted)',
                fontStyle: 'italic',
              }}>
                {invitation!.message}
              </div>
            )}
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
            <Link href={`/login?redirect=/rejoindre/${token}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 24px', borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--color-border-strong)',
              color: 'var(--color-primary)', textDecoration: 'none',
              fontSize: 14, fontWeight: 500,
            }}>
              J&apos;ai déjà un compte — Me connecter
            </Link>
            <Link href={`/register/teacher?redirect=/rejoindre/${token}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 24px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF', textDecoration: 'none',
              fontSize: 14, fontWeight: 500,
            }}>
              Je n&apos;ai pas de compte — Créer mon compte
            </Link>
          </div>

          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 16, textAlign: 'center' }}>
            Après connexion, le séjour sera automatiquement créé dans votre tableau de bord.
          </p>
        </div>
      </div>
    </div>
  );
}
