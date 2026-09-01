'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { createSejourDirect } from '@/src/lib/collaboration';
import type { SejourPlanning } from '@/src/lib/collaboration';
import { getMesClients } from '@/src/lib/clients';
import type { Client } from '@/src/lib/clients';
import RechercheOrganisation from '@/src/components/RechercheOrganisation';
import type { OrganisationResult } from '@/src/components/OrganisationSearch';

// Normalisation accent-insensible — partagée avec le planning.
export function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

export const SOUS_TYPES_SEJOUR = [
  { value: 'CLASSE_DECOUVERTE', label: 'Classe de découverte' },
  { value: 'COLONIE_VACANCES', label: 'Colonie de vacances' },
  { value: 'CAMP_SPORTIF', label: 'Camp sportif' },
  { value: 'SEJOUR_LINGUISTIQUE', label: 'Séjour linguistique' },
  { value: 'SEJOUR_ETUDIANT', label: 'Séjour étudiant' },
  { value: 'AUTRE_SEJOUR', label: 'Autre séjour' },
];

export const SOUS_TYPES_EVENEMENT = [
  { value: 'MARIAGE', label: 'Mariage' },
  { value: 'ANNIVERSAIRE', label: 'Anniversaire' },
  { value: 'SEMINAIRE', label: 'Séminaire' },
  { value: 'TEAM_BUILDING', label: 'Team building' },
  { value: 'REUNION_FAMILLE', label: 'Réunion de famille' },
  { value: 'AUTRE_EVENEMENT', label: 'Autre événement' },
];

export interface CreateSejourModalProps {
  natureSejour: 'SEJOUR' | 'EVENEMENT';
  initialDates?: { dateDebut: string; dateFin: string } | null;
  initialClient?: {
    nom?: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    organisation?: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    clientId?: string;
  } | null;
  onClose: () => void;
  onCreated: (sejour: SejourPlanning) => void;
  /** Onboarding : propose d'abord le choix séjour test / vrai séjour client. Défaut false. */
  proposeTest?: boolean;
}

type Etape = 'CHOIX' | 'CLIENT' | 'SEJOUR' | 'DETAILS';

export default function CreateSejourModal({
  natureSejour,
  initialDates,
  initialClient,
  onClose,
  onCreated,
  proposeTest,
}: CreateSejourModalProps) {
  const { user } = useAuth();

  // Wizard 3 étapes Client → Séjour → Détails (+ écran CHOIX onboarding). Fiche CRM
  // (client connu) → on démarre au séjour ; « Précédent » permet de revenir au client.
  const [etape, setEtape] = useState<Etape>(
    proposeTest ? 'CHOIX' : (initialClient?.clientId ? 'SEJOUR' : 'CLIENT')
  );

  // Checkbox « Dates à définir » : quand cochée, on masque les champs date et on
  // envoie dateDebut/dateFin = undefined au backend (séjour exploratoire sans dates).
  const [datesADefinir, setDatesADefinir] = useState(false);

  const [form, setForm] = useState({
    titre: '',
    typeSejour: natureSejour === 'SEJOUR' ? 'CLASSE_DECOUVERTE' : 'MARIAGE',
    dateDebut: initialDates?.dateDebut ?? '',
    dateFin: initialDates?.dateFin ?? '',
    nombreParticipants: '',
    nombreAccompagnants: '',
    clientNom: initialClient?.nom ?? '',
    clientPrenom: initialClient?.prenom ?? '',
    clientEmail: initialClient?.email ?? '',
    clientTelephone: initialClient?.telephone ?? '',
    clientOrganisation: initialClient?.organisation ?? '',
    clientAdresse: initialClient?.adresse ?? '',
    clientCodePostal: initialClient?.codePostal ?? '',
    clientVille: initialClient?.ville ?? '',
    description: '',
    moisSouhaite: '',
    anneeSouhaitee: '',
    noteDateFlexible: '',
    dureeNuits: '',
    // Étape 3 — Détails (SEJOUR uniquement, tous optionnels)
    niveauClasse: '',
    heureArrivee: '',
    heureDepart: '',
    transportAller: '',
    transportSurPlace: '',
    activitesSouhaitees: '',
    budgetMaxParEleve: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type de client : Particulier (mariage, anniversaire…) ou Professionnel (SIRET).
  // Si un client est pré-rempli avec une organisation, on bascule directement en Professionnel.
  const [clientType, setClientType] = useState<'PARTICULIER' | 'PROFESSIONNEL'>(
    initialClient?.organisation
      ? 'PROFESSIONNEL'
      : natureSejour === 'EVENEMENT'
        ? 'PARTICULIER'
        : 'PROFESSIONNEL'
  );

  // Autocomplétion du contact depuis les clients existants du CRM
  const [crmClients, setCrmClients] = useState<Client[]>([]);
  const [showContactSuggest, setShowContactSuggest] = useState(false);

  // Charger les clients du CRM pour l'autocomplétion du contact
  useEffect(() => {
    getMesClients().then(setCrmClients).catch(() => {});
  }, []);

  // Sélection d'un résultat de recherche : pré-remplit les champs. Le nom d'établissement
  // reste porté par form.clientOrganisation (source de vérité, toujours éditable).
  const handleSelectOrg = (org: OrganisationResult) => {
    setForm(f => ({
      ...f,
      clientOrganisation: org.nom,
      clientAdresse: org.adresse ?? f.clientAdresse,
      clientCodePostal: org.codePostal ?? f.clientCodePostal,
      clientVille: org.ville ?? f.clientVille,
      // Email/téléphone JAMAIS pré-remplis depuis l'annuaire : ce sont les coordonnées
      // de l'établissement (secrétariat), pas du contact/enseignant. L'hébergeur les saisit
      // manuellement — clientEmail est le destinataire du devis + lien de signature.
    }));
  };

  // Suggestions de contacts existants (CRM) filtrées sur le nom saisi
  const contactSuggestions = (() => {
    const q = normalise(form.clientNom.trim());
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const out: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }[] = [];
    const push = (s: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }) => {
      const key = `${normalise(s.prenom)}|${normalise(s.nom)}|${s.email.toLowerCase()}`;
      if (!s.nom && !s.prenom) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    };
    for (const c of crmClients) {
      const isParticulier = c.type === 'PARTICULIER';
      const organisation = isParticulier ? null : c.nom;
      // Un particulier est souvent stocké en tant que Client (nom = nom de famille)
      if (isParticulier) {
        push({ prenom: '', nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', organisation: null });
      }
      // Tout client (quelle que soit son organisation) : indexer le nom du client lui-même
      if (!isParticulier) {
        // Chercher sur clientNom : le nom de l'organisation / famille / couple
        push({ prenom: '', nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', organisation: c.nom });
      }
      for (const ct of c.contacts ?? []) {
        push({ prenom: ct.prenom ?? '', nom: ct.nom ?? '', email: ct.email ?? '', telephone: ct.telephone ?? '', organisation });
      }
    }
    return out
      .filter(s => normalise(`${s.prenom} ${s.nom}`).includes(q) || normalise(s.nom).includes(q))
      .slice(0, 8);
  })();

  const selectContact = (s: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }) => {
    setForm(f => ({
      ...f,
      clientNom: s.nom,
      clientPrenom: s.prenom || f.clientPrenom,
      clientEmail: s.email || f.clientEmail,
      clientTelephone: s.telephone || f.clientTelephone,
    }));
    // Contact rattaché à une structure → bascule en mode Professionnel et pré-remplit l'établissement
    if (s.organisation) {
      setClientType('PROFESSIONNEL');
      const orga = s.organisation;
      setForm(f => ({ ...f, clientOrganisation: orga }));
    }
    setShowContactSuggest(false);
  };

  // Séjour test : pré-remplit l'hébergeur comme client (il pourra tout s'envoyer
  // à sa propre adresse — seule destination autorisée tant que le centre est gaté).
  const choisirTest = () => {
    setForm(f => ({
      ...f,
      titre: f.titre || (natureSejour === 'SEJOUR' ? 'TEST — Mon séjour test' : 'TEST — Mon événement test'),
      clientPrenom: user?.firstName ?? '',
      clientNom: user?.lastName ?? '',
      clientEmail: user?.email ?? '',
    }));
    setClientType('PARTICULIER');
    setEtape('CLIENT');
  };

  const choisirReel = () => setEtape('CLIENT');

  const sousTypes = natureSejour === 'SEJOUR' ? SOUS_TYPES_SEJOUR : SOUS_TYPES_EVENEMENT;
  const labelParticipants = natureSejour === 'SEJOUR' ? 'Nombre de participants' : 'Nombre de personnes';

  const handleSubmit = async () => {
    if (!form.titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!datesADefinir && (!form.dateDebut || !form.dateFin)) {
      setError('Renseignez les dates ou cochez « Dates à définir »');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sejour = await createSejourDirect({
        titre: form.titre.trim(),
        natureSejour,
        typeSejour: form.typeSejour,
        dateDebut: datesADefinir ? undefined : form.dateDebut,
        dateFin: datesADefinir ? undefined : form.dateFin,
        nombreParticipants: parseInt(form.nombreParticipants) || 0,
        nombreAccompagnateurs: parseInt(form.nombreAccompagnants) || undefined,
        clientNom: form.clientNom.trim() || undefined,
        clientPrenom: form.clientPrenom.trim() || undefined,
        clientEmail: form.clientEmail.trim() || undefined,
        clientTelephone: form.clientTelephone.trim() || undefined,
        clientOrganisation: clientType === 'PROFESSIONNEL'
          ? (form.clientOrganisation.trim() || undefined)
          : undefined,
        clientAdresse: form.clientAdresse.trim() || undefined,
        clientCodePostal: form.clientCodePostal.trim() || undefined,
        clientVille: form.clientVille.trim() || undefined,
        // Client CRM existant : le backend lie directement et ne crée pas de client fantôme.
        clientId: initialClient?.clientId ?? undefined,
        ...(datesADefinir ? {
          moisSouhaite: form.moisSouhaite ? parseInt(form.moisSouhaite) : undefined,
          anneeSouhaitee: form.anneeSouhaitee ? parseInt(form.anneeSouhaitee) : undefined,
          noteDateFlexible: form.noteDateFlexible || undefined,
          dureeNuits: form.dureeNuits ? parseInt(form.dureeNuits) : undefined,
        } : {}),
        // Étape 3 — Détails : uniquement pour un SÉJOUR, jamais de chaîne vide (§7).
        // thematiquesPedagogiques n'est jamais envoyé depuis la modale (l'enseignant les saisit).
        ...(natureSejour === 'SEJOUR' ? {
          niveauClasse: form.niveauClasse.trim() || undefined,
          heureArrivee: form.heureArrivee || undefined,
          heureDepart: form.heureDepart || undefined,
          transportAller: form.transportAller || undefined,
          transportSurPlace: form.transportSurPlace === '' ? undefined : form.transportSurPlace === 'oui',
          activitesSouhaitees: form.activitesSouhaitees.trim() || undefined,
          budgetMaxParEleve: parseFloat(form.budgetMaxParEleve) || undefined,
        } : {}),
      });
      onCreated(sejour);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const creerLabel = saving ? 'Création…' : natureSejour === 'SEJOUR' ? 'Créer le séjour' : 'Créer l\'événement';
  const creerDisabled = saving || !form.titre.trim();

  // Indicateur d'étapes (idiome nouveau-sejour) — le 3 « Détails » masqué pour un événement.
  const steps: { key: Etape; label: string }[] = [
    { key: 'CLIENT', label: 'Client' },
    { key: 'SEJOUR', label: 'Séjour' },
    ...(natureSejour === 'SEJOUR' ? [{ key: 'DETAILS' as Etape, label: 'Détails' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        {etape === 'CHOIX' ? (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-5">Comment voulez-vous commencer ?</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={choisirTest}
                className="w-full text-left rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 hover:opacity-90 transition-opacity"
              >
                <p className="text-sm font-semibold text-gray-900">🧪 Séjour test (recommandé)</p>
                <p className="text-xs text-gray-500 mt-1">
                  Testez tout le parcours en sécurité : vous êtes pré-rempli comme client, vous pourrez vous envoyer le devis à vous-même.
                </p>
              </button>
              <button
                type="button"
                onClick={choisirReel}
                className="w-full text-left rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900">Vrai séjour client</p>
                <p className="text-xs text-gray-500 mt-1">
                  Vous avez déjà un client ? Créez directement son séjour.
                </p>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full text-center text-xs text-gray-500 hover:underline"
            >
              Annuler
            </button>
          </div>
        ) : (
        <>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          {natureSejour === 'SEJOUR' ? '📋 Nouveau séjour' : '🎉 Nouvel événement'}
        </h2>

        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-2 text-xs font-medium mb-5">
          {steps.map((s, i) => (
            <span key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">·</span>}
              <span className={etape === s.key ? 'text-[var(--color-primary)]' : 'text-gray-400'}>
                {i + 1} {s.label}
              </span>
            </span>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {/* ── Étape CLIENT ──────────────────────────────────────────────── */}
        {etape === 'CLIENT' && (
        <div className="space-y-4">
          {/* Choix explicite Particulier / Professionnel — en tête de l'étape */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setClientType('PARTICULIER'); setForm(f => ({ ...f, clientOrganisation: '' })); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${clientType === 'PARTICULIER' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              👤 Particulier
            </button>
            <button
              type="button"
              onClick={() => setClientType('PROFESSIONNEL')}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${clientType === 'PROFESSIONNEL' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              🏢 Professionnel (SIRET)
            </button>
          </div>

          {clientType === 'PROFESSIONNEL' && (
            <div className="space-y-2">
              <RechercheOrganisation onSelect={handleSelectOrg} />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Établissement</label>
                <input type="text" value={form.clientOrganisation} onChange={set('clientOrganisation')}
                  placeholder="Nom de l'établissement"
                  className={inputCls} />
                <p className="text-[11px] text-gray-400 mt-1">La recherche pré-remplit ce champ ; vous pouvez aussi le saisir à la main (ex. école publique non répertoriée par les annuaires).</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" value={form.clientPrenom} onChange={set('clientPrenom')}
                className={inputCls} />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                autoComplete="off"
                value={form.clientNom}
                onChange={e => { setForm(f => ({ ...f, clientNom: e.target.value })); setShowContactSuggest(true); }}
                onFocus={() => setShowContactSuggest(true)}
                onBlur={() => setTimeout(() => setShowContactSuggest(false), 150)}
                className={inputCls} />
              {/* Suggestions de clients existants du CRM */}
              {showContactSuggest && contactSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                  {contactSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectContact(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{`${s.prenom} ${s.nom}`.trim()}</span>
                      {s.organisation && <span className="text-gray-400"> — {s.organisation}</span>}
                      {s.email && <span className="block text-[11px] text-gray-400">{s.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Adresse du destinataire (figée sur le devis/facture) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
            <input type="text" value={form.clientAdresse} onChange={set('clientAdresse')}
              className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code postal</label>
              <input type="text" value={form.clientCodePostal} onChange={set('clientCodePostal')}
                className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
              <input type="text" value={form.clientVille} onChange={set('clientVille')}
                className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.clientEmail} onChange={set('clientEmail')}
                className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-1">Destinataire du devis et du lien de signature.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.clientTelephone} onChange={set('clientTelephone')}
                className={inputCls} />
            </div>
          </div>
        </div>
        )}

        {/* ── Étape SEJOUR ──────────────────────────────────────────────── */}
        {etape === 'SEJOUR' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 -mt-1 mb-1">
            {datesADefinir
              ? 'Les dates pourront être renseignées plus tard.'
              : 'Les dates seront bloquées au planning dès la création.'}
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select value={form.typeSejour} onChange={set('typeSejour')}
              className={inputCls}>
              {sousTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Titre</label>
            <input type="text" value={form.titre} onChange={set('titre')}
              placeholder={natureSejour === 'SEJOUR' ? 'ex: Classe de neige 4ème' : 'ex: Mariage Dupont-Martin'}
              className={inputCls} />
          </div>

          {/* Checkbox « Dates à définir » au-dessus des champs date */}
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={datesADefinir}
              onChange={e => setDatesADefinir(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            Dates à définir (appel exploratoire sans dates précises)
          </label>

          {!datesADefinir && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
                <input type="date" value={form.dateDebut} onChange={set('dateDebut')}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
                <input type="date" value={form.dateFin} onChange={set('dateFin')}
                  className={inputCls} />
              </div>
            </div>
          )}

          {datesADefinir && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-3">
              <p className="text-xs text-blue-700 font-medium">Période souhaitée (optionnel)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Mois</label>
                  <select value={form.moisSouhaite} onChange={set('moisSouhaite')}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    <option value="">--</option>
                    {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m,i) => (
                      <option key={i+1} value={String(i+1)}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Année</label>
                  <input type="number" value={form.anneeSouhaitee} onChange={set('anneeSouhaitee')}
                    placeholder="2027" min="2025" max="2030"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Précision</label>
                <input type="text" value={form.noteDateFlexible} onChange={set('noteDateFlexible')}
                  placeholder='ex: "Semaine de Pâques"'
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Durée estimée (nuits)</label>
                <input type="number" value={form.dureeNuits} onChange={set('dureeNuits')}
                  placeholder="ex: 5" min="1" max="30"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{labelParticipants}</label>
              <input type="number" min="0" value={form.nombreParticipants} onChange={set('nombreParticipants')}
                placeholder="ex: 48"
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Accompagnants</label>
              <input type="number" min="0" value={form.nombreAccompagnants} onChange={set('nombreAccompagnants')}
                placeholder="ex: 4"
                className={inputCls} />
            </div>
          </div>
        </div>
        )}

        {/* ── Étape DETAILS (SÉJOUR uniquement) ─────────────────────────── */}
        {etape === 'DETAILS' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Détails du séjour (optionnel)</h3>
            <p className="text-xs text-gray-500 mt-1">
              Rien n&apos;est obligatoire. Ces informations vous serviront de pense-bête pour le devis, et
              alimenteront le projet pédagogique et les déclarations (rectorat, TAM) de l&apos;organisateur.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Niveau / classe / âge</label>
            <input type="text" maxLength={50} value={form.niveauClasse} onChange={set('niveauClasse')}
              placeholder="ex : 6ème · 11-14 ans"
              className={`${inputCls} placeholder:italic`} />
            <p className="text-[11px] text-gray-400 mt-1">Classe ou tranche d&apos;âge selon le séjour — pour adapter le devis et les activités.</p>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heure d&apos;arrivée</label>
                <input type="time" value={form.heureArrivee} onChange={set('heureArrivee')}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heure de départ</label>
                <input type="time" value={form.heureDepart} onChange={set('heureDepart')}
                  className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Reprises dans le devis et le planning.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Transport aller</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="transportAller" value="DEJA_TRANSPORTEUR"
                  checked={form.transportAller === 'DEJA_TRANSPORTEUR'}
                  onChange={() => setForm(f => ({ ...f, transportAller: 'DEJA_TRANSPORTEUR' }))}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-[var(--color-primary)]" />
                <span className="text-xs text-gray-700">L&apos;organisateur a déjà un transporteur</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="transportAller" value="BESOIN_TRANSPORTEUR"
                  checked={form.transportAller === 'BESOIN_TRANSPORTEUR'}
                  onChange={() => setForm(f => ({ ...f, transportAller: 'BESOIN_TRANSPORTEUR' }))}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-[var(--color-primary)]" />
                <span className="text-xs text-gray-700">Il a besoin d&apos;un transporteur</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Transport sur place</label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="transportSurPlace" value="oui"
                  checked={form.transportSurPlace === 'oui'}
                  onChange={() => setForm(f => ({ ...f, transportSurPlace: 'oui' }))}
                  className="h-4 w-4 border-gray-300 text-[var(--color-primary)]" />
                <span className="text-xs text-gray-700">Oui</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="transportSurPlace" value="non"
                  checked={form.transportSurPlace === 'non'}
                  onChange={() => setForm(f => ({ ...f, transportSurPlace: 'non' }))}
                  className="h-4 w-4 border-gray-300 text-[var(--color-primary)]" />
                <span className="text-xs text-gray-700">Non</span>
              </label>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Utiles pour le devis (navettes, activités) et la déclaration TAM.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Activités souhaitées</label>
            <textarea rows={3} value={form.activitesSouhaitees} onChange={set('activitesSouhaitees')}
              className={inputCls} />
            <p className="text-[11px] text-gray-400 mt-1">Pense-bête pour construire le devis.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Budget max / participant (€)</label>
            <input type="number" min={0} step={1} value={form.budgetMaxParEleve} onChange={set('budgetMaxParEleve')}
              placeholder="ex : 350"
              className={inputCls} />
            <p className="text-[11px] text-gray-400 mt-1">Cadre le devis.</p>
          </div>
        </div>
        )}

        {/* ── Barre de navigation ───────────────────────────────────────── */}
        <div className="flex gap-3 mt-6">
          {etape === 'CLIENT' && (
            <>
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => setEtape('SEJOUR')}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Suivant →
              </button>
            </>
          )}

          {etape === 'SEJOUR' && (
            <>
              <button
                onClick={() => setEtape('CLIENT')}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Précédent
              </button>
              <button
                onClick={handleSubmit}
                disabled={creerDisabled}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {creerLabel}
              </button>
              {natureSejour === 'SEJOUR' && (
                <button
                  onClick={() => setEtape('DETAILS')}
                  disabled={!form.titre.trim()}
                  className="rounded-lg border border-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ajouter les détails →
                </button>
              )}
            </>
          )}

          {etape === 'DETAILS' && (
            <>
              <button
                onClick={() => setEtape('SEJOUR')}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Précédent
              </button>
              <button
                onClick={handleSubmit}
                disabled={creerDisabled}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {creerLabel}
              </button>
            </>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
