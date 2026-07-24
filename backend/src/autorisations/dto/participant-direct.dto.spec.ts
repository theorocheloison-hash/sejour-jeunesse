import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { BatchDirectDto, ParticipantDirectDto } from './participant-direct.dto';

/**
 * DTO saisie directe — le pipe global est { whitelist: true, transform: true }
 * SANS forbidNonWhitelisted : un champ non décoré serait STRIPPÉ EN SILENCE.
 * Ces tests verrouillent l'exhaustivité (payload complet → zéro perte) et la
 * validation de hebergementCategorie (la faille update-fields). Pipe
 * instancié avec les MÊMES options que main.ts.
 */

const pipe = new ValidationPipe({ whitelist: true, transform: true });

// Un payload COMPLET, chaque champ de ParticipantDirectInput rempli — si un
// champ manque au DTO, le toEqual échoue (champ strippé).
const PAYLOAD_COMPLET = {
  eleveNom: 'DUPONT',
  elevePrenom: 'Zoé',
  parentEmail: 'parent@example.com',
  taille: 152,
  poids: 41,
  pointure: 36,
  niveauSki: 'Débutant',
  regimeAlimentaire: 'Sans porc',
  eleveDateNaissance: '2014-05-12',
  nomParent: 'Marie Dupont',
  telephoneUrgence: '0601020304',
  infosMedicales: 'RAS',
  champsPersonnalises: { 'Taille casque': 'M' },
  hebergementCategorie: 'FILLE',
};

async function transforme(payload: unknown) {
  return pipe.transform(payload, { type: 'body', metatype: ParticipantDirectDto });
}

describe('ParticipantDirectDto (update-fields)', () => {
  it('payload COMPLET : aucun champ strippé par la whitelist', async () => {
    const res = await transforme(PAYLOAD_COMPLET);
    expect(res).toEqual(PAYLOAD_COMPLET);
  });

  it('les null explicites du front passent et sont préservés', async () => {
    const payload = {
      parentEmail: null,
      taille: null,
      poids: null,
      pointure: null,
      niveauSki: null,
      regimeAlimentaire: null,
      eleveDateNaissance: null,
      nomParent: null,
      telephoneUrgence: null,
      infosMedicales: null,
      champsPersonnalises: null,
      hebergementCategorie: null,
    };
    const res = await transforme(payload);
    expect(res).toEqual(payload);
  });

  it('hebergementCategorie hors liste → 400 (la faille fermée)', async () => {
    await expect(
      transforme({ hebergementCategorie: 'PLUS-DE-DIX-CARACTERES' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('taille non numérique → 400 (le front envoie des numbers natifs)', async () => {
    await expect(transforme({ taille: '152' })).rejects.toThrow(BadRequestException);
  });
});

describe('BatchDirectDto (batch-direct)', () => {
  it('valide en profondeur : participant nested invalide → 400', async () => {
    await expect(
      pipe.transform(
        { sejourId: 'sejour-1', participants: [{ hebergementCategorie: 'XX' }] },
        { type: 'body', metatype: BatchDirectDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('batch valide : champs nested préservés sans perte', async () => {
    const res = await pipe.transform(
      { sejourId: 'sejour-1', participants: [PAYLOAD_COMPLET] },
      { type: 'body', metatype: BatchDirectDto },
    );
    expect(res.sejourId).toBe('sejour-1');
    expect(res.participants).toHaveLength(1);
    expect(res.participants[0]).toEqual(PAYLOAD_COMPLET);
  });
});
