import api from '@/src/lib/api';

/** Extrait le filename d'un header content-disposition (`attachment; filename="x.zip"`). */
function filenameFromDisposition(disposition: string | undefined): string | null {
  if (!disposition) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Télécharge un fichier via l'instance axios : l'interceptor de requête pose
 * le header X-Centre-Id — contrairement à un <a href> qui le court-circuite
 * (un hébergeur multi-centre exporterait toujours son premier centre).
 */
export async function downloadViaApi(url: string, fallbackFilename: string): Promise<void> {
  let response;
  try {
    response = await api.get<Blob>(url, { responseType: 'blob' });
  } catch (err) {
    // Avec responseType 'blob', le corps d'erreur est un Blob, pas du JSON :
    // on le reparse pour remonter le message du backend tel quel.
    let message = 'Échec du téléchargement';
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
      try {
        const j = JSON.parse(await data.text());
        if (j.message) message = String(j.message);
      } catch {
        // corps non-JSON → message générique
      }
    }
    throw new Error(message);
  }

  const filename =
    filenameFromDisposition(response.headers['content-disposition']) ?? fallbackFilename;

  const objectUrl = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
