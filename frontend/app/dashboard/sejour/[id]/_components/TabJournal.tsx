'use client';

import { useEffect, useRef, useState } from 'react';
import { getJournal, createJournalPost, deleteJournalPost } from '@/src/lib/collaboration';
import type { PostJournal } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import SecureImage from '@/src/components/SecureImage';
import InviteOrganisateurCard from './InviteOrganisateurCard';
import { formatDateRelative } from '@/src/lib/utils';

function PhotoGrid({ photos }: { photos: { id: string; url: string }[] }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <SecureImage
        url={photos[0].url}
        className="mt-3 rounded-xl max-h-96 object-cover w-full"
        openOnClick
      />
    );
  }
  if (photos.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <SecureImage
            key={p.id}
            url={p.url}
            className="rounded-xl object-cover w-full aspect-square"
            openOnClick
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <SecureImage
          key={p.id}
          url={p.url}
          className={`rounded-xl object-cover w-full aspect-square ${i === 0 ? 'col-span-2 row-span-2 aspect-auto h-full' : ''}`}
          openOnClick
        />
      ))}
    </div>
  );
}

function JournalPostCard({
  post,
  canDelete,
  onDelete,
}: {
  post: PostJournal;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const initiales = `${post.auteur.prenom[0] ?? ''}${post.auteur.nom[0] ?? ''}`.toUpperCase();
  const isHebergeur = post.auteur.role === 'HEBERGEUR';
  const roleLabel = isHebergeur ? 'Hébergeur' : 'Enseignant';
  const avatarBg = isHebergeur ? 'var(--color-success)' : 'var(--color-primary)';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
      <div className="flex items-center gap-3">
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
            <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${isHebergeur ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-blue-50 text-[var(--color-primary)]'}`}>
              {roleLabel}
            </span>
          </div>
          <p className="text-xs text-gray-400">{formatDateRelative(post.createdAt)}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>

      <p className="text-sm text-gray-900 whitespace-pre-wrap mt-3">{post.contenu}</p>
      <PhotoGrid photos={post.photos} />
    </div>
  );
}

export interface TabJournalProps {
  sejourId: string;
  user: User;
  isDirect: boolean;
  invitationCollab: { email: string; createdAt: string } | null;
  estLectureSeule: boolean;
  onError: (message: string) => void;
}

export default function TabJournal({
  sejourId,
  user,
  isDirect,
  invitationCollab,
  estLectureSeule,
  onError,
}: TabJournalProps) {
  const [journalPosts, setJournalPosts] = useState<PostJournal[]>([]);
  const [journalContenu, setJournalContenu] = useState('');
  const [journalPhotos, setJournalPhotos] = useState<File[]>([]);
  const [journalPhotosPreviews, setJournalPhotosPreviews] = useState<string[]>([]);
  const [journalSending, setJournalSending] = useState(false);
  const [journalLinkCopied, setJournalLinkCopied] = useState(false);
  const journalFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDirect) { getJournal(sejourId).then(setJournalPosts).catch(() => {}); }
  }, [isDirect, sejourId]);

  const handleAddJournalPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = Math.max(0, 6 - journalPhotos.length);
    const accepted = Array.from(files).slice(0, remaining).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
    );
    if (accepted.length === 0) return;
    const previews = accepted.map((f) => URL.createObjectURL(f));
    setJournalPhotos((prev) => [...prev, ...accepted]);
    setJournalPhotosPreviews((prev) => [...prev, ...previews]);
    if (journalFileRef.current) journalFileRef.current.value = '';
  };

  const handleRemoveJournalPhoto = (idx: number) => {
    URL.revokeObjectURL(journalPhotosPreviews[idx]);
    setJournalPhotos((prev) => prev.filter((_, i) => i !== idx));
    setJournalPhotosPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePublishJournal = async () => {
    if (!sejourId || !journalContenu.trim()) return;
    setJournalSending(true);
    try {
      const post = await createJournalPost(sejourId, journalContenu.trim(), journalPhotos);
      setJournalPosts((prev) => [post, ...prev]);
      journalPhotosPreviews.forEach((p) => URL.revokeObjectURL(p));
      setJournalContenu('');
      setJournalPhotos([]);
      setJournalPhotosPreviews([]);
    } catch { /* ignore */ }
    setJournalSending(false);
  };

  const handleDeleteJournalPost = async (postId: string) => {
    if (!sejourId) return;
    try {
      await deleteJournalPost(sejourId, postId);
      setJournalPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('[handleDeleteJournalPost]', err);
      onError('Une erreur est survenue. Veuillez réessayer.');
      getJournal(sejourId).then(setJournalPosts).catch(() => {});
    }
  };

  if (isDirect) {
    return (
      <InviteOrganisateurCard
        sejourId={sejourId}
        pending={invitationCollab}
        title="Journal de séjour"
        subtitle="Invitez l'organisateur à rejoindre l'espace collaboratif pour publier dans le journal."
        icon={
          <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        }
      />
    );
  }

  return (
    <div>
      {/* Zone de publication */}
      {(user.role === 'ORGANISATEUR' || user.role === 'HEBERGEUR') && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          <textarea
            value={journalContenu}
            onChange={(e) => setJournalContenu(e.target.value.slice(0, 2000))}
            placeholder="Racontez la journée…"
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-gray-400">{journalContenu.length} / 2000</span>
          </div>

          {journalPhotosPreviews.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {journalPhotosPreviews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => handleRemoveJournalPhoto(i)}
                    aria-label="Retirer la photo"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center hover:bg-black"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={() => journalFileRef.current?.click()}
              disabled={journalPhotos.length >= 6}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Ajouter des photos {journalPhotos.length > 0 && `(${journalPhotos.length}/6)`}
            </button>
            <input
              ref={journalFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleAddJournalPhotos(e.target.files)}
            />
            <button
              type="button"
              onClick={handlePublishJournal}
              disabled={journalSending || !journalContenu.trim() || estLectureSeule}
              title={estLectureSeule ? 'Accès en lecture seule' : undefined}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {journalSending ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </div>
      )}

      {/* Fil */}
      {journalPosts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <svg className="h-10 w-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <p className="text-sm text-gray-500">Aucune publication pour l&apos;instant. Partagez les moments du séjour avec les familles !</p>
        </div>
      ) : (
        <div>
          {journalPosts.map((post) => (
            <JournalPostCard
              key={post.id}
              post={post}
              canDelete={post.auteur.id === user.id}
              onDelete={() => handleDeleteJournalPost(post.id)}
            />
          ))}
        </div>
      )}

      {/* Lien parent */}
      {user.role === 'ORGANISATEUR' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
          <p className="text-sm text-blue-900 mb-3">
            Les parents peuvent consulter ce journal via le lien de leur autorisation parentale. Chaque parent accède au journal depuis la page : <code className="text-xs bg-white border border-blue-200 rounded px-1.5 py-0.5">liavo.fr/sejour/&#123;token&#125;/journal</code>
          </p>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText('https://liavo.fr/sejour/{token}/journal');
              setJournalLinkCopied(true);
              setTimeout(() => setJournalLinkCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {journalLinkCopied ? 'Copié !' : 'Copier le lien d\'exemple'}
          </button>
        </div>
      )}
    </div>
  );
}
