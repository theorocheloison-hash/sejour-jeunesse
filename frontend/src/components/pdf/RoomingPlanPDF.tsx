import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { RoomingData } from '@/src/lib/collaboration';
import { groupByEtage } from '@/src/lib/rooming';

// Feuille d'accueil « qui dort où » (D13) — plan PUR : noms + chambres
// uniquement, jamais signee/email/donnée médicale. Document unique de vérité,
// importé par RoomingPlanPDFButton (pas de copie interne — anti-pattern
// PlanningPDFButton à ne pas reproduire).

const PRIMARY = '#1B4060';
const GREY = '#374151';
const BORDER = '#E5E7EB';

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: GREY },
  title: { fontSize: 14, fontWeight: 'bold', color: PRIMARY, marginBottom: 3 },
  subtitle: { fontSize: 9, color: '#6B7280', marginBottom: 12 },
  etageHeader: { fontSize: 10, fontWeight: 'bold', color: PRIMARY, marginTop: 10, marginBottom: 4 },
  chambre: { borderWidth: 0.5, borderColor: BORDER, borderStyle: 'solid', padding: 6, marginBottom: 6 },
  chambreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  chambreNom: { fontSize: 9, fontWeight: 'bold', color: GREY },
  chambreMeta: { fontSize: 8, color: '#6B7280' },
  occupant: { fontSize: 8, color: GREY, marginBottom: 1 },
  vide: { fontSize: 8, color: '#9CA3AF' },
  nonAffectes: { marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
  nonAffectesTitre: { fontSize: 9, fontWeight: 'bold', color: PRIMARY, marginBottom: 3 },
  nonAffectesNoms: { fontSize: 8, color: GREY, marginBottom: 6 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 4 },
  footerText: { fontSize: 7, color: '#9CA3AF', textAlign: 'center' },
});

function fmtDate(iso: string): string {
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export interface RoomingPlanPDFProps {
  titreSejour: string;
  dateDebut: string | null;
  dateFin: string | null;
  centreName?: string;
  rooming: RoomingData;
}

export default function RoomingPlanPDF(props: RoomingPlanPDFProps) {
  const groupes = groupByEtage(props.rooming.chambres);
  const { eleves, encadrants } = props.rooming.nonAffectes;
  const plage =
    props.dateDebut && props.dateFin
      ? `du ${fmtDate(props.dateDebut)} au ${fmtDate(props.dateFin)}`
      : null;
  const sousTitre = [props.centreName, plage].filter(Boolean).join(' · ');

  return (
    <Document>
      {/* Page unique : @react-pdf pagine seul au débordement — l'en-tête
          (non-fixed) ne sort que page 1, le footer fixed se répète. */}
      <Page size="A4" orientation="portrait" style={s.page}>
        <Text style={s.title}>Plan des chambres — {props.titreSejour}</Text>
        {sousTitre ? <Text style={s.subtitle}>{sousTitre}</Text> : null}

        {groupes.map((g, i) => (
          <View key={g.etage ?? `sans-etage-${i}`}>
            {/* Règle border #5 : étage null seul → pas d'en-tête ; mixte → « Autres » */}
            {(g.etage !== null || groupes.length > 1) && (
              <Text style={s.etageHeader}>{g.etage ?? 'Autres'}</Text>
            )}
            {g.chambres.map((c) => (
              <View key={c.occupationId} style={s.chambre} wrap={false}>
                <View style={s.chambreHeader}>
                  <Text style={s.chambreNom}>{c.nom}</Text>
                  <Text style={s.chambreMeta}>
                    ({c.occupants.length}/{c.capacite})
                    {c.etiquette ? ` — ${c.etiquette}` : ''}
                  </Text>
                </View>
                {c.occupants.length === 0 ? (
                  <Text style={s.vide}>— aucun participant réparti</Text>
                ) : (
                  c.occupants.map((o) => (
                    <Text key={o.affectationId} style={s.occupant}>
                      {o.prenom} {o.nom}
                      {o.type === 'ENCADRANT' ? ' (encadrant)' : ''}
                    </Text>
                  ))
                )}
              </View>
            ))}
          </View>
        ))}

        {(eleves.length > 0 || encadrants.length > 0) && (
          <View style={s.nonAffectes}>
            {eleves.length > 0 && (
              <>
                <Text style={s.nonAffectesTitre}>Élèves non affectés ({eleves.length})</Text>
                <Text style={s.nonAffectesNoms}>
                  {eleves.map((p) => `${p.prenom} ${p.nom}`).join(', ')}
                </Text>
              </>
            )}
            {encadrants.length > 0 && (
              <>
                <Text style={s.nonAffectesTitre}>
                  Encadrants non affectés ({encadrants.length})
                </Text>
                <Text style={s.nonAffectesNoms}>
                  {encadrants.map((p) => `${p.prenom} ${p.nom}`).join(', ')}
                </Text>
              </>
            )}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Plan des chambres — LIAVO — liavo.fr — {new Date().toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
