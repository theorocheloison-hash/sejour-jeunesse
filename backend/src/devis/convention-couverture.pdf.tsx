import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ConventionScolaireData } from './convention-scolaire-sauvageon.pdf.js';

const BLEU = '#1B4060';
const GRIS = '#6B7280';
const NOIR = '#111827';

const styles = StyleSheet.create({
  page: { padding: 45, fontSize: 9, fontFamily: 'Helvetica', color: NOIR, lineHeight: 1.5 },
  header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: BLEU, paddingBottom: 12 },
  titre: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BLEU, marginBottom: 6 },
  enteteCentreNom: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BLEU, marginBottom: 3 },
  enteteCentre: { fontSize: 8.5, color: NOIR, marginBottom: 1 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLEU,
    borderBottomWidth: 1, borderBottomColor: BLEU, paddingBottom: 3, marginBottom: 8, marginTop: 14 },
  partieRow: { flexDirection: 'row', gap: 20, marginTop: 4 },
  partieBox: { flex: 1 },
  partieLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLEU, marginBottom: 3 },
  value: { fontSize: 8.5, color: NOIR, marginBottom: 2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  effectifBox: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    padding: 8, borderRadius: 4, marginBottom: 4, marginTop: 8 },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: BLEU, paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6,
    borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  tableCell: { fontSize: 8, color: NOIR },
  colDesc: { flex: 4 },
  colQte: { flex: 1, textAlign: 'right' },
  colPu: { flex: 1.4, textAlign: 'right' },
  colTva: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1.6, textAlign: 'right' },
  totaux: { marginTop: 8, alignItems: 'flex-end' },
  totalLine: { flexDirection: 'row', width: 220, justifyContent: 'space-between', marginBottom: 2 },
  totalLabel: { fontSize: 8.5, color: GRIS },
  totalValue: { fontSize: 8.5, color: NOIR, fontFamily: 'Helvetica-Bold' },
  acompteBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    padding: 8, borderRadius: 4, marginTop: 10 },
  signatureRow: { flexDirection: 'row', gap: 20, marginTop: 18 },
  signatureBox: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 4, padding: 12, minHeight: 90 },
  signatureTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLEU, marginBottom: 6 },
  signatureValue: { fontSize: 8, color: NOIR, marginBottom: 3 },
  mention: { fontSize: 7.5, color: GRIS, fontStyle: 'italic', marginTop: 6 },
  footer: { position: 'absolute', bottom: 20, left: 45, right: 45,
    borderTopWidth: 0.5, borderTopColor: '#D1D5DB', paddingTop: 6,
    fontSize: 7, color: GRIS, flexDirection: 'row', justifyContent: 'space-between' },
});

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

function ConventionCouvertureDocument({ data }: { data: ConventionScolaireData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.titre}>CONVENTION DE SÉJOUR</Text>
          <Text style={styles.enteteCentreNom}>{data.centreNom}</Text>
          <Text style={styles.enteteCentre}>
            {[data.centreAdresse, [data.centreCodePostal, data.centreVille].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
          </Text>
          <Text style={styles.enteteCentre}>
            {[data.centreTelephone && `Tél : ${data.centreTelephone}`, data.centreEmail].filter(Boolean).join(' · ')}
          </Text>
          {data.centreSiret ? <Text style={styles.enteteCentre}>SIRET : {data.centreSiret}</Text> : null}
        </View>

        {/* Entre les parties */}
        <Text style={styles.sectionTitle}>ENTRE LES PARTIES</Text>
        <View style={styles.partieRow}>
          <View style={styles.partieBox}>
            <Text style={styles.partieLabel}>Le centre d'hébergement</Text>
            <Text style={styles.value}><Text style={styles.bold}>{data.centreNom}</Text></Text>
            {data.centreSiret ? <Text style={styles.value}>SIRET : {data.centreSiret}</Text> : null}
            <Text style={styles.value}>Représenté par : {data.centreRepresentant}</Text>
          </View>
          <View style={styles.partieBox}>
            <Text style={styles.partieLabel}>L'établissement / le client</Text>
            <Text style={styles.value}><Text style={styles.bold}>{data.etablissementNom}</Text></Text>
            {data.etablissementAdresse ? <Text style={styles.value}>{data.etablissementAdresse}</Text> : null}
            <Text style={styles.value}>Contact : {data.contactNom}</Text>
            {data.contactEmail ? <Text style={styles.value}>{data.contactEmail}</Text> : null}
          </View>
        </View>

        {/* Objet */}
        <Text style={styles.sectionTitle}>OBJET</Text>
        <Text style={styles.value}>Séjour : <Text style={styles.bold}>{data.sejourTitre}</Text></Text>
        <Text style={styles.value}>Du <Text style={styles.bold}>{data.dateDebut}</Text> au <Text style={styles.bold}>{data.dateFin}</Text></Text>
        <View style={styles.effectifBox}>
          <Text style={styles.value}>
            Effectif : <Text style={styles.bold}>{data.effectifEleves} élève{data.effectifEleves > 1 ? 's' : ''}</Text>
            {' '}+ <Text style={styles.bold}>{data.effectifEncadrants} encadrant{data.effectifEncadrants > 1 ? 's' : ''}</Text>
          </Text>
        </View>

        {/* Conditions financières */}
        <Text style={styles.sectionTitle}>CONDITIONS FINANCIÈRES</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Désignation</Text>
            <Text style={[styles.tableHeaderCell, styles.colQte]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, styles.colPu]}>PU TTC</Text>
            <Text style={[styles.tableHeaderCell, styles.colTva]}>TVA</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total TTC</Text>
          </View>
          {data.lignes.map((l, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, styles.colDesc]}>{l.description}</Text>
              <Text style={[styles.tableCell, styles.colQte]}>{l.quantite}</Text>
              <Text style={[styles.tableCell, styles.colPu]}>{fmt(l.prixUnitaire)} €</Text>
              <Text style={[styles.tableCell, styles.colTva]}>{l.tva} %</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>{fmt(l.totalTTC)} €</Text>
            </View>
          ))}
        </View>
        <View style={styles.totaux}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmt(data.montantHT)} €</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>TVA</Text>
            <Text style={styles.totalValue}>{fmt(data.montantTVA)} €</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total TTC</Text>
            <Text style={styles.totalValue}>{fmt(data.montantTTC)} €</Text>
          </View>
        </View>
        <View style={styles.acompteBox}>
          <Text style={styles.value}>
            Acompte : <Text style={styles.bold}>{data.pourcentageAcompte} %</Text> soit <Text style={styles.bold}>{fmt(data.montantAcompte)} €</Text>
            {data.numeroDevis ? <Text> · Devis n° {data.numeroDevis}</Text> : null}
          </Text>
        </View>

        {/* Signatures */}
        <Text style={styles.sectionTitle}>SIGNATURES</Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Le centre</Text>
            <Text style={styles.signatureValue}>{data.centreNom}</Text>
            <Text style={styles.signatureValue}>{data.centreRepresentant}</Text>
            <Text style={styles.mention}>Lu et approuvé</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>L'établissement</Text>
            <Text style={styles.signatureValue}>{data.etablissementNom}</Text>
            <Text style={styles.signatureValue}>{data.contactNom}</Text>
            <Text style={styles.mention}>Lu et approuvé</Text>
          </View>
        </View>
        <Text style={styles.value}>Fait le {data.dateDocument}</Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Document généré par LIAVO (liavo.fr)</Text>
          <Text>{data.sejourTitre}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateConventionCouverturePdf(data: ConventionScolaireData): Promise<Buffer> {
  return renderToBuffer(<ConventionCouvertureDocument data={data} />);
}
