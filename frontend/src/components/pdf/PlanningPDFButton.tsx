'use client';

import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const PRIMARY = '#1B4060';
const GREY = '#374151';
const BORDER = '#E5E7EB';

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: 'Helvetica', color: GREY },
  title: { fontSize: 14, fontWeight: 'bold', color: PRIMARY, marginBottom: 3 },
  subtitle: { fontSize: 9, color: '#6B7280', marginBottom: 12 },
  table: { borderWidth: 0.5, borderColor: BORDER, borderStyle: 'solid' },
  headerRow: { flexDirection: 'row', backgroundColor: PRIMARY },
  headerCell: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  headerLabel: { fontSize: 7, color: '#FFFFFF', textAlign: 'center' },
  headerDate: { fontSize: 9, color: '#FFFFFF', fontWeight: 'bold', textAlign: 'center' },
  bodyRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: BORDER, minHeight: 70 },
  cell: { padding: 3, borderRightWidth: 0.5, borderRightColor: BORDER },
  slotLabelCell: { padding: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.5, borderRightColor: BORDER },
  slotLabel: { fontSize: 7, fontWeight: 'bold', color: PRIMARY, textAlign: 'center' },
  activityBlock: { padding: 3, marginBottom: 2 },
  activityTitle: { fontSize: 7, fontWeight: 'bold', color: GREY, marginBottom: 1 },
  activityGroupes: { fontSize: 6, color: '#6B7280' },
  activityHour: { fontSize: 6, color: '#6B7280', marginBottom: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 8, color: GREY },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 4 },
  footerText: { fontSize: 7, color: '#9CA3AF', textAlign: 'center' },
});

const DAY_LABELS = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
const TIME_COL_WIDTH = 55;

const SLOTS: { key: 'matin' | 'aprem' | 'journee'; label: string }[] = [
  { key: 'matin', label: 'MATIN' },
  { key: 'aprem', label: 'APRÈS-MIDI' },
  { key: 'journee', label: 'JOURNÉE' },
];

function fmtDate(iso: string): string {
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function lighten(hex: string | null | undefined, amount = 0.85): string {
  if (!hex) return '#F3F4F6';
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#F3F4F6';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#F3F4F6';
  const mix = (ch: number) => Math.round(255 * amount + ch * (1 - amount));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function classifySlot(heureDebut: string, heureFin: string): 'matin' | 'aprem' | 'journee' {
  const start = timeToMinutes(heureDebut);
  const end = timeToMinutes(heureFin);
  if (start < 12 * 60 && end > 13 * 60) return 'journee';
  if (end <= 13 * 60) return 'matin';
  return 'aprem';
}

function getDays(dateDebut: string, dateFin: string): Date[] {
  const days: Date[] = [];
  const start = new Date(dateDebut.includes('T') ? dateDebut : dateDebut + 'T12:00:00');
  const end = new Date(dateFin.includes('T') ? dateFin : dateFin + 'T12:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return days;
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export interface PlanningPDFProps {
  titreSejour: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  centreName?: string;
  planning: Array<{
    id: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    couleur?: string | null;
    estCollective?: boolean;
    groupeNom?: string | null;
  }>;
  groupes: Array<{
    id: string;
    nom: string;
    couleur: string;
    taille: number;
  }>;
}

function PlanningPDF(props: PlanningPDFProps) {
  const allDays = getDays(props.dateDebut, props.dateFin);
  const pages: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    pages.push(allDays.slice(i, i + 7));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <Document>
      {pages.map((days, pageIdx) => (
        <Page key={pageIdx} size="A4" orientation="landscape" style={s.page}>
          {pageIdx === 0 && (
            <>
              <Text style={s.title}>Planning — {props.titreSejour}</Text>
              <Text style={s.subtitle}>
                Du {fmtDate(props.dateDebut)} au {fmtDate(props.dateFin)} — {props.nombreEleves} participants
                {props.centreName ? ` — ${props.centreName}` : ''}
              </Text>
            </>
          )}

          <View style={s.table}>
            <View style={s.headerRow}>
              <View style={[s.headerCell, { width: TIME_COL_WIDTH }]}>
                <Text style={s.headerLabel}> </Text>
              </View>
              {days.map((day) => (
                <View key={day.toISOString()} style={[s.headerCell, { flex: 1 }]}>
                  <Text style={s.headerLabel}>{DAY_LABELS[day.getDay()]}</Text>
                  <Text style={s.headerDate}>
                    {String(day.getDate()).padStart(2, '0')}/{String(day.getMonth() + 1).padStart(2, '0')}
                  </Text>
                </View>
              ))}
            </View>

            {SLOTS.map((slot) => (
              <View key={slot.key} style={s.bodyRow}>
                <View style={[s.slotLabelCell, { width: TIME_COL_WIDTH }]}>
                  <Text style={s.slotLabel}>{slot.label}</Text>
                </View>
                {days.map((day) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const acts = props.planning
                    .filter((p) => {
                      const pDate = p.date.includes('T') ? p.date.split('T')[0] : p.date;
                      if (pDate !== dateStr) return false;
                      return classifySlot(p.heureDebut, p.heureFin) === slot.key;
                    })
                    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));

                  return (
                    <View key={day.toISOString()} style={[s.cell, { flex: 1 }]}>
                      {acts.map((a) => {
                        const bg = lighten(a.couleur, 0.85);
                        const groupeLabel = a.estCollective || !a.groupeNom ? 'Tous les groupes' : a.groupeNom;
                        return (
                          <View
                            key={a.id}
                            style={[
                              s.activityBlock,
                              { backgroundColor: bg, borderLeftWidth: 2, borderLeftColor: a.couleur || PRIMARY },
                            ]}
                          >
                            <Text style={s.activityHour}>{a.heureDebut} - {a.heureFin}</Text>
                            <Text style={s.activityTitle}>{a.titre}</Text>
                            <Text style={s.activityGroupes}>{groupeLabel}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {pageIdx === pages.length - 1 && props.groupes.length > 0 && (
            <View style={s.legend}>
              {props.groupes.map((g) => (
                <View key={g.id} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: g.couleur }]} />
                  <Text style={s.legendText}>{g.nom} ({g.taille})</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.footer} fixed>
            <Text style={s.footerText}>
              Planning généré par LIAVO — liavo.fr — {new Date().toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

interface PlanningPDFButtonProps {
  planningProps: PlanningPDFProps;
  filename?: string;
}

export default function PlanningPDFButton({ planningProps, filename = 'planning.pdf' }: PlanningPDFButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const generate = async (): Promise<string> => {
    if (blobUrl) return blobUrl;
    const { pdf } = await import('@react-pdf/renderer');
    const blob = await pdf(<PlanningPDF {...planningProps} />).toBlob();
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
      <button onClick={handlePreview} title="Afficher le PDF" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-300">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Voir PDF
      </button>
      <button onClick={handleDownload} title="Télécharger le PDF" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Télécharger
      </button>
    </div>
  );
}
