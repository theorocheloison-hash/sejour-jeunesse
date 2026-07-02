// Formes de réponse par endpoint pour l'auth simulée (défaut : tableau vide).
// Partagé par shots.mjs et check-overflow.mjs.
export function mockBody(url) {
  if (url.includes('/collaboration/mes-non-lus')) return '{"total":0,"parSejour":[]}';
  if (url.includes('/pilotage/remplissage')) {
    return '{"annee":2026,"capacite":0,"tauxAnnuel":0,"nuiteesOccupees":0,"nuiteesDisponibles":0,"parMois":[],"comparaisonN1":null}';
  }
  if (url.includes('/pilotage/ca')) {
    return '{"annee":2026,"confirme":0,"encaisse":0,"resteAEncaisser":0,"parMois":[],"parType":{"sejours":0,"evenements":0},"parSource":{"direct":0,"reseau":0},"parProduit":[],"comparaisonN1":null}';
  }
  if (url.includes('/rentabilite/tableau')) {
    return '{"sejours":[],"totaux":{"caTTC":0,"chargesTTC":0,"margeTTC":0,"tauxMarge":null}}';
  }
  if (url.includes('/admin/activite')) {
    return '{"kpis":{"sejoursCreesMois":0,"devisCreesMois":0,"centresActifs":0,"centresAvecSejour":0,"tauxActivation":0},"santeClients":[],"feed":[]}';
  }
  if (url.includes('/reseau/stats')) {
    return '{"reseau":"MOCK","nomComplet":"MOCK","periode":"tout","kpis":{"demandesReseau":0,"devisReseau":0,"caReseau":0,"tauxConversionReseau":0,"totalCentres":0,"centresActifs":0,"enseignantsAcquis":0,"enseignantsFidelises":0},"centres":[]}';
  }
  if (url.includes('/hebergements')) return '{"results":[],"total":0}';
  if (url.includes('/users/me')) return '{}';
  // GET /collaboration/{id} (sans sous-ressource) → SejourCollabInfo minimal
  if (/\/collaboration\/[^/?]+(\?.*)?$/.test(url) && !url.includes('mes-non-lus')) {
    return JSON.stringify({
      id: 'mock-sejour', titre: 'Séjour de test', lieu: 'Morillon',
      dateDebut: '2026-07-06T00:00:00.000Z', dateFin: '2026-07-10T00:00:00.000Z',
      placesTotales: 40, nombreAccompagnateurs: 4, statut: 'CONVENTION',
      inscriptionsCloturees: false, thematiquesPedagogiques: ['Nature'],
      modeGestion: 'COLLABORATIF', natureSejour: 'SEJOUR',
      createur: { id: 'orga-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.local' },
      hebergementSelectionne: { id: 'c1', nom: 'Chalet Test', ville: 'Morillon', userId: 'mock-user' },
    });
  }
  return '[]';
}
