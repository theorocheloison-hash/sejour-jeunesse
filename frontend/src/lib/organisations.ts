import api from './api';
import type { SireneRaw } from '@/src/components/OrganisationSearch';

// Recherche SIRENE (répertoire des entreprises) via le backend. cp optionnel :
// axios omet la clé quand elle est undefined (comportement inchangé sans CP).
export const searchOrganisationSirene = (q: string, cp?: string) =>
  api.get<{ results: SireneRaw[] }>('/organisations/search', { params: { q, cp } })
    .then(r => r.data.results);
