// Tests du résolveur canonique client/établissement (Étape 4, Lot 1).
// Sémantique E2 : override hébergeur — sejour.client* fait foi ; le compte enseignant/créateur
// n'est qu'un fallback legacy COLLAB. Aucun libellé par défaut ici.
import { describe, it, expect } from 'vitest';
import {
  resolveClientEtablissement,
  type SejourClientFields,
  type PersonneContact,
} from './client-etablissement';

const membership = (org: { nom: string; ville?: string | null; uai?: string | null }) => ({
  memberships: [{ organisation: org }],
});

const createur: PersonneContact = {
  prenom: 'Anne',
  nom: 'Créatrice',
  email: 'anne@createur.fr',
  telephone: '0102030405',
  ...membership({ nom: 'Collège Créateur', ville: 'Lyon', uai: '0690001A' }),
};

const enseignant: PersonneContact = {
  prenom: 'Éric',
  nom: 'Enseignant',
  email: 'eric@enseignant.fr',
  telephone: '0605040302',
  ...membership({ nom: 'Lycée Enseignant', ville: 'Paris', uai: '0750002B' }),
};

const sejourComplet: SejourClientFields = {
  clientNom: 'Dupont',
  clientPrenom: 'Marie',
  clientEmail: 'marie@sejour.fr',
  clientTelephone: '0700000000',
  clientOrganisation: 'École du Séjour',
  clientAdresse: '1 rue des Écoles',
  clientCodePostal: '75001',
  clientVille: 'Nîmes',
};

describe('resolveClientEtablissement', () => {
  it('priorise sejour.client* sur le membership (source SEJOUR)', () => {
    const r = resolveClientEtablissement(sejourComplet, { enseignant, createur });
    expect(r.source).toBe('SEJOUR');
    expect(r.nom).toBe('École du Séjour');
    expect(r.ville).toBe('Nîmes');
    expect(r.adresse).toBe('1 rue des Écoles');
    expect(r.codePostal).toBe('75001');
    // Le séjour ne porte pas d'UAI → l'UAI vient toujours du membership.
    expect(r.uai).toBe('0690001A');
    // Contact : le séjour prime.
    expect(r.contactNom).toBe('Marie Dupont');
    expect(r.contactEmail).toBe('marie@sejour.fr');
    expect(r.contactTelephone).toBe('0700000000');
  });

  it('fallback membership du CRÉATEUR d\'abord (source MEMBERSHIP)', () => {
    const r = resolveClientEtablissement(null, { enseignant, createur });
    expect(r.source).toBe('MEMBERSHIP');
    expect(r.nom).toBe('Collège Créateur');
    expect(r.ville).toBe('Lyon');
    expect(r.uai).toBe('0690001A');
  });

  it('fallback membership de l\'ENSEIGNANT si pas de créateur', () => {
    const r = resolveClientEtablissement(null, { enseignant });
    expect(r.source).toBe('MEMBERSHIP');
    expect(r.nom).toBe('Lycée Enseignant');
    expect(r.ville).toBe('Paris');
    expect(r.uai).toBe('0750002B');
  });

  it('contact = compte (enseignant prioritaire) quand le séjour ne porte pas de contact', () => {
    const r = resolveClientEtablissement(null, { enseignant, createur });
    expect(r.contactNom).toBe('Éric Enseignant');
    expect(r.contactEmail).toBe('eric@enseignant.fr');
    expect(r.contactTelephone).toBe('0605040302');
  });

  it('contact = compte créateur si aucun enseignant', () => {
    const r = resolveClientEtablissement(null, { createur });
    expect(r.contactNom).toBe('Anne Créatrice');
    expect(r.contactEmail).toBe('anne@createur.fr');
    expect(r.contactTelephone).toBe('0102030405');
  });

  it('chaînes vides = absentes (||) : on retombe sur le membership / le compte', () => {
    const sejourVide: SejourClientFields = {
      clientOrganisation: '',
      clientVille: '',
      clientEmail: '',
      clientTelephone: '',
      clientNom: '',
      clientPrenom: '',
      clientAdresse: '',
      clientCodePostal: '',
    };
    const r = resolveClientEtablissement(sejourVide, { enseignant, createur });
    expect(r.source).toBe('MEMBERSHIP');
    expect(r.nom).toBe('Collège Créateur');
    expect(r.contactNom).toBe('Éric Enseignant');
    expect(r.contactEmail).toBe('eric@enseignant.fr');
    expect(r.adresse).toBeNull();
    expect(r.codePostal).toBeNull();
  });

  it('tout-null : tous les champs nuls, source null', () => {
    const r = resolveClientEtablissement(null, {});
    expect(r).toEqual({
      nom: null,
      ville: null,
      adresse: null,
      codePostal: null,
      uai: null,
      contactNom: null,
      contactEmail: null,
      contactTelephone: null,
      source: null,
    });
  });

  it('sans arguments du tout : source null, aucun crash', () => {
    const r = resolveClientEtablissement();
    expect(r.source).toBeNull();
    expect(r.nom).toBeNull();
    expect(r.contactNom).toBeNull();
  });
});
