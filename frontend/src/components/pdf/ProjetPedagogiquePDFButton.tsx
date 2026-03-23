'use client';

import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const PRIMARY = '#1B4060';
const GREY = '#374151';
const BORDER = '#E5E7EB';
const GREY_LIGHT = '#F9FAFB';
const SUCCESS = '#16a34a';
const AMBER = '#d97706';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: GREY },
  header: { borderBottomWidth: 2, borderBottomColor: PRIMARY, paddingBottom: 12, marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 1 },
  headerSub: { fontSize: 10, color: '#6B7280', marginTop: 4 },
  headerMeta: { fontSize: 8, color: '#9CA3AF', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: PRIMARY, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  grid2: { flexDirection: 'row', gap: 16 },
  gridItem: { flex: 1 },
  label: { fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 9, color: GREY, fontWeight: 'bold' },
  valueLight: { fontSize: 9, color: GREY },
  tableHeader: { flexDirection: 'row', backgroundColor: PRIMARY, paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell: { fontSize: 7, fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: GREY_LIGHT },
  cell: { fontSize: 8, color: GREY },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeSuccessText: { fontSize: 7, color: SUCCESS, fontWeight: 'bold' },
  badgeAmberText: { fontSize: 7, color: AMBER, fontWeight: 'bold' },
  dayHeader: { backgroundColor: '#EFF6FF', paddingVertical: 3, paddingHorizontal: 6, marginBottom: 2, marginTop: 6 },
  dayHeaderText: { fontSize: 8, fontWeight: 'bold', color: PRIMARY, textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function fmtDate(iso: string): string {
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDateLong(iso: string): string {
  const str = iso.includes('T') ? iso : iso + 'T12:00:00';
  const d = new Date(str);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
}

export interface ProjetPedagogiqueData {
  titre: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  niveauClasse?: string | null;
  description?: string | null;
  thematiquesPedagogiques?: string[];
  createur?: {
    prenom: string;
    nom: string;
    email: string;
    telephone?: string | null;
    etablissementNom?: string | null;
    etablissementAdresse?: string | null;
    etablissementVille?: string | null;
    etablissementUai?: string | null;
  } | null;
  hebergementSelectionne?: {
    nom: string;
    adresse: string;
    ville: string;
    telephone?: string | null;
  } | null;
  accompagnateurs: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone?: string | null;
    signeeAt?: string | null;
    moyenTransport?: string | null;
  }[];
  planningActivites: {
    id: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    description?: string | null;
    responsable?: string | null;
  }[];
  autorisations: {
    id: string;
    eleveNom: string;
    elevePrenom: string;
    parentEmail: string;
    signeeAt?: string | null;
  }[];
  lignesBudget?: {
    id: string;
    categorie: string;
    description: string;
    montant: number;
  }[];
  recettesBudget?: {
    id: string;
    source: string;
    montant: number;
  }[];
  demandes?: {
    devis: {
      montantTTC: number | null;
      lignes: {
        description: string;
        quantite: number;
        prixUnitaire: number;
        tva: number;
        totalHT: number;
        totalTTC: number;
      }[];
    }[];
  }[];
}

function ProjetPedagogiquePDF({ data, objectifsPedago, lienProgrammes }: {
  data: ProjetPedagogiqueData;
  objectifsPedago?: string;
  lienProgrammes?: string;
}) {
  const signedAuto = data.autorisations.filter(a => a.signeeAt).length;
  const signedOM = data.accompagnateurs.filter(a => a.signeeAt).length;

  const planByDay = data.planningActivites.reduce<Record<string, typeof data.planningActivites>>((acc, p) => {
    const day = p.date.slice(0, 10);
    (acc[day] ??= []).push(p);
    return acc;
  }, {});

  const devis = data.demandes?.[0]?.devis?.[0];
  const lignesHebergeur = devis?.lignes ?? [];
  const totalHebergeur = lignesHebergeur.reduce((sum, l) => sum + l.totalTTC, 0);
  const totalCompl = (data.lignesBudget ?? []).reduce((sum, l) => sum + l.montant, 0);
  const totalRecettes = (data.recettesBudget ?? []).reduce((sum, r) => sum + r.montant, 0);
  const totalDepenses = totalHebergeur + totalCompl;
  const solde = totalRecettes - totalDepenses;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Projet pédagogique</Text>
          <Text style={s.headerSub}>{data.titre}</Text>
          <Text style={s.headerMeta}>
            {data.lieu} — Du {fmtDate(data.dateDebut)} au {fmtDate(data.dateFin)} — {data.placesTotales} élèves
            {data.niveauClasse ? ` — ${data.niveauClasse}` : ''}
          </Text>
          <Text style={s.headerMeta}>Généré le {fmtDate(new Date().toISOString())} via LIAVO</Text>
        </View>

        {/* Établissement */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Établissement scolaire</Text>
          <View style={s.grid2}>
            <View style={s.gridItem}>
              <Text style={s.label}>Établissement</Text>
              <Text style={s.value}>{data.createur?.etablissementNom ?? '—'}</Text>
              {data.createur?.etablissementUai && <Text style={s.valueLight}>UAI : {data.createur.etablissementUai}</Text>}
              {data.createur?.etablissementAdresse && <Text style={s.valueLight}>{data.createur.etablissementAdresse}{data.createur.etablissementVille ? `, ${data.createur.etablissementVille}` : ''}</Text>}
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Enseignant responsable</Text>
              <Text style={s.value}>{data.createur?.prenom} {data.createur?.nom}</Text>
              {data.createur?.email && <Text style={s.valueLight}>{data.createur.email}</Text>}
              {data.createur?.telephone && <Text style={s.valueLight}>{data.createur.telephone}</Text>}
            </View>
          </View>
        </View>

        {/* Hébergement */}
        {data.hebergementSelectionne && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Centre d'hébergement</Text>
            <Text style={s.value}>{data.hebergementSelectionne.nom}</Text>
            <Text style={s.valueLight}>{data.hebergementSelectionne.adresse}, {data.hebergementSelectionne.ville}</Text>
            {data.hebergementSelectionne.telephone && <Text style={s.valueLight}>Tél : {data.hebergementSelectionne.telephone}</Text>}
          </View>
        )}

        {/* Thématiques */}
        {data.thematiquesPedagogiques && data.thematiquesPedagogiques.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Thématiques pédagogiques</Text>
            <Text style={s.valueLight}>{data.thematiquesPedagogiques.join(' • ')}</Text>
          </View>
        )}

        {/* Objectifs pédagogiques */}
        {objectifsPedago && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Objectifs pédagogiques</Text>
            <Text style={s.valueLight}>{objectifsPedago}</Text>
          </View>
        )}

        {/* Lien programmes */}
        {lienProgrammes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Lien avec les programmes scolaires</Text>
            <Text style={s.valueLight}>{lienProgrammes}</Text>
          </View>
        )}

        {/* Encadrement */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Encadrement ({data.accompagnateurs.length} accompagnateur{data.accompagnateurs.length > 1 ? 's' : ''} — {signedOM} ordre{signedOM > 1 ? 's' : ''} de mission signé{signedOM > 1 ? 's' : ''})</Text>
          {data.accompagnateurs.length > 0 && (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '25%' }]}>Nom</Text>
                <Text style={[s.tableHeaderCell, { width: '30%' }]}>Email</Text>
                <Text style={[s.tableHeaderCell, { width: '25%' }]}>Transport</Text>
                <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Ordre mission</Text>
              </View>
              {data.accompagnateurs.map((a, i) => (
                <View key={a.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.cell, { width: '25%' }]}>{a.prenom} {a.nom}</Text>
                  <Text style={[s.cell, { width: '30%' }]}>{a.email}</Text>
                  <Text style={[s.cell, { width: '25%' }]}>{a.moyenTransport ?? '—'}</Text>
                  <Text style={[s.cell, { width: '20%', textAlign: 'right' }]}>{a.signeeAt ? 'Signé' : 'En attente'}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Élèves */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Élèves participants ({signedAuto}/{data.autorisations.length} autorisations signées)</Text>
          {data.autorisations.length > 0 && (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '30%' }]}>Nom</Text>
                <Text style={[s.tableHeaderCell, { width: '30%' }]}>Prénom</Text>
                <Text style={[s.tableHeaderCell, { width: '40%', textAlign: 'right' }]}>Autorisation</Text>
              </View>
              {data.autorisations.map((a, i) => (
                <View key={a.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.cell, { width: '30%' }]}>{a.eleveNom}</Text>
                  <Text style={[s.cell, { width: '30%' }]}>{a.elevePrenom}</Text>
                  <Text style={[s.cell, { width: '40%', textAlign: 'right', color: a.signeeAt ? SUCCESS : AMBER }]}>
                    {a.signeeAt ? 'Signée' : 'En attente'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Programme */}
        {Object.keys(planByDay).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Programme prévisionnel</Text>
            {Object.entries(planByDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => (
              <View key={day}>
                <View style={s.dayHeader}>
                  <Text style={s.dayHeaderText}>{fmtDateLong(day)}</Text>
                </View>
                {items.map((p, i) => (
                  <View key={p.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.cell, { width: '20%', fontFamily: 'Courier' }]}>{p.heureDebut} – {p.heureFin}</Text>
                    <Text style={[s.cell, { width: '50%', fontWeight: 'bold' }]}>{p.titre}</Text>
                    <Text style={[s.cell, { width: '30%', textAlign: 'right' }]}>{p.responsable ?? '—'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Budget résumé */}
        {(lignesHebergeur.length > 0 || (data.lignesBudget ?? []).length > 0 || (data.recettesBudget ?? []).length > 0) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Budget prévisionnel (résumé)</Text>
            {lignesHebergeur.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[s.label, { marginBottom: 3 }]}>Prestations hébergeur</Text>
                {lignesHebergeur.map((l, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.cell, { flex: 1 }]}>{l.description}</Text>
                    <Text style={[s.cell, { width: '15%', textAlign: 'right' }]}>{l.quantite}</Text>
                    <Text style={[s.cell, { width: '25%', textAlign: 'right' }]}>{fmtMoney(l.totalTTC)}</Text>
                  </View>
                ))}
              </View>
            )}
            {(data.lignesBudget ?? []).length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[s.label, { marginBottom: 3 }]}>Dépenses complémentaires</Text>
                {(data.lignesBudget ?? []).map((l, i) => (
                  <View key={l.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.cell, { width: '25%' }]}>{l.categorie}</Text>
                    <Text style={[s.cell, { flex: 1 }]}>{l.description}</Text>
                    <Text style={[s.cell, { width: '25%', textAlign: 'right' }]}>{fmtMoney(l.montant)}</Text>
                  </View>
                ))}
              </View>
            )}
            {(data.recettesBudget ?? []).length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[s.label, { marginBottom: 3 }]}>Recettes</Text>
                {(data.recettesBudget ?? []).map((r, i) => (
                  <View key={r.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.cell, { flex: 1 }]}>{r.source}</Text>
                    <Text style={[s.cell, { width: '25%', textAlign: 'right' }]}>{fmtMoney(r.montant)}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
              <View style={{ width: 200 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 8, color: '#6B7280' }}>Total dépenses</Text>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: GREY }}>{fmtMoney(totalDepenses)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 8, color: '#6B7280' }}>Total recettes</Text>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: GREY }}>{fmtMoney(totalRecettes)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderTopWidth: 1, borderTopColor: BORDER }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: GREY }}>Solde</Text>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: solde >= 0 ? SUCCESS : '#dc2626' }}>
                    {solde >= 0 ? '+' : ''}{fmtMoney(solde)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Projet pédagogique — {data.titre} — LIAVO</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

interface ProjetPedagogiquePDFButtonProps {
  data: ProjetPedagogiqueData;
  objectifsPedago?: string;
  lienProgrammes?: string;
  filename?: string;
}

export default function ProjetPedagogiquePDFButton({ data, objectifsPedago, lienProgrammes, filename = 'projet-pedagogique.pdf' }: ProjetPedagogiquePDFButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const generate = async (): Promise<string> => {
    if (blobUrl) return blobUrl;
    const { pdf } = await import('@react-pdf/renderer');
    const blob = await pdf(<ProjetPedagogiquePDF data={data} objectifsPedago={objectifsPedago} lienProgrammes={lienProgrammes} />).toBlob();
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
