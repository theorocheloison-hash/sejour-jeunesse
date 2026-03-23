'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';

export default function InviterEnseignantPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    emailEnseignant: '',
    titreSejourSuggere: '',
    dateDebut: '',
    dateFin: '',
    nbElevesEstime: '',
    nombreAccompagnateurs: '',
    niveauClasse: '',
    heureArrivee: '',
    heureDepart: '',
    transportAller: '',
    activitesSouhaitees: '',
    budgetMaxParEleve: '',
    message: '',
  });
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPending(true);
    try {
      await api.post('/invitation-collaboration', {
        emailEnseignant: form.emailEnseignant,
        titreSejourSuggere: form.titreSejourSuggere,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin,
        nbElevesEstime: parseInt(form.nbElevesEstime, 10),
        nombreAccompagnateurs: form.nombreAccompagnateurs ? parseInt(form.nombreAccompagnateurs, 10) : undefined,
        niveauClasse: form.niveauClasse || undefined,
        heureArrivee: form.heureArrivee || undefined,
        heureDepart: form.heureDepart || undefined,
        transportAller: form.transportAller || undefined,
        activitesSouhaitees: form.activitesSouhaitees || undefined,
        budgetMaxParEleve: form.budgetMaxParEleve ? parseFloat(form.budgetMaxParEleve) : undefined,
        message: form.message || undefined,
      });
      setSuccess(form.emailEnseignant);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setIsPending(false);
    }
  };

  const resetForm = () => {
    setForm({ emailEnseignant: '', titreSejourSuggere: '', dateDebut: '', dateFin: '', nbElevesEstime: '', nombreAccompagnateurs: '', niveauClasse: '', heureArrivee: '', heureDepart: '', transportAller: '', activitesSouhaitees: '', budgetMaxParEleve: '', message: '' });
    setSuccess(null);
    setError(null);
  };

  if (!user) return null;

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-transparent";

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <Link href="/dashboard/venue" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          Retour au tableau de bord
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-primary)', marginBottom: 8 }}>
          Inviter un enseignant à collaborer
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 32 }}>
          L&apos;enseignant recevra un email avec les détails du séjour et pourra accepter l&apos;invitation en un clic.
        </p>

        {success ? (
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 32, textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              backgroundColor: 'var(--color-success-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-success)', marginBottom: 8 }}>
              Invitation envoyée
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
              L&apos;enseignant à l&apos;adresse <strong style={{ color: 'var(--color-text)' }}>{success}</strong> recevra un email dans quelques minutes.
            </p>
            <button onClick={resetForm} style={{
              fontSize: 14, fontWeight: 500, padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
            }}>
              Envoyer une autre invitation
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            backgroundColor: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
          }}>
            {error && (
              <div style={{
                marginBottom: 20, padding: '12px 16px',
                backgroundColor: 'var(--color-danger-light)',
                border: '0.5px solid var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13, color: 'var(--color-danger)',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email de l&apos;enseignant *</label>
                <input type="email" required value={form.emailEnseignant} onChange={set('emailEnseignant')} placeholder="enseignant@ecole.fr" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre du séjour *</label>
                <input type="text" required value={form.titreSejourSuggere} onChange={set('titreSejourSuggere')} placeholder="Séjour ski CM2 — Mars 2026" className={inputCls} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début *</label>
                  <input type="date" required value={form.dateDebut} onChange={set('dateDebut')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de fin *</label>
                  <input type="date" required value={form.dateFin} onChange={set('dateFin')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre d&apos;élèves estimé *</label>
                <input type="number" required min={1} value={form.nbElevesEstime} onChange={set('nbElevesEstime')} placeholder="30" className={inputCls} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre d&apos;accompagnateurs</label>
                  <input type="number" min={0} value={form.nombreAccompagnateurs} onChange={set('nombreAccompagnateurs')} placeholder="3" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Niveau de classe</label>
                  <input type="text" value={form.niveauClasse} onChange={set('niveauClasse')} placeholder="6ème, CM2..." className={inputCls} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Heure d&apos;arrivée</label>
                  <input type="time" value={form.heureArrivee} onChange={set('heureArrivee')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Heure de départ</label>
                  <input type="time" value={form.heureDepart} onChange={set('heureDepart')} className={inputCls} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Transport aller</label>
                  <select value={form.transportAller} onChange={(e) => setForm(f => ({ ...f, transportAller: e.target.value }))} className={inputCls}>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message personnalisé <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel)</span></label>
                <textarea value={form.message} onChange={set('message')} rows={3} placeholder="Bonjour, nous serions ravis de..." className={`${inputCls} resize-none`} />
              </div>
            </div>

            <button type="submit" disabled={isPending} style={{
              marginTop: 24, width: '100%',
              fontSize: 14, fontWeight: 500, padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF', border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}>
              {isPending ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
