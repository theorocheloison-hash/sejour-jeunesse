import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const BLEU = '#1B4060';
const GRIS = '#6B7280';
const GRIS_CLAIR = '#F3F4F6';
const NOIR = '#111827';

const styles = StyleSheet.create({
  page: { padding: 45, fontSize: 9, fontFamily: 'Helvetica', color: NOIR, lineHeight: 1.5 },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: BLEU, paddingBottom: 12 },
  titre: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BLEU, marginBottom: 4 },
  sousTitre: { fontSize: 11, color: GRIS },
  row2col: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  col: { flex: 1 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLEU,
    borderBottomWidth: 1, borderBottomColor: BLEU, paddingBottom: 3, marginBottom: 8, marginTop: 14 },
  label: { fontSize: 8, color: GRIS, marginBottom: 1 },
  value: { fontSize: 9, color: NOIR, marginBottom: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  table: { marginBottom: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: BLEU, padding: 5 },
  tableHeaderCell: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  tableRowAlt: { flexDirection: 'row', padding: 4, backgroundColor: GRIS_CLAIR,
    borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  cell: { fontSize: 8, color: NOIR },
  totaux: { alignItems: 'flex-end', marginTop: 6, marginBottom: 12 },
  totauxLigne: { flexDirection: 'row', gap: 20, marginBottom: 2 },
  totauxLabel: { fontSize: 8, color: GRIS, width: 120, textAlign: 'right' },
  totauxValue: { fontSize: 8, color: NOIR, width: 80, textAlign: 'right' },
  totalTTC: { flexDirection: 'row', gap: 20, marginTop: 4,
    borderTopWidth: 1, borderTopColor: BLEU, paddingTop: 4 },
  totalTTCLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLEU, width: 120, textAlign: 'right' },
  totalTTCValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLEU, width: 80, textAlign: 'right' },
  acompteBox: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B',
    padding: 8, marginBottom: 12, borderRadius: 4 },
  articleTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 8, marginBottom: 3 },
  paragraph: { fontSize: 8.5, color: NOIR, marginBottom: 4, lineHeight: 1.6 },
  bullet: { fontSize: 8.5, color: NOIR, marginBottom: 2, marginLeft: 10 },
  ibanBox: { backgroundColor: GRIS_CLAIR, padding: 10, borderRadius: 4,
    borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 12 },
  ibanTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLEU, marginBottom: 4 },
  ibanRow: { flexDirection: 'row', gap: 30, marginBottom: 2 },
  ibanLabel: { fontSize: 8, color: GRIS, width: 40 },
  ibanValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NOIR },
  signatureRow: { flexDirection: 'row', gap: 20, marginTop: 20 },
  signatureBox: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 4, padding: 12, minHeight: 80 },
  signatureTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLEU, marginBottom: 6 },
  signatureValue: { fontSize: 8, color: NOIR },
  footer: { position: 'absolute', bottom: 20, left: 45, right: 45,
    borderTopWidth: 0.5, borderTopColor: '#D1D5DB', paddingTop: 6,
    fontSize: 7, color: GRIS, flexDirection: 'row', justifyContent: 'space-between' },
  rgpdBox: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    padding: 8, borderRadius: 4, marginBottom: 8 },
  warnBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    padding: 8, borderRadius: 4, marginBottom: 8 },
});

export interface ContratData {
  // Client
  nomClient: string;
  prenomClient?: string | null;
  adresseClient?: string | null;
  telClient?: string | null;
  emailClient?: string | null;
  // Événement
  typeEvenement?: string | null;
  dateDebut: string; // déjà formaté "DD MMMM YYYY" par le service
  dateFin: string;
  // Financier
  lignes: Array<{
    description: string;
    quantite: number;
    prixUnitaire: number;
    tva: number;
    totalTTC: number;
  }>;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  pourcentageAcompte: number;
  montantAcompte: number;
  resteAPayer: number;
  // Signature
  dateSignature: string;
  nomPrenomSignataire?: string | null;
  signatureClient?: string | null;
  // Numéro
  numeroDevis?: string | null;
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

export async function generateContratSauvageonPdf(data: ContratData): Promise<Buffer> {
  const doc = (
    <Document title={`Contrat ${data.typeEvenement ?? 'Événement'} — ${data.nomClient}`}>
      <Page size="A4" style={styles.page}>

        {/* EN-TÊTE */}
        <View style={styles.header}>
          <Text style={styles.titre}>CONTRAT DE LOCATION — GESTION LIBRE</Text>
          <Text style={styles.sousTitre}>Chalet Le Sauvageon — {data.numeroDevis}</Text>
        </View>

        {/* PARTIES */}
        <View style={styles.row2col}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>LE BAILLEUR</Text>
            <Text style={[styles.value, styles.bold]}>SAS Le Sauvageon</Text>
            <Text style={styles.value}>SIRET : 102 994 910 00010</Text>
            <Text style={styles.value}>472 Route du Mas Devant, 74440 Morillon</Text>
            <Text style={styles.value}>Tél. : 06.74.94.81.82</Text>
            <Text style={styles.value}>Email : resa@lesauvageon.com</Text>
            <Text style={styles.value}>Représentée par Maëva Roche-Loison, Directrice</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>LE LOCATAIRE</Text>
            <Text style={[styles.value, styles.bold]}>{data.nomClient} {data.prenomClient ?? ''}</Text>
            {data.adresseClient && <Text style={styles.value}>{data.adresseClient}</Text>}
            {data.telClient && <Text style={styles.value}>Tél. : {data.telClient}</Text>}
            {data.emailClient && <Text style={styles.value}>Email : {data.emailClient}</Text>}
          </View>
        </View>

        {/* ÉVÉNEMENT */}
        <Text style={styles.sectionTitle}>DESCRIPTION DE LA PRESTATION</Text>
        <Text style={styles.value}>
          <Text style={styles.bold}>Type d&apos;événement :</Text> {data.typeEvenement ?? '—'}
        </Text>
        <Text style={styles.value}>
          <Text style={styles.bold}>Période :</Text> Du {data.dateDebut} à 17h00 au {data.dateFin} à 16h00
        </Text>
        <Text style={styles.value}>
          <Text style={styles.bold}>Lieu :</Text> Chalet Le Sauvageon — 472 Route du Mas Devant, 74440 Morillon
        </Text>

        {/* TABLEAU PRESTATIONS */}
        <Text style={styles.sectionTitle}>DÉTAIL ET FACTURATION</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Prestation</Text>
            <Text style={[styles.tableHeaderCell, { width: 40, textAlign: 'right' }]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, { width: 60, textAlign: 'right' }]}>PU HT</Text>
            <Text style={[styles.tableHeaderCell, { width: 35, textAlign: 'right' }]}>TVA</Text>
            <Text style={[styles.tableHeaderCell, { width: 65, textAlign: 'right' }]}>Total TTC</Text>
          </View>
          {data.lignes.map((l, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.cell, { flex: 3 }]}>{l.description}</Text>
              <Text style={[styles.cell, { width: 40, textAlign: 'right' }]}>{l.quantite}</Text>
              <Text style={[styles.cell, { width: 60, textAlign: 'right' }]}>{fmt(l.prixUnitaire)} €</Text>
              <Text style={[styles.cell, { width: 35, textAlign: 'right' }]}>{l.tva}%</Text>
              <Text style={[styles.cell, { width: 65, textAlign: 'right' }]}>{fmt(l.totalTTC)} €</Text>
            </View>
          ))}
        </View>
        <View style={styles.totaux}>
          <View style={styles.totauxLigne}>
            <Text style={styles.totauxLabel}>Sous-total HT</Text>
            <Text style={styles.totauxValue}>{fmt(data.montantHT)} €</Text>
          </View>
          <View style={styles.totauxLigne}>
            <Text style={styles.totauxLabel}>TVA</Text>
            <Text style={styles.totauxValue}>{fmt(data.montantTVA)} €</Text>
          </View>
          <View style={styles.totalTTC}>
            <Text style={styles.totalTTCLabel}>Total TTC</Text>
            <Text style={styles.totalTTCValue}>{fmt(data.montantTTC)} €</Text>
          </View>
        </View>

        {/* ACOMPTE */}
        <View style={styles.acompteBox}>
          <Text style={[styles.value, styles.bold]}>
            Acompte exigible ({data.pourcentageAcompte}%) : {fmt(data.montantAcompte)} €
          </Text>
          <Text style={styles.value}>
            Solde restant dû : {fmt(data.resteAPayer)} €
          </Text>
        </View>

        {/* IBAN */}
        <View style={styles.ibanBox}>
          <Text style={styles.ibanTitle}>Coordonnées bancaires pour le virement de l&apos;acompte</Text>
          <View style={styles.ibanRow}>
            <Text style={styles.ibanLabel}>IBAN</Text>
            <Text style={styles.ibanValue}>FR76 1810 6000 2796 7820 4408 470</Text>
          </View>
          <View style={styles.ibanRow}>
            <Text style={styles.ibanLabel}>BIC</Text>
            <Text style={styles.ibanValue}>AGRIFRPP881</Text>
          </View>
          <View style={styles.ibanRow}>
            <Text style={styles.ibanLabel}>Banque</Text>
            <Text style={styles.ibanValue}>Crédit Agricole des Savoie — Samoens</Text>
          </View>
          <Text style={[styles.label, { marginTop: 4 }]}>
            Référence virement : {data.numeroDevis} — {data.nomClient}
          </Text>
        </View>

        {/* RÉSERVATION */}
        <Text style={styles.sectionTitle}>RÉSERVATION</Text>
        <Text style={styles.paragraph}>
          La réservation est validée sous deux conditions :
        </Text>
        <Text style={styles.bullet}>
          • Réception du présent contrat signé électroniquement avec la mention &quot;bon pour accord&quot;
        </Text>
        <Text style={styles.bullet}>
          • Réception de l&apos;acompte de {data.pourcentageAcompte}% ({fmt(data.montantAcompte)} €) par virement dans un délai d&apos;un mois après la date d&apos;envoi du présent contrat
        </Text>
        <Text style={styles.paragraph}>
          Si ces deux conditions ne sont pas remplies dans les délais, la SAS Le Sauvageon se réserve le droit d&apos;accepter une autre réservation sur les dates concernées.
        </Text>

        {/* CONDITIONS RÈGLEMENT */}
        <Text style={styles.sectionTitle}>CONDITIONS DE RÈGLEMENT</Text>
        <Text style={styles.bullet}>
          • L&apos;acompte de {data.pourcentageAcompte}% ({fmt(data.montantAcompte)} €) est à régler par virement bancaire dès signature du présent contrat.
        </Text>
        <Text style={styles.bullet}>
          • Le solde ({fmt(data.resteAPayer)} €) est à régler par chèque, espèces ou virement le jour du départ.
        </Text>
        <Text style={styles.paragraph}>
          La facture tient compte du nombre effectif de présents au séjour. Tout séjour commencé est dû dans son intégralité, quelle que soit la raison d&apos;une interruption prématurée.
        </Text>

        {/* REMARQUES */}
        <Text style={styles.sectionTitle}>REMARQUES GÉNÉRALES</Text>
        <Text style={styles.paragraph}>
          L&apos;accès à tous les locaux communs est autorisé. Seules les parties techniques seront fermées à clé, réservées au personnel de l&apos;établissement.
        </Text>
        <Text style={styles.paragraph}>
          Espaces disponibles : parking, salle de jeux, terrasse, jardin, terrain de sport extérieur, cuisine, hall d&apos;entrée, salle de restauration, chambres.
        </Text>
        <Text style={styles.paragraph}>
          Les animaux ne sont pas acceptés. En cas de non-respect, un dédommagement de 500 € de frais de ménage supplémentaires par animal sera exigé.
        </Text>
        <Text style={styles.paragraph}>
          Sur le terrain extérieur, aucune structure additionnelle n&apos;est acceptée sans demande écrite préalable (trampoline, jeux gonflables, piscine, chapiteaux, etc.).
        </Text>

        {/* MÉNAGE */}
        <Text style={styles.sectionTitle}>MÉNAGE</Text>
        <Text style={styles.paragraph}>
          Le ménage des communs (cuisine, salle à manger, toilettes) est à la charge des locataires avant la remise des clés. Les locataires s&apos;engagent à rendre ces espaces dans l&apos;état où ils les ont trouvés. Le ménage des chambres sera effectué par le bailleur après le séjour.
        </Text>

        {/* SOIRÉE */}
        <Text style={styles.sectionTitle}>SOIRÉE ET BRUIT</Text>
        <Text style={styles.paragraph}>
          La soirée doit se dérouler dans la salle de jeux, le salon ou la salle de réception du chalet. Aucune musique ne doit être diffusée sur la terrasse après 22h00, afin de respecter le voisinage.
        </Text>

        {/* DÉTÉRIORATION */}
        <Text style={styles.sectionTitle}>DÉTÉRIORATION ET CAUTIONS</Text>
        <Text style={styles.paragraph}>
          Un état des lieux est dressé à l&apos;arrivée et au départ. Les dégâts constatés sont facturés au prix de remplacement ou de réparation. Deux chèques de caution seront demandés à l&apos;arrivée :
        </Text>
        <Text style={styles.bullet}>• 1 500 € pour les frais de ménage éventuels</Text>
        <Text style={styles.bullet}>• 2 000 € pour les appareils et équipements</Text>
        <Text style={styles.paragraph}>
          Ces chèques sont restitués à la fin du séjour, une fois l&apos;état des lieux validé entre les deux parties.
        </Text>

        {/* SÉCURITÉ */}
        <Text style={styles.sectionTitle}>SÉCURITÉ</Text>
        <Text style={styles.paragraph}>
          La commission de sécurité compétente a émis un avis favorable à la poursuite de l&apos;activité de l&apos;établissement, classé en catégorie R4.
        </Text>

        {/* CONDITIONS DÉSISTEMENT */}
        <Text style={styles.sectionTitle}>CONDITIONS DE DÉSISTEMENT</Text>

        <Text style={styles.articleTitle}>Article 1 — Durée du séjour</Text>
        <Text style={styles.paragraph}>
          Le locataire signataire du présent contrat, conclu pour une durée déterminée, ne pourra en aucune circonstance se prévaloir d&apos;un quelconque droit au maintien dans les lieux à l&apos;issue du séjour.
        </Text>

        <Text style={styles.articleTitle}>Article 2 — Responsabilité</Text>
        <Text style={styles.paragraph}>
          La SAS Le Sauvageon est l&apos;unique interlocuteur du client et répond de l&apos;exécution des obligations découlant des présentes conditions. Elle ne peut être tenue pour responsable des cas fortuits, de force majeure, ou du fait de toute personne étrangère à l&apos;organisation du séjour.
        </Text>

        <Text style={styles.articleTitle}>Article 3 — Absence de rétractation</Text>
        <Text style={styles.paragraph}>
          Pour les réservations effectuées par email, courrier, téléphone ou internet, le locataire ne bénéficie pas du délai de rétractation, conformément à l&apos;article L121-21-8 du code de la consommation relatif aux prestations de services d&apos;hébergement fournies à une date déterminée.
        </Text>

        <Text style={styles.articleTitle}>Article 4 — Annulation du fait du client</Text>
        <Text style={styles.paragraph}>
          Toute annulation doit être notifiée par écrit à resa@lesauvageon.com.
        </Text>
        <Text style={styles.bullet}>• Annulation jusqu&apos;à 9 mois avant le début du séjour : l&apos;acompte versé est remboursé dans son intégralité</Text>
        <Text style={styles.bullet}>• Annulation entre 9 et 6 mois avant le début du séjour : 50% du montant total TTC est retenu</Text>
        <Text style={styles.bullet}>• Annulation moins de 6 mois avant le début du séjour : l&apos;intégralité du montant TTC est due</Text>

        <Text style={styles.articleTitle}>Article 5 — Annulation du fait de la SAS Le Sauvageon</Text>
        <Text style={styles.paragraph}>
          100% des prestations payées seront remboursées au client.
        </Text>

        <Text style={styles.articleTitle}>Article 6 — Force majeure</Text>
        <Text style={styles.paragraph}>
          En cas d&apos;impossibilité d&apos;effectuer le séjour suite à un cas de force majeure (catastrophe climatique, sanitaire, etc.) n&apos;étant du fait ni de la SAS Le Sauvageon ni du client, l&apos;intégralité des prestations versées sera remboursée.
        </Text>

        <Text style={styles.articleTitle}>Article 7 — Juridiction compétente</Text>
        <Text style={styles.paragraph}>
          Tout litige relatif à l&apos;exécution du présent contrat sera soumis, à défaut d&apos;accord amiable, au tribunal compétent d&apos;Annecy.
        </Text>

        {/* RGPD */}
        <Text style={styles.sectionTitle}>PROTECTION DES DONNÉES PERSONNELLES</Text>
        <View style={styles.rgpdBox}>
          <Text style={styles.paragraph}>
            Les données personnelles collectées dans le cadre du présent contrat (nom, prénom, adresse, email, téléphone) sont traitées par la SAS Le Sauvageon (SIRET 102 994 910 00010), responsable de traitement, aux seules fins de gestion de la réservation et de la relation commerciale. Ces données sont conservées 5 ans à compter de la fin du contrat, conformément aux obligations légales comptables. Elles ne sont pas transmises à des tiers. Conformément au RGPD (UE 2016/679), vous disposez d&apos;un droit d&apos;accès, de rectification et d&apos;effacement en contactant : resa@lesauvageon.com.
          </Text>
        </View>

        {/* SIGNATURE ÉLECTRONIQUE */}
        <Text style={styles.sectionTitle}>SIGNATURE ÉLECTRONIQUE</Text>
        <View style={styles.warnBox}>
          <Text style={styles.paragraph}>
            Le présent contrat est signé électroniquement via la plateforme LIAVO (liavo.fr). La signature électronique constitue une signature électronique simple au sens du Règlement eIDAS (UE n°910/2014). Elle est horodatée et associée à l&apos;adresse IP du signataire, garantissant son intégrité et son imputabilité. Les parties reconnaissent expressément la valeur juridique de ce mode de signature.
          </Text>
        </View>

        {/* SIGNATURES */}
        <Text style={styles.sectionTitle}>SIGNATURES</Text>
        <Text style={[styles.paragraph, { marginBottom: 8 }]}>
          Fait à Morillon, le {data.dateSignature}
        </Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>LE BAILLEUR</Text>
            <Text style={styles.signatureValue}>SAS Le Sauvageon</Text>
            <Text style={styles.signatureValue}>Maëva Roche-Loison, Directrice</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>LE LOCATAIRE</Text>
            <Text style={styles.signatureValue}>
              {data.nomPrenomSignataire ?? `${data.nomClient} ${data.prenomClient ?? ''}`}
            </Text>
            {data.signatureClient && (
              <Text style={[styles.signatureValue, { marginTop: 6, fontSize: 7, color: GRIS }]}>
                {data.signatureClient}
              </Text>
            )}
            <Text style={[styles.signatureValue, { marginTop: 4, fontSize: 7, color: GRIS }]}>
              &quot;Lu et approuvé&quot;
            </Text>
          </View>
        </View>

        {/* FOOTER */}
        <Text style={styles.footer}>
          <Text>Document généré par LIAVO (liavo.fr) — SAS Le Sauvageon, SIRET 102 994 910 00010</Text>
          <Text>Tribunal compétent : Annecy</Text>
        </Text>

      </Page>
    </Document>
  );

  return await renderToBuffer(doc) as Buffer;
}
