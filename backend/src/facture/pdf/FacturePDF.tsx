import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FacturePDFProps {
  typeFacture: 'ACOMPTE' | 'SOLDE';
  numero: string;
  dateEmission: string; // ISO
  dateEcheance: string; // ISO (= dateEmission + 30 jours)
  emetteurNom: string;
  emetteurAdresse: string | null;
  emetteurSiret: string | null;
  emetteurTva: string | null;
  emetteurEmail: string | null;
  emetteurTel: string | null;
  emetteurIban: string | null;
  destinataireNom: string;
  destinataireAdresse: string | null;
  destinataireSiret: string | null;
  destinataireEmail: string | null;
  titreSejour: string;
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
  montantFacture: number; // montant DÛ sur cette facture
  pourcentageAcompte: number | null;
  montantAcompteDejaFacture: number | null; // SOLDE uniquement
  conditionsAnnulation: string | null;
  tauxTva: number;
  versements?: Array<{
    datePaiement: string; // ISO
    montant: number;
    reference: string | null;
    modePaiement: string | null;
  }>;
}

// Libellés français des modes de règlement (PDF)
const LABEL_MODE: Record<string, string> = {
  VIREMENT: 'Virement',
  CHEQUE: 'Chèque',
  CARTE: 'Carte bancaire',
  ESPECES: 'Espèces',
  CHEQUES_VACANCES: 'Chèques-vacances / ANCV',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtMontant(n: number): string {
  const num = Number(n) || 0;
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${intPart},${parts[1]}`;
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
  docTitle: { fontSize: 22, fontWeight: 'bold', color: PRIMARY, marginBottom: 6 },
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
  totauxAccent: { fontSize: 10, color: ACCENT, fontWeight: 'bold' },
  totauxSolde: { fontSize: 11, fontWeight: 'bold', color: PRIMARY },
  // Règlements reçus
  versBlock: { marginTop: 16 },
  versTitle: { fontSize: 9, fontWeight: 'bold', color: GREY_TEXT, marginBottom: 6 },
  versRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  versDate: { width: '22%', fontSize: 9, color: GREY_TEXT },
  versMode: { width: '33%', fontSize: 9, color: GREY_TEXT },
  versRef: { width: '25%', fontSize: 9, color: '#6B7280' },
  versMontant: { width: '20%', fontSize: 9, color: GREY_TEXT, fontWeight: 'bold', textAlign: 'right' },
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

export default function FacturePDF(props: FacturePDFProps) {
  const {
    typeFacture, numero, dateEmission, dateEcheance,
    emetteurNom, emetteurAdresse, emetteurSiret, emetteurTva, emetteurEmail, emetteurTel, emetteurIban,
    destinataireNom, destinataireAdresse, destinataireSiret, destinataireEmail,
    titreSejour, lignes, montantHT, montantTVA, montantTTC,
    montantFacture, pourcentageAcompte, montantAcompteDejaFacture,
    conditionsAnnulation, versements,
  } = props;

  const titre = typeFacture === 'ACOMPTE' ? "FACTURE D'ACOMPTE" : 'FACTURE DE SOLDE';

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.header}>
          <View style={s.emetteur}>
            <Text style={s.emetteurNom}>{emetteurNom}</Text>
            {emetteurAdresse && <Text style={s.emetteurDetail}>{emetteurAdresse}</Text>}
            {emetteurSiret && <Text style={s.emetteurDetail}>SIRET : {emetteurSiret}</Text>}
            {emetteurTva && <Text style={s.emetteurDetail}>TVA intracommunautaire : {emetteurTva}</Text>}
            {emetteurEmail && <Text style={s.emetteurDetail}>{emetteurEmail}</Text>}
            {emetteurTel && <Text style={s.emetteurDetail}>{emetteurTel}</Text>}
            {emetteurIban && <Text style={s.emetteurDetail}>IBAN : {emetteurIban}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>{titre}</Text>
            <Text style={s.docInfo}>N° {numero}</Text>
            <Text style={s.docInfo}>Date d'émission : {fmtDate(dateEmission)}</Text>
            <Text style={s.docInfo}>Date d'échéance : {fmtDate(dateEcheance)}</Text>
          </View>
        </View>

        {/* Destinataire */}
        <View style={s.destBlock}>
          <Text style={s.destLabel}>Destinataire</Text>
          <Text style={s.destNom}>{destinataireNom}</Text>
          {destinataireAdresse && <Text style={s.destDetail}>{destinataireAdresse}</Text>}
          {destinataireSiret && <Text style={s.destDetail}>SIRET : {destinataireSiret}</Text>}
          {destinataireEmail && <Text style={s.destDetail}>{destinataireEmail}</Text>}
        </View>

        {/* Objet */}
        <View style={s.objetBlock}>
          <Text style={s.objetLabel}>Objet</Text>
          <Text style={s.objetText}>Séjour — {titreSejour}</Text>
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

          {typeFacture === 'ACOMPTE' && (
            <View style={s.totauxRow}>
              <Text style={s.totauxAccent}>
                Acompte{pourcentageAcompte != null ? ` (${pourcentageAcompte} %)` : ''}
              </Text>
              <Text style={s.totauxAccent}>{fmtMontant(montantFacture)} €</Text>
            </View>
          )}

          {typeFacture === 'SOLDE' && (
            <>
              <View style={s.totauxRow}>
                <Text style={s.totauxLabel}>Acompte déjà versé</Text>
                <Text style={s.totauxValue}>{fmtMontant(montantAcompteDejaFacture ?? 0)} €</Text>
              </View>
              <View style={s.totauxRow}>
                <Text style={s.totauxSolde}>Solde à régler</Text>
                <Text style={s.totauxSolde}>{fmtMontant(montantFacture)} €</Text>
              </View>
            </>
          )}
        </View>

        {/* Coordonnées bancaires */}
        {emetteurIban && (
          <View style={s.ibanBlock}>
            <Text style={s.ibanTitle}>Coordonnées bancaires</Text>
            <Text style={s.ibanText}>IBAN : {emetteurIban}</Text>
          </View>
        )}

        {/* Règlements reçus (présents uniquement après versement / régénération) */}
        {versements && versements.length > 0 && (
          <View style={s.versBlock}>
            <Text style={s.versTitle}>Règlements reçus</Text>
            {versements.map((v, i) => (
              <View key={i} style={s.versRow}>
                <Text style={s.versDate}>{fmtDate(v.datePaiement)}</Text>
                <Text style={s.versMode}>{v.modePaiement ? LABEL_MODE[v.modePaiement] ?? v.modePaiement : '—'}</Text>
                <Text style={s.versRef}>{v.reference ?? ''}</Text>
                <Text style={s.versMontant}>{fmtMontant(v.montant)} €</Text>
              </View>
            ))}
          </View>
        )}

        {/* Conditions d'annulation */}
        {conditionsAnnulation && (
          <View style={s.condBlock}>
            <Text style={s.condTitle}>Conditions d'annulation</Text>
            <Text style={s.condText}>{conditionsAnnulation}</Text>
          </View>
        )}

        {/* Mentions légales — toujours affichées */}
        <View style={s.mentionsBlock}>
          <Text style={s.mentionsText}>
            Conformément à l'art. L441-10 du Code de commerce, tout retard de paiement entraîne
            des pénalités au taux de 3 fois le taux d'intérêt légal en vigueur, ainsi qu'une
            indemnité forfaitaire pour frais de recouvrement de 40 €. Escompte pour paiement
            anticipé : néant.
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Document généré par LIAVO — liavo.fr</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
