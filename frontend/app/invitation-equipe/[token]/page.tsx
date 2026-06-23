'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';

type Status = 'loading' | 'accepting' | 'accepted' | 'need-login' | 'wrong-role' | 'error-403' | 'error';

interface InvitationInfo {
  email: string;
  acceptedAt: string | null;
  centre: { nom: string };
  inviteur: { prenom: string; nom: string };
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
      {children}
    </div>
  </main>
);

export default function InvitationEquipePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
  const [info, setInfo] = useState<InvitationInfo | null>(null);

  // Formulaire d'inscription collaborateur (état « non connecté »)
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const invitationPath = `/invitation-equipe/${token}`;

  // Détails publics de l'invitation (pour affichage email/centre)
  useEffect(() => {
    if (!token) return;
    api.get<InvitationInfo>(`/collaborateurs/invitation/${token}`)
      .then(({ data }) => setInfo(data))
      .catch(() => {});
  }, [token]);

  // Flux d'acceptation selon l'état d'authentification
  useEffect(() => {
    if (authLoading || !token) return;

    if (!user) {
      setStatus('need-login');
      return;
    }
    if (user.role !== 'HEBERGEUR') {
      setStatus('wrong-role');
      return;
    }

    setStatus('accepting');
    api.post('/collaborateurs/accepter', { token })
      .then(() => {
        setStatus('accepted');
        setTimeout(() => router.push('/dashboard/hebergeur'), 2000);
      })
      .catch((err: any) => {
        const code = err?.response?.status;
        setMessage(err?.response?.data?.message || 'Une erreur est survenue.');
        setStatus(code === 403 ? 'error-403' : 'error');
      });
  }, [authLoading, user, token, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setRegError(null);
    if (password !== confirmPassword) {
      setRegError('Les mots de passe ne correspondent pas');
      setRegistering(false);
      return;
    }
    try {
      const { data } = await api.post('/collaborateurs/register', { token, prenom, nom, password });
      // Login automatique : cookies httpOnly posés par le backend via
      // POST /collaborateurs/register (Phase 3). On ne stocke que le profil, puis
      // full reload pour que l'AuthProvider ré-hydrate la session (router.push ne
      // remonte pas le provider).
      localStorage.setItem('sj_user_v2', JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.prenom,
        lastName: data.user.nom,
        role: data.user.role,
      }));
      window.location.href = '/dashboard/hebergeur';
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message as string | undefined) : null;
      setRegError(msg ?? 'Erreur lors de la création du compte');
      setRegistering(false);
    }
  };

  const goRegister = () => {
    // Persiste la redirection pour qu'après vérification email + login, on revienne ici
    document.cookie = `liavo_post_verify_redirect=${encodeURIComponent(invitationPath)};path=/;max-age=3600`;
    router.push('/register/hebergeur');
  };

  if (status === 'loading' || status === 'accepting' || authLoading) {
    return (
      <Card>
        <div className="flex justify-center mb-4">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
        <p className="text-sm text-gray-500">Vérification de l&apos;invitation…</p>
      </Card>
    );
  }

  if (status === 'accepted') {
    return (
      <Card>
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Invitation acceptée</h1>
        <p className="text-sm text-gray-500">
          Vous avez désormais accès {info ? <>au centre <strong>{info.centre.nom}</strong></> : 'au centre'}.
          Redirection vers votre tableau de bord…
        </p>
      </Card>
    );
  }

  if (status === 'error-403') {
    return (
      <Card>
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Invitation non valide pour ce compte</h1>
        <p className="text-sm text-gray-500">
          Cette invitation a été envoyée à une autre adresse email{info ? <> (<strong>{info.email}</strong>)</> : ''}.
          Connectez-vous avec cette adresse.
        </p>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Invitation introuvable</h1>
        <p className="text-sm text-gray-500">{message || 'Cette invitation est invalide ou a expiré.'}</p>
      </Card>
    );
  }

  if (status === 'wrong-role') {
    return (
      <Card>
        <div className="text-4xl mb-3">🏢</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Compte hébergeur requis</h1>
        <p className="text-sm text-gray-500 mb-5">
          Cette invitation nécessite un compte hébergeur.
          {info ? <> L&apos;invitation a été envoyée à <strong>{info.email}</strong>.</> : ''} Créez un compte
          hébergeur avec cette adresse.
        </p>
        <button onClick={goRegister} className="w-full rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Créer un compte hébergeur
        </button>
      </Card>
    );
  }

  // need-login → formulaire d'inscription collaborateur inline
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">📩</div>
          <h1 className="text-lg font-semibold text-gray-900">Créer votre compte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pour rejoindre {info ? <strong>{info.centre.nom}</strong> : 'votre équipe'}, créez votre compte LIAVO.
          </p>
        </div>

        {info && (
          <p className="text-sm text-gray-600 mb-4">
            Email : <strong>{info.email}</strong>
          </p>
        )}

        {regError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{regError}</div>
        )}

        <form onSubmit={handleRegister} className="space-y-3">
          <input
            type="text" placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <input
            type="text" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <input
            type="password" placeholder="Mot de passe (8 caractères min.)" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <button
            type="submit" disabled={registering}
            className="w-full rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {registering ? 'Création…' : 'Rejoindre l\'équipe'}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-4 text-center">
          Vous avez déjà un compte ?{' '}
          <Link href={`/login?redirect=${encodeURIComponent(invitationPath)}`} className="font-medium text-[var(--color-primary)] hover:underline">
            Connectez-vous
          </Link>
        </p>
      </div>
    </main>
  );
}
