import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { DossierPedagogiqueData } from '@/src/lib/sejour';

const PRIMARY = '#1B4060';
const GREY = '#374151';
const BORDER = '#E5E7EB';
const GREY_LIGHT = '#F9FAFB';
const AMBER = '#d97706';
const DANGER = '#dc2626';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: GREY },
  header: { borderBottomWidth: 2, borderBottomColor: PRIMARY, paddingBottom: 12, marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 1 },
  headerSub: { fontSize: 10, color: '#6B7280', marginTop: 4 },
  headerMeta: { fontSize: 8, color: '#9CA3AF', marginTop: 2 },
  headerNote: { fontSize: 8, color: PRIMARY, marginTop: 6, fontWeight: 'bold' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: PRIMARY, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  grid2: { flexDirection: 'row', gap: 16 },
  gridItem: { flex: 1 },
  label: { fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 9, color: GREY, fontWeight: 'bold' },
  valueLight: { fontSize: 9, color: GREY },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: PRIMARY, paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell: { fontSize: 7, fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: GREY_LIGHT },
  cell: { fontSize: 8, color: GREY },
  note: { fontSize: 7, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  paragraph: { fontSize: 9, color: GREY, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function fmtDate(iso: string): string {
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDateObj(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export interface PreparationTamPDFProps {
  data: DossierPedagogiqueData;
}

export default function PreparationTamPDF({ data }: PreparationTamPDFProps) {
  const debut = new Date(data.dateDebut.includes('T') ? data.dateDebut : data.dateDebut + 'T12:00:00');
  const fiLimit = new Date(debut); fiLimit.setDate(fiLimit.getDate() - 60); // J-60
  const fcLimit = new Date(debut); fcLimit.setDate(fcLimit.getDate() - 8);  // J-8
  const now = new Date();
  const fiDepasse = fiLimit.getTime() < now.getTime();

  const orga = data.createur?.memberships?.[0]?.organisation ?? null;
  const trancheAge =
    data.ageMin != null && data.ageMax != null ? `De ${data.ageMin} à ${data.ageMax} ans`
    : data.ageMin != null ? `À partir de ${data.ageMin} ans`
    : data.ageMax != null ? `Jusqu'à ${data.ageMax} ans`
    : '—';

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Préparation à la déclaration TAM</Text>
          <Text style={s.headerSub}>{data.titre}</Text>
          <Text style={s.headerMeta}>
            {data.lieu} — Du {fmtDate(data.dateDebut)} au {fmtDate(data.dateFin)} — {data.placesTotales} participants
          </Text>
          <Text style={s.headerNote}>
            Document de préparation — à saisir sur https://tam.extranet.jeunesse-sports.gouv.fr
          </Text>
        </View>

        {/* SECTION 1 — Organisateur */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>1 — Organisateur</Text>
          <View style={s.grid2}>
            <View style={s.gridItem}>
              <Text style={s.label}>Responsable</Text>
              <Text style={s.value}>{data.createur ? `${data.createur.prenom} ${data.createur.nom}` : '—'}</Text>
              {data.createur?.email && <Text style={s.valueLight}>{data.createur.email}</Text>}
              {data.createur?.telephone && <Text style={s.valueLight}>{data.createur.telephone}</Text>}
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Organisation</Text>
              <Text style={s.value}>{orga?.nom ?? '—'}</Text>
              {orga?.ville && <Text style={s.valueLight}>{orga.ville}</Text>}
              {orga?.uai && <Text style={s.valueLight}>UAI : {orga.uai}</Text>}
            </View>
          </View>
        </View>

        {/* SECTION 2 — Accueil */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>2 — Accueil</Text>
          <View style={s.grid2}>
            <View style={s.gridItem}>
              <Text style={s.label}>Type d'accueil ACM</Text>
              <Text style={s.value}>{data.typeAccueilACM ?? '—'}</Text>
              <Text style={[s.label, { marginTop: 6 }]}>Dates</Text>
              <Text style={s.valueLight}>Du {fmtDate(data.dateDebut)} au {fmtDate(data.dateFin)}</Text>
              <Text style={[s.label, { marginTop: 6 }]}>Lieu</Text>
              <Text style={s.valueLight}>{data.lieu}</Text>
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Effectif total</Text>
              <Text style={s.value}>{data.placesTotales} mineurs</Text>
              <Text style={[s.label, { marginTop: 6 }]}>Tranches d'âge</Text>
              <Text style={s.valueLight}>{trancheAge}</Text>
              <Text style={s.valueLight}>Présence de moins de 6 ans : {data.moinsde6ans ? 'Oui' : 'Non'}</Text>
            </View>
          </View>
          {data.hebergementSelectionne && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.label}>Hébergement</Text>
              <Text style={s.value}>{data.hebergementSelectionne.nom}</Text>
              <Text style={s.valueLight}>
                {data.hebergementSelectionne.adresse}{data.hebergementSelectionne.ville ? `, ${data.hebergementSelectionne.ville}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* SECTION 3 — Équipe d'encadrement */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>3 — Équipe d'encadrement ({data.accompagnateurs.length})</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { width: '18%' }]}>Nom</Text>
            <Text style={[s.tableHeaderCell, { width: '16%' }]}>Prénom</Text>
            <Text style={[s.tableHeaderCell, { width: '24%' }]}>Email</Text>
            <Text style={[s.tableHeaderCell, { width: '15%' }]}>Téléphone</Text>
            <Text style={[s.tableHeaderCell, { width: '12%' }]}>Diplôme</Text>
            <Text style={[s.tableHeaderCell, { width: '15%' }]}>Précision</Text>
          </View>
          {data.accompagnateurs.length > 0 ? data.accompagnateurs.map((a, i) => (
            <View key={a.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.cell, { width: '18%' }]}>{a.nom}</Text>
              <Text style={[s.cell, { width: '16%' }]}>{a.prenom}</Text>
              <Text style={[s.cell, { width: '24%' }]}>{a.email}</Text>
              <Text style={[s.cell, { width: '15%' }]}>{a.telephone ?? '—'}</Text>
              <Text style={[s.cell, { width: '12%' }]}>{a.diplome ?? '—'}</Text>
              <Text style={[s.cell, { width: '15%' }]}>{a.qualificationAutre ?? '—'}</Text>
            </View>
          )) : (
            <Text style={[s.valueLight, { marginTop: 4 }]}>Aucun encadrant renseigné.</Text>
          )}
          <Text style={s.note}>
            La vérification d'honorabilité (casier judiciaire B2) est effectuée automatiquement par TAM à la saisie des intervenants.
          </Text>
        </View>

        {/* SECTION 4 — Projet éducatif */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>4 — Projet éducatif</Text>
          <Text style={s.paragraph}>{data.projetEducatif ?? 'Non renseigné'}</Text>
          <Text style={s.note}>Le projet éducatif est obligatoire pour la demande d'accès TAM (FI).</Text>
        </View>

        {/* SECTION 5 — Checklist délais TAM */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>5 — Checklist des délais TAM</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { width: '32%' }]}>Étape</Text>
            <Text style={[s.tableHeaderCell, { width: '34%' }]}>Délai réglementaire</Text>
            <Text style={[s.tableHeaderCell, { width: '34%' }]}>Statut</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.cell, { width: '32%', fontWeight: 'bold' }]}>Fiche Initiale (FI)</Text>
            <Text style={[s.cell, { width: '34%' }]}>2 mois avant le début (J-60)</Text>
            <Text style={[s.cell, { width: '34%', color: fiDepasse ? DANGER : AMBER, fontWeight: 'bold' }]}>
              {fiDepasse ? '⚠ Délai dépassé' : `À faire avant le ${fmtDateObj(fiLimit)}`}
            </Text>
          </View>
          <View style={s.tableRowAlt}>
            <Text style={[s.cell, { width: '32%', fontWeight: 'bold' }]}>Fiche Complémentaire (FC)</Text>
            <Text style={[s.cell, { width: '34%' }]}>8 jours avant le début (J-8)</Text>
            <Text style={[s.cell, { width: '34%', color: AMBER, fontWeight: 'bold' }]}>
              À faire avant le {fmtDateObj(fcLimit)}
            </Text>
          </View>
          <Text style={s.note}>La FI est valable 3 ans (triennalisation possible).</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Généré par LIAVO — liavo.fr — Document de préparation uniquement, la déclaration officielle s'effectue sur tam.extranet.jeunesse-sports.gouv.fr
          </Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
