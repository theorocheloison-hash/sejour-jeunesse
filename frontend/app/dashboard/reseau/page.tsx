'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getMyReseauStats,
  getReseauDemandes,
  inviterCentreReseau,
  getReseauCentreDetail,
  type ReseauStats,
  type ReseauCentre,
  type DemandeReseau,
} from '@/src/lib/admin';
import { formatDate } from '@/src/lib/utils';
import KpiCard from '@/src/components/KpiCard';
import StatutBadge, { type StatutBadgeEntry } from '@/src/components/StatutBadge';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEuros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function demandePeriode(d: DemandeReseau): string {
  if (d.dateDebut && d.dateFin) return `${formatDate(d.dateDebut, 'numeric')} → ${formatDate(d.dateFin, 'numeric')}`;
  const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const parts: string[] = [];
  if (d.moisSouhaite) parts.push(MOIS[d.moisSouhaite - 1]);
  if (d.anneeSouhaitee) parts.push(String(d.anneeSouhaitee));
  if (d.dureeNuits) parts.push(`~${d.dureeNuits} nuits`);
  return parts.length ? parts.join(' ') : 'Période à définir';
}

const DEMANDE_STATUT_CONFIG: Record<string, StatutBadgeEntry> = {
  OUVERTE: { cls: 'bg-green-100 text-green-700', label: 'Ouverte' },
  FERMEE: { cls: 'bg-gray-100 text-gray-600', label: 'Fermée' },
  ANNULEE: { cls: 'bg-red-100 text-red-700', label: 'Annulée' },
};

const PERIODES: { value: string; label: string }[] = [
  { value: '30j', label: '30 derniers jours' },
  { value: '90j', label: '90 jours' },
  { value: 'saison', label: 'Cette saison' },
  { value: 'tout', label: 'Depuis le début' },
];

const ONBOARDING_LABELS = ['Profil complet', 'Mandat signé', 'Agrément renseigné', 'SIRET renseigné'];

// ─── Funnel pipeline (onglet Demandes) ───────────────────────────────────────

const CONFIRME_STATUTS = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];

function FunnelPipeline({ demandes, kpis, active, onSelect }: {
  demandes: DemandeReseau[];
  kpis: ReseauStats['kpis'];
  active: 'all' | 'avec_reponse' | 'confirmes';
  onSelect: (f: 'all' | 'avec_reponse' | 'confirmes') => void;
}) {
  const avecProposition = demandes.filter(d => d.nombreReponses > 0).length;
  const blocs = [
    { key: 'all' as const,          label: 'Demandes',            sub: 'reçues',              value: kpis.demandesReseau,        color: 'bg-blue-50 text-blue-700 border-blue-200',   ring: 'ring-blue-400' },
    { key: 'avec_reponse' as const, label: 'Avec proposition(s)', sub: '≥1 centre a répondu', value: avecProposition,            color: 'bg-sky-50 text-sky-700 border-sky-200',      ring: 'ring-sky-400' },
    { key: 'confirmes' as const,    label: 'Séjours confirmés',   sub: 'devis signé',         value: kpis.devisReseau,           color: 'bg-green-50 text-green-700 border-green-200', ring: 'ring-green-400' },
    { key: 'confirmes' as const,    label: 'CA généré',           sub: 'via le réseau',       value: formatEuros(kpis.caReseau), color: 'bg-amber-50 text-amber-700 border-amber-200', ring: 'ring-amber-400' },
  ];
  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-2">
      {blocs.map((b, i) => (
        <Fragment key={i}>
          <button
            type="button"
            onClick={() => onSelect(b.key)}
            className={`flex-1 text-left rounded-xl border p-4 transition ${b.color} ${active === b.key ? `ring-2 ${b.ring} border-transparent` : 'hover:shadow-sm'}`}
          >
            <p className="text-2xl font-bold">{b.value}</p>
            <p className="text-sm font-semibold">{b.label}</p>
            <p className="text-[11px] opacity-70">{b.sub}</p>
          </button>
          {i < blocs.length - 1 && <div className="hidden sm:flex items-center text-gray-300 text-xl">▸</div>}
        </Fragment>
      ))}
    </div>
  );
}

// ─── Statut badge ────────────────────────────────────────────────────────────

const CENTRE_STATUT_CONFIG: Record<string, StatutBadgeEntry> = {
  ACTIVE: { label: 'Actif', cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  SUSPENDED: { label: 'Suspendu', cls: 'bg-red-100 text-red-700' },
};
const CENTRE_STATUT_FALLBACK: StatutBadgeEntry = { label: 'En attente', cls: 'bg-amber-100 text-amber-700' };

// ─── Onboarding dots ─────────────────────────────────────────────────────────

function OnboardingDots({ centre }: { centre: ReseauCentre }) {
  const steps = [
    centre.onboardingDetails.profilComplet,
    centre.onboardingDetails.mandatSigne,
    centre.onboardingDetails.agrementRenseigne,
    centre.onboardingDetails.siretRenseigne,
  ];
  return (
    <div className="flex items-center gap-1">
      {steps.map((ok, i) => (
        <span
          key={i}
          title={ONBOARDING_LABELS[i]}
          className={`inline-block w-2.5 h-2.5 rounded-full cursor-help ${ok ? 'bg-[var(--color-success)]' : 'bg-gray-300'}`}
        />
      ))}
    </div>
  );
}

// ─── Loading / Empty ─────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border-strong)] border-t-transparent" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
      <p className="text-sm font-medium text-gray-500">{text}</p>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {message}
    </div>
  );
}

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [nomCentre, setNomCentre] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !nomCentre) { setError('Tous les champs sont obligatoires'); return; }
    setSending(true);
    setError(null);
    try {
      await inviterCentreReseau(email, nomCentre);
      onSuccess(`Invitation envoyée à ${email}`);
      onClose();
    } catch {
      setError('Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Inviter un centre</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email du centre</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="contact@centre.fr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du centre</label>
            <input
              type="text"
              value={nomCentre}
              onChange={e => setNomCentre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="Centre de la Montagne"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={sending} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition disabled:opacity-50">
            {sending ? 'Envoi...' : 'Envoyer l\'invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slide-over centre detail ────────────────────────────────────────────────

const DEVIS_STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  EN_ATTENTE_VALIDATION: 'Validation',
  SELECTIONNE: 'Retenu',
  SIGNE_DIRECTION: 'Signé',
  NON_RETENU: 'Non retenu',
};

function CentreSlideOver({ centreId, reseauLabel, onClose }: { centreId: string; reseauLabel: string; onClose: () => void }) {
  const [centre, setCentre] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReseauCentreDetail(centreId)
      .then(setCentre)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [centreId]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 z-50 overflow-y-auto">
        <div className="p-5">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>

          {loading ? <LoadingSpinner /> : !centre ? <EmptyState text="Centre introuvable" /> : (
            <div className="space-y-5 pt-2">
              {centre.imageUrl && (
                <img src={centre.imageUrl} alt={centre.nom} className="w-full h-40 object-cover rounded-xl" />
              )}

              <div>
                <h2 className="text-lg font-bold text-gray-900">{centre.nom}</h2>
                <p className="text-sm text-gray-500">{centre.ville}{centre.departement ? ` (${centre.departement})` : ''}</p>
                <p className="text-xs text-gray-400">{centre.adresse}, {centre.codePostal}</p>
              </div>

              {/* CA généré via le réseau — mis en évidence */}
              <div className="rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 p-4">
                <p className="text-xs font-medium text-[var(--color-primary)] uppercase tracking-wide">CA généré via {reseauLabel}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatEuros(centre.caViaReseau ?? 0)}</p>
              </div>

              {!(centre.description) && centre.source === 'APIDAE' && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Importé depuis APIDAE</p>
                  <p className="text-xs text-blue-600">
                    Ce centre a été importé automatiquement. Son profil complet sera disponible
                    dès qu&apos;il aura rejoint la plateforme.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Capacité élèves</span><p className="font-medium">{centre.capacite}</p></div>
                {centre.capaciteAdultes && <div><span className="text-gray-500">Capacité adultes</span><p className="font-medium">{centre.capaciteAdultes}</p></div>}
              </div>

              {centre.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
                  <p className="text-sm text-gray-700">{centre.description}</p>
                </div>
              )}

              {centre.thematiquesCentre?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Thématiques</p>
                  <div className="flex flex-wrap gap-1.5">
                    {centre.thematiquesCentre.map((t: string) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {centre.activitesCentre?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Activités</p>
                  <div className="flex flex-wrap gap-1.5">
                    {centre.activitesCentre.map((a: string) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {centre.periodeOuverture && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Période d&apos;ouverture</p>
                  <p className="text-sm text-gray-700">{centre.periodeOuverture}</p>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {centre.accessiblePmr && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Accessible PMR</span>
                )}
                {centre.avisSecurite && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Avis sécurité : {centre.avisSecurite}</span>
                )}
                {centre.agrementEducationNationale && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Agréé EN</span>
                )}
              </div>

              {/* Statut plateforme */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Statut plateforme</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Compte</span>
                  <StatutBadge statut={centre.statut} config={CENTRE_STATUT_CONFIG} fallback={CENTRE_STATUT_FALLBACK} compact />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Mandat signé</span>
                  <span className={`font-medium ${centre.mandatFacturationAccepte ? 'text-green-600' : 'text-amber-600'}`}>
                    {centre.mandatFacturationAccepte ? `Oui (${formatDate(centre.mandatFacturationAccepteAt, 'numeric')})` : 'Non'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">SIRET</span>
                  <span className={`font-medium ${centre.siret ? 'text-green-600' : 'text-amber-600'}`}>
                    {centre.siret ? 'Oui' : 'Non'}
                  </span>
                </div>
              </div>

              {/* Activité récente — devis */}
              {centre.devis?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Derniers devis</p>
                  <div className="space-y-1.5">
                    {centre.devis.slice(0, 5).map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">{formatDate(d.createdAt, 'numeric')}</span>
                        <div className="flex items-center gap-1.5">
                          {d.demande?.sourceReseau && (
                            <span className="inline-flex items-center rounded-full bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">via {reseauLabel}</span>
                          )}
                          <span className="text-xs font-medium text-gray-600">{DEVIS_STATUT_LABELS[d.statut] ?? d.statut}</span>
                        </div>
                        <span className="font-medium text-gray-900">{d.montantTTC ? formatEuros(d.montantTTC) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Slide-over demande detail ───────────────────────────────────────────────

const TYPE_PENSION_LABELS: Record<string, string> = {
  PENSION_COMPLETE: 'Pension complète',
  DEMI_PENSION: 'Demi-pension',
  GESTION_LIBRE: 'Gestion libre',
};

const TYPE_STRUCTURE_LABELS: Record<string, string> = {
  COLLEGE_LYCEE: 'Collège / Lycée',
  ECOLE_PRIMAIRE: 'École primaire',
  MAIRIE: 'Mairie',
  COLLECTIVITE_TERRITORIALE: 'Collectivité territoriale',
  CENTRE_LOISIRS: 'Centre de loisirs',
  ASSOCIATION: 'Association',
  COMITE_ENTREPRISE: "Comité d'entreprise",
  ENTREPRISE: 'Entreprise',
  MICRO_ENTREPRISE: 'Micro-entreprise',
  AUTRE: 'Autre',
};

function ContexteBadge({ typeContexte }: { typeContexte?: string | null }) {
  if (!typeContexte) return null;
  const scolaire = typeContexte === 'SCOLAIRE';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${scolaire ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
      {scolaire ? 'Scolaire' : 'Hors scolaire'}
    </span>
  );
}

function DemandeSlideOver({ demande, reseauLabel, onClose }: { demande: DemandeReseau; reseauLabel: string; onClose: () => void }) {
  const e = demande.enseignant;
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[28rem] max-w-full bg-white shadow-xl border-l border-gray-200 z-50 overflow-y-auto">
        <div className="p-5 space-y-5 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>

          <div className="pt-2">
            <div className="flex items-center gap-2">
              <StatutBadge statut={demande.statut} config={DEMANDE_STATUT_CONFIG} compact />
              <span className="text-xs text-gray-400">{formatDate(demande.createdAt, 'numeric')}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-2">{demande.titre}</h2>
          </div>

          {/* Contact enseignant — appel / requalification */}
          <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4 space-y-1.5">
            <p className="text-xs font-semibold text-[var(--color-primary)] uppercase">Contact enseignant</p>
            <p className="text-base font-bold text-gray-900">{e.prenom} {e.nom}</p>
            {demande.organisation && (
              <p className="text-xs text-gray-500">{demande.organisation.nom}{demande.organisation.ville ? ` · ${demande.organisation.ville}` : ''}</p>
            )}
            <a href={`mailto:${e.email}`} className="block text-sm text-[var(--color-primary)] hover:underline break-all">{e.email}</a>
            {e.telephone
              ? <a href={`tel:${e.telephone.replace(/\s/g, '')}`} className="mt-1 inline-flex items-center gap-1.5 text-base font-bold text-[var(--color-primary)] hover:underline">📞 {e.telephone}</a>
              : <p className="text-sm text-gray-400">Téléphone non renseigné</p>}
          </div>

          {/* Détails séjour */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Période</span><p className="font-medium">{demandePeriode(demande)}</p></div>
            <div><span className="text-gray-500">Effectif</span><p className="font-medium">{demande.placesTotales} élèves{demande.nombreAccompagnateurs ? ` + ${demande.nombreAccompagnateurs}` : ''}</p></div>
            {demande.niveauClasse && <div><span className="text-gray-500">Niveau</span><p className="font-medium">{demande.niveauClasse}</p></div>}
            <div><span className="text-gray-500">Contexte</span><p className="font-medium">{demande.typeContexte === 'SCOLAIRE' ? 'Scolaire' : 'Hors-scolaire'}</p></div>
            {demande.organisation?.typeStructure && (
              <div><span className="text-gray-500">Type de structure</span><p className="font-medium">{TYPE_STRUCTURE_LABELS[demande.organisation.typeStructure] ?? demande.organisation.typeStructure}</p></div>
            )}
            {(demande.ageMin != null || demande.ageMax != null) && (
              <div><span className="text-gray-500">Tranche d&apos;âge</span><p className="font-medium">{demande.ageMin ?? '?'} - {demande.ageMax ?? '?'} ans</p></div>
            )}
            {demande.heureArrivee && <div><span className="text-gray-500">Arrivée</span><p className="font-medium">{demande.heureArrivee}</p></div>}
            {demande.heureDepart && <div><span className="text-gray-500">Départ</span><p className="font-medium">{demande.heureDepart}</p></div>}
            {demande.budgetMaxParEleve != null && (
              <div><span className="text-gray-500">Budget max / élève</span><p className="font-medium">{demande.budgetMaxParEleve} €</p></div>
            )}
            {demande.departementsCibles.length > 0 && (
              <div className="col-span-2"><span className="text-gray-500">Départements ciblés</span><p className="font-medium">{demande.departementsCibles.join(', ')}</p></div>
            )}
          </div>

          {/* Transport */}
          {demande.transportAller && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {demande.transportAller === 'BESOIN_TRANSPORTEUR'
                ? 'Transport aller demandé — à inclure dans le devis'
                : "Transport aller : déjà prévu par l'enseignant"}
            </div>
          )}
          {demande.transportSurPlace !== null && (
            <p className="text-sm text-gray-600">Transport sur place : {demande.transportSurPlace ? 'Autonome' : 'Non prévu'}</p>
          )}

          {/* Type de pension */}
          {demande.typePension.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Type de pension</p>
              <div className="flex flex-wrap gap-1.5">
                {demande.typePension.map((p) => (
                  <span key={p} className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{TYPE_PENSION_LABELS[p] ?? p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Thématiques pédagogiques */}
          {demande.thematiquesPedagogiques.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Thématiques pédagogiques</p>
              <div className="flex flex-wrap gap-1.5">
                {demande.thematiquesPedagogiques.map((t) => (
                  <span key={t} className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {demande.activitesSouhaitees && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Activités souhaitées</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">{demande.activitesSouhaitees}</p>
            </div>
          )}

          {demande.informationsComplementaires && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Informations complémentaires</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">{demande.informationsComplementaires}</p>
            </div>
          )}

          {demande.projetEducatif && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Projet éducatif</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">{demande.projetEducatif}</p>
            </div>
          )}

          {demande.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{demande.description}</p>
            </div>
          )}

          {demande.dateButoireReponse && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
              <p className="text-xs font-medium text-orange-700">Date limite de réponse : {formatDate(demande.dateButoireReponse, 'numeric')}</p>
            </div>
          )}

          {/* Réponses hébergeurs */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Réponses hébergeurs ({demande.nombreReponses})</p>
            {demande.reponses.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune réponse pour le moment.</p>
            ) : (
              <div className="space-y-1.5">
                {demande.reponses.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{r.centreNom}</p>
                      <p className="text-xs text-gray-400">{r.centreVille} · {formatDate(r.dateReponse, 'numeric')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-gray-600">{DEVIS_STATUT_LABELS[r.statut] ?? r.statut}</p>
                      <p className="font-medium text-gray-900">{r.montantTTC ? formatEuros(r.montantTTC) : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-300 text-center">Demande acquise via {reseauLabel}</p>
        </div>
      </div>
    </>
  );
}

// ─── Sortable Header ──────────────────────────────────────────────────────────

function SortableHeader({
  col, label, current, dir, onSort,
}: {
  col: string; label: string; current: string; dir: 'asc' | 'desc';
  onSort: (col: string) => void;
}) {
  const active = col === current;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-gray-300">
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(stats: ReseauStats) {
  const headers = ['Nom', 'Ville', 'Département', 'Capacité', 'Statut', 'Profil (/4)',
    'Demandes via réseau', 'Dernière activité'];
  const rows = stats.centres.map(c => [
    c.nom, c.ville, c.departement ?? '', c.capacite,
    c.statut === 'ACTIVE' ? 'Actif' : c.statut === 'PENDING' ? 'En attente' : 'Suspendu',
    c.onboardingScore,
    c.demandesReseau, new Date(c.derniereActivite).toLocaleDateString('fr-FR'),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${stats.reseau}_centres_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReseauDashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<ReseauStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<string>('tout');
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('nom');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tab, setTab] = useState<'centres' | 'demandes'>('demandes');
  const [demandes, setDemandes] = useState<DemandeReseau[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [funnelFilter, setFunnelFilter] = useState<'all' | 'avec_reponse' | 'confirmes'>('all');
  const [selectedDemande, setSelectedDemande] = useState<DemandeReseau | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'RESEAU' && user.role !== 'ADMIN'))) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const loadStats = useCallback((p: string) => {
    if (!user || (user.role !== 'RESEAU' && user.role !== 'ADMIN')) return;
    setLoading(true);
    getMyReseauStats(p)
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques du réseau'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadStats(periode);
  }, [loadStats, periode]);

  const loadDemandes = useCallback((p: string) => {
    if (!user || (user.role !== 'RESEAU' && user.role !== 'ADMIN')) return;
    setDemandesLoading(true);
    getReseauDemandes(p)
      .then(setDemandes)
      .catch(() => {})
      .finally(() => setDemandesLoading(false));
  }, [user]);

  useEffect(() => {
    if (tab === 'demandes') loadDemandes(periode);
  }, [tab, periode, loadDemandes]);

  const handlePeriodeChange = (p: string) => {
    setPeriode(p);
    setFunnelFilter('all');
  };

  if (isLoading || !user) return null;

  const displayName = stats?.nomComplet && stats.nomComplet !== stats.reseau ? stats.nomComplet : stats?.reseau;

  const filteredCentres = stats?.centres.filter(c =>
    !search ||
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.ville.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const sortedCentres = [...filteredCentres].sort((a, b) => {
    let va: any, vb: any;
    switch (sortCol) {
      case 'nom': va = a.nom; vb = b.nom; break;
      case 'ville': va = a.ville; vb = b.ville; break;
      case 'capacite': va = a.capacite; vb = b.capacite; break;
      case 'onboarding': va = a.onboardingScore; vb = b.onboardingScore; break;
      case 'reseau': va = a.demandesReseau; vb = b.demandesReseau; break;
      case 'caReseau': va = a.caViaReseau; vb = b.caViaReseau; break;
      case 'activite': va = a.derniereActivite; vb = b.derniereActivite; break;
      default: va = a.nom; vb = b.nom;
    }
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const demandesFiltrees = demandes.filter(d => {
    if (funnelFilter === 'avec_reponse') return d.nombreReponses > 0;
    if (funnelFilter === 'confirmes') return d.reponses.some(r => CONFIRME_STATUTS.includes(r.statut));
    return true;
  });

  return (
    <div>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Tableau de bord {displayName ? `— ${displayName}` : ''}
          </h1>
          <div className="flex items-center gap-2">
            {stats && (
              <button
                onClick={() => exportCSV(stats)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Exporter CSV
              </button>
            )}
            <button
              onClick={() => setShowInvite(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition"
            >
              Inviter un centre
            </button>
          </div>
        </div>

        {/* Subtitle + Période */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <p className="text-sm text-gray-500">
            Suivi de l&apos;activité de vos centres adhérents sur Liavo
            {stats?.periode && stats.periode !== 'tout' && (
              <span className="ml-1 text-[var(--color-primary)] font-medium">
                — {PERIODES.find(p => p.value === stats.periode)?.label}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            {PERIODES.map(p => (
              <button
                key={p.value}
                onClick={() => handlePeriodeChange(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${periode === p.value ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <EmptyState text={error} />
        ) : stats ? (
          <div className="space-y-6">
            {/* KPIs ligne 1 — apport réseau */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-2">Apport du réseau{displayName ? ` ${displayName}` : ''}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Demandes via réseau" value={stats.kpis.demandesReseau} description="Demandes d'enseignants arrivées via votre réseau" accent="text-[var(--color-primary)]" onClick={() => { setTab('demandes'); setFunnelFilter('all'); }} />
                <KpiCard label="Devis convertis via réseau" value={stats.kpis.devisReseau} description="Devis retenus suite à une demande réseau" onClick={() => { setTab('demandes'); setFunnelFilter('confirmes'); }} />
                <KpiCard label="CA via réseau" value={formatEuros(stats.kpis.caReseau)} description="Chiffre d'affaires généré par vos demandes" accent="text-[var(--color-accent)]" onClick={() => { setTab('demandes'); setFunnelFilter('confirmes'); }} />
                <KpiCard label="Taux de conversion réseau" value={stats.kpis.demandesReseau === 0 ? '—' : `${stats.kpis.tauxConversionReseau} %`} description="Demandes réseau transformées en séjour" onClick={() => { setTab('demandes'); setFunnelFilter('all'); }} />
              </div>
            </div>
            {/* KPIs ligne 2 — vue d'ensemble */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Vue d&apos;ensemble</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Centres membres" value={stats.kpis.totalCentres} description="Centres rattachés à votre réseau sur Liavo" />
                <KpiCard label="Centres actifs" value={stats.kpis.centresActifs} description="Centres avec un compte actif" accent="text-[var(--color-success)]" />
                <KpiCard label="Enseignants acquis" value={stats.kpis.enseignantsAcquis} description="Enseignants inscrits via votre réseau" />
                <KpiCard label="Enseignants fidélisés" value={stats.kpis.enseignantsFidelises} description="Enseignants revenus pour un 2e séjour" accent="text-[var(--color-primary)]" />
              </div>
            </div>

            {/* Onglets */}
            <div className="flex items-center gap-1 border-b border-gray-200">
              {(['demandes', 'centres'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  {t === 'centres' ? 'Centres' : 'Demandes'}
                  {t === 'demandes' && demandes.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--color-primary)]/10 px-1.5 text-[10px] font-semibold text-[var(--color-primary)]">{demandes.length}</span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'centres' && (
            <>
            {/* Onboarding réseau */}
            {stats.centres.length > 0 && (() => {
              const total = stats.centres.length;
              const profilsComplets = stats.centres.filter(c => c.onboardingDetails.profilComplet).length;
              const mandatsSigbes = stats.centres.filter(c => c.onboardingDetails.mandatSigne).length;
              const agrementsRenseignes = stats.centres.filter(c => c.onboardingDetails.agrementRenseigne).length;
              const siretsRenseignes = stats.centres.filter(c => c.onboardingDetails.siretRenseigne).length;
              const scoreGlobal = Math.round(
                ((profilsComplets + mandatsSigbes + agrementsRenseignes + siretsRenseignes) / (total * 4)) * 100
              );

              return (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Onboarding réseau</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Progression de vos {total} centres adhérents</p>
                    </div>
                    <span className="text-2xl font-bold text-[var(--color-primary)]">{scoreGlobal} %</span>
                  </div>

                  {/* Barre de progression globale */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
                    <div
                      className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${scoreGlobal}%` }}
                    />
                  </div>

                  {/* 4 métriques détaillées */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Profil complet', count: profilsComplets },
                      { label: 'Mandat signé', count: mandatsSigbes },
                      { label: 'Agrément renseigné', count: agrementsRenseignes },
                      { label: 'SIRET renseigné', count: siretsRenseignes },
                    ].map(({ label, count }) => (
                      <div key={label} className="text-center">
                        <div className="flex items-end justify-center gap-1 mb-1">
                          <span className="text-xl font-bold text-gray-900">{count}</span>
                          <span className="text-sm text-gray-400 mb-0.5">/ {total}</span>
                        </div>
                        <p className="text-xs text-gray-500">{label}</p>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-[var(--color-success)] h-1.5 rounded-full"
                            style={{ width: `${Math.round((count / total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Recherche + Table des centres */}
            <div className="flex items-center gap-3 mb-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un centre par nom ou ville…"
                className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-gray-400 hover:text-gray-700 transition"
                >
                  Effacer
                </button>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {filteredCentres.length} centre{filteredCentres.length > 1 ? 's' : ''}
              </span>
            </div>

            {filteredCentres.length === 0 ? (
              <EmptyState text={search ? `Aucun centre trouvé pour "${search}"` : 'Aucun centre rattaché à ce réseau'} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <SortableHeader col="nom" label="Nom" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <SortableHeader col="ville" label="Ville / Dép." current={sortCol} dir={sortDir} onSort={handleSort} />
                        <SortableHeader col="capacite" label="Capacité" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <SortableHeader col="onboarding" label="Profil" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <SortableHeader col="reseau" label="Via réseau" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <SortableHeader col="caReseau" label="CA réseau" current={sortCol} dir={sortDir} onSort={handleSort} />
                        <SortableHeader col="activite" label="Dernière activité" current={sortCol} dir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedCentres.map((c: ReseauCentre) => (
                        <tr
                          key={c.id}
                          className="hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => setSelectedCentreId(c.id)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                            {c.nom}
                            {c.onboardingScore < 4 && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400" title="Profil incomplet" />}
                            {c.source === 'APIDAE' && (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                                APIDAE
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {c.ville}{c.departement ? ` (${c.departement})` : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{c.capacite}</td>
                          <td className="px-4 py-3"><StatutBadge statut={c.statut} config={CENTRE_STATUT_CONFIG} fallback={CENTRE_STATUT_FALLBACK} compact /></td>
                          <td className="px-4 py-3"><OnboardingDots centre={c} /></td>
                          <td className="px-4 py-3 text-sm font-medium text-[var(--color-primary)]">{c.demandesReseau}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[var(--color-accent)] whitespace-nowrap">{formatEuros(c.caViaReseau)}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(c.derniereActivite, 'numeric')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </>
            )}

            {tab === 'demandes' && (
              demandesLoading ? <LoadingSpinner /> : (
                <div className="space-y-4">
                  <FunnelPipeline demandes={demandes} kpis={stats.kpis} active={funnelFilter} onSelect={setFunnelFilter} />
                  <div className="flex items-center">
                    <span className="text-xs text-gray-400 ml-auto">{demandesFiltrees.length} demande{demandesFiltrees.length > 1 ? 's' : ''}</span>
                  </div>
                  {demandesFiltrees.length === 0 ? (
                    <EmptyState text="Aucune demande pour cette période." />
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enseignant</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effectif</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réponses</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {demandesFiltrees.map(d => (
                              <tr key={d.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setSelectedDemande(d)}>
                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(d.createdAt, 'numeric')}</td>
                                <td className="px-4 py-3 text-sm whitespace-nowrap">
                                  <span className="font-medium text-gray-900">{d.enseignant.prenom} {d.enseignant.nom}</span>
                                  {d.organisation && <span className="block text-xs text-gray-400">{d.organisation.nom}</span>}
                                  <span className="mt-0.5 inline-block"><ContexteBadge typeContexte={d.typeContexte} /></span>
                                </td>
                                <td className="px-4 py-3 text-sm whitespace-nowrap" onClick={ev => ev.stopPropagation()}>
                                  {d.enseignant.telephone
                                    ? <a href={`tel:${d.enseignant.telephone.replace(/\s/g, '')}`} className="text-[var(--color-primary)] font-medium hover:underline">{d.enseignant.telephone}</a>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{d.placesTotales}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{demandePeriode(d)}</td>
                                <td className="px-4 py-3"><StatutBadge statut={d.statut} config={DEMANDE_STATUT_CONFIG} compact /></td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.nombreReponses}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        ) : null}
      </main>

      {/* Modals / Overlays */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={(msg) => setToast({ message: msg, type: 'success' })}
        />
      )}
      {selectedCentreId && (
        <CentreSlideOver centreId={selectedCentreId} reseauLabel={stats?.reseau ?? 'réseau'} onClose={() => setSelectedCentreId(null)} />
      )}
      {selectedDemande && (
        <DemandeSlideOver demande={selectedDemande} reseauLabel={stats?.reseau ?? 'réseau'} onClose={() => setSelectedDemande(null)} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
