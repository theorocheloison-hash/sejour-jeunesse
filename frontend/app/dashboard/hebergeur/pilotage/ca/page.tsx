'use client';

import { useEffect, useState } from 'react';
import { getRemplissage, getCA } from '@/src/lib/pilotage';
import type { RemplissageData, CAData } from '@/src/lib/pilotage';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';

/** Couleur du taux de remplissage par seuil. */
function tauxColor(taux: number): string {
  if (taux >= 70) return '#16A34A';
  if (taux >= 40) return '#F59E0B';
  return '#DC2626';
}

// ─── Composant Tooltip info ──────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex ml-1.5 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        className="flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        style={{ width: 16, height: 16, fontSize: 10, fontWeight: 700, border: '1.5px solid currentColor' }}
      >
        ?
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg z-50 text-center leading-relaxed">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-800" />
        </span>
      )}
    </span>
  );
}

// ─── Composant KPI Card ──────────────────────────────────────────────────────

function KpiCard({
  label, value, tooltip, sub, color,
}: {
  label: string; value: string; tooltip: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <InfoTip text={tooltip} />
      </div>
      <p className="text-2xl font-bold" style={{ color: color ?? '#1a1a1a' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Composant Badge N-1 ──────────────────────────────────────────────────────

function BadgeN1({ label, evolution }: { label: string; evolution: string }) {
  const isPositive = evolution.startsWith('+');
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-1">
      <span>{label}</span>
      <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
        {isPositive ? '↑' : '↓'} {evolution}
      </span>
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PilotageCAPage() {
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [ca, setCA] = useState<CAData | null>(null);
  const [remplissage, setRemplissage] = useState<RemplissageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getCA(annee), getRemplissage(annee)])
      .then(([caData, rempData]) => {
        setCA(caData);
        setRemplissage(rempData);
      })
      .catch((err) => {
        // PlanGuard 403 → pas d'erreur affichée, le PlanInsufficientModal gère
        if (err?.response?.status !== 403) {
          setError('Impossible de charger les données');
        }
      })
      .finally(() => setLoading(false));
  }, [annee]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-sm text-red-500 py-12">{error}</p>;
  }

  if (!ca || !remplissage) return null;

  // Données graphique CA mensuel
  const caChartData = ca.parMois.map(m => ({
    name: MOIS_LABELS[m.mois - 1],
    confirme: Math.round(m.confirme),
    encaisse: Math.round(m.encaisse),
  }));

  // Données graphique remplissage mensuel
  const rempChartData = remplissage.parMois.map(m => ({
    name: MOIS_LABELS[m.mois - 1],
    taux: m.taux,
    sejours: m.nbSejours,
  }));

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-8">

      {/* ── Sélecteur d'année ── */}
      <div className="flex items-center gap-2">
        {[currentYear - 1, currentYear, currentYear + 1].map(y => (
          <button
            key={y}
            onClick={() => setAnnee(y)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              annee === y
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           SECTION CA
         ══════════════════════════════════════════════════════════════ */}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Chiffre d'affaires {annee}</h2>

        {/* KPIs — split réalisé vs pipeline */}
        {(() => {
          const now = new Date();
          const moisActuel = now.getFullYear() === annee ? now.getMonth() + 1 : (annee < now.getFullYear() ? 12 : 0);
          const caRealise = ca.parMois.filter(m => m.mois <= moisActuel).reduce((s, m) => s + m.confirme, 0);
          const caPipeline = ca.confirme - caRealise;
          const encaissePasse = ca.parMois.filter(m => m.mois <= moisActuel).reduce((s, m) => s + m.encaisse, 0);
          const resteDu = Math.max(0, caRealise - encaissePasse);

          return (
            <>
              <div className="flex gap-3 mb-1">
                <KpiCard
                  label="CA réalisé"
                  value={fmtEur(caRealise)}
                  tooltip="Montant TTC des devis signés dont le séjour est terminé ou en cours (mois actuel et passés)."
                />
                <KpiCard
                  label="Prévisionnel"
                  value={fmtEur(caPipeline)}
                  tooltip="Montant TTC des devis signés dont le séjour n'a pas encore eu lieu. Correspond aux mois futurs de l'année sélectionnée."
                  color="#F59E0B"
                  sub={`${ca.parMois.filter(m => m.mois > moisActuel && m.confirme > 0).length} mois à venir`}
                />
                <KpiCard
                  label="Encaissé"
                  value={fmtEur(ca.encaisse)}
                  tooltip="Somme de tous les versements reçus (acomptes + soldes) sur cette année, quelle que soit la date du séjour."
                  color="#16A34A"
                />
                <KpiCard
                  label="Reste dû"
                  value={fmtEur(resteDu)}
                  tooltip="CA réalisé moins encaissé sur les mois écoulés. Ne compte que les séjours passés — le pipeline n'est pas un impayé."
                  color={resteDu > 0 ? '#DC2626' : '#16A34A'}
                />
              </div>

              {/* Badge N-1 CA */}
              {ca.comparaisonN1 && (
                <BadgeN1
                  label={`vs ${fmtEur(ca.comparaisonN1.confirme)} en ${annee - 1}`}
                  evolution={`${ca.comparaisonN1.evolution}%`}
                />
              )}
            </>
          );
        })()}

        {/* Graphique CA mensuel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <p className="text-xs text-gray-400 mb-3">CA mensuel — confirmé vs encaissé</p>
          {(() => {
            const now = new Date();
            const moisActuel = now.getFullYear() === annee ? now.getMonth() + 1 : (annee < now.getFullYear() ? 12 : 0);
            return (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={caChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                  <RechartsTooltip
                    formatter={(value, name) => [fmtEur(Number(value)), name === 'confirme' ? 'Confirmé' : 'Encaissé']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="confirme" name="Confirmé" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    {caChartData.map((_, index) => (
                      <Cell key={index} fill={index + 1 > moisActuel ? '#F59E0B' : '#2563EB'} />
                    ))}
                  </Bar>
                  <Bar dataKey="encaisse" name="Encaissé" fill="#16A34A" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-2 rounded-sm bg-[#2563EB]" /> Réalisé</span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-2 rounded-sm bg-[#F59E0B]" /> Prévisionnel</span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-2 rounded-sm bg-[#16A34A]" /> Encaissé</span>
          </div>
        </div>

        {/* Ventilation */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-2">Par type</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Séjours</span>
                <span className="font-medium">{fmtEur(ca.parType.sejours)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Événements</span>
                <span className="font-medium">{fmtEur(ca.parType.evenements)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-2">Par source</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Direct</span>
                <span className="font-medium">{fmtEur(ca.parSource.direct)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Réseau</span>
                <span className="font-medium">{fmtEur(ca.parSource.reseau)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-1 mb-2">
              <p className="text-xs text-gray-400">Par produit</p>
              <InfoTip text="Ventilation du CA confirmé par produit du catalogue. Les lignes non rattachées à un produit sont regroupées dans Autre." />
            </div>
            {ca.parProduit.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune donnée produit disponible</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {ca.parProduit.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate mr-2">{p.nom}</span>
                    <span className="font-medium shrink-0">{fmtEur(p.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
           SECTION REMPLISSAGE
         ══════════════════════════════════════════════════════════════ */}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Taux de remplissage {annee}</h2>

        {/* KPI */}
        <div className="flex gap-3 mb-1">
          <KpiCard
            label="Taux annuel"
            value={`${remplissage.tauxAnnuel}%`}
            tooltip="Nuitées occupées par des séjours confirmés / nuitées disponibles (capacité × jours). Les accompagnateurs sont comptés comme occupants."
            color={tauxColor(remplissage.tauxAnnuel)}
          />
          <KpiCard
            label="Nuitées occupées"
            value={fmt(remplissage.nuiteesOccupees)}
            tooltip="Nombre total de nuits × personnes pour les séjours confirmés de l'année. Un séjour de 5 nuits avec 45 personnes = 225 nuitées."
          />
          <KpiCard
            label="Capacité"
            value={`${remplissage.capacite} lits`}
            tooltip="Capacité d'accueil déclarée de votre centre. Modifiable dans Profil."
            sub={`${fmt(remplissage.nuiteesDisponibles)} nuitées dispo / an`}
          />
        </div>

        {/* Badge N-1 remplissage */}
        {remplissage.comparaisonN1 && (
          <BadgeN1
            label={`vs ${remplissage.comparaisonN1.tauxAnnuel}% en ${annee - 1}`}
            evolution={`${remplissage.comparaisonN1.evolution} pts`}
          />
        )}

        {/* Graphique remplissage mensuel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <p className="text-xs text-gray-400 mb-3">Taux de remplissage mensuel</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rempChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <RechartsTooltip
                formatter={(value) => [`${Number(value)}%`, 'Taux']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="taux" name="Taux" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {rempChartData.map((entry, index) => (
                  <Cell key={index} fill={tauxColor(entry.taux)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;40%</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 40-70%</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-full bg-green-500" /> &gt;70%</span>
          </div>
        </div>
      </section>
    </div>
  );
}
