import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DevisPDFProps {
  typeDocument: 'DEVIS' | 'FACTURE_ACOMPTE' | 'FACTURE_SOLDE';
  numeroDocument: string;
  dateDocument: string;
  dateValidite?: string;
  nomEmetteur: string;
  adresseEmetteur: string;
  siretEmetteur?: string;
  emailEmetteur?: string;
  telEmetteur?: string;
  tvaEmetteur?: string;
  ibanEmetteur?: string;
  nomDestinataire: string;
  etablissementNom?: string;
  adresseDestinataire?: string;
  emailDestinataire?: string;
  telDestinataire?: string;
  titreSejour: string;
  lieuSejour?: string;
  dateDebutSejour?: string;
  dateFinSejour?: string;
  nombreEleves?: number;
  niveauClasse?: string;
  lignes: Array<{
    description: string;
    quantite: number;
    prixUnitaire: number;
    tva: number;
    totalHT: number;
    totalTTC: number;
  }>;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  montantAcompte?: number;
  pourcentageAcompte?: number;
  montantSolde?: number;
  conditionsAnnulation?: string;
  validationDirection?: {
    nomDirecteur: string;
    dateValidation: string;
    etablissement: string;
  };
  signatureDirecteur?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtMontant(n: number): string {
  const num = Number(n) || 0;
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${intPart},${parts[1]}`;
}

function titreDocument(type: DevisPDFProps['typeDocument']): string {
  switch (type) {
    case 'DEVIS': return 'DEVIS';
    case 'FACTURE_ACOMPTE': return "FACTURE D'ACOMPTE";
    case 'FACTURE_SOLDE': return 'FACTURE';
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const PRIMARY = '#1B4060';
const ACCENT = '#C87D2E';
const GREY_TEXT = '#374151';
const GREY_LIGHT = '#F3F4F6';
const GREY_ROW = '#F9FAFB';
const BORDER = '#E5E7EB';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: GREY_TEXT },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  emetteur: { maxWidth: '55%' },
  emetteurNom: { fontSize: 16, fontWeight: 'bold', color: PRIMARY, marginBottom: 4 },
  emetteurDetail: { fontSize: 9, color: '#6B7280', lineHeight: 1.5 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: { fontSize: 24, fontWeight: 'bold', color: PRIMARY, marginBottom: 6 },
  docInfo: { fontSize: 9, color: '#6B7280', textAlign: 'right', lineHeight: 1.5 },
  // Destinataire
  destBlock: { backgroundColor: GREY_LIGHT, padding: 12, borderRadius: 4, marginBottom: 16 },
  destLabel: { fontSize: 8, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  destNom: { fontSize: 11, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  destDetail: { fontSize: 9, color: '#6B7280', lineHeight: 1.5 },
  // Objet
  objetBlock: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  objetLabel: { fontSize: 8, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  objetText: { fontSize: 10, fontWeight: 'bold', color: '#111827' },
  objetSub: { fontSize: 9, color: '#6B7280', marginTop: 2 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: PRIMARY, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 2 },
  tableHeaderCell: { fontSize: 8, fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: GREY_ROW },
  cellDesc: { width: '40%' },
  cellQte: { width: '12%', textAlign: 'right' },
  cellPU: { width: '18%', textAlign: 'right' },
  cellTVA: { width: '12%', textAlign: 'right' },
  cellTotal: { width: '18%', textAlign: 'right' },
  cellText: { fontSize: 9, color: GREY_TEXT },
  // Totaux
  totauxBlock: { marginTop: 12, alignItems: 'flex-end' },
  totauxRow: { flexDirection: 'row', justifyContent: 'space-between', width: 220, paddingVertical: 3 },
  totauxLabel: { fontSize: 9, color: '#6B7280' },
  totauxValue: { fontSize: 9, color: GREY_TEXT, fontWeight: 'bold' },
  totauxTTC: { flexDirection: 'row', justifyContent: 'space-between', width: 220, paddingVertical: 6, borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4 },
  totauxTTCLabel: { fontSize: 11, fontWeight: 'bold', color: '#111827' },
  totauxTTCValue: { fontSize: 11, fontWeight: 'bold', color: PRIMARY },
  totauxAccent: { fontSize: 9, color: ACCENT, fontWeight: 'bold' },
  // Validation
  validBlock: { marginTop: 20, padding: 12, borderWidth: 1, borderColor: ACCENT, borderRadius: 4 },
  validTitle: { fontSize: 9, fontWeight: 'bold', color: ACCENT, marginBottom: 4 },
  validText: { fontSize: 8, color: GREY_TEXT, lineHeight: 1.5 },
  // Conditions
  condBlock: { marginTop: 16 },
  condTitle: { fontSize: 9, fontWeight: 'bold', color: GREY_TEXT, marginBottom: 4 },
  condText: { fontSize: 8, color: '#6B7280', lineHeight: 1.5 },
  // IBAN
  ibanBlock: { marginTop: 16, padding: 10, backgroundColor: '#F0F4F8', borderRadius: 4 },
  ibanTitle: { fontSize: 9, fontWeight: 'bold', color: PRIMARY, marginBottom: 4 },
  ibanText: { fontSize: 9, color: GREY_TEXT },
  // Mentions légales
  mentionsBlock: { marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
  mentionsText: { fontSize: 7, color: '#9CA3AF', lineHeight: 1.4 },
  // Footer
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8 },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function DevisPDF(props: DevisPDFProps) {
  const {
    typeDocument, numeroDocument, dateDocument, dateValidite,
    nomEmetteur, adresseEmetteur, siretEmetteur, emailEmetteur, telEmetteur, tvaEmetteur, ibanEmetteur,
    nomDestinataire, etablissementNom, adresseDestinataire, emailDestinataire, telDestinataire,
    titreSejour, lieuSejour, dateDebutSejour, dateFinSejour, nombreEleves, niveauClasse,
    lignes, montantHT, montantTVA, montantTTC,
    montantAcompte, pourcentageAcompte, montantSolde,
    conditionsAnnulation, validationDirection,
  } = props;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.header}>
          <View style={s.emetteur}>
            <Text style={s.emetteurNom}>{nomEmetteur}</Text>
            <Text style={s.emetteurDetail}>{adresseEmetteur}</Text>
            {siretEmetteur && <Text style={s.emetteurDetail}>SIRET : {siretEmetteur}</Text>}
            {tvaEmetteur && <Text style={s.emetteurDetail}>TVA : {tvaEmetteur}</Text>}
            {emailEmetteur && <Text style={s.emetteurDetail}>{emailEmetteur}</Text>}
            {telEmetteur && <Text style={s.emetteurDetail}>{telEmetteur}</Text>}
            {ibanEmetteur && <Text style={s.emetteurDetail}>IBAN : {ibanEmetteur}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>{titreDocument(typeDocument)}</Text>
            <Text style={s.docInfo}>N° {numeroDocument}</Text>
            <Text style={s.docInfo}>Date : {fmtDate(dateDocument)}</Text>
            {typeDocument === 'DEVIS' && dateValidite && (
              <Text style={s.docInfo}>Valide jusqu'au : {fmtDate(dateValidite)}</Text>
            )}
            {(typeDocument === 'FACTURE_ACOMPTE' || typeDocument === 'FACTURE_SOLDE') && dateValidite && (
              <Text style={s.docInfo}>Échéance : {fmtDate(dateValidite)}</Text>
            )}
          </View>
        </View>

        {/* Destinataire */}
        <View style={s.destBlock}>
          <Text style={s.destLabel}>Destinataire</Text>
          <Text style={s.destNom}>{nomDestinataire}</Text>
          {etablissementNom && <Text style={s.destDetail}>{etablissementNom}</Text>}
          {adresseDestinataire && <Text style={s.destDetail}>{adresseDestinataire}</Text>}
          {emailDestinataire && <Text style={s.destDetail}>{emailDestinataire}</Text>}
          {telDestinataire && <Text style={s.destDetail}>{telDestinataire}</Text>}
        </View>

        {/* Objet */}
        <View style={s.objetBlock}>
          <Text style={s.objetLabel}>Objet</Text>
          <Text style={s.objetText}>
            Séjour scolaire — {lieuSejour ?? ''} — du {fmtDate(dateDebutSejour)} au {fmtDate(dateFinSejour)}
          </Text>
          <Text style={s.objetSub}>
            {nombreEleves ? `${nombreEleves} élève${nombreEleves > 1 ? 's' : ''}` : ''}
            {niveauClasse ? ` — ${niveauClasse}` : ''}
          </Text>
        </View>

        {/* Tableau */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.cellDesc]}>Désignation</Text>
          <Text style={[s.tableHeaderCell, s.cellQte]}>Qté</Text>
          <Text style={[s.tableHeaderCell, s.cellPU]}>PU HT</Text>
          <Text style={[s.tableHeaderCell, s.cellTVA]}>TVA %</Text>
          <Text style={[s.tableHeaderCell, s.cellTotal]}>Total HT</Text>
        </View>
        {lignes.map((l, i) => (
          <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.cellText, s.cellDesc]}>{l.description}</Text>
            <Text style={[s.cellText, s.cellQte]}>{l.quantite}</Text>
            <Text style={[s.cellText, s.cellPU]}>{fmtMontant(l.prixUnitaire)} €</Text>
            <Text style={[s.cellText, s.cellTVA]}>{l.tva} %</Text>
            <Text style={[s.cellText, s.cellTotal]}>{fmtMontant(l.totalHT)} €</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={s.totauxBlock}>
          <View style={s.totauxRow}>
            <Text style={s.totauxLabel}>Total HT</Text>
            <Text style={s.totauxValue}>{fmtMontant(montantHT)} €</Text>
          </View>
          <View style={s.totauxRow}>
            <Text style={s.totauxLabel}>TVA</Text>
            <Text style={s.totauxValue}>{fmtMontant(montantTVA)} €</Text>
          </View>
          <View style={s.totauxTTC}>
            <Text style={s.totauxTTCLabel}>Total TTC</Text>
            <Text style={s.totauxTTCValue}>{fmtMontant(montantTTC)} €</Text>
          </View>
          {typeDocument === 'FACTURE_ACOMPTE' && montantAcompte != null && pourcentageAcompte != null && (
            <View style={s.totauxRow}>
              <Text style={s.totauxAccent}>Acompte ({pourcentageAcompte} %)</Text>
              <Text style={s.totauxAccent}>{fmtMontant(montantAcompte)} €</Text>
            </View>
          )}
          {typeDocument === 'FACTURE_SOLDE' && montantAcompte != null && montantSolde != null && (
            <>
              <View style={s.totauxRow}>
                <Text style={s.totauxLabel}>Acompte déjà versé</Text>
                <Text style={s.totauxValue}>{fmtMontant(montantAcompte)} €</Text>
              </View>
              <View style={s.totauxRow}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: PRIMARY }}>Solde à régler</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: PRIMARY }}>{fmtMontant(montantSolde)} €</Text>
              </View>
            </>
          )}
        </View>

        {/* Coordonnées bancaires */}
        {ibanEmetteur && (
          <View style={s.ibanBlock}>
            <Text style={s.ibanTitle}>Coordonnées bancaires</Text>
            <Text style={s.ibanText}>IBAN : {ibanEmetteur}</Text>
          </View>
        )}

        {/* Validation direction */}
        {props.signatureDirecteur && (
          <View style={s.validBlock}>
            <Text style={s.validTitle}>Signé électroniquement par la direction</Text>
            <Text style={s.validText}>{props.signatureDirecteur}</Text>
          </View>
        )}
        {!props.signatureDirecteur && validationDirection && (
          <View style={s.validBlock}>
            <Text style={s.validTitle}>Approuvé par la direction</Text>
            <Text style={s.validText}>{validationDirection.nomDirecteur}</Text>
            <Text style={s.validText}>{validationDirection.etablissement}</Text>
            <Text style={s.validText}>Le {fmtDate(validationDirection.dateValidation)}</Text>
          </View>
        )}

        {/* Conditions */}
        {conditionsAnnulation && (
          <View style={s.condBlock}>
            <Text style={s.condTitle}>Conditions d'annulation</Text>
            <Text style={s.condText}>{conditionsAnnulation}</Text>
          </View>
        )}

        {/* Mentions légales factures */}
        {(typeDocument === 'FACTURE_ACOMPTE' || typeDocument === 'FACTURE_SOLDE') && (
          <View style={s.mentionsBlock}>
            <Text style={s.mentionsText}>
              Paiement à réception de facture. Tout retard de paiement entraîne des pénalités au taux légal en vigueur. Indemnité forfaitaire pour frais de recouvrement : 40 euros (art. L441-10 du Code de commerce).
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Document généré par LIAVO — liavo.fr</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
