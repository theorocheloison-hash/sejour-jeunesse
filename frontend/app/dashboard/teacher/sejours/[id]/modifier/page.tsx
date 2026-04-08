'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMesSejours, updateSejour } from '@/src/lib/sejour';
import type { Sejour } from '@/src/lib/sejour';
import { extractApiError } from '@/src/contexts/AuthContext';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export default function ModifierSejourPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sejour, setSejour] = useState<Sejour | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    niveauClasse: '',
    nombreAccompagnateurs: '',
    heureArrivee: '',
    heureDepart: '',
    transportAller: '',
    activitesSouhaitees: '',
    budgetMaxParEleve: '',
    informationsComplementaires: '',
  });

  useEffect(() => {
    getMesSejours().then(sejours => {
      const found = sejours.find(s => s.id === id);
      if (found) {
        setSejour(found);
        setForm({
          niveauClasse: found.niveauClasse ?? '',
          nombreAccompagnateurs: found.nombreAccompagnateurs?.toString() ?? '',
          heureArrivee: found.heureArrivee ?? '',
          heureDepart: found.heureDepart ?? '',
          transportAller: found.transportAller ?? '',
          activitesSouhaitees: found.activitesSouhaitees ?? '',
          budgetMaxParEleve: found.budgetMaxParEleve?.toString() ?? '',
          informationsComplementaires: found.description ?? '',
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await updateSejour(id, {
        niveauClasse: form.niveauClasse || undefined,
        activitesSouhaitees: form.activitesSouhaitees || undefined,
        budgetMaxParEleve: form.budgetMaxParEleve ? parseFloat(form.budgetMaxParEleve) : undefined,
        nombreAccompagnateurs: form.nombreAccompagnateurs ? parseInt(form.nombreAccompagnateurs, 10) : undefined,
        heureArrivee: form.heureArrivee || undefined,
        heureDepart: form.heureDepart || undefined,
        transportAller: form.transportAller || undefined,
        informationsComplementaires: form.informationsComplementaires || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push('/dashboard/teacher'), 1500);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setIsPending(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
    </div>
  );

  if (!sejour) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Séjour introuvable.</p>
    </div>
  );

  if (sejour.statut !== 'DRAFT') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-gray-700 font-medium mb-2">Ce séjour ne peut plus être modifié.</p>
        <p className="text-sm text-gray-500 mb-4">Seuls les séjours en brouillon sont modifiables.</p>
        <Link href="/dashboard/teacher" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <span className="font-semibold text-gray-900 text-sm">Modifier le séjour</span>
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              ← Retour
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Infos fixes */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs font-semibold text-blue-700 mb-1">Informations fixes — non modifiables</p>
          <p className="text-sm text-blue-800 font-medium">{sejour.titre}</p>
          <p className="text-xs text-blue-600 mt-0.5">
            {fmt(sejour.dateDebut)} → {fmt(sejour.dateFin)} · {sejour.placesTotales} élèves
          </p>
        </div>

        {success && (
          <div className="mb-4 rounded-xl bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-4 py-3 text-sm font-medium text-[var(--color-success)]">
            Modifications enregistrées. Redirection...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Niveau de classe</label>
              <input type="text" value={form.niveauClasse} onChange={set('niveauClasse')} placeholder="6ème, CM2..." className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre d&apos;accompagnateurs</label>
              <input type="number" min={0} value={form.nombreAccompagnateurs} onChange={set('nombreAccompagnateurs')} placeholder="3" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Heure d&apos;arrivée</label>
              <input type="time" value={form.heureArrivee} onChange={set('heureArrivee')} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Heure de départ</label>
              <input type="time" value={form.heureDepart} onChange={set('heureDepart')} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Transport aller</label>
              <select value={form.transportAller} onChange={set('transportAller')} className={inputCls}>
                <option value="">Non précisé</option>
                <option value="CARS">Cars</option>
                <option value="TRAIN">Train</option>
                <option value="AVION">Avion</option>
                <option value="BESOIN_TRANSPORTEUR">Besoin transporteur</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget max / élève (€)</label>
              <input type="number" min={0} step={10} value={form.budgetMaxParEleve} onChange={set('budgetMaxParEleve')} placeholder="350" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Activités souhaitées</label>
            <input type="text" value={form.activitesSouhaitees} onChange={set('activitesSouhaitees')} placeholder="Ski, randonnée, escalade..." className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Informations complémentaires</label>
            <textarea value={form.informationsComplementaires} onChange={set('informationsComplementaires')} rows={3} placeholder="Précisions sur le projet pédagogique..." className={`${inputCls} resize-none`} />
          </div>

          <button
            type="submit"
            disabled={isPending || success}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>

        </form>
      </main>
    </div>
  );
}
