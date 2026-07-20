'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/app/components/Logo';
import { getJournalPublic, type JournalPublicData } from '@/src/lib/journal-public';
import type { PhotoJournal, PostJournal } from '@/src/lib/collaboration';
import { formatDateRelative } from '@/src/lib/utils';

type Tab = 'journal' | 'planning';

type Reactions = {
  heart: { active: boolean; count: number };
  thumb: { active: boolean; count: number };
  star: { active: boolean; count: number };
};

const initialReactions = (): Reactions => ({
  heart: { active: false, count: 0 },
  thumb: { active: false, count: 0 },
  star: { active: false, count: 0 },
});

function formatDateRange(debut: string, fin: string): string {
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const sameYear = d1.getFullYear() === d2.getFullYear();
  const sameMonth = sameYear && d1.getMonth() === d2.getMonth();
  if (sameMonth) {
    return `du ${d1.getDate()} au ${d2.getDate()} ${d2.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  }
  if (sameYear) {
    return `du ${d1.getDate()} ${d1.toLocaleDateString('fr-FR', { month: 'short' })} au ${d2.getDate()} ${d2.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  }
  return `du ${d1.toLocaleDateString('fr-FR')} au ${d2.toLocaleDateString('fr-FR')}`;
}

function lighten(hex: string | null | undefined, percent: number): string {
  if (!hex || !hex.startsWith('#')) return '#e5e7eb';
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * percent);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

type PlanningAct = {
  id: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  titre: string;
  couleur: string | null;
  estCollective: boolean;
  // §4.18 : groupes structurés (refonte m2m) — absent sur les vieux payloads.
  groupes?: { id: string; nom: string; couleur: string | null }[];
};

type GroupedActivite = {
  nomBase: string;
  estCollective: boolean;
  couleur: string | null;
  groupes: { label: string; couleur: string | null }[];
};

type CreneauGroupe = {
  heureDebut: string;
  heureFin: string;
  activites: GroupedActivite[];
};

function regrouperParCreneau(activites: PlanningAct[]): CreneauGroupe[] {
  const slotsMap = new Map<string, PlanningAct[]>();
  for (const a of activites) {
    const key = `${a.heureDebut}-${a.heureFin}`;
    const arr = slotsMap.get(key) ?? [];
    arr.push(a);
    slotsMap.set(key, arr);
  }

  return Array.from(slotsMap.entries())
    .sort(([k1], [k2]) => k1.localeCompare(k2))
    .map(([, items]) => {
      const heureDebut = items[0].heureDebut;
      const heureFin = items[0].heureFin;

      const byName = new Map<string, PlanningAct[]>();
      for (const a of items) {
        const nomBase = a.titre.replace(/ — G\d+$/, '').trim();
        const k = `${a.estCollective ? 'col' : 'grp'}:${nomBase}`;
        const arr = byName.get(k) ?? [];
        arr.push(a);
        byName.set(k, arr);
      }

      const activitesGroupees: GroupedActivite[] = Array.from(byName.values()).map((rows) => {
        const nomBase = rows[0].titre.replace(/ — G\d+$/, '').trim();
        // §4.18 — schéma m2m : les groupes sont structurés sur l'activité (1 activité
        // par cluster). Dédup par id (plusieurs rows legacy pourraient se chevaucher).
        const structures = new Map<string, { label: string; couleur: string | null }>();
        for (const r of rows) {
          for (const g of r.groupes ?? []) {
            structures.set(g.id, { label: g.nom, couleur: g.couleur ?? r.couleur });
          }
        }
        // Fallback legacy (plannings d'avant la refonte : activités dupliquées,
        // suffixe « — G1 » dans le titre) — uniquement si aucun groupe structuré.
        const groupes = structures.size > 0
          ? Array.from(structures.values())
          : rows
              .map((r) => {
                const m = r.titre.match(/ — (G\d+)$/);
                return m ? { label: m[1], couleur: r.couleur } : null;
              })
              .filter((x): x is { label: string; couleur: string | null } => x !== null);
        groupes.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
        return {
          nomBase,
          estCollective: rows[0].estCollective,
          couleur: rows[0].couleur,
          groupes,
        };
      });

      activitesGroupees.sort((a, b) => Number(b.estCollective) - Number(a.estCollective));
      return { heureDebut, heureFin, activites: activitesGroupees };
    });
}

function PhotoGrid({ photos }: { photos: PhotoJournal[] }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <img
        src={photos[0].url}
        alt=""
        onClick={() => window.open(photos[0].url, '_blank')}
        className="mt-3 rounded-xl max-h-96 object-cover w-full cursor-pointer"
      />
    );
  }
  if (photos.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <img
            key={p.id}
            src={p.url}
            alt=""
            onClick={() => window.open(p.url, '_blank')}
            className="rounded-xl object-cover w-full aspect-square cursor-pointer"
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <img
          key={p.id}
          src={p.url}
          alt=""
          onClick={() => window.open(p.url, '_blank')}
          className={`rounded-xl object-cover w-full aspect-square cursor-pointer ${i === 0 ? 'col-span-2 row-span-2 aspect-auto h-full' : ''}`}
        />
      ))}
    </div>
  );
}

function ReactionBar({
  reactions,
  toggle,
}: {
  reactions: Reactions;
  toggle: (k: keyof Reactions) => void;
}) {
  const buttons: { key: keyof Reactions; emoji: string; label: string }[] = [
    { key: 'heart', emoji: '❤️', label: 'Coeur' },
    { key: 'thumb', emoji: '👍', label: 'Pouce' },
    { key: 'star', emoji: '⭐', label: 'Étoile' },
  ];
  return (
    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
      {buttons.map((b) => {
        const r = reactions[b.key];
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => toggle(b.key)}
            aria-label={b.label}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              r.active
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>{b.emoji}</span>
            <span>{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function PostCard({ post }: { post: PostJournal }) {
  const [reactions, setReactions] = useState<Reactions>(initialReactions);
  const initiales = `${post.auteur.prenom[0] ?? ''}${post.auteur.nom[0] ?? ''}`.toUpperCase();
  const isHebergeur = post.auteur.role === 'HEBERGEUR';
  const roleLabel = isHebergeur ? 'Hébergeur' : 'Enseignant';
  const avatarBg = isHebergeur ? 'var(--color-success)' : 'var(--color-primary)';

  const toggle = (k: keyof Reactions) => {
    setReactions((prev) => {
      const cur = prev[k];
      return {
        ...prev,
        [k]: { active: !cur.active, count: cur.count + (cur.active ? -1 : 1) },
      };
    });
  };

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
      <header className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ backgroundColor: avatarBg }}
        >
          {initiales}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {post.auteur.prenom} {post.auteur.nom}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${
                isHebergeur
                  ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                  : 'bg-blue-50 text-[var(--color-primary)]'
              }`}
            >
              {roleLabel}
            </span>
          </div>
          <p className="text-xs text-gray-400">{formatDateRelative(post.createdAt)}</p>
        </div>
      </header>

      <p className="text-sm text-gray-900 whitespace-pre-wrap mt-3">{post.contenu}</p>
      <PhotoGrid photos={post.photos} />
      <ReactionBar reactions={reactions} toggle={toggle} />
    </article>
  );
}

export default function JournalPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<JournalPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('journal');

  useEffect(() => {
    if (!token) return;
    getJournalPublic(token)
      .then(setData)
      .catch(() => setError("Ce lien n'est pas valide ou a expiré"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F1]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F1] px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center max-w-sm">
          <p className="text-sm text-gray-700">{error ?? "Ce lien n'est pas valide ou a expiré"}</p>
        </div>
      </div>
    );
  }

  const { sejour, elevePrenom, eleveNom } = data;
  const hebergement = sejour.hebergements[0] ?? null;

  const now = new Date();
  const dDebut = new Date(sejour.dateDebut);
  const dFin = new Date(sejour.dateFin);
  let statutLabel = 'À venir';
  let statutClass = 'bg-blue-100 text-blue-700';
  if (now > dFin) {
    statutLabel = 'Terminé';
    statutClass = 'bg-gray-100 text-gray-600';
  } else if (now >= dDebut) {
    statutLabel = 'En cours';
    statutClass = 'bg-[var(--color-success-light)] text-[var(--color-success)]';
  }

  const joursPlanning: { date: string; activites: typeof sejour.planningActivites }[] = (() => {
    const days: { date: string; activites: typeof sejour.planningActivites }[] = [];
    const cursor = new Date(dDebut.getFullYear(), dDebut.getMonth(), dDebut.getDate());
    const end = new Date(dFin.getFullYear(), dFin.getMonth(), dFin.getDate());
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const activites = sejour.planningActivites
        .filter((a) => a.date.startsWith(dateStr))
        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
      days.push({ date: dateStr, activites });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  })();

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      {/* Header sticky */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Logo size="sm" showTagline={false} />
          <p className="flex-1 text-sm font-semibold text-gray-900 truncate text-center">
            {sejour.titre}
          </p>
          <span className={`shrink-0 text-[10px] uppercase tracking-wide font-medium px-2 py-1 rounded-full ${statutClass}`}>
            {statutLabel}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Bannière séjour */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
          {hebergement && (
            <p className="text-base font-bold text-gray-900">{hebergement.nom}</p>
          )}
          <p className="text-sm text-gray-600 mt-0.5">
            {sejour.lieu} — {formatDateRange(sejour.dateDebut, sejour.dateFin)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{sejour.placesTotales} élèves</p>
          {hebergement?.telephone && (
            <a
              href={`tel:${hebergement.telephone}`}
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {hebergement.telephone}
            </a>
          )}
          <p className="text-xs text-gray-500 mt-3 italic">
            Journal du séjour de {elevePrenom} {eleveNom}
          </p>
        </section>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 rounded-t-2xl px-4">
          <div className="flex gap-6">
            {(['journal', 'planning'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'journal' ? 'Journal' : 'Planning'}
              </button>
            ))}
          </div>
        </div>

        <section className="pt-4">
          {tab === 'journal' && (
            <>
              {sejour.postsJournal.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
                  <svg className="h-10 w-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <p className="text-sm text-gray-500 px-6">
                    Aucune publication pour l&apos;instant. L&apos;enseignant ou l&apos;hébergeur publiera bientôt des nouvelles du séjour !
                  </p>
                </div>
              ) : (
                <div>
                  {sejour.postsJournal.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'planning' && (
            <div className="space-y-5">
              {joursPlanning.map(({ date, activites }) => {
                const d = new Date(date + 'T12:00:00');
                const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                const creneaux = regrouperParCreneau(activites);
                return (
                  <div key={date}>
                    <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2 capitalize">
                      {label}
                    </h3>
                    {creneaux.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Pas d&apos;activité prévue</p>
                    ) : (
                      <div className="space-y-2">
                        {creneaux.map((c) => (
                          <div
                            key={`${c.heureDebut}-${c.heureFin}`}
                            className="bg-white rounded-xl border border-gray-200 px-4 py-3"
                          >
                            <p className="text-sm font-bold text-gray-900 mb-2">
                              {c.heureDebut} – {c.heureFin}
                            </p>
                            <div className="space-y-2">
                              {c.activites.map((act, i) => (
                                <div
                                  key={i}
                                  className="pl-3 py-1"
                                  style={{ borderLeft: `3px solid ${act.couleur ?? 'var(--color-primary)'}` }}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900">{act.nomBase}</span>
                                    {act.estCollective ? (
                                      <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-blue-50 text-[var(--color-primary)]">
                                        Tous les groupes
                                      </span>
                                    ) : (
                                      act.groupes.map((g, j) => (
                                        <span
                                          key={j}
                                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                                          style={{
                                            backgroundColor: lighten(g.couleur, 0.85),
                                            color: g.couleur ?? 'var(--color-primary)',
                                          }}
                                        >
                                          {g.label}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-gray-400 text-center py-6">
          Journal de séjour — liavo.fr
        </p>
      </main>
    </div>
  );
}
