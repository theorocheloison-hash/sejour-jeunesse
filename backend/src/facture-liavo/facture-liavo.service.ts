import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { generateFacturePdf } from '../facture/pdf/facture-pdf.generator.js';

// La colonne sequence_numero.emetteur_id est de type uuid (@db.Uuid) : on ne peut pas
// y stocker la string 'LIAVO'. UUID sentinelle dédié à la séquence de facturation LIAVO
// (ne collisionne pas avec les UUID v4 aléatoires des centres / organisations).
const LIAVO_EMETTEUR_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class FactureLiavoService {
  private readonly logger = new Logger(FactureLiavoService.name);

  constructor(
    private prisma: PrismaService,
    private sequenceService: SequenceService,
    private storageService: StorageService,
    private emailService: EmailService,
  ) {}

  async genererNumero(): Promise<string> {
    const num = await this.sequenceService.generer(LIAVO_EMETTEUR_ID, 'FACTURE_LIAVO');
    const annee = new Date().getFullYear();
    return `FL-${annee}-${String(num).padStart(3, '0')}`;
  }

  async emettre(
    centreId: string,
    montantCentimes: number,
    plan: string,
    type: string,
    molliePaymentId: string,
  ) {
    const numero = await this.genererNumero();

    const centre = await this.prisma.centreHebergement.findUniqueOrThrow({
      where: { id: centreId },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    const frequenceLabel = type === 'ANNUEL' ? 'Annuel' : 'Mensuel';
    const description = `Abonnement LIAVO ${plan} — ${frequenceLabel}`;

    const facture = await this.prisma.factureLiavo.create({
      data: {
        centreId,
        numero,
        dateEmission: new Date(),
        montantHT: montantCentimes,
        montantTVA: 0,
        montantTTC: montantCentimes,
        description,
        planAbonnement: plan,
        typeAbonnement: type,
        molliePaymentId,
      },
    });

    const montantEuros = montantCentimes / 100;
    const now = new Date();
    const pdfBuffer = await generateFacturePdf({
      typeFacture: 'SOLDE',
      numero,
      dateEmission: now.toISOString(),
      dateEcheance: now.toISOString(),
      emetteurNom: 'LIAVO SASU',
      emetteurAdresse: '472 Route du Mas Devant, 74440 Morillon',
      emetteurSiret: '102 994 910',
      emetteurTva: null,
      emetteurEmail: 'contact@liavo.fr',
      emetteurTel: null,
      emetteurIban: null,
      destinataireNom: centre.nom,
      destinataireAdresse: (centre as any).adresse ?? null,
      destinataireSiret: (centre as any).siret ?? null,
      destinataireEmail: centre.user?.email ?? null,
      titreSejour: description,
      lignes: [{
        description,
        quantite: 1,
        prixUnitaire: montantEuros,
        tva: 0,
        totalHT: montantEuros,
        totalTTC: montantEuros,
      }],
      montantHT: montantEuros,
      montantTVA: 0,
      montantTTC: montantEuros,
      montantFacture: montantEuros,
      pourcentageAcompte: null,
      montantAcompteDejaFacture: null,
      conditionsAnnulation: 'Facture acquittée par prélèvement SEPA.',
      tauxTva: 0,
      mentionTVA: 'TVA non applicable, art. 293 B du CGI',
      logoUrl: null,
    });

    const pdfUrl = await this.storageService.uploadBuffer(
      pdfBuffer, `${numero}.pdf`, 'factures-liavo', 'application/pdf',
    );

    await this.prisma.factureLiavo.update({
      where: { id: facture.id },
      data: { pdfUrl },
    });

    if (centre.user?.email) {
      const messageHtml = `<p>Bonjour ${centre.user.prenom},</p>
        <p>Veuillez trouver ci-jointe votre facture <strong>${numero}</strong> pour votre abonnement LIAVO (${plan} — ${frequenceLabel}).</p>
        <p>Montant : ${montantEuros.toFixed(2)} € HT</p>
        <p>Cordialement,<br/>L'équipe LIAVO</p>`;
      await this.emailService.sendFactureParEmail(
        centre.user.email,
        `Facture ${numero} — Abonnement LIAVO`,
        messageHtml,
        pdfBuffer,
        `${numero}.pdf`,
        { name: 'Liavo', email: 'contact@liavo.fr' },
      );
    }

    return { ...facture, pdfUrl };
  }

  async lister(centreId: string) {
    return this.prisma.factureLiavo.findMany({
      where: { centreId },
      orderBy: { dateEmission: 'desc' },
    });
  }

  async listerToutes() {
    return this.prisma.factureLiavo.findMany({
      orderBy: { dateEmission: 'desc' },
      include: { centre: { select: { nom: true } } },
    });
  }
}
