'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMyProfile, updateMonEtablissement, type UserProfile } from '@/src/lib/etablissements';
import { Logo } from '@/app/components/Logo';
import type { Etablissement } from '@/src/lib/etablissements';
import EtablissementSearch from '@/src/components/EtablissementSearch';

export default function ProfilPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Etablissement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    getMyProfile()
      .then(setProfile)
      .catch(() => setLoadError('Impossible de charger le profil.'));
  }, [user]);

  const handleSelect = (etab: Etablissement) => {
    setSelected(etab);
    setSaveMsg(null);
  };

  const handleSave = async () => {
    const etab = selected;
    if (!etab) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateMonEtablissement({
        etablissementUai: etab.uai,
        etablissementNom: etab.nom,
        etablissementAdresse: `${etab.adresse}, ${etab.codePostal} ${etab.commune}`,
        etablissementVille: etab.commune,
        etablissementEmail: etab.mail ?? undefined,
        etablissementTelephone: etab.telephone ?? undefined,
      });
      setSaveMsg('Établissement sauvegardé avec succès.');
      // Refresh profile
      const p = await getMyProfile();
      setProfile(p);
    } catch {
      setSaveMsg('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  const etab = selected ?? (profile?.etablissementUai ? {
    uai: profile.etablissementUai,
    nom: profile.etablissementNom ?? '',
    adresse: profile.etablissementAdresse ?? '',
    commune: profile.etablissementVille ?? '',
    mail: profile.etablissementEmail,
    telephone: profile.etablissementTelephone,
  } : null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" showTagline={false} />
            </div>
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              &larr; Retour au tableau de bord
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Mon profil</h1>
        <p className="text-sm text-gray-500 mb-8">Gérez vos informations personnelles et votre établissement</p>

        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{loadError}</div>
        )}

        {/* Infos personnelles */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Informations personnelles</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Prénom</label>
              <p className="text-sm font-medium text-gray-900">{profile?.prenom ?? user.firstName}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom</label>
              <p className="text-sm font-medium text-gray-900">{profile?.nom ?? user.lastName}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <p className="text-sm font-medium text-gray-900">{profile?.email ?? user.email}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Téléphone</label>
              <p className="text-sm font-medium text-gray-900">{profile?.telephone ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Établissement */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Mon établissement</h2>

          <EtablissementSearch
            onSelect={handleSelect}
            initialValue={profile?.etablissementNom ?? ''}
          />

          {/* Fiche établissement sélectionné */}
          {etab && etab.uai && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{etab.nom}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {'adresse' in etab && typeof etab.adresse === 'string' ? etab.adresse : ''}
                    {'commune' in etab ? `, ${etab.commune}` : ''}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  UAI {etab.uai}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {etab.mail && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase">Email</label>
                    <p className="text-sm text-gray-700">{etab.mail}</p>
                  </div>
                )}
                {etab.telephone && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase">Téléphone</label>
                    <p className="text-sm text-gray-700">{etab.telephone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save button */}
          {selected && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Sauvegarde...</>
                ) : (
                  'Sauvegarder'
                )}
              </button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg.includes('succès') ? 'text-[var(--color-success)]' : 'text-red-600'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          )}

          {!etab?.uai && !selected && (
            <p className="mt-4 text-sm text-gray-400">
              Aucun établissement associé. Utilisez la recherche ci-dessus pour trouver votre établissement.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
