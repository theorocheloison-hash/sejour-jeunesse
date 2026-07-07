import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const PRIMARY = '#1B4060';
const GREY = '#374151';
const BORDER = '#E5E7EB';
const GREY_LIGHT = '#F9FAFB';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: GREY },
  title: { fontSize: 16, fontWeight: 'bold', color: PRIMARY, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#6B7280', marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: PRIMARY, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableHeader: { flexDirection: 'row', backgroundColor: PRIMARY, paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell: { fontSize: 8, fontWeight: 'bold', color: '#FFFFFF' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: GREY_LIGHT },
  cell: { fontSize: 8, color: GREY },
  totalRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: '#EFF6FF', borderTopWidth: 1, borderTopColor: PRIMARY },
  totalCell: { fontSize: 9, fontWeight: 'bold', color: PRIMARY },
  soldePositif: { fontSize: 12, fontWeight: 'bold', color: '#16a34a' },
  soldeNegatif: { fontSize: 12, fontWeight: 'bold', color: '#dc2626' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6 },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

export interface BudgetPDFProps {
  titreSejour: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  enseignantNom?: string;
  etablissementNom?: string;
  lignesHebergeur: Array<{ description: string; quantite: number; prixUnitaire: number; tva: number; totalTTC: number }>;
  totalHebergeur: number;
  lignesCompl: Array<{ categorie: string; description: string; montant: number }>;
  totalCompl: number;
  recettes: Array<{ source: string; montant: number }>;
  totalRecettes: number;
  totalDepenses: number;
  solde: number;
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(iso: string): string {
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function BudgetPDF(props: BudgetPDFProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Budget prévisionnel</Text>
        <Text style={s.subtitle}>
          {props.titreSejour} — {fmtDate(props.dateDebut)} au {fmtDate(props.dateFin)} — {props.nombreEleves} participants
          {props.etablissementNom ? `\n${props.etablissementNom}` : ''}
          {props.enseignantNom ? ` — ${props.enseignantNom}` : ''}
        </Text>

        {props.lignesHebergeur.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Prestations hébergeur</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: '50%' }]}>Description</Text>
              <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>Qté</Text>
              <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>PU HT</Text>
              <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Total TTC</Text>
            </View>
            {props.lignesHebergeur.map((l, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.cell, { width: '50%' }]}>{l.description}</Text>
                <Text style={[s.cell, { width: '10%', textAlign: 'right' }]}>{l.quantite}</Text>
                <Text style={[s.cell, { width: '20%', textAlign: 'right' }]}>{l.prixUnitaire.toFixed(2)} €</Text>
                <Text style={[s.cell, { width: '20%', textAlign: 'right' }]}>{fmt(l.totalTTC)}</Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={[s.totalCell, { flex: 1 }]}>Total hébergeur</Text>
              <Text style={[s.totalCell, { textAlign: 'right' }]}>{fmt(props.totalHebergeur)}</Text>
            </View>
          </View>
        )}

        {props.lignesCompl.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Dépenses complémentaires</Text>
            {props.lignesCompl.map((l, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.cell, { width: '30%' }]}>{l.categorie}</Text>
                <Text style={[s.cell, { width: '50%' }]}>{l.description}</Text>
                <Text style={[s.cell, { width: '20%', textAlign: 'right' }]}>{fmt(l.montant)}</Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={[s.totalCell, { flex: 1 }]}>Total complémentaires</Text>
              <Text style={[s.totalCell, { textAlign: 'right' }]}>{fmt(props.totalCompl)}</Text>
            </View>
          </View>
        )}

        {props.recettes.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recettes</Text>
            {props.recettes.map((r, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.cell, { flex: 1 }]}>{r.source}</Text>
                <Text style={[s.cell, { width: '25%', textAlign: 'right' }]}>{fmt(r.montant)}</Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={[s.totalCell, { flex: 1 }]}>Total recettes</Text>
              <Text style={[s.totalCell, { textAlign: 'right' }]}>{fmt(props.totalRecettes)}</Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: 16, padding: 12, backgroundColor: '#F0F4F8', borderRadius: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 9, color: GREY }}>Total dépenses</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: GREY }}>{fmt(props.totalDepenses)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 9, color: GREY }}>Total recettes</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: GREY }}>{fmt(props.totalRecettes)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: GREY }}>Solde</Text>
            <Text style={props.solde >= 0 ? s.soldePositif : s.soldeNegatif}>
              {props.solde >= 0 ? '+' : ''}{fmt(props.solde)}
            </Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Budget prévisionnel généré par LIAVO — liavo.fr — {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>
      </Page>
    </Document>
  );
}
