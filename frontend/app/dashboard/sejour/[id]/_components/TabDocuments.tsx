'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { getDocuments, createDocument, getDocumentsCentre } from '@/src/lib/collaboration';
import type { DocumentSejour, TypeDocumentSejour, DocumentCentreFiche } from '@/src/lib/collaboration';
import SecureFileLink from '@/src/components/SecureFileLink';

const TYPE_DOC_OPTIONS: { value: TypeDocumentSejour; label: string }[] = [
  { value: 'PROGRAMME', label: 'Programme' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ASSURANCE', label: 'Assurance' },
  { value: 'FACTURE', label: 'Facture' },
  { value: 'AUTRE', label: 'Autre' },
];

const TYPE_DOC_BADGE: Record<TypeDocumentSejour, string> = {
  PROGRAMME: 'bg-blue-100 text-blue-700',
  TRANSPORT: 'bg-orange-100 text-orange-700',
  ASSURANCE: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  FACTURE: 'bg-purple-100 text-purple-700',
  AUTRE: 'bg-gray-100 text-gray-600',
};

export interface TabDocumentsProps {
  sejourId: string;
  isDirector: boolean;
  estLectureSeule: boolean;
  onError: (message: string) => void;
}

export default function TabDocuments({ sejourId, isDirector, estLectureSeule, onError }: TabDocumentsProps) {
  const [docs, setDocs] = useState<DocumentSejour[]>([]);
  const [docsCentre, setDocsCentre] = useState<DocumentCentreFiche[]>([]);
  const [docForm, setDocForm] = useState({ nom: '', type: 'AUTRE' as TypeDocumentSejour });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDragging, setDocDragging] = useState(false);
  const [docSending, setDocSending] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    if (!sejourId) return;
    try { setDocs(await getDocuments(sejourId)); } catch { /* ignore */ }
  }, [sejourId]);

  const loadDocsCentre = useCallback(async () => {
    if (!sejourId) return;
    try { setDocsCentre(await getDocumentsCentre(sejourId)); } catch { /* ignore */ }
  }, [sejourId]);

  useEffect(() => {
    loadDocs();
    loadDocsCentre();
  }, [loadDocs, loadDocsCentre]);

  const handleDocFileSelect = (file: File | undefined) => {
    if (!file) return;
    const allowed = [
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg',
    ];
    if (allowed.includes(file.type)) {
      setDocFile(file);
      if (!docForm.nom) {
        setDocForm((f) => ({ ...f, nom: file.name.replace(/\.[^.]+$/, '') }));
      }
    }
  };

  const handleDocDrop = (e: DragEvent) => {
    e.preventDefault();
    setDocDragging(false);
    handleDocFileSelect(e.dataTransfer.files[0]);
  };

  const handleAddDocument = async () => {
    if (!sejourId || !docForm.nom || !docFile) return;
    setDocSending(true);
    try {
      const doc = await createDocument(sejourId, { nom: docForm.nom, type: docForm.type }, docFile);
      setDocs((prev) => [doc, ...prev]);
      setDocForm({ nom: '', type: 'AUTRE' });
      setDocFile(null);
    } catch (err) {
      console.error('[handleAddDocument]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      loadDocs();
    }
    setDocSending(false);
  };

  return (
    <div className="space-y-6">
      {docsCentre.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents du centre partenaire</h3>
          <div className="space-y-2">
            {docsCentre.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.nom}</p>
                  <p className="text-xs text-gray-500">
                    {d.type}
                    {d.dateExpiration && ` — Expire le ${new Date(d.dateExpiration).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                {d.url && (
                  <div className="shrink-0 flex items-center gap-2">
                    <SecureFileLink url={d.url}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors inline-flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Voir
                    </SecureFileLink>
                    <SecureFileLink url={d.url} download
                      className="text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-primary-light)] transition-colors inline-flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Télécharger
                    </SecureFileLink>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isDirector && (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Ajouter un document</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input type="text" value={docForm.nom} onChange={(e) => setDocForm((f) => ({ ...f, nom: e.target.value }))}
            placeholder="Nom du document" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          <select value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value as TypeDocumentSejour }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            {TYPE_DOC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Zone drag & drop */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDocDragging(true); }}
          onDragLeave={() => setDocDragging(false)}
          onDrop={handleDocDrop}
          className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            docDragging
              ? 'border-indigo-400 bg-[var(--color-primary-light)]'
              : docFile
                ? 'border-[var(--color-success)] bg-[var(--color-success-light)]'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          {docFile ? (
            <div className="flex items-center justify-center gap-3">
              <svg className="h-8 w-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{docFile.name}</p>
                <p className="text-xs text-gray-500">{(docFile.size / 1024).toFixed(0)} Ko</p>
              </div>
              <button onClick={() => setDocFile(null)} className="ml-2 text-gray-400 hover:text-red-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">Glissez-déposez votre fichier ici</p>
              <p className="text-xs text-gray-400 mb-3">ou</p>
              <button
                type="button"
                onClick={() => docFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                Parcourir
              </button>
              <input
                ref={docFileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleDocFileSelect(e.target.files?.[0])}
              />
              <p className="mt-3 text-xs text-gray-400">PDF, Word, Excel, PowerPoint, PNG, JPG</p>
            </>
          )}
        </div>

        <button onClick={handleAddDocument}
          disabled={!docForm.nom || !docFile || docSending || estLectureSeule}
          title={estLectureSeule ? 'Accès en lecture seule' : undefined}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {docSending ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi...</>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Ajouter
            </>
          )}
        </button>
      </div>
      )}

      {docs.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">Aucun document partagé.</p>
      )}
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_DOC_BADGE[d.type]}`}>
                {TYPE_DOC_OPTIONS.find((o) => o.value === d.type)?.label ?? d.type}
              </span>
              <span className="text-sm font-medium text-gray-900 truncate">{d.nom}</span>
              <span className="text-xs text-gray-400">par {d.uploader.prenom} {d.uploader.nom}</span>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <SecureFileLink url={d.url}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors inline-flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Voir
              </SecureFileLink>
              <SecureFileLink url={d.url} download
                className="text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-primary-light)] transition-colors inline-flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Télécharger
              </SecureFileLink>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
