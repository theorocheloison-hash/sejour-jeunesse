'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { getMonProfil, updateMonProfil, uploadCentreImage, supprimerCentreImage, reordonnerCentreImages, uploadBrochure, uploadLogo, deleteLogo, uploadConventionPdf, supprimerConventionPdf } from '@/src/lib/centre';
import type { Centre } from '@/src/lib/centre';

// Aligné sur MAX_PHOTOS_CENTRE côté backend.
const MAX_PHOTOS = 12;

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

const EQUIPEMENTS_OPTIONS = [
  'Salle de classe',
  'R\u00e9fectoire',
  'Infirmerie',
  'Gymnase',
  'Salle polyvalente',
  'Biblioth\u00e8que',
  'Acc\u00e8s internet WiFi',
  'Parking bus',
  'Accessibilit\u00e9 PMR',
  'Cuisine \u00e9quip\u00e9e',
  'Sc\u00e8ne / salle de spectacle',
  'Terrain de sport ext\u00e9rieur',
];

interface FormState {
  nom: string;
  description: string;
  capacite: string;
  siteWeb: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siret: string;
  tvaIntracommunautaire: string;
  iban: string;
  equipements: string[];
  conditionsAnnulation: string;
  accessiblePmr: boolean;
  avisSecurite: string;
  thematiquesCentre: string[];
  activitesCentre: string[];
  capaciteAdultes: string;
  capaciteGroupeMin: string;
  capaciteGroupeMax: string;
  periodeOuverture: string;
}

const INITIAL: FormState = {
  nom: '',
  description: '',
  capacite: '',
  siteWeb: '',
  adresse: '',
  codePostal: '',
  ville: '',
  telephone: '',
  email: '',
  siret: '',
  tvaIntracommunautaire: '',
  iban: '',
  equipements: [],
  conditionsAnnulation: '',
  accessiblePmr: false,
  avisSecurite: '',
  thematiquesCentre: [],
  activitesCentre: [],
  capaciteAdultes: '',
  capaciteGroupeMin: '',
  capaciteGroupeMax: '',
  periodeOuverture: '',
};

export default function HebergeurProfilPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [centre, setCentre] = useState<Centre | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMandatModal, setShowMandatModal] = useState(false);
  const [mandatLu, setMandatLu] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [imageBusy, setImageBusy] = useState(false); // suppression / réordonnancement en cours
  const [brochureUrl, setBrochureUrl] = useState<string | null>(null);
  const [brochureUploading, setBrochureUploading] = useState(false);
  const [brochureError, setBrochureError] = useState<string | null>(null);
  const [conventionPdfUrl, setConventionPdfUrl] = useState<string | null>(null);
  const [conventionUploading, setConventionUploading] = useState(false);
  const [conventionError, setConventionError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'HEBERGEUR') return;
    getMonProfil()
      .then((c) => {
        setCentre(c);
        // Centre importé (APIDAE) : imageUrl posée sans galerie → on l'affiche comme 1ère photo.
        setImages(c.imagesUrls?.length ? c.imagesUrls : c.imageUrl ? [c.imageUrl] : []);
        setBrochureUrl(c.brochureUrl ?? null);
        setConventionPdfUrl(c.conventionPdfUrl ?? null);
        setLogoUrl(c.logoUrl ?? null);
        setForm({
          nom: c.nom ?? '',
          description: c.description ?? '',
          capacite: c.capacite ? String(c.capacite) : '',
          siteWeb: c.siteWeb ?? '',
          adresse: c.adresse ?? '',
          codePostal: c.codePostal ?? '',
          ville: c.ville ?? '',
          telephone: c.telephone ?? '',
          email: c.email ?? '',
          siret: c.siret ?? '',
          tvaIntracommunautaire: c.tvaIntracommunautaire ?? '',
          iban: c.iban ?? '',
          equipements: c.equipements ?? [],
          conditionsAnnulation: c.conditionsAnnulation ?? '',
          accessiblePmr: c.accessiblePmr ?? false,
          avisSecurite: c.avisSecurite ?? '',
          thematiquesCentre: c.thematiquesCentre ?? [],
          activitesCentre: c.activitesCentre ?? [],
          capaciteAdultes: c.capaciteAdultes ? String(c.capaciteAdultes) : '',
          capaciteGroupeMin: c.capaciteGroupeMin != null ? String(c.capaciteGroupeMin) : '',
          capaciteGroupeMax: c.capaciteGroupeMax != null ? String(c.capaciteGroupeMax) : '',
          periodeOuverture: c.periodeOuverture ?? '',
        });
      })
      .catch(() => setError('Impossible de charger le profil.'))
      .finally(() => setLoading(false));
  }, [user]);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSuccess(false);
  };

  const toggleEquipement = (eq: string) => {
    setForm((prev) => ({
      ...prev,
      equipements: prev.equipements.includes(eq)
        ? prev.equipements.filter((e) => e !== eq)
        : [...prev.equipements, eq],
    }));
    setSuccess(false);
  };

  const handleSubmit = async () => {
    // Validation UX : si les deux bornes sont renseignées, min ≤ max.
    if (form.capaciteGroupeMin && form.capaciteGroupeMax
      && parseInt(form.capaciteGroupeMin, 10) > parseInt(form.capaciteGroupeMax, 10)) {
      setError('La capacité groupe minimum ne peut pas dépasser la capacité maximum.');
      setSuccess(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateMonProfil({
        nom: form.nom,
        description: form.description || undefined,
        capacite: form.capacite ? parseInt(form.capacite, 10) : undefined,
        siteWeb: form.siteWeb || undefined,
        adresse: form.adresse,
        codePostal: form.codePostal,
        ville: form.ville,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        siret: form.siret || undefined,
        tvaIntracommunautaire: form.tvaIntracommunautaire || undefined,
        iban: form.iban || undefined,
        equipements: form.equipements,
        conditionsAnnulation: form.conditionsAnnulation || undefined,
        accessiblePmr: form.accessiblePmr,
        avisSecurite: form.avisSecurite || undefined,
        thematiquesCentre: form.thematiquesCentre,
        activitesCentre: form.activitesCentre,
        capaciteAdultes: form.capaciteAdultes ? parseInt(form.capaciteAdultes, 10) : undefined,
        capaciteGroupeMin: form.capaciteGroupeMin ? parseInt(form.capaciteGroupeMin, 10) : undefined,
        capaciteGroupeMax: form.capaciteGroupeMax ? parseInt(form.capaciteGroupeMax, 10) : undefined,
        periodeOuverture: form.periodeOuverture || undefined,
      });
      setSuccess(true);
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of files) {
      if (!allowed.includes(file.type)) {
        setImageError('Format non supporté. Utilisez JPG, PNG ou WebP.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setImageError('Fichier trop lourd. Maximum 10 Mo.');
        return;
      }
    }
    if (images.length + files.length > MAX_PHOTOS) {
      setImageError(`Maximum ${MAX_PHOTOS} photos. Supprimez-en avant d'en ajouter.`);
      return;
    }
    setImageUploading(true);
    setImageError(null);
    try {
      // Uploads séquentiels : le backend fait un append par requête.
      let updated: Centre | null = null;
      for (const file of files) {
        updated = await uploadCentreImage(file);
      }
      if (updated) setImages(updated.imagesUrls ?? (updated.imageUrl ? [updated.imageUrl] : []));
    } catch {
      setImageError("Erreur lors de l'upload. Réessayez.");
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleSupprimerImage = async (url: string) => {
    setImageBusy(true);
    setImageError(null);
    try {
      const updated = await supprimerCentreImage(url);
      setImages(updated.imagesUrls ?? []);
    } catch {
      setImageError('Erreur lors de la suppression. Réessayez.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleDeplacerImage = async (index: number, delta: -1 | 1) => {
    const cible = index + delta;
    if (cible < 0 || cible >= images.length) return;
    const ordre = [...images];
    [ordre[index], ordre[cible]] = [ordre[cible], ordre[index]];
    setImageBusy(true);
    setImageError(null);
    try {
      const updated = await reordonnerCentreImages(ordre);
      setImages(updated.imagesUrls ?? ordre);
    } catch {
      setImageError('Erreur lors du réordonnancement. Réessayez.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleBrochureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setBrochureError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBrochureError('Fichier trop lourd. Maximum 10 Mo.');
      return;
    }
    setBrochureUploading(true);
    setBrochureError(null);
    try {
      const result = await uploadBrochure(file);
      setBrochureUrl(result.brochureUrl);
    } catch {
      setBrochureError("Erreur lors de l'upload. Réessayez.");
    } finally {
      setBrochureUploading(false);
      e.target.value = '';
    }
  };

  const handleConventionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setConventionError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setConventionError('Fichier trop lourd. Maximum 10 Mo.');
      return;
    }
    setConventionUploading(true);
    setConventionError(null);
    try {
      const result = await uploadConventionPdf(file);
      setConventionPdfUrl(result.conventionPdfUrl);
    } catch {
      setConventionError("Erreur lors de l'upload. Réessayez.");
    } finally {
      setConventionUploading(false);
      e.target.value = '';
    }
  };

  const handleConventionDelete = async () => {
    setConventionUploading(true);
    setConventionError(null);
    try {
      await supprimerConventionPdf();
      setConventionPdfUrl(null);
    } catch {
      setConventionError('Erreur lors de la suppression. Réessayez.');
    } finally {
      setConventionUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !centre) return;
    // JPG/PNG STRICTEMENT (react-pdf ne supporte pas le webp → crash silencieux du PDF)
    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setLogoError('Format non supporté. Utilisez JPEG ou PNG uniquement.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Fichier trop lourd. Maximum 2 Mo.');
      return;
    }
    setLogoUploading(true);
    setLogoError(null);
    try {
      const result = await uploadLogo(centre.id, file);
      setLogoUrl(result.logoUrl);
    } catch {
      setLogoError("Erreur lors de l'upload. Réessayez.");
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    if (!centre || !logoUrl) return;
    if (!window.confirm('Supprimer le logo ? Il n\'apparaîtra plus sur vos devis et factures.')) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      await deleteLogo(centre.id);
      setLogoUrl(null);
    } catch {
      setLogoError('Erreur lors de la suppression. Réessayez.');
    } finally {
      setLogoUploading(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/hebergeur" className="text-sm text-[var(--color-primary)] hover:underline">&larr; Mon &eacute;tablissement</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Modifier mon profil</h1>
        <p className="text-sm text-gray-500 mb-8">Ces informations apparaissent sur vos devis et dans l&apos;annuaire</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8">

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">Profil mis &agrave; jour avec succ&egrave;s.</div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Photos de l&apos;établissement
                {images.length > 0 && (
                  <span className="ml-2 font-normal text-gray-400">{images.length}/{MAX_PHOTOS}</span>
                )}
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                La première photo est la couverture : elle apparaît dans le catalogue et sur vos devis.<br />
                Formats acceptés : JPG, PNG, WebP — maximum 10 Mo par photo, {MAX_PHOTOS} photos.
              </p>
              {imageError && (
                <p className="text-sm text-red-600 mb-2">{imageError}</p>
              )}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-4 mb-4">
                  {images.map((url, index) => (
                    <div key={url} className="w-24">
                      <div className="relative">
                        <img
                          src={url}
                          alt={index === 0 ? "Photo de couverture de l'établissement" : `Photo ${index + 1} de l'établissement`}
                          className="h-24 w-24 rounded-xl object-cover border border-gray-200"
                        />
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 rounded-md bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                            Couverture
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Supprimer cette photo"
                          disabled={imageBusy || imageUploading}
                          onClick={() => handleSupprimerImage(url)}
                          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-300 text-gray-500 shadow-sm hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1 flex justify-center gap-1">
                        <button
                          type="button"
                          aria-label="Déplacer la photo vers la gauche"
                          disabled={imageBusy || imageUploading || index === 0}
                          onClick={() => handleDeplacerImage(index, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label="Déplacer la photo vers la droite"
                          disabled={imageBusy || imageUploading || index === images.length - 1}
                          onClick={() => handleDeplacerImage(index, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {images.length === 0 && (
                <div className="mb-4 h-24 w-24 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                </div>
              )}
              <label className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ${imageUploading || imageBusy || images.length >= MAX_PHOTOS ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {imageUploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    {images.length > 0 ? 'Ajouter des photos' : 'Ajouter une photo'}
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  disabled={imageUploading || imageBusy || images.length >= MAX_PHOTOS}
                  onChange={handleImageUpload}
                />
              </label>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Logo</h2>
              <div className="flex items-start gap-6">
                <div className="shrink-0">
                  {logoUrl ? (
                    <div className="flex items-center justify-center h-[60px] w-[120px] rounded-lg bg-gray-100 border border-gray-200 p-1">
                      <img
                        src={logoUrl}
                        alt="Logo de l'établissement"
                        className="max-h-[60px] max-w-[120px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[60px] w-[120px] rounded-lg bg-gray-100 border border-gray-200">
                      <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  {logoError && (
                    <p className="text-sm text-red-600 mb-2">{logoError}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ${logoUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {logoUploading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                          Upload en cours...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                          </svg>
                          {logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        disabled={logoUploading}
                        onChange={handleLogoUpload}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleLogoDelete}
                        disabled={logoUploading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Supprimer le logo
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    Ce logo apparaîtra sur vos devis et factures. Formats : JPEG, PNG. Max 2 Mo.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Brochure de présentation</h2>
              <p className="text-sm text-gray-500 mb-4">
                Cette brochure sera envoyée automatiquement à vos prospects depuis le CRM.
                Format PDF uniquement, maximum 10 Mo.
              </p>
              {brochureError && (
                <p className="text-sm text-red-600 mb-3">{brochureError}</p>
              )}
              {brochureUrl && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 mb-3">
                  <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <a
                    href={brochureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-primary)] hover:underline flex-1 truncate"
                  >
                    Brochure en ligne — voir le PDF
                  </a>
                </div>
              )}
              <label className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ${brochureUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {brochureUploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    {brochureUrl ? 'Remplacer la brochure' : 'Uploader la brochure PDF'}
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={brochureUploading}
                  onChange={handleBrochureUpload}
                />
              </label>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Convention / Conditions générales</h2>
              <p className="text-sm text-gray-500 mb-4">
                Uploadez votre document PDF de conditions générales de séjour. Ce document sera
                automatiquement annexé à la page de couverture générée par LIAVO lors de l&apos;envoi
                d&apos;une convention. Format PDF uniquement, maximum 10 Mo.
              </p>
              {conventionError && (
                <p className="text-sm text-red-600 mb-3">{conventionError}</p>
              )}
              {conventionPdfUrl && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 mb-3">
                  <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <a
                    href={conventionPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-primary)] hover:underline flex-1 truncate"
                  >
                    Convention en ligne — voir le PDF
                  </a>
                  <button
                    type="button"
                    onClick={handleConventionDelete}
                    disabled={conventionUploading}
                    className="text-sm text-red-600 hover:underline shrink-0 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              )}
              <label className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ${conventionUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {conventionUploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    {conventionPdfUrl ? 'Remplacer le document' : 'Importer le document PDF'}
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={conventionUploading}
                  onChange={handleConventionUpload}
                />
              </label>
            </div>

            {/* Informations g&eacute;n&eacute;rales */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Informations g&eacute;n&eacute;rales</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du centre *</label>
                  <input type="text" value={form.nom} onChange={set('nom')} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={set('description')} rows={4} className={`${inputCls} resize-none`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacit&eacute; en lits</label>
                    <input type="number" value={form.capacite} onChange={set('capacite')} min={1} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Site web</label>
                    <input type="text" value={form.siteWeb} onChange={set('siteWeb')} placeholder="https://..." className={inputCls} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1.5">Taille de groupe acceptée</p>
                  <p className="text-xs text-gray-400 mb-2">
                    Les demandes diffusées (non adressées directement à votre centre) hors de cette fourchette ne vous seront pas proposées. Laissez vide pour tout recevoir.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Capacité groupe minimum</label>
                      <input type="number" value={form.capaciteGroupeMin} onChange={set('capaciteGroupeMin')} min={0} placeholder="Ex: 20" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Capacité groupe maximum</label>
                      <input type="number" value={form.capaciteGroupeMax} onChange={set('capaciteGroupeMax')} min={0} placeholder="Ex: 80" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coordonn&eacute;es */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Coordonn&eacute;es</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
                  <input type="text" value={form.adresse} onChange={set('adresse')} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Code postal</label>
                    <input type="text" value={form.codePostal} onChange={set('codePostal')} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
                    <input type="text" value={form.ville} onChange={set('ville')} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">T&eacute;l&eacute;phone</label>
                    <input type="text" value={form.telephone} onChange={set('telephone')} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email de contact</label>
                    <input type="text" value={form.email} onChange={set('email')} className={inputCls} />
                  </div>
                </div>
              </div>
            </div>

            {/* Informations administratives */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Informations administratives</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SIRET</label>
                  <input type="text" value={form.siret} onChange={set('siret')} maxLength={14} placeholder="12345678901234" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">N&deg; TVA intracommunautaire</label>
                    <input type="text" value={form.tvaIntracommunautaire} onChange={set('tvaIntracommunautaire')} placeholder="FR12345678901" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">IBAN</label>
                    <input type="text" value={form.iban} onChange={set('iban')} placeholder="FR76..." className={inputCls} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Ces informations apparaissent sur vos factures et devis.</p>
              </div>
            </div>

            {/* &Eacute;quipements disponibles */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">&Eacute;quipements disponibles</h2>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPEMENTS_OPTIONS.map((eq) => (
                  <label key={eq} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.equipements.includes(eq)}
                      onChange={() => toggleEquipement(eq)}
                      className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-gray-700">{eq}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Informations catalogue */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Informations catalogue</h2>
              <p className="text-xs text-gray-400 mb-4">Ces informations apparaissent sur votre fiche dans le catalogue des hébergements.</p>
              <div className="space-y-4">

                {/* Accessible PMR */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.accessiblePmr}
                    onChange={(e) => setForm(f => ({ ...f, accessiblePmr: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]" />
                  <span className="text-sm text-gray-700">Accessible PMR (personnes à mobilité réduite)</span>
                </label>

                {/* Avis sécurité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Avis de la commission de sécurité</label>
                  <select value={form.avisSecurite}
                    onChange={(e) => setForm(f => ({ ...f, avisSecurite: e.target.value }))}
                    className={inputCls}>
                    <option value="">Non renseigné</option>
                    <option value="Favorable">Favorable</option>
                    <option value="Favorable avec réserves">Favorable avec réserves</option>
                    <option value="Défavorable">Défavorable</option>
                  </select>
                </div>

                {/* Capacité adultes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacité adultes (accompagnateurs)</label>
                  <input type="number" value={form.capaciteAdultes}
                    onChange={set('capaciteAdultes')} min={0} placeholder="Ex : 8"
                    className={inputCls} />
                </div>

                {/* Période d'ouverture */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Période d&apos;ouverture</label>
                  <input type="text" value={form.periodeOuverture}
                    onChange={set('periodeOuverture')}
                    placeholder="Ex : Toute l'année, Octobre à juin..."
                    className={inputCls} />
                </div>

                {/* Thématiques pédagogiques proposées */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Thématiques pédagogiques proposées</label>
                  <p className="text-xs text-gray-400 mb-2">Saisissez une thématique et appuyez sur Entrée pour l&apos;ajouter.</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.thematiquesCentre.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3 py-1 text-xs font-medium">
                        {t}
                        <button type="button" onClick={() => setForm(f => ({ ...f, thematiquesCentre: f.thematiquesCentre.filter(x => x !== t) }))}
                          className="hover:opacity-70">&times;</button>
                      </span>
                    ))}
                  </div>
                  <input type="text" placeholder="Ex : Sciences et nature, Histoire et patrimoine..."
                    className={inputCls}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !form.thematiquesCentre.includes(val)) {
                          setForm(f => ({ ...f, thematiquesCentre: [...f.thematiquesCentre, val] }));
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }} />
                </div>

                {/* Activités proposées */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Activités proposées</label>
                  <p className="text-xs text-gray-400 mb-2">Saisissez une activité et appuyez sur Entrée pour l&apos;ajouter.</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.activitesCentre.map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-3 py-1 text-xs font-medium">
                        {a}
                        <button type="button" onClick={() => setForm(f => ({ ...f, activitesCentre: f.activitesCentre.filter(x => x !== a) }))}
                          className="hover:opacity-70">&times;</button>
                      </span>
                    ))}
                  </div>
                  <input type="text" placeholder="Ex : Ski, Escalade, Randonnée..."
                    className={inputCls}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !form.activitesCentre.includes(val)) {
                          setForm(f => ({ ...f, activitesCentre: [...f.activitesCentre, val] }));
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }} />
                </div>

              </div>
            </div>

            {/* Conditions d'annulation */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Conditions d&apos;annulation</h2>
              <textarea
                value={form.conditionsAnnulation}
                onChange={set('conditionsAnnulation')}
                rows={4}
                placeholder="Ex : Annulation gratuite jusqu'&agrave; 30 jours avant le s&eacute;jour. Au-del&agrave;, 30% du montant total retenu..."
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Mandat de facturation Chorus Pro */}
            {centre && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Mandat de facturation Chorus Pro
                </h3>
                {centre.mandatFacturationAccepte ? (
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-4 py-3">
                    <svg className="h-5 w-5 text-[var(--color-success)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-success)]">Mandat accepté</p>
                      {centre.mandatFacturationAccepteAt && (
                        <p className="text-xs text-[var(--color-success)]">
                          Le {new Date(centre.mandatFacturationAccepteAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — version {centre.mandatFacturationVersion}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                      <p className="font-semibold mb-1">Mandat de facturation requis</p>
                      <p className="text-xs">Pour générer des factures au format Chorus Pro (obligatoire pour les marchés publics avec les établissements scolaires), vous devez accepter le mandat de facturation au sens de l&apos;art. 289-I-2 du Code Général des Impôts. LIAVO agit en votre nom comme émetteur technique.</p>
                    </div>
                    <button
                      onClick={() => { setShowMandatModal(true); setMandatLu(false); }}
                      className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      J&apos;accepte le mandat de facturation
                    </button>

                    {/* Modale confirmation mandat */}
                    {showMandatModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
                          <h3 className="text-base font-bold text-gray-900 mb-4">Accepter le mandat de facturation</h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Avant d&apos;accepter, veuillez prendre connaissance du mandat de facturation qui autorise LIAVO à émettre des factures Chorus Pro en votre nom.
                          </p>
                          <a
                            href="/legal/mandat-facturation"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline mb-5"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                            Lire le mandat complet (version 1.0)
                          </a>
                          <label className="flex items-start gap-3 cursor-pointer mb-6">
                            <input
                              type="checkbox"
                              checked={mandatLu}
                              onChange={(e) => setMandatLu(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <span className="text-sm text-gray-700">
                              J&apos;ai lu et j&apos;accepte le mandat de facturation LIAVO version 1.0
                            </span>
                          </label>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setShowMandatModal(false)}
                              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              disabled={!mandatLu}
                              onClick={async () => {
                                try {
                                  await api.patch('/centres/mandat-facturation');
                                  const updated = await api.get('/centres/mon-profil');
                                  setCentre(updated.data);
                                  setShowMandatModal(false);
                                } catch { /* ignore */ }
                              }}
                              className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Confirmer l&apos;acceptation
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Link href="/dashboard/hebergeur" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Annuler
              </Link>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.nom}
                className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Enregistrement...
                  </>
                ) : (
                  'Enregistrer'
                )}
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
