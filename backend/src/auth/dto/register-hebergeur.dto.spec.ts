import { plainToInstance } from 'class-transformer';
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
