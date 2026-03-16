'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  MapPin,
  CalendarDays,
  Users,
  GraduationCap,
  Building2,
  ShieldCheck,
  UserRound,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Heart,
  BookOpen,
  Ruler,
  Weight,
  Footprints,
  UtensilsCrossed,
  Mountain,
  Stethoscope,
  CreditCard,
  Paperclip,
  Upload,
  FileText,
  Lock,
} from 'lucide-react';
import {
  getAutorisationPublique,
  signerAutorisation,
  uploadDocumentMedical,
  type AutorisationPublique,
} from '@/src/lib/autorisation';

const THEMATIQUE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

const TYPE_HEBERGEMENT_LABEL: Record<string, string> = {
  auberge_jeunesse: 'Auberge de jeunesse',
  centre_vacances: 'Centre de vacances',
  camping: 'Camping',
  gite: 'Gîte',
  hotel: 'Hôtel',
  refuge: 'Refuge',
  autre: 'Autre',
};

const REGIME_OPTIONS = [
  'Aucun régime particulier',
  'Végétarien',
  'Végétalien/Vegan',
  'Sans porc',
  'Sans gluten',
  'Autre',
];

const NIVEAU_SKI_OPTIONS = [
  { value: '', label: 'Non renseigné' },
  { value: 'DEBUTANT', label: 'Débutant' },
  { value: 'INTERMEDIAIRE', label: 'Intermédiaire' },
  { value: 'CONFIRME', label: 'Confirmé' },
  { value: 'HORS_PISTE', label: 'Hors-piste' },
];

const MENSUALITES_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ACCEPTED_DOC_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

const RGPD_TEXT = `Conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679) et à la loi Informatique et Libertés du 6 janvier 1978 modifiée, les données personnelles collectées dans ce formulaire (identité, informations médicales, données de santé) sont traitées par l'établissement scolaire responsable du séjour, en qualité de responsable de traitement. Elles sont transmises uniquement à l'hébergement accueillant votre enfant, en qualité de sous-traitant, dans le strict cadre de l'organisation du séjour scolaire. Ces données ne seront ni cédées, ni vendues, ni utilisées à d'autres fins. Conformément à vos droits, vous pouvez accéder, rectifier ou supprimer vos données en contactant l'établissement scolaire. Les données sont conservées pour la durée légale applicable aux archives scolaires (5 ans).`;

export default function SignerAutorisationPage() {
  const { token } = useParams<{ token: string }>();

  const [autorisation, setAutorisation] = useState<AutorisationPublique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [taille, setTaille] = useState('');
  const [poids, setPoids] = useState('');
  const [pointure, setPointure] = useState('');
  const [regime, setRegime] = useState('Aucun régime particulier');
  const [regimeAutre, setRegimeAutre] = useState('');
  const [niveauSki, setNiveauSki] = useState('');
  const [infosMedicales, setInfosMedicales] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  // Payment
  const [nombreMensualites, setNombreMensualites] = useState(1);
  const [showPaymentMsg, setShowPaymentMsg] = useState(false);

  // Document médical
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploaded, setDocUploaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RGPD
  const [rgpdAccepte, setRgpdAccepte] = useState(false);

  useEffect(() => {
    if (!token) return;
    getAutorisationPublique(token)
      .then((data) => {
        setAutorisation(data);
        if (data.signeeAt) setSigned(true);
      })
      .catch(() => setError('Lien invalide ou autorisation introuvable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const showSki = autorisation?.sejour.thematiquesPedagogiques?.some(
    (t) => /ski|montagne|neige/i.test(t),
  );

  const montantParEleve = autorisation?.sejour.montantParEleve
    ? Number(autorisation.sejour.montantParEleve)
    : null;
  const mensualite = montantParEleve ? montantParEleve / nombreMensualites : null;

  const handleSign = async () => {
    if (!token || !taille || !poids || !pointure || !rgpdAccepte) return;
    setSigning(true);
    try {
      const regimeVal = regime === 'Autre' ? regimeAutre.trim() : regime === 'Aucun régime particulier' ? undefined : regime;
      await signerAutorisation(token, {
        taille: parseInt(taille, 10),
        poids: parseInt(poids, 10),
        pointure: parseInt(pointure, 10),
        regimeAlimentaire: regimeVal || undefined,
        niveauSki: niveauSki || undefined,
        infosMedicales: infosMedicales.trim() || undefined,
        rgpdAccepte: true,
        nombreMensualites,
      });
      setSigned(true);
    } catch {
      setError('Erreur lors de la signature. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  const handleDocUpload = async () => {
    if (!token || !docFile) return;
    setDocUploading(true);
    try {
      await uploadDocumentMedical(token, docFile);
      setDocUploaded(true);
    } catch {
      setError('Erreur lors de l\'envoi du document.');
    } finally {
      setDocUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setDocFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setDocFile(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#003189]/5 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--color-border-strong)] border-t-transparent" />
      </div>
    );
  }

  if (error && !autorisation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#003189]/5 to-white px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <ShieldCheck className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900">Lien invalide</h2>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!autorisation) return null;

  const { sejour, hebergement } = autorisation;
  const thematiques = sejour.thematiquesPedagogiques ?? [];

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const formValid = taille && poids && pointure && rgpdAccepte;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003189]/5 to-white">
      {/* HEADER */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium tracking-wide">Autorisation parentale</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* HERO */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#003189] to-[#0050c8] px-6 py-8 text-white">
            <h1 className="text-2xl font-bold leading-tight">{sejour.titre}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-blue-100">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Du {fmt(sejour.dateDebut)} au {fmt(sejour.dateFin)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {sejour.lieu}
              </span>
              {sejour.niveauClasse && (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  {sejour.niveauClasse}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {sejour.placesTotales} places
              </span>
            </div>
          </div>
        </section>

        {/* Détail séjour */}
        {(sejour.description || thematiques.length > 0) && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-4">
              <ClipboardCheck className="h-5 w-5" />
              Le séjour en détail
            </h2>
            {sejour.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-4">
                {sejour.description}
              </p>
            )}
            {thematiques.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Thématiques pédagogiques
                </p>
                <div className="flex flex-wrap gap-2">
                  {thematiques.map((t, i) => (
                    <span
                      key={t}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${THEMATIQUE_COLORS[i % THEMATIQUE_COLORS.length]}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Hébergement */}
        {hebergement && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-4">
              <Building2 className="h-5 w-5" />
              L&apos;hébergement
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Établissement</p>
                <p className="font-semibold text-gray-900">{hebergement.nom}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-medium text-gray-900">
                  {TYPE_HEBERGEMENT_LABEL[hebergement.type] ?? hebergement.type}
                </p>
              </div>
              {hebergement.adresse && (
                <div>
                  <p className="text-xs text-gray-500">Adresse</p>
                  <p className="font-medium text-gray-900">{hebergement.adresse}, {hebergement.ville}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Capacité</p>
                <p className="font-medium text-gray-900">{hebergement.capacite} places</p>
              </div>
            </div>
          </section>
        )}

        {/* Votre enfant */}
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-4">
            <UserRound className="h-5 w-5" />
            Votre enfant
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Élève concerné(e)</p>
              <p className="text-base font-semibold text-gray-900">
                {autorisation.elevePrenom} {autorisation.eleveNom}
              </p>
            </div>
            <div>
              {signed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Autorisation signée
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Clock className="h-4 w-4" />
                  En attente de signature
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Formulaire / Confirmation */}
        {signed ? (
          <>
            <section className="bg-green-50 rounded-2xl shadow-md border border-green-200 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-green-800">
                {autorisation.signeeAt
                  ? `Autorisation signée le ${fmt(autorisation.signeeAt)}`
                  : 'Autorisation signée avec succès !'}
              </h2>
              <p className="mt-2 text-sm text-green-600">
                Merci pour votre confiance. Votre enfant pourra participer au séjour.
              </p>
            </section>

            {/* ── SECTION PAIEMENT (retour parent) ───────────────────────── */}
            {(montantParEleve === null || montantParEleve === 0) ? (
              <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-4">
                  <CreditCard className="h-5 w-5" />
                  Règlement du séjour
                </h2>
                <div className="rounded-xl bg-[var(--color-primary-light)] border border-blue-200 px-5 py-4 text-center">
                  <p className="text-sm text-blue-800">
                    Le prix du séjour sera communiqué prochainement par l&apos;établissement scolaire.
                  </p>
                </div>
              </section>
            ) : (
              <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-6">
                  <CreditCard className="h-5 w-5" />
                  Règlement du séjour
                </h2>

                <div className="rounded-xl bg-[var(--color-primary-light)] border border-blue-200 px-5 py-4 mb-6">
                  <p className="text-sm text-blue-800">
                    Montant total par élève :{' '}
                    <span className="text-lg font-bold">
                      {montantParEleve.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </p>
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Nombre de mensualités
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MENSUALITES_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNombreMensualites(n)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          nombreMensualites === n
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-border-strong)]'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-[var(--color-border-strong)] hover:text-[var(--color-primary)]'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>

                {mensualite !== null && nombreMensualites > 1 && (
                  <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 mb-6">
                    <p className="text-sm text-green-800">
                      {nombreMensualites} mensualités de{' '}
                      <span className="text-lg font-bold">
                        {mensualite.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </span>
                    </p>
                  </div>
                )}

                {showPaymentMsg ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-center">
                    <Lock className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-amber-800">
                      Paiement sécurisé — intégration Stripe à venir
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPaymentMsg(true)}
                    className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Procéder au paiement
                    </span>
                  </button>
                )}

                <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3" />
                  Paiement 100% sécurisé — sans frais
                </p>
              </section>
            )}

            {/* ── SECTION DOCUMENTS MÉDICAUX (retour parent) ─────────────── */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-2">
                <Paperclip className="h-5 w-5" />
                Documents médicaux
                <span className="text-sm font-normal text-gray-400">(optionnel)</span>
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Ordonnance, certificat médical, PAI...
              </p>

              {docUploaded ? (
                <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-800">Document envoyé avec succès</p>
                  <p className="text-xs text-green-600 mt-1">{docFile?.name}</p>
                </div>
              ) : (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-[var(--color-border-strong)] bg-[var(--color-primary-light)]'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_DOC_TYPES}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-[var(--color-primary)]">Cliquer pour choisir</span> ou glisser-déposer un fichier
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC, DOCX</p>
                  </div>

                  {docFile && (
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{docFile.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          ({(docFile.size / 1024).toFixed(0)} Ko)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDocUpload}
                        disabled={docUploading}
                        className="ml-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50"
                      >
                        {docUploading ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Joindre ce document
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-6">
                <Heart className="h-5 w-5" />
                Autoriser la participation
              </h2>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Informations pratiques */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-gray-400" />
                  Informations pratiques
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="taille" className="block text-sm font-medium text-gray-700 mb-1">
                      Taille (cm) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="taille"
                        type="number"
                        min="50"
                        max="250"
                        value={taille}
                        onChange={(e) => setTaille(e.target.value)}
                        placeholder="ex: 145"
                        className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="poids" className="block text-sm font-medium text-gray-700 mb-1">
                      Poids (kg) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="poids"
                        type="number"
                        min="10"
                        max="200"
                        value={poids}
                        onChange={(e) => setPoids(e.target.value)}
                        placeholder="ex: 38"
                        className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pointure" className="block text-sm font-medium text-gray-700 mb-1">
                      Pointure <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Footprints className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="pointure"
                        type="number"
                        min="20"
                        max="50"
                        value={pointure}
                        onChange={(e) => setPointure(e.target.value)}
                        placeholder="ex: 37"
                        className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Régime alimentaire */}
              <div className="mb-6">
                <label htmlFor="regime" className="block text-sm font-medium text-gray-700 mb-1">
                  <UtensilsCrossed className="inline h-4 w-4 mr-1 text-gray-400" />
                  Régime alimentaire
                </label>
                <select
                  id="regime"
                  value={regime}
                  onChange={(e) => setRegime(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                >
                  {REGIME_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {regime === 'Autre' && (
                  <input
                    type="text"
                    value={regimeAutre}
                    onChange={(e) => setRegimeAutre(e.target.value)}
                    placeholder="Précisez le régime alimentaire..."
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                  />
                )}
              </div>

              {/* Niveau de ski (conditionnel) */}
              {showSki && (
                <div className="mb-6">
                  <label htmlFor="niveauSki" className="block text-sm font-medium text-gray-700 mb-1">
                    <Mountain className="inline h-4 w-4 mr-1 text-gray-400" />
                    Niveau de ski
                    <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                  </label>
                  <select
                    id="niveauSki"
                    value={niveauSki}
                    onChange={(e) => setNiveauSki(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                  >
                    {NIVEAU_SKI_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Informations médicales */}
              <div className="mb-6">
                <label
                  htmlFor="infosMedicales"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  <Stethoscope className="inline h-4 w-4 mr-1 text-gray-400" />
                  Informations médicales importantes
                  <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                </label>
                <textarea
                  id="infosMedicales"
                  rows={3}
                  value={infosMedicales}
                  onChange={(e) => setInfosMedicales(e.target.value)}
                  placeholder="Allergies, traitements en cours, contacts d'urgence..."
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none transition-shadow"
                />
              </div>
            </section>

            {/* ── SECTION PAIEMENT ──────────────────────────────────────────── */}
            {(montantParEleve === null || montantParEleve === 0) ? (
              <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-4">
                  <CreditCard className="h-5 w-5" />
                  Règlement du séjour
                </h2>
                <div className="rounded-xl bg-[var(--color-primary-light)] border border-blue-200 px-5 py-4 text-center">
                  <p className="text-sm text-blue-800">
                    Le prix du séjour sera communiqué prochainement par l&apos;établissement scolaire.
                  </p>
                </div>
              </section>
            ) : (
              <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-6">
                  <CreditCard className="h-5 w-5" />
                  Règlement du séjour
                </h2>

                <div className="rounded-xl bg-[var(--color-primary-light)] border border-blue-200 px-5 py-4 mb-6">
                  <p className="text-sm text-blue-800">
                    Montant total par élève :{' '}
                    <span className="text-lg font-bold">
                      {montantParEleve.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </p>
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Nombre de mensualités
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MENSUALITES_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNombreMensualites(n)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          nombreMensualites === n
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-border-strong)]'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-[var(--color-border-strong)] hover:text-[var(--color-primary)]'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>

                {mensualite !== null && nombreMensualites > 1 && (
                  <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 mb-6">
                    <p className="text-sm text-green-800">
                      {nombreMensualites} mensualités de{' '}
                      <span className="text-lg font-bold">
                        {mensualite.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </span>
                    </p>
                  </div>
                )}

                {showPaymentMsg ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-center">
                    <Lock className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-amber-800">
                      Paiement sécurisé — intégration Stripe à venir
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPaymentMsg(true)}
                    className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Procéder au paiement
                    </span>
                  </button>
                )}

                <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3" />
                  Paiement 100% sécurisé — sans frais
                </p>
              </section>
            )}

            {/* ── SECTION DOCUMENTS MÉDICAUX ────────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-2">
                <Paperclip className="h-5 w-5" />
                Documents médicaux
                <span className="text-sm font-normal text-gray-400">(optionnel)</span>
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Ordonnance, certificat médical, PAI...
              </p>

              {docUploaded ? (
                <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-800">Document envoyé avec succès</p>
                  <p className="text-xs text-green-600 mt-1">{docFile?.name}</p>
                </div>
              ) : (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-[var(--color-border-strong)] bg-[var(--color-primary-light)]'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_DOC_TYPES}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-[var(--color-primary)]">Cliquer pour choisir</span> ou glisser-déposer un fichier
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC, DOCX</p>
                  </div>

                  {docFile && (
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{docFile.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          ({(docFile.size / 1024).toFixed(0)} Ko)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDocUpload}
                        disabled={docUploading}
                        className="ml-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50"
                      >
                        {docUploading ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Joindre ce document
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── SECTION RGPD ──────────────────────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)] mb-4">
                <ShieldCheck className="h-5 w-5" />
                Protection des données personnelles
              </h2>

              <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 mb-5 max-h-48 overflow-y-auto">
                <p className="text-xs text-gray-600 leading-relaxed">
                  {RGPD_TEXT}
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rgpdAccepte}
                  onChange={(e) => setRgpdAccepte(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-2 cursor-pointer"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  J&apos;ai lu et j&apos;accepte les conditions de traitement de mes données personnelles
                  <span className="text-red-500 ml-0.5">*</span>
                </span>
              </label>
            </section>

            {/* ── BOUTON SIGNER ─────────────────────────────────────────────── */}
            <section className="pb-2">
              <button
                type="button"
                onClick={handleSign}
                disabled={signing || !formValid}
                className="w-full rounded-xl bg-green-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-600/25 hover:bg-green-700 hover:shadow-green-700/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                {signing ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signature en cours...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Je signe et autorise mon enfant à participer
                  </span>
                )}
              </button>

              {!rgpdAccepte && (
                <p className="mt-2 text-xs text-amber-600 text-center">
                  Vous devez accepter les conditions RGPD pour pouvoir signer.
                </p>
              )}

              <p className="mt-3 text-xs text-gray-400 text-center">
                En signant, vous autorisez la participation de votre enfant à ce séjour
                et certifiez avoir pris connaissance des informations ci-dessus.
              </p>
            </section>
          </>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-gray-400">
          Liavo — Plateforme de gestion des séjours scolaires
        </p>
      </footer>
    </div>
  );
}
