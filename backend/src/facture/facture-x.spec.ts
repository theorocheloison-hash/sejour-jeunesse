import { buildCiiXml, FactureAvecLignes } from './facture-x';

/**
 * Tests du CII Factur-X (EN 16931) — typage ISO 6523 de l'identifiant légal
 * (BT-30) : schemeID dérivé du format réel de la donnée snapshot
 * (0009 = SIRET 14 chiffres, 0002 = SIREN 9 chiffres), valeur nettoyée,
 * bloc omis si la longueur est aberrante.
 */

function facture(over: Partial<Record<string, unknown>> = {}): FactureAvecLignes {
  return {
    numero: 'FA-2026-001',
    typeFacture: 'SOLDE',
    dateEmission: new Date('2026-07-01T10:00:00Z'),
    emetteurNom: 'Le Sauvageon',
    emetteurAdresse: '1 chemin des Bois||74110||Morzine',
    emetteurSiret: null,
    emetteurTva: null,
    emetteurIban: null,
    destinataireNom: 'Client Test',
    destinataireAdresse: null,
    destinataireSiret: null,
    montantHT: 100,
    montantTVA: 20,
    montantTTC: 120,
    montantFacture: 120,
    tauxTva: 20,
    montantAcompteDejaFacture: null,
    factureAnnulee: null,
    lignes: [{ description: 'Nuitée', prixUnitaire: 100, quantite: 1, tva: 20, totalHT: 100 }],
    ...over,
  } as unknown as FactureAvecLignes;
}

/** Vérification de bonne formation : chaque balise ouvrante a sa fermante appariée. */
function assertWellFormed(xml: string) {
  const stack: string[] = [];
  const re = /<(\/?)([\w:.-]+)((?:[^"'>]|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      expect(stack.pop()).toBe(name);
    } else {
      stack.push(name);
    }
  }
  expect(stack).toEqual([]);
}

describe('buildCiiXml — schemeID ISO 6523 (SpecifiedLegalOrganization)', () => {
  it('emetteurSiret 14 chiffres → schemeID="0009", valeur intacte', () => {
    const xml = buildCiiXml(facture({ emetteurSiret: '95363203100027' }), 'Séjour Test');
    expect(xml).toContain('<ram:ID schemeID="0009">95363203100027</ram:ID>');
    expect(xml).not.toContain('schemeID="0002"');
  });

  it('emetteurSiret 9 chiffres (SIREN) → schemeID="0002"', () => {
    const xml = buildCiiXml(facture({ emetteurSiret: '953632031' }), 'Séjour Test');
    expect(xml).toContain('<ram:ID schemeID="0002">953632031</ram:ID>');
    expect(xml).not.toContain('schemeID="0009"');
  });

  it('emetteurSiret avec espaces → valeur nettoyée (chiffres seuls) dans le XML', () => {
    const xml = buildCiiXml(facture({ emetteurSiret: '953 632 031 00027' }), 'Séjour Test');
    expect(xml).toContain('<ram:ID schemeID="0009">95363203100027</ram:ID>');
    expect(xml).not.toContain('953 632 031 00027');
  });

  it('emetteurSiret null ou de longueur aberrante → bloc SpecifiedLegalOrganization absent', () => {
    for (const emetteurSiret of [null, '12345678901']) {
      const xml = buildCiiXml(facture({ emetteurSiret }), 'Séjour Test');
      expect(xml).not.toContain('SpecifiedLegalOrganization');
    }
  });

  it('destinataireSiret : mêmes règles pour le buyer (0009 / 0002 / nettoyage / omission)', () => {
    const siret14 = buildCiiXml(facture({ destinataireSiret: '78467169500087' }), 'Séjour Test');
    expect(siret14).toContain('<ram:ID schemeID="0009">78467169500087</ram:ID>');

    const siren9 = buildCiiXml(facture({ destinataireSiret: '784 671 695' }), 'Séjour Test');
    expect(siren9).toContain('<ram:ID schemeID="0002">784671695</ram:ID>');

    const aberrant = buildCiiXml(facture({ destinataireSiret: '784671' }), 'Séjour Test');
    expect(aberrant).not.toContain('SpecifiedLegalOrganization');
  });

  it("non-régression : XML bien formé, guideline EN 16931 inchangé", () => {
    const xml = buildCiiXml(
      facture({ emetteurSiret: '95363203100027', destinataireSiret: '784671695', emetteurIban: 'FR7630006000011234567890189', emetteurTva: 'FR32953632031' }),
      'Séjour Test',
    );
    assertWellFormed(xml);
    expect(xml).toContain(
      '<ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>',
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});
