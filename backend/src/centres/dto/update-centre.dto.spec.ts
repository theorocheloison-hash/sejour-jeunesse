import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCentreDto } from './update-centre.dto';

/**
 * Lot A — sémantique « absent / effacé / obligatoire » du PATCH profil :
 * - absent (undefined) → champ non modifié, aucune validation ;
 * - null → effacement, accepté UNIQUEMENT pour les champs effaçables ;
 * - '' (après trim) sur un texte effaçable → converti en null par le Transform ;
 * - champ obligatoire présent : valide et non vide, sinon 400 en français.
 * Reproduit le pipeline du ValidationPipe global ({ whitelist, transform }).
 */
async function valider(payload: Record<string, unknown>) {
  const instance = plainToInstance(UpdateCentreDto, payload);
  const erreurs = await validate(instance, { whitelist: true });
  return { instance, erreurs };
}

function messages(erreurs: Awaited<ReturnType<typeof valider>>['erreurs']): string[] {
  return erreurs.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('UpdateCentreDto — champs OBLIGATOIRES', () => {
  it('nom: null → erreur en français', async () => {
    const { erreurs } = await valider({ nom: null });
    expect(messages(erreurs)).toContain('Le nom du centre ne peut pas être vide.');
  });

  it("nom: '' et '   ' → erreur", async () => {
    for (const nom of ['', '   ']) {
      const { erreurs } = await valider({ nom });
      expect(messages(erreurs)).toContain('Le nom du centre ne peut pas être vide.');
    }
  });

  it('nom absent → OK (champ non modifié)', async () => {
    const { erreurs, instance } = await valider({});
    expect(erreurs).toHaveLength(0);
    expect(instance.nom).toBeUndefined();
  });

  it('equipements: null → erreur ; liste vide → OK', async () => {
    const { erreurs } = await valider({ equipements: null });
    expect(erreurs.length).toBeGreaterThan(0);
    const ok = await valider({ equipements: [] });
    expect(ok.erreurs).toHaveLength(0);
  });

  it('accessiblePmr: null → erreur ; false → OK', async () => {
    const { erreurs } = await valider({ accessiblePmr: null });
    expect(erreurs.length).toBeGreaterThan(0);
    const ok = await valider({ accessiblePmr: false });
    expect(ok.erreurs).toHaveLength(0);
  });

  it('capacite: null → erreur ; "0" → erreur (Min 1) ; "12" → 12', async () => {
    expect((await valider({ capacite: null })).erreurs.length).toBeGreaterThan(0);
    expect((await valider({ capacite: '0' })).erreurs.length).toBeGreaterThan(0);
    const ok = await valider({ capacite: '12' });
    expect(ok.erreurs).toHaveLength(0);
    expect(ok.instance.capacite).toBe(12);
  });
});

describe('UpdateCentreDto — champs EFFAÇABLES (null / \'\' → effacement)', () => {
  it('telephone: null → OK et reste null', async () => {
    const { erreurs, instance } = await valider({ telephone: null });
    expect(erreurs).toHaveLength(0);
    expect(instance.telephone).toBeNull();
  });

  it("telephone: '' → devient null ; '  06 12 ' → trim", async () => {
    const vide = await valider({ telephone: '' });
    expect(vide.erreurs).toHaveLength(0);
    expect(vide.instance.telephone).toBeNull();
    const trim = await valider({ telephone: '  06 12 ' });
    expect(trim.erreurs).toHaveLength(0);
    expect(trim.instance.telephone).toBe('06 12');
  });

  it("siret: null → OK ; '' → null ; '123' → erreur ; '953 632 031 00027' → strippé", async () => {
    const nul = await valider({ siret: null });
    expect(nul.erreurs).toHaveLength(0);
    expect(nul.instance.siret).toBeNull();
    const vide = await valider({ siret: '' });
    expect(vide.erreurs).toHaveLength(0);
    expect(vide.instance.siret).toBeNull();
    const court = await valider({ siret: '123' });
    expect(messages(court.erreurs)).toContain('Le SIRET doit contenir exactement 14 chiffres.');
    const espaces = await valider({ siret: '953 632 031 00027' });
    expect(espaces.erreurs).toHaveLength(0);
    expect(espaces.instance.siret).toBe('95363203100027');
  });

  it("siteWeb: null → reste null ; '' → null ; 'exemple.fr' → préfixé https", async () => {
    const nul = await valider({ siteWeb: null });
    expect(nul.erreurs).toHaveLength(0);
    expect(nul.instance.siteWeb).toBeNull();
    const vide = await valider({ siteWeb: '' });
    expect(vide.erreurs).toHaveLength(0);
    expect(vide.instance.siteWeb).toBeNull();
    const nu = await valider({ siteWeb: 'exemple.fr' });
    expect(nu.erreurs).toHaveLength(0);
    expect(nu.instance.siteWeb).toBe('https://exemple.fr');
  });

  it('capaciteAdultes: null → OK et reste null (jamais 0)', async () => {
    const { erreurs, instance } = await valider({ capaciteAdultes: null });
    expect(erreurs).toHaveLength(0);
    expect(instance.capaciteAdultes).toBeNull();
    expect(instance.capaciteAdultes).not.toBe(0);
  });
});
