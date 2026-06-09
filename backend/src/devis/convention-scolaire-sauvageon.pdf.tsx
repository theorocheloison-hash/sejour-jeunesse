import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const BLEU = '#1B4060';
const GRIS = '#6B7280';
const NOIR = '#111827';

const styles = StyleSheet.create({
  page: { padding: 45, fontSize: 9, fontFamily: 'Helvetica', color: NOIR, lineHeight: 1.5 },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: BLEU, paddingBottom: 12 },
  titre: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BLEU, marginBottom: 4 },
  sousTitre: { fontSize: 11, color: GRIS },
  enteteCentre: { fontSize: 8.5, color: NOIR, marginBottom: 1 },
  enteteCentreNom: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BLEU, marginBottom: 3 },
  destinataire: { marginTop: 18, marginBottom: 18, alignItems: 'flex-end' },
  destinataireBloc: { width: 240 },
  value: { fontSize: 9, color: NOIR, marginBottom: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLEU,
    borderBottomWidth: 1, borderBottomColor: BLEU, paddingBottom: 3, marginBottom: 8, marginTop: 14 },
  articleTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 8, marginBottom: 3 },
  paragraph: { fontSize: 8.5, color: NOIR, marginBottom: 4, lineHeight: 1.6 },
  bullet: { fontSize: 8.5, color: NOIR, marginBottom: 2, marginLeft: 10 },
  effectifBox: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    padding: 8, borderRadius: 4, marginBottom: 12, marginTop: 8 },
  signatureRow: { flexDirection: 'row', gap: 20, marginTop: 24 },
  signatureBox: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 4, padding: 12, minHeight: 90 },
  signatureTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: BLEU, marginBottom: 6 },
  signatureValue: { fontSize: 8, color: NOIR, marginBottom: 3 },
  footer: { position: 'absolute', bottom: 20, left: 45, right: 45,
    borderTopWidth: 0.5, borderTopColor: '#D1D5DB', paddingTop: 6,
    fontSize: 7, color: GRIS, flexDirection: 'row', justifyContent: 'space-between' },
});

export interface ConventionScolaireData {
  // Centre (hardcodé Sauvageon pour phase 1, mais nommés génériquement)
  centreNom: string;
  centreAdresse: string;
  centreCodePostal: string;
  centreVille: string;
  centreTelephone: string;
  centreEmail: string;
  centreSiret: string;
  centreRepresentant: string; // "Maëva Roche-Loison"
  // Client (établissement scolaire)
  etablissementNom: string;
  etablissementAdresse: string | null;
  contactNom: string;
  contactEmail: string | null;
  // Séjour
  dateDebut: string; // déjà formaté
  dateFin: string;
  effectifEleves: number;
  effectifEncadrants: number;
  sejourTitre: string;
  // Devis
  numeroDevis: string | null;
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
  // Date document
  dateDocument: string;
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

export async function generateConventionScolaireSauvageonPdf(data: ConventionScolaireData): Promise<Buffer> {
  const doc = (
    <Document title={`Convention séjour scolaire — ${data.etablissementNom}`}>

      {/* ───────────────── PAGE 1 — LETTRE D'ACCOMPAGNEMENT ───────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.enteteCentreNom}>Chalet « {data.centreNom} »</Text>
          <Text style={styles.enteteCentre}>{data.centreAdresse}, {data.centreCodePostal} {data.centreVille}</Text>
          <Text style={styles.enteteCentre}>Tél. : {data.centreTelephone} — {data.centreEmail}</Text>
          <Text style={styles.enteteCentre}>www.lesauvageon.com</Text>
        </View>

        <View style={styles.destinataire}>
          <View style={styles.destinataireBloc}>
            <Text style={[styles.value, styles.bold]}>{data.etablissementNom}</Text>
            {data.etablissementAdresse && <Text style={styles.value}>{data.etablissementAdresse}</Text>}
            <Text style={styles.value}>À l&apos;attention de {data.contactNom}</Text>
          </View>
        </View>

        <Text style={[styles.paragraph, { marginTop: 10 }]}>Madame, Monsieur,</Text>
        <Text style={styles.paragraph}>
          Je vous adresse la convention pour le stage que vous souhaitez organiser pour votre
          établissement scolaire à MORILLON (Haute-Savoie), Chalet Le Sauvageon, du {data.dateDebut} au {data.dateFin}.
        </Text>
        <Text style={styles.paragraph}>
          Je vous remercie de bien vouloir nous retourner un exemplaire de cette convention signé,
          précédé de la mention « lu et approuvé ». Le solde du séjour sera réglé à l&apos;issue de celui-ci,
          sur la base du nombre effectif de présents.
        </Text>
        <Text style={styles.paragraph}>
          Afin de préparer au mieux votre accueil, merci de nous transmettre avant le séjour la liste
          des élèves et des professeurs accompagnateurs, en précisant pour chacun la taille, la pointure,
          le sexe, l&apos;âge ainsi que les éventuels régimes alimentaires particuliers.
        </Text>
        <Text style={styles.paragraph}>
          Restant à votre disposition pour toute information complémentaire, je vous prie d&apos;agréer,
          Madame, Monsieur, l&apos;expression de mes salutations distinguées.
        </Text>

        <View style={{ marginTop: 30, alignItems: 'flex-end' }}>
          <View style={{ width: 240 }}>
            <Text style={[styles.value, styles.bold]}>{data.centreRepresentant}</Text>
            <Text style={styles.value}>Directrice — Chalet Le Sauvageon</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          <Text>Document généré par LIAVO (liavo.fr) — Chalet {data.centreNom}, SIRET {data.centreSiret}</Text>
          <Text>Convention séjour scolaire {data.numeroDevis ?? ''}</Text>
        </Text>
      </Page>

      {/* ───────────────── PAGE 2+ — DESCRIPTION DES PRESTATIONS ───────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.titre}>CONVENTION DE SÉJOUR SCOLAIRE</Text>
          <Text style={styles.sousTitre}>Chalet Le Sauvageon{data.numeroDevis ? ` — ${data.numeroDevis}` : ''}</Text>
        </View>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Entre :</Text> Chalet LE SAUVAGEON, {data.centreAdresse}, {data.centreCodePostal} {data.centreVille}
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Et :</Text> {data.etablissementNom}
        </Text>
        <Text style={styles.paragraph}>
          Il est convenu ce qui suit, pour le séjour « {data.sejourTitre} » : du {data.dateDebut} au {data.dateFin}.
        </Text>

        <View style={styles.effectifBox}>
          <Text style={[styles.value, styles.bold]}>
            EFFECTIF PRÉVU : {data.effectifEleves} élèves étudiants et {data.effectifEncadrants} encadrants
          </Text>
        </View>

        <Text style={styles.sectionTitle}>RÉSERVATION</Text>
        <Text style={styles.paragraph}>
          La réservation est validée par la réception du devis et des conditions générales de vente
          signés avec la mention « bon pour accord », accompagnés du versement d&apos;un acompte de {data.pourcentageAcompte}%
          ({fmt(data.montantAcompte)} €) dans un délai d&apos;un mois.
        </Text>

        <Text style={styles.sectionTitle}>REMARQUES GÉNÉRALES</Text>
        <Text style={styles.paragraph}>
          L&apos;accès à tous les locaux communs est autorisé. Espaces disponibles : parking, salle de jeu,
          terrasse, jardin, terrain de sport, cuisine, hall d&apos;entrée, salle de restauration et chambres.
        </Text>
        <Text style={styles.paragraph}>
          Les animaux ne sont pas acceptés. En cas de non-respect, un dédommagement de 500 € par animal sera exigé.
        </Text>
        <Text style={styles.paragraph}>
          Le prix est forfaitaire : aucune déduction ne pourra être appliquée. Le prix total figure sur le devis joint.
        </Text>

        <Text style={styles.sectionTitle}>ALIMENTATION</Text>
        <Text style={styles.paragraph}>
          Les commandes doivent être passées une semaine avant l&apos;arrivée, et la liste des régimes
          alimentaires transmise dans les temps. Les repas sont préparés sur place par notre cuisinier et son commis.
        </Text>
        <Text style={styles.paragraph}>
          La pension est complète : petit déjeuner, repas du midi (sur place ou en panier repas), goûter et repas du soir.
          Attention : l&apos;eau n&apos;est pas fournie avec les paniers repas.
        </Text>

        <Text style={styles.sectionTitle}>ACTIVITÉS</Text>
        <Text style={styles.paragraph}>
          Le matériel et l&apos;encadrement sont inclus pour les activités figurant sur le devis. Les prestataires
          sont diplômés et disposent chacun d&apos;une assurance responsabilité civile professionnelle. Le transport
          entre le chalet et les lieux d&apos;activités est inclus.
        </Text>

        <Text style={styles.sectionTitle}>LINGE DE LIT</Text>
        <Text style={styles.paragraph}>
          Le linge de lit est fourni en gestion libre : chacun installe et débarrasse son lit.
        </Text>

        <Text style={styles.sectionTitle}>MATÉRIEL</Text>
        <Text style={styles.paragraph}>
          Le mobilier et le matériel ne doivent pas être déplacés sans accord. Le matériel fourni doit être rendu
          en bon état ; toute dégradation fera l&apos;objet d&apos;une facturation de remplacement.
        </Text>

        <Text style={styles.sectionTitle}>MÉNAGE</Text>
        <Text style={styles.paragraph}>
          Le ménage quotidien des espaces communs est assuré par l&apos;équipe. Les chambres sont nettoyées avant
          l&apos;arrivée et après le départ. Merci de responsabiliser les jeunes au moment du départ.
        </Text>

        <Text style={styles.sectionTitle}>DÉTÉRIORATION</Text>
        <Text style={styles.paragraph}>
          Un état des lieux est réalisé à l&apos;arrivée et au départ. Les dégâts constatés sont facturés au prix
          de remplacement ou de réparation.
        </Text>

        <Text style={styles.sectionTitle}>SÉCURITÉ</Text>
        <Text style={styles.paragraph}>
          La commission de sécurité a émis un avis favorable ; l&apos;établissement est classé en catégorie R4.
          Agréments : Jeunesse &amp; Sports n° 741901005, Éducation Nationale n° 4.05.190.03.
        </Text>

        <Text style={styles.sectionTitle}>CONDITIONS DE RÈGLEMENT</Text>
        <Text style={styles.bullet}>
          • Un acompte de {data.pourcentageAcompte}% ({fmt(data.montantAcompte)} €) est réglé par virement après retour du devis signé.
        </Text>
        <Text style={styles.bullet}>
          • Le restant dû est réglé par virement au plus tard 30 jours après la fin du séjour.
        </Text>
        <Text style={styles.paragraph}>
          La facture est établie sur la base du nombre effectif de présents au séjour.
        </Text>

        <Text style={styles.sectionTitle}>CONDITIONS DE DÉSISTEMENT</Text>

        <Text style={styles.articleTitle}>Article 1 — Durée du séjour</Text>
        <Text style={styles.paragraph}>
          Le présent contrat est conclu pour une durée déterminée. Le signataire ne pourra se prévaloir d&apos;un
          quelconque droit au maintien dans les lieux à l&apos;issue du séjour.
        </Text>

        <Text style={styles.articleTitle}>Article 2 — Responsabilité</Text>
        <Text style={styles.paragraph}>
          Le Chalet Le Sauvageon est l&apos;unique interlocuteur du client. Il ne peut être tenu pour responsable
          des cas fortuits, de force majeure ou du fait de toute personne étrangère à l&apos;organisation du séjour.
        </Text>

        <Text style={styles.articleTitle}>Article 3 — Absence de rétractation</Text>
        <Text style={styles.paragraph}>
          Le client ne bénéficie pas du délai de rétractation, conformément à l&apos;article L121-21-8 du code de la
          consommation relatif aux prestations d&apos;hébergement fournies à une date déterminée.
        </Text>

        <Text style={styles.articleTitle}>Article 4 — Annulation du fait du client</Text>
        <Text style={styles.bullet}>• Jusqu&apos;à 6 mois avant le début du séjour : remboursement intégral de l&apos;acompte versé.</Text>
        <Text style={styles.bullet}>• Entre 6 et 3 mois avant le début du séjour : 50% du montant total est retenu.</Text>
        <Text style={styles.bullet}>• Moins de 3 mois avant le début du séjour : l&apos;intégralité du montant est due.</Text>

        <Text style={styles.articleTitle}>Article 5 — Annulation du fait du Chalet Le Sauvageon</Text>
        <Text style={styles.paragraph}>
          100% des sommes versées sont remboursées au client.
        </Text>

        <Text style={styles.articleTitle}>Article 6 — Force majeure</Text>
        <Text style={styles.paragraph}>
          En cas d&apos;impossibilité d&apos;effectuer le séjour suite à un cas de force majeure, l&apos;intégralité des
          sommes versées est remboursée.
        </Text>

        {/* SIGNATURE */}
        <Text style={styles.sectionTitle}>SIGNATURES</Text>
        <Text style={[styles.paragraph, { marginBottom: 6 }]}>
          Fait à Morillon, le {data.dateDocument}
        </Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>LE CHALET LE SAUVAGEON</Text>
            <Text style={styles.signatureValue}>{data.centreRepresentant}, Directrice</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>L&apos;ÉTABLISSEMENT</Text>
            <Text style={styles.signatureValue}>Nom, Prénom, Date :</Text>
            <Text style={[styles.signatureValue, { marginTop: 8, fontSize: 7, color: GRIS }]}>
              Signature précédée de la mention « lu et approuvé »
            </Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          <Text>Document généré par LIAVO (liavo.fr) — Chalet {data.centreNom}, SIRET {data.centreSiret}</Text>
          <Text>Convention séjour scolaire {data.numeroDevis ?? ''}</Text>
        </Text>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc) as Buffer;
}
