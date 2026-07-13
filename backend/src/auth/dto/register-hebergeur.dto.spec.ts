import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterHebergeurDto } from './register-hebergeur.dto';

/**
 * Normalisation du SIRET à l'inscription hébergeur (@Transform sur le DTO).
 * Un SIRET saisi avec espaces/points/tirets (ex. "813 741 220 00020", 17 chars)
 * dépassait le VarChar(14) de centres_hebergement.siret → centre.create plantait
 * APRÈS la création du user → compte hébergeur orphelin.
 * enableImplicitConversion: false = défaut du ValidationPipe global (main.ts).
 */

const CHAMPS_VALIDES = {
  prenom: 'Théo',
  nom: 'Roche-Loison',
  email: 'theo@example.com',
  password: 'S3cret!password',
  nomCentre: 'Centre Test',
};

function toDto(siret?: string) {
  return plainToInstance(
    RegisterHebergeurDto,
    siret === undefined ? CHAMPS_VALIDES : { ...CHAMPS_VALIDES, siret },
    { enableImplicitConversion: false },
  );
}

describe('RegisterHebergeurDto — normalisation SIRET', () => {
  it('strippe les espaces (cas réel des prospects perdus)', () => {
    const dto = toDto('813 741 220 00020');
    expect(dto.siret).toBe('81374122000020');
  });

  it('strippe points et tirets', () => {
    const dto = toDto('813.741.220-00020');
    expect(dto.siret).toBe('81374122000020');
  });

  it('laisse un SIRET déjà propre inchangé', () => {
    const dto = toDto('81374122000020');
    expect(dto.siret).toBe('81374122000020');
  });

  it('laisse undefined quand le SIRET est absent', () => {
    const dto = toDto(undefined);
    expect(dto.siret).toBeUndefined();
  });
});

describe('RegisterHebergeurDto — validation de longueur SIRET (@Length)', () => {
  async function erreursSiret(siret?: string) {
    const errors = await validate(toDto(siret));
    return errors.find((e) => e.property === 'siret');
  }

  it('rejette un SIRET à 13 chiffres', async () => {
    const err = await erreursSiret('8137412200002');
    expect(err?.constraints?.isLength).toBe('Le SIRET doit contenir exactement 14 chiffres.');
  });

  it('rejette un SIRET à 15 chiffres', async () => {
    const err = await erreursSiret('813741220000201');
    expect(err?.constraints?.isLength).toBe('Le SIRET doit contenir exactement 14 chiffres.');
  });

  it('accepte un SIRET à 14 chiffres', async () => {
    expect(await erreursSiret('81374122000020')).toBeUndefined();
  });

  it('accepte un SIRET à 14 chiffres saisi avec des espaces (strip avant @Length)', async () => {
    expect(await erreursSiret('813 741 220 00020')).toBeUndefined();
  });

  it("n'échoue pas quand le SIRET est absent (@IsOptional)", async () => {
    expect(await erreursSiret(undefined)).toBeUndefined();
  });
});
