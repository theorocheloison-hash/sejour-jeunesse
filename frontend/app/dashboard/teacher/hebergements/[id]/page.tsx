'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { getHebergement, creerSejourDepuisCatalogue } from '@/src/lib/hebergement';
import type { Hebergement } from '@/src/lib/hebergement';

const isLiavoId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default function HebergementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [hebergement, setHebergement] = useState<Hebergement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modale "Travailler avec ce centre"
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState({ titre: '', dateDebut: '', dateFin: '', nombreEleves: '', message: '', niveauClasse: '', heureArrivee: '', heureDepart: '', transportAller: '', budgetMaxParEleve: '' });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modale invitation centre externe
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    emailDestinataire: '',
    titreSejourSuggere: '',
    dateDebut: '',
    dateFin: '',
    nbElevesEstime: '',
    message: '',
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleInviterCentreExterne = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    if (!inviteForm.emailDestinataire || !inviteForm.titreSejourSuggere || !inviteForm.dateDebut || !inviteForm.dateFin || !inviteForm.nbElevesEstime) {
      setInviteError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setInviteSubmitting(true);
    try {
      await api.post('/invitation-collaboration/centre-externe', {
        emailDestinataire: inviteForm.emailDestinataire,
        nomCentre: hebergement?.nom ?? '',
        villeCentre: hebergement?.ville ?? '',
        codePostalCentre: hebergement?.codePostal ?? '',
        titreSejourSuggere: inviteForm.titreSejourSuggere,
        dateDebut: inviteForm.dateDebut,
        dateFin: inviteForm.dateFin,
        nbElevesEstime: parseInt(inviteForm.nbElevesEstime, 10),
        message: inviteForm.message || undefined,
      });
      setInviteSuccess(true);
    } catch (err: any) {
      setInviteError(err?.response?.data?.message ?? "Erreur lors de l'envoi");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCreerSejour = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!modalForm.titre || !modalForm.dateDebut || !modalForm.dateFin || !modalForm.nombreEleves) {
      setModalError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const result = await creerSejourDepuisCatalogue({
        centreId: params.id as string,
        titre: modalForm.titre,
        dateDebut: modalForm.dateDebut,
        dateFin: modalForm.dateFin,
        nombreEleves: parseInt(modalForm.nombreEleves, 10),
        message: modalForm.message || undefined,
        niveauClasse: modalForm.niveauClasse || undefined,
        heureArrivee: modalForm.heureArrivee || undefined,
        heureDepart: modalForm.heureDepart || undefined,
        transportAller: modalForm.transportAller || undefined,
        budgetMaxParEleve: modalForm.budgetMaxParEleve ? parseFloat(modalForm.budgetMaxParEleve) : undefined,
      });
      router.push(`/dashboard/sejour/${result.sejourId}`);
    } catch (err: any) {
      setModalError(err?.response?.data?.message ?? 'Erreur lors de la création du séjour');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'TEACHER')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'TEACHER' && params.id) {
      setLoading(true);
      getHebergement(params.id as string)
        .then(setHebergement)
        .catch(() => setError('Hébergement introuvable.'))
        .finally(() => setLoading(false));
    }
  }, [user, params.id]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Détail hébergement</span>
            </div>
            <Link href="/dashboard/teacher/hebergements" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              ← Retour au catalogue
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {!loading && hebergement && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Image */}
            {hebergement.image && (
              <img src={hebergement.image} alt={hebergement.nom} className="w-full h-56 object-cover" />
            )}

            {/* En-tête */}
            <div className="p-6 sm:p-8 border-b border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{hebergement.nom}</h1>
                  <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {hebergement.ville} ({hebergement.departement}), {hebergement.region}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  {hebergement.accessible && (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-3 py-1 text-sm font-medium">
                      Accessible PMR
                    </span>
                  )}
                  {hebergement.avisSecurite === 'Favorable' && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-sm font-medium">
                      Avis favorable
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Partenaire Liavo */}
            {isLiavoId(params.id as string) && (
              <div className="px-6 py-4 border-b border-gray-200 bg-[var(--color-primary-light)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-primary)]">Ce centre est partenaire Liavo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Créez un séjour directement avec cet hébergeur</p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity shrink-0"
                  >
                    Travailler avec ce centre
                  </button>
                </div>
              </div>
            )}

            {/* Centre externe — pas sur LIAVO */}
            {!isLiavoId(params.id as string) && (
              <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Ce centre n&apos;est pas encore sur LIAVO</p>
                    <p className="text-xs text-amber-700 mt-0.5">Invitez-le à rejoindre la plateforme pour collaborer directement</p>
                  </div>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity shrink-0"
                  >
                    Inviter ce centre
                  </button>
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="divide-y divide-gray-200">
              {/* Localisation */}
              <Section title="Localisation">
                <Row label="Ville" value={hebergement.ville} />
                <Row label="Code postal" value={hebergement.codePostal} />
                <Row label="Département" value={hebergement.departement} />
                <Row label="Région" value={hebergement.region} />
              </Section>

              {/* Capacité */}
              <Section title="Capacité et accueil">
                <Row label="Lits élèves" value={hebergement.capaciteEleves != null ? `${hebergement.capaciteEleves}` : '—'} />
                <Row label="Lits adultes (encadrement)" value={hebergement.capaciteAdultes != null ? `${hebergement.capaciteAdultes}` : '—'} />
                <Row label="Accessibilité handicap" value={hebergement.accessible ? 'Oui' : 'Non'} />
                <Row label="Avis sécurité" value={hebergement.avisSecurite ?? '—'} />
                <Row label="Période d'ouverture" value={hebergement.periodeOuverture ?? '—'} />
              </Section>

              {/* Contact */}
              {hebergement.contact && (
                <Section title="Contact">
                  <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-line">
                    {hebergement.contact}
                  </div>
                </Section>
              )}

              {/* Thématiques */}
              {hebergement.thematiques.length > 0 && (
                <div>
                  <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Thématiques
                  </div>
                  <div className="px-6 py-4 flex flex-wrap gap-2">
                    {hebergement.thematiques.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3 py-1 text-sm font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Activités */}
              {hebergement.activites.length > 0 && (
                <div>
                  <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Activités proposées
                  </div>
                  <div className="px-6 py-4 flex flex-wrap gap-2">
                    {hebergement.activites.map((a) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-sm font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {hebergement.description && (
                <Section title="Description">
                  <div className="px-6 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {hebergement.description}
                  </div>
                </Section>
              )}

              {/* Lien fiche officielle */}
              {hebergement.permalien && (
                <div className="px-6 py-4">
                  <a
                    href={hebergement.permalien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    Voir la fiche officielle
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modale création séjour */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Créer un séjour avec {hebergement?.nom}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{modalError}</div>
            )}

            <form onSubmit={handleCreerSejour} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre du séjour *</label>
                <input type="text" required value={modalForm.titre}
                  onChange={e => setModalForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex : Classe de neige 6ème"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
                  <input type="date" required value={modalForm.dateDebut}
                    onChange={e => setModalForm(f => ({ ...f, dateDebut: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin *</label>
                  <input type="date" required value={modalForm.dateFin}
                    onChange={e => setModalForm(f => ({ ...f, dateFin: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d&apos;élèves *</label>
                <input type="number" required min="1" value={modalForm.nombreEleves}
                  onChange={e => setModalForm(f => ({ ...f, nombreEleves: e.target.value }))}
                  placeholder="30"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau de classe <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={modalForm.niveauClasse}
                  onChange={e => setModalForm(f => ({ ...f, niveauClasse: e.target.value }))}
                  placeholder="6ème, CM2..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heure d&apos;arrivée <span className="text-gray-400 font-normal">(opt.)</span></label>
                  <input type="time" value={modalForm.heureArrivee}
                    onChange={e => setModalForm(f => ({ ...f, heureArrivee: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heure de départ <span className="text-gray-400 font-normal">(opt.)</span></label>
                  <input type="time" value={modalForm.heureDepart}
                    onChange={e => setModalForm(f => ({ ...f, heureDepart: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transport aller <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <select value={modalForm.transportAller}
                  onChange={e => setModalForm(f => ({ ...f, transportAller: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                  <option value="">Non précisé</option>
                  <option value="CARS">Cars</option>
                  <option value="TRAIN">Train</option>
                  <option value="AVION">Avion</option>
                  <option value="BESOIN_TRANSPORTEUR">Besoin transporteur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget max / élève (€) <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input type="number" min="0" step="10" value={modalForm.budgetMaxParEleve}
                  onChange={e => setModalForm(f => ({ ...f, budgetMaxParEleve: e.target.value }))}
                  placeholder="500"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message pour l&apos;hébergeur <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <textarea rows={3} value={modalForm.message}
                  onChange={e => setModalForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Précisez vos besoins spécifiques..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                  {submitting ? 'Création...' : 'Créer le séjour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale invitation centre externe */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Inviter {hebergement?.nom} sur LIAVO</h2>
              <button onClick={() => { setShowInviteModal(false); setInviteSuccess(false); setInviteError(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inviteSuccess ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">Invitation envoyée</p>
                <p className="text-xs text-gray-500">Le centre recevra un email avec un lien pour créer son compte LIAVO.</p>
                <button onClick={() => { setShowInviteModal(false); setInviteSuccess(false); }} className="mt-4 text-sm font-medium text-[var(--color-primary)] hover:underline">
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviterCentreExterne} className="space-y-4">
                {inviteError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{inviteError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email du centre *</label>
                  <input type="email" required value={inviteForm.emailDestinataire}
                    onChange={e => setInviteForm(f => ({ ...f, emailDestinataire: e.target.value }))}
                    placeholder="contact@centre.fr"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  <p className="mt-1 text-xs text-gray-400">Retrouvez l&apos;email dans la section Contact ci-dessous</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre du séjour *</label>
                  <input type="text" required value={inviteForm.titreSejourSuggere}
                    onChange={e => setInviteForm(f => ({ ...f, titreSejourSuggere: e.target.value }))}
                    placeholder="Classe de neige 6ème — Janvier 2027"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
                    <input type="date" required value={inviteForm.dateDebut}
                      onChange={e => setInviteForm(f => ({ ...f, dateDebut: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date fin *</label>
                    <input type="date" required value={inviteForm.dateFin}
                      onChange={e => setInviteForm(f => ({ ...f, dateFin: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d&apos;élèves *</label>
                  <input type="number" required min="1" value={inviteForm.nbElevesEstime}
                    onChange={e => setInviteForm(f => ({ ...f, nbElevesEstime: e.target.value }))}
                    placeholder="30"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <textarea rows={3} value={inviteForm.message}
                    onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Bonjour, nous souhaiterions organiser un séjour avec votre structure..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowInviteModal(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Annuler
                  </button>
                  <button type="submit" disabled={inviteSubmitting}
                    className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60">
                    {inviteSubmitting ? 'Envoi...' : 'Envoyer l\'invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-gray-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-3">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right font-medium">{value}</span>
    </div>
  );
}
