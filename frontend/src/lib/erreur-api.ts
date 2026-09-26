/**
 * Extrait le message d'erreur d'une réponse API (axios) :
 * - data.message string → tel quel ;
 * - data.message string[] (erreurs class-validator) → jointes par espace ;
 * - sinon (réseau coupé, 500 sans corps…) → message par défaut.
 */
export function messageErreurApi(err: unknown, defaut: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) {
    const joint = message.filter((m) => typeof m === 'string' && m.trim()).join(' ');
    if (joint) return joint;
  }
  if (typeof message === 'string' && message.trim()) return message;
  return defaut;
}
