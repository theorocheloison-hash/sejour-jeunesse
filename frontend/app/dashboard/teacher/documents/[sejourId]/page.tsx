'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { jsPDF } from 'jspdf';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DossierData {
  id: string;
  titre: string;
  description: string | null;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  niveauClasse: string | null;
  thematiquesPedagogiques: string[];
  statut: string;
  createur: { prenom: string; nom: string; email: string; telephone: string | null } | null;
  hebergementSelectionne: { nom: string; ville: string; adresse: string; telephone: string | null } | null;
  autorisations: { eleveNom: string; elevePrenom: string; parentEmail: string; signeeAt: string | null }[];
  _count: { inscriptions: number; autorisations: number };
}

interface CheckItem {
  id: string;
  label: string;
  checked: boolean;
}

const INITIAL_CHECKLIST: CheckItem[] = [
  { id: 'autorisation_rectorat', label: 'Autorisation du rectorat', checked: false },
  { id: 'assurance_rc', label: 'Attestation d\'assurance RC', checked: false },
  { id: 'transport', label: 'Convention de transport', checked: false },
  { id: 'hebergement', label: 'Convention d\'hébergement', checked: false },
  { id: 'projet_pedagogique', label: 'Projet pédagogique validé', checked: false },
  { id: 'autorisations_parentales', label: 'Autorisations parentales complètes', checked: false },
  { id: 'fiches_sanitaires', label: 'Fiches sanitaires des élèves', checked: false },
  { id: 'liste_accompagnateurs', label: 'Liste des accompagnateurs', checked: false },
  { id: 'budget_previsionnel', label: 'Budget prévisionnel', checked: false },
  { id: 'programme_detaille', label: 'Programme détaillé jour par jour', checked: false },
];

// ─── PDF Generators ─────────────────────────────────────────────────────────

function generateDossierPedagogique(data: DossierData) {
  const doc = new jsPDF();
  const m = 20; // margin
  let y = m;

  // Header
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('MINISTÈRE DE L\'ÉDUCATION NATIONALE', m, y);
  y += 5;
  doc.text('Liavo — Dossier pédagogique', m, y);
  y += 15;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(30);
  doc.text('DOSSIER PÉDAGOGIQUE', m, y);
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(70);
  doc.text(data.titre, m, y);
  y += 15;

  // Info block
  doc.setFontSize(10);
  doc.setTextColor(30);
  const dateDebut = new Date(data.dateDebut).toLocaleDateString('fr-FR');
  const dateFin = new Date(data.dateFin).toLocaleDateString('fr-FR');

  const infos = [
    ['Destination', data.lieu],
    ['Dates', `Du ${dateDebut} au ${dateFin}`],
    ['Effectif élèves', `${data.placesTotales} élève${data.placesTotales > 1 ? 's' : ''}`],
    ['Niveau', data.niveauClasse ?? 'Non précisé'],
    ['Enseignant responsable', data.createur ? `${data.createur.prenom} ${data.createur.nom}` : '—'],
    ['Email enseignant', data.createur?.email ?? '—'],
    ['Téléphone', data.createur?.telephone ?? '—'],
  ];

  for (const [label, value] of infos) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, m, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, m + 55, y);
    y += 7;
  }
  y += 5;

  // Thématiques
  if (data.thematiquesPedagogiques.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Thématiques pédagogiques', m, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const t of data.thematiquesPedagogiques) {
      doc.text(`• ${t}`, m + 5, y);
      y += 6;
    }
    y += 5;
  }

  // Description
  if (data.description) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Description du projet', m, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.description, 170);
    doc.text(lines, m, y);
    y += lines.length * 5 + 5;
  }

  // Hébergement
  if (data.hebergementSelectionne) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Centre d\'hébergement', m, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.hebergementSelectionne.nom} — ${data.hebergementSelectionne.ville}`, m, y);
    y += 6;
    if (data.hebergementSelectionne.adresse) {
      doc.text(data.hebergementSelectionne.adresse, m, y);
      y += 6;
    }
    if (data.hebergementSelectionne.telephone) {
      doc.text(`Tél. : ${data.hebergementSelectionne.telephone}`, m, y);
      y += 6;
    }
    y += 5;
  }

  // Autorisations summary
  const signees = data.autorisations.filter((a) => a.signeeAt).length;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Autorisations parentales', m, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${signees} / ${data.autorisations.length} autorisations signées`, m, y);
  y += 10;

  // Liste élèves
  if (data.autorisations.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Liste des élèves', m, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const a of data.autorisations) {
      if (y > 270) { doc.addPage(); y = m; }
      const status = a.signeeAt ? '✓' : '○';
      doc.text(`${status}  ${a.elevePrenom} ${a.eleveNom}`, m + 5, y);
      y += 5;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Liavo`, m, 287);

  doc.save(`dossier-pedagogique-${data.titre.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

function generateOrdreMission(data: DossierData) {
  const doc = new jsPDF();
  const m = 20;
  let y = m;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('MINISTÈRE DE L\'ÉDUCATION NATIONALE', m, y);
  y += 15;

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text('ORDRE DE MISSION', m, y);
  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(70);
  doc.text('Séjour scolaire avec nuitée(s)', m, y);
  y += 15;

  doc.setFontSize(10);
  doc.setTextColor(30);

  const dateDebut = new Date(data.dateDebut).toLocaleDateString('fr-FR');
  const dateFin = new Date(data.dateFin).toLocaleDateString('fr-FR');

  // Missionnaire
  doc.setFont('helvetica', 'bold');
  doc.text('1. AGENT MISSIONNÉ', m, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  if (data.createur) {
    doc.text(`Nom : ${data.createur.nom}`, m + 5, y); y += 6;
    doc.text(`Prénom : ${data.createur.prenom}`, m + 5, y); y += 6;
    doc.text(`Email : ${data.createur.email}`, m + 5, y); y += 6;
    if (data.createur.telephone) { doc.text(`Téléphone : ${data.createur.telephone}`, m + 5, y); y += 6; }
  }
  doc.text('Fonction : Enseignant responsable du séjour', m + 5, y);
  y += 12;

  // Objet
  doc.setFont('helvetica', 'bold');
  doc.text('2. OBJET DE LA MISSION', m, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`Séjour pédagogique : ${data.titre}`, m + 5, y); y += 6;
  doc.text(`Destination : ${data.lieu}`, m + 5, y); y += 6;
  doc.text(`Du ${dateDebut} au ${dateFin}`, m + 5, y); y += 6;
  doc.text(`Effectif : ${data.placesTotales} élève${data.placesTotales > 1 ? 's' : ''}`, m + 5, y);
  y += 12;

  // Hébergement
  if (data.hebergementSelectionne) {
    doc.setFont('helvetica', 'bold');
    doc.text('3. LIEU D\'HÉBERGEMENT', m, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Centre : ${data.hebergementSelectionne.nom}`, m + 5, y); y += 6;
    doc.text(`Adresse : ${data.hebergementSelectionne.adresse ?? ''}, ${data.hebergementSelectionne.ville}`, m + 5, y);
    y += 12;
  }

  // Signatures
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('Signature de l\'enseignant', m, y);
  doc.text('Signature du chef d\'établissement', 110, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Date :', m, y);
  doc.text('Date :', 110, y);

  // Boxes for signatures
  doc.setDrawColor(180);
  doc.rect(m, y + 3, 70, 25);
  doc.rect(110, y + 3, 70, 25);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Liavo`, m, 287);

  doc.save(`ordre-mission-${data.titre.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DocumentsOfficielsPage() {
  const { sejourId } = useParams<{ sejourId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<CheckItem[]>(INITIAL_CHECKLIST);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TEACHER')) router.replace('/login');
  }, [isLoading, user, router]);

  const loadDossier = useCallback(async () => {
    if (!sejourId) return;
    try {
      const { data } = await api.get<DossierData>(`/sejours/${sejourId}/dossier-pedagogique`);
      setDossier(data);
      // Auto-check autorisations if all signed
      if (data.autorisations.length > 0 && data.autorisations.every((a) => a.signeeAt)) {
        setChecklist((prev) => prev.map((c) => c.id === 'autorisations_parentales' ? { ...c, checked: true } : c));
      }
    } catch {
      setError('Impossible de charger les données du séjour.');
    }
  }, [sejourId]);

  useEffect(() => {
    if (user) loadDossier();
  }, [user, loadDossier]);

  const toggleCheck = (id: string) => {
    setChecklist((prev) => prev.map((c) => c.id === id ? { ...c, checked: !c.checked } : c));
  };

  const handleSubmitRectorat = async () => {
    setSubmitting(true);
    // Simulated — in production this would call an API
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitted(true);
    setSubmitting(false);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const checkedCount = checklist.filter((c) => c.checked).length;
  const allChecked = checkedCount === checklist.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/teacher" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">&larr; Mes séjours</Link>
              {dossier && <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">{dossier.titre}</span>}
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">Documents officiels</span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Section 1 : Dossier pédagogique ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dossier pédagogique</h2>
              <p className="mt-1 text-sm text-gray-500">
                Document complet avec informations du séjour, liste des élèves et autorisations parentales.
              </p>
            </div>
            <button
              onClick={() => dossier && generateDossierPedagogique(dossier)}
              disabled={!dossier}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Générer PDF
            </button>
          </div>
          {dossier && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{dossier.placesTotales}</p>
                <p className="text-xs text-gray-500">Élèves</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{dossier.autorisations.filter((a) => a.signeeAt).length}/{dossier.autorisations.length}</p>
                <p className="text-xs text-gray-500">Autorisations signées</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{dossier.thematiquesPedagogiques.length}</p>
                <p className="text-xs text-gray-500">Thématiques</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600 text-sm font-semibold">{dossier.hebergementSelectionne?.nom ?? '—'}</p>
                <p className="text-xs text-gray-500">Centre</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2 : Ordres de mission ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ordres de mission</h2>
              <p className="mt-1 text-sm text-gray-500">
                Document officiel pour les accompagnateurs avec lieu, dates et signatures.
              </p>
            </div>
            <button
              onClick={() => dossier && generateOrdreMission(dossier)}
              disabled={!dossier}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Générer PDF
            </button>
          </div>
          {dossier?.createur && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-900">Enseignant responsable : {dossier.createur.prenom} {dossier.createur.nom}</p>
              <p className="text-gray-500">{dossier.createur.email}{dossier.createur.telephone ? ` — ${dossier.createur.telephone}` : ''}</p>
            </div>
          )}
        </div>

        {/* ── Section 3 : Checklist administrative ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Checklist administrative</h2>
              <p className="mt-1 text-sm text-gray-500">Vérifiez que tous les documents sont réunis avant soumission.</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
              allChecked ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {checkedCount}/{checklist.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-5">
            <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(checkedCount / checklist.length) * 100}%` }} />
          </div>

          <div className="space-y-2">
            {checklist.map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-lg hover:bg-gray-50 px-3 py-2.5 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleCheck(item.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Section 4 : Soumettre au rectorat ───────────────────────────── */}
        <div className={`rounded-2xl border-2 p-6 ${
          submitted
            ? 'bg-green-50 border-green-200'
            : allChecked
              ? 'bg-indigo-50 border-indigo-200'
              : 'bg-gray-50 border-gray-200'
        }`}>
          {submitted ? (
            <div className="text-center py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-green-900">Dossier soumis au rectorat</h2>
              <p className="mt-1 text-sm text-green-700">
                Votre dossier a été transmis. Vous recevrez une confirmation par email.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Soumettre au rectorat</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {allChecked
                    ? 'Tous les documents sont réunis. Vous pouvez soumettre le dossier.'
                    : `Il reste ${checklist.length - checkedCount} document${checklist.length - checkedCount > 1 ? 's' : ''} à valider avant de pouvoir soumettre.`
                  }
                </p>
              </div>
              <button
                onClick={handleSubmitRectorat}
                disabled={!allChecked || submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Soumettre au rectorat
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
