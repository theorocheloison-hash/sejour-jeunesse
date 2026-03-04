'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { getInvitation, registerCentre } from '@/src/lib/centre';
import type { Invitation } from '@/src/lib/centre';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

export default function InscriptionHebergementPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [telephone, setTelephone] = useState('');
  const [capacite, setCapacite] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    getInvitation(token)
      .then((inv) => {
        setInvitation(inv);
        setNom(inv.nomCentre);
      })
      .catch(() => setError('Invitation invalide ou déjà utilisée.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await registerCentre({
        token,
        password,
        nom,
        adresse,
        ville,
        codePostal,
        telephone: telephone || undefined,
        capacite: parseInt(capacite, 10),
        description: description || undefined,
      });
      Cookies.set('token', result.access_token, { expires: 7, sameSite: 'lax' });
      localStorage.setItem('sj_user', JSON.stringify(result.user));
      router.push('/dashboard/venue');
    } catch {
      setError('Erreur lors de l\'inscription. Vérifiez les informations saisies.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md text-center">
          <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Invitation invalide</h1>
          <p className="text-sm text-gray-500">{error || 'Ce lien d\'invitation n\'est plus valide.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-indigo-600 mb-4">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Inscription centre d'hébergement</h1>
          <p className="mt-2 text-sm text-gray-500">
            Vous avez été invité à enregistrer <strong>{invitation.nomCentre}</strong> sur Séjour Jeunesse.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-medium text-gray-500">Email (pré-rempli depuis l'invitation)</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{invitation.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 caractères" className={inputCls} required minLength={8} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du centre *</label>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse *</label>
            <input type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="12 rue des Alpes" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville *</label>
              <input type="text" value={ville} onChange={(e) => setVille(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Code postal *</label>
              <input type="text" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
              <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="04 50 00 00 00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacité (lits) *</label>
              <input type="number" value={capacite} onChange={(e) => setCapacite(e.target.value)} min={1} className={inputCls} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Décrivez votre centre..." className={`${inputCls} resize-none`} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {submitting ? 'Inscription en cours...' : 'Créer mon compte centre'}
          </button>
        </form>
      </div>
    </div>
  );
}
