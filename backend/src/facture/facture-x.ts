import { PDFDocument, PDFName, PDFString, PDFDict } from 'pdf-lib';
import type { Facture, LigneFacture } from '@prisma/client';

/**
 * Lot 4A — Factur-X EN 16931.
 * buildCiiXml() : génère le CII D22B (profil EN 16931) depuis une Facture LIAVO.
 * embedFacturX() : embarque ce XML + métadonnées XMP PDF/A-3 dans le buffer react-pdf.
 *
 * NB getChorusXml() (UBL) reste séparé et inchangé — destiné à Chorus Pro (Lot 4B).
 */

export type FactureAvecLignes = Facture & {
  lignes: LigneFacture[];
  factureAnnulee?: { numero: string; dateEmission: Date } | null;
  // Refacto facture-solde (étape 1) : contexte optionnel du solde (additif,
  // non consommé par buildCiiXml — les montants XML restent les champs figés).
  factureAcompte?: { numero: string; dateEmission: Date; montantVerseTotal: number } | null;
  devis?: { versements?: Array<{ montant: number; datePaiement: Date }> } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Format CII YYYYMMDD (qualifié format="102"). */
function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().substring(0, 10).replace(/-/g, '');
}

function escXml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fmtAmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** schemeID ISO 6523 : 0009 = SIRET (14 chiffres), 0002 = SIREN (9 chiffres). */
function schemeIdFor(id: string | null | undefined): '0009' | '0002' | null {
  const clean = String(id ?? '').replace(/\D/g, '');
  if (clean.length === 14) return '0009';
  if (clean.length === 9) return '0002';
  return null;
}

/** Date PDF (D:YYYYMMDDHHmmSSZ) pour le Params/ModDate du fichier embarqué. */
function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * Découpe l'adresse snapshot en champs CII distincts (PostCode + City requis EN 16931).
 * Convention de sérialisation (construireEmetteur/Destinataire) : "adresse||codePostal||ville".
 * Fallback : adresse brute (anciennes factures sans séparateur).
 */
function parseAdresse(raw: string | null): { lineOne: string; postCode: string; city: string } {
  if (!raw) return { lineOne: '', postCode: '', city: '' };
  const parts = raw.split('||');
  if (parts.length === 3) {
    return { lineOne: parts[0], postCode: parts[1], city: parts[2] };
  }
  return { lineOne: raw, postCode: '', city: '' };
}

// ─── CII D22B (EN 16931) ────────────────────────────────────────────────────

export function buildCiiXml(facture: FactureAvecLignes, titreSejour: string): string {
  const typeCode =
    facture.typeFacture === 'ACOMPTE' ? '386'   // Prepayment invoice
    : facture.typeFacture === 'AVOIR' ? '381'   // Credit note
    : '380';                                    // Commercial invoice (SOLDE)

  const categoryCode = (taux: number) => (taux > 0 ? 'S' : 'Z');

  // Date d'échéance = émission + 30 jours
  const echeance = new Date(facture.dateEmission);
  echeance.setDate(echeance.getDate() + 30);
  const dueDate = fmtDate(echeance);

  // Lignes CII
  const lignesXml = facture.lignes.map((l, i) => `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${i + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${escXml(l.description)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:GrossPriceProductTradePrice>
            <ram:ChargeAmount>${fmtAmt(Math.abs(l.prixUnitaire))}</ram:ChargeAmount>
          </ram:GrossPriceProductTradePrice>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${fmtAmt(Math.abs(l.prixUnitaire))}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="C62">${l.quantite}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${categoryCode(l.tva)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${l.tva}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${fmtAmt(l.totalHT)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`).join('');

  // Émetteur — blocs conditionnels
  const sellerTva = facture.emetteurTva
    ? `
          <ram:SpecifiedTaxRegistration>
            <ram:ID schemeID="VA">${escXml(facture.emetteurTva)}</ram:ID>
          </ram:SpecifiedTaxRegistration>`
    : '';
  // Identifiant légal (BT-30) : schemeID dérivé du format réel de la donnée
  // (0009 = SIRET 14 chiffres, 0002 = SIREN 9 chiffres), valeur nettoyée
  // (chiffres seuls). Longueur aberrante → bloc omis, mieux qu'un ID mal typé.
  const legalOrgBlock = (id: string | null | undefined): string => {
    const schemeId = schemeIdFor(id);
    return schemeId
      ? `
          <ram:SpecifiedLegalOrganization>
            <ram:ID schemeID="${schemeId}">${String(id ?? '').replace(/\D/g, '')}</ram:ID>
          </ram:SpecifiedLegalOrganization>`
      : '';
  };
  const sellerSiret = legalOrgBlock(facture.emetteurSiret);
  const buyerSiret = legalOrgBlock(facture.destinataireSiret);

  // Acompte déjà facturé (SOLDE uniquement)
  const prepaidXml =
    facture.typeFacture === 'SOLDE' && facture.montantAcompteDejaFacture != null
      ? `
          <ram:TotalPrepaidAmount>${fmtAmt(facture.montantAcompteDejaFacture)}</ram:TotalPrepaidAmount>`
      : '';

  // Référence facture annulée (AVOIR) — BG-3, placée dans ApplicableHeaderTradeSettlement
  // (emplacement valide CII D22B ; pas dans ExchangedDocument).
  const invoiceRefXml =
    facture.typeFacture === 'AVOIR' && facture.factureAnnulee?.numero
      ? `
        <ram:InvoiceReferencedDocument>
          <ram:IssuerAssignedID>${escXml(facture.factureAnnulee.numero)}</ram:IssuerAssignedID>
          <ram:FormattedIssueDateTime>
            <qdt:DateTimeString format="102">${fmtDate(facture.factureAnnulee.dateEmission)}</qdt:DateTimeString>
          </ram:FormattedIssueDateTime>
        </ram:InvoiceReferencedDocument>`
      : '';

  // Adresses structurées (PostCode + City requis EN 16931)
  const adrEmetteur = parseAdresse(facture.emetteurAdresse);
  const adrDestinataire = parseAdresse(facture.destinataireAdresse);

  // BG-16 Moyen de paiement (virement SEPA, TypeCode 58) + IBAN émetteur — BG-17.
  // Conditionnel : certains centres n'ont pas encore renseigné leur IBAN.
  const paymentMeansXml = facture.emetteurIban
    ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escXml(facture.emetteurIban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escXml(facture.numero)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${fmtDate(facture.dateEmission)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
${lignesXml}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${escXml(facture.destinataireSiret ?? 'SANS OBJET')}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${escXml(facture.emetteurNom)}</ram:Name>${sellerSiret}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escXml(adrEmetteur.postCode)}</ram:PostcodeCode>
          <ram:LineOne>${escXml(adrEmetteur.lineOne)}</ram:LineOne>
          <ram:CityName>${escXml(adrEmetteur.city)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${sellerTva}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escXml(facture.destinataireNom)}</ram:Name>${buyerSiret}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escXml(adrDestinataire.postCode)}</ram:PostcodeCode>
          <ram:LineOne>${escXml(adrDestinataire.lineOne)}</ram:LineOne>
          <ram:CityName>${escXml(adrDestinataire.city)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
      <ram:BuyerOrderReferencedDocument>
        <ram:IssuerAssignedID>${escXml(titreSejour)}</ram:IssuerAssignedID>
      </ram:BuyerOrderReferencedDocument>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${paymentMeansXml}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${fmtAmt(facture.montantTVA)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${fmtAmt(facture.montantHT)}</ram:BasisAmount>
        <ram:CategoryCode>${categoryCode(facture.tauxTva)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${facture.tauxTva}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmtAmt(facture.montantHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmtAmt(facture.montantHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmtAmt(facture.montantTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmtAmt(facture.montantTTC)}</ram:GrandTotalAmount>${prepaidXml}
        <ram:DuePayableAmount>${fmtAmt(facture.montantFacture)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${invoiceRefXml}
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// ─── Embedding PDF/A-3 ────────────────────────────────────────────────────

/**
 * Embarque le CII XML + métadonnées XMP PDF/A-3b dans le buffer react-pdf.
 * NON BLOQUANT : en cas d'échec, retourne le buffer PDF original (toujours lisible).
 */
export async function embedFacturX(
  pdfBuffer: Buffer,
  facture: FactureAvecLignes,
  titreSejour: string,
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    const xmlString = buildCiiXml(facture, titreSejour);
    const xmlBytes = Buffer.from(xmlString, 'utf-8');
    const now = new Date();

    // 1) Stream du fichier embarqué (Subtype text/xml encodé en nom PDF : text#2Fxml)
    const embeddedFileStream = pdfDoc.context.stream(xmlBytes, {
      Type: 'EmbeddedFile',
      Subtype: 'text#2Fxml',
      Params: {
        ModDate: PDFString.of(pdfDate(now)),
        Size: xmlBytes.length,
      },
    });
    const embeddedFileRef = pdfDoc.context.register(embeddedFileStream);

    // 2) Filespec (AFRelationship Alternative requis par Factur-X)
    const filespecDict = pdfDoc.context.obj({
      Type: 'Filespec',
      F: PDFString.of('factur-x.xml'),
      UF: PDFString.of('factur-x.xml'),
      EF: { F: embeddedFileRef },
      Desc: PDFString.of('Factur-X EN 16931'),
      AFRelationship: PDFName.of('Alternative'),
    });
    const filespecRef = pdfDoc.context.register(filespecDict);

    // 3) Catalogue → Names/EmbeddedFiles (name tree)
    const catalog = pdfDoc.catalog;
    // lookupMaybe : retourne undefined si la clé est absente (lookup typé lèverait).
    let namesDict = catalog.lookupMaybe(PDFName.of('Names'), PDFDict) as PDFDict | undefined;
    if (!namesDict) {
      namesDict = pdfDoc.context.obj({}) as PDFDict;
      catalog.set(PDFName.of('Names'), namesDict);
    }
    namesDict.set(
      PDFName.of('EmbeddedFiles'),
      pdfDoc.context.obj({
        Names: [PDFString.of('factur-x.xml'), filespecRef],
      }),
    );

    // 4) Tableau AF sur le catalogue (requis Factur-X)
    catalog.set(PDFName.of('AF'), pdfDoc.context.obj([filespecRef]));

    // 5) Métadonnées XMP PDF/A-3b + extension Factur-X
    const xmpMetadata = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escXml(facture.numero)}</rdf:li></rdf:Alt></dc:title>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const xmpBytes = Buffer.from(xmpMetadata, 'utf-8');
    const xmpStream = pdfDoc.context.stream(xmpBytes, {
      Type: 'Metadata',
      Subtype: 'XML',
    });
    const xmpRef = pdfDoc.context.register(xmpStream);
    catalog.set(PDFName.of('Metadata'), xmpRef);

    // useObjectStreams:false → xref/dicts non compressés (AF, Filespec inspectables ;
    // évite les quirks de validateurs PDF/A sur les object streams).
    const resultBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(resultBytes);
  } catch (e) {
    // Non bloquant : on retourne le PDF original (lisible mais non Factur-X)
    console.error('embedFacturX error:', e instanceof Error ? e.stack : String(e));
    return pdfBuffer;
  }
}
