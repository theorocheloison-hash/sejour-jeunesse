import { Test, TestingModule } from '@nestjs/testing';
import { TypeStructure, SourceOrganisation } from '@prisma/client';
import { OrganisationsService, mapperNatureJuridique } from './organisations.service';

describe('mapperNatureJuridique', () => {
  it('1000 → MICRO_ENTREPRISE', () => {
    expect(mapperNatureJuridique('1000')).toBe(TypeStructure.MICRO_ENTREPRISE);
  });

  it('5XXX → ENTREPRISE (SAS, SARL, EURL, SCI)', () => {
    expect(mapperNatureJuridique('5710')).toBe(TypeStructure.ENTREPRISE); // SAS
    expect(mapperNatureJuridique('5499')).toBe(TypeStructure.ENTREPRISE);
    expect(mapperNatureJuridique('5202')).toBe(TypeStructure.ENTREPRISE);
  });

  it('92XX → ASSOCIATION', () => {
    expect(mapperNatureJuridique('9210')).toBe(TypeStructure.ASSOCIATION);
    expect(mapperNatureJuridique('9220')).toBe(TypeStructure.ASSOCIATION);
    expect(mapperNatureJuridique('9260')).toBe(TypeStructure.ASSOCIATION);
  });

  it('7210 → MAIRIE', () => {
    expect(mapperNatureJuridique('7210')).toBe(TypeStructure.MAIRIE);
  });

  it('7220/7230 → COLLECTIVITE_TERRITORIALE', () => {
    expect(mapperNatureJuridique('7220')).toBe(TypeStructure.COLLECTIVITE_TERRITORIALE);
    expect(mapperNatureJuridique('7230')).toBe(TypeStructure.COLLECTIVITE_TERRITORIALE);
  });

  it('7383/7384 → COLLEGE_LYCEE', () => {
    expect(mapperNatureJuridique('7383')).toBe(TypeStructure.COLLEGE_LYCEE);
    expect(mapperNatureJuridique('7384')).toBe(TypeStructure.COLLEGE_LYCEE);
  });

  it('codes inconnus / null / vide → null', () => {
    expect(mapperNatureJuridique(null)).toBeNull();
    expect(mapperNatureJuridique(undefined)).toBeNull();
    expect(mapperNatureJuridique('')).toBeNull();
    expect(mapperNatureJuridique('9999')).toBeNull();
    expect(mapperNatureJuridique('3120')).toBeNull();
  });
});

describe('OrganisationsService.searchExternal', () => {
  let service: OrganisationsService;
  let fetchMock: jest.SpyInstance;

  const mockApiResponse = (results: any[]) => ({
    ok: true,
    status: 200,
    json: async () => ({ results }),
  });

  const sampleEtab = {
    siren: '123456789',
    nom_complet: 'ECOLE PRIMAIRE TEST',
    nom_raison_sociale: 'ECOLE PRIMAIRE TEST',
    nature_juridique: '7383',
    siege: {
      siret: '12345678900012',
      geo_adresse: '1 RUE DE TEST 75001 PARIS',
      libelle_commune: 'PARIS',
      code_postal: '75001',
      etat_administratif: 'A',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganisationsService],
    }).compile();
    service = module.get<OrganisationsService>(OrganisationsService);
    fetchMock = jest.spyOn(global, 'fetch' as any);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('mappe correctement un résultat actif', async () => {
    fetchMock.mockResolvedValueOnce(mockApiResponse([sampleEtab]) as any);
    const results = await service.searchExternal('ecole test');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      siren: '123456789',
      siret: '12345678900012',
      nom: 'ECOLE PRIMAIRE TEST',
      ville: 'PARIS',
      codePostal: '75001',
      departement: '75',
      typeStructure: TypeStructure.COLLEGE_LYCEE,
      source: SourceOrganisation.API_SIRENE,
    });
  });

  it('département 3 chars pour DOM-TOM (97x/98x)', async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse([
        { ...sampleEtab, siege: { ...sampleEtab.siege, code_postal: '97400' } },
      ]) as any,
    );
    const results = await service.searchExternal('test dom');
    expect(results[0].departement).toBe('974');
  });

  it('filtre les établissements fermés (etat_administratif !== A)', async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse([
        { ...sampleEtab, siege: { ...sampleEtab.siege, etat_administratif: 'F' } },
      ]) as any,
    );
    const results = await service.searchExternal('ferme');
    expect(results).toHaveLength(0);
  });

  it('cache hit : 2 appels identiques → 1 seul fetch', async () => {
    fetchMock.mockResolvedValueOnce(mockApiResponse([sampleEtab]) as any);
    const r1 = await service.searchExternal('idem');
    const r2 = await service.searchExternal('idem');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('cache miss : casse et accent différents → 2 fetch (normalisation NFKD lowercase seulement)', async () => {
    fetchMock
      .mockResolvedValueOnce(mockApiResponse([sampleEtab]) as any)
      .mockResolvedValueOnce(mockApiResponse([sampleEtab]) as any);
    await service.searchExternal('test alpha');
    await service.searchExternal('test beta');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('timeout / abort → []', async () => {
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          }, 10);
        }),
    );
    const results = await service.searchExternal('timeout');
    expect(results).toEqual([]);
  });

  it('500 API gouv → []', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as any);
    const results = await service.searchExternal('boom');
    expect(results).toEqual([]);
  });

  it('résultats vides → []', async () => {
    fetchMock.mockResolvedValueOnce(mockApiResponse([]) as any);
    const results = await service.searchExternal('introuvable');
    expect(results).toEqual([]);
  });
});
