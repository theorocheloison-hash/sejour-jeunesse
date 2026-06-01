'use client';

import { useState } from 'react';
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

function PreparationTamPDF({ data }: { data: DossierPedagogiqueData }) {
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

interface PreparationTamPDFProps {
  data: DossierPedagogiqueData;
  sejourId: string;
}

export default function PreparationTamPDFButton({ data, sejourId }: PreparationTamPDFProps) {
  const [generating, setGenerating] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const filename = `preparation-tam-${sejourId}.pdf`;

  const generate = async (): Promise<string> => {
    if (blobUrl) return blobUrl;
    const { pdf } = await import('@react-pdf/renderer');
    const blob = await pdf(<PreparationTamPDF data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return url;
  };

  const handlePreview = async () => {
    setGenerating(true);
    try { window.open(await generate(), '_blank'); }
    catch (err) { console.error(err); }
    finally { setGenerating(false); }
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const url = await generate();
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
    }
    catch (err) { console.error(err); }
    finally { setGenerating(false); }
  };

  if (generating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        Génération PDF...
      </span>
    );
  }

  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
      <button onClick={handlePreview} title="Afficher le PDF de préparation TAM" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-300">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Voir PDF
      </button>
      <button onClick={handleDownload} title="Préparer la déclaration TAM" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Préparer la déclaration TAM
      </button>
    </div>
  );
}
