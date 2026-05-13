import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Request } from 'express';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import type {
  CreateDevisLibreDto, UpdateDevisLibreDto,
  AjouterVersementDto, SignerDevisDto,
} from './dto/create-devis-libre.dto.js';

const INCLUDE_FULL = {
  lignes: true,
  versements: { orderBy: { datePaiement: 'asc' as const } },
  client: {
    select: { id: true, nom: true, email: true, telephone: true },
  },
  centre: {
    select: {
      id: true, nom: true, adresse: true, ville: true, codePostal: true,
      telephone: true, email: true, siret: true,
    },
  },
};

@Injectable()
export class DevisLibresService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private email: EmailService,
  ) {}

  private async getCentreId(userId: string): Promise<string> {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new ForbiddenException('Centre introuvable');
    return centre.id;
  }

  private async generateNumero(centreId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.devisLibre.count({
      where: {
        centreId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    return `DL-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: CreateDevisLibreDto, userId: string) {
    const centreId = await this.getCentreId(userId);
    let clientId = dto.clientId ?? null;

    // Auto-création client si pas de clientId
    if (!clientId && dto.nomClient) {
      const existing = await this.prisma.client.findFirst({
        where: {
          centreId,
          nom: dto.nomClient,
        },
      });
      if (existing) {
        clientId = existing.id;
      } else {
        const created = await this.prisma.client.create({
          data: {
            centreId,
            nom: dto.nomClient,
            // prenom n'existe pas sur Client — stocké uniquement sur DevisLibre.prenomClient
            telephone: dto.telClient ?? undefined,
            email: dto.emailClient ?? undefined,
            adresse: dto.adresseClient ?? undefined,
            type: 'PARTICULIER',
            statut: 'CLIENT',
            source: 'DEVIS_LIBRE',
          },
        });
        clientId = created.id;
      }
    }

    const numeroDevis = await this.generateNumero(centreId);

    const devis = await this.prisma.$transaction(async (tx) => {
      const d = await tx.devisLibre.create({
        data: {
          centreId,
          clientId,
          nomClient: dto.nomClient,
          prenomClient: dto.prenomClient ?? null,
          emailClient: dto.emailClient ?? null,
          telClient: dto.telClient ?? null,
          adresseClient: dto.adresseClient ?? null,
          typeEvenement: dto.typeEvenement ?? null,
          dateDebut: new Date(dto.dateDebut),
          dateFin: new Date(dto.dateFin),
          description: dto.description ?? null,
          conditionsAnnulation: dto.conditionsAnnulation ?? null,
          notesInternes: dto.notesInternes ?? null,
          montantHT: dto.montantHT ?? null,
          montantTVA: dto.montantTVA ?? null,
          montantTTC: dto.montantTTC ?? null,
          tauxTva: dto.tauxTva ?? 0,
          pourcentageAcompte: dto.pourcentageAcompte ?? 30,
          montantAcompte: dto.montantAcompte ?? null,
          numeroDevis,
        },
      });
      if (dto.lignes && dto.lignes.length > 0) {
        await tx.ligneDevisLibre.createMany({
          data: dto.lignes.map((l) => ({ ...l, devisLibreId: d.id })),
        });
      }
      return d;
    });

    return this.prisma.devisLibre.findUnique({
      where: { id: devis.id },
      include: INCLUDE_FULL,
    });
  }

  async getMesDevisLibres(userId: string) {
    const centreId = await this.getCentreId(userId);
    return this.prisma.devisLibre.findMany({
      where: { centreId },
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const devis = await this.prisma.devisLibre.findUnique({
      where: { id },
      include: INCLUDE_FULL,
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centreId) throw new ForbiddenException();
    return devis;
  }

  async update(id: string, dto: UpdateDevisLibreDto, userId: string) {
    const centreId = await this.getCentreId(userId);
    const devis = await this.prisma.devisLibre.findUnique({ where: { id } });
    if (!devis) throw new NotFoundException();
    if (devis.centreId !== centreId) throw new ForbiddenException();
    if (devis.statut === 'ACCEPTE' || devis.statut === 'PAYE') {
      throw new ForbiddenException('Un devis accepté ou payé ne peut pas être modifié');
    }

    await this.prisma.ligneDevisLibre.deleteMany({ where: { devisLibreId: id } });

    await this.prisma.devisLibre.update({
      where: { id },
      data: {
        nomClient: dto.nomClient,
        prenomClient: dto.prenomClient ?? null,
        emailClient: dto.emailClient ?? null,
        telClient: dto.telClient ?? null,
        adresseClient: dto.adresseClient ?? null,
        typeEvenement: dto.typeEvenement ?? null,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        description: dto.description ?? null,
        conditionsAnnulation: dto.conditionsAnnulation ?? null,
        notesInternes: dto.notesInternes ?? null,
        montantHT: dto.montantHT ?? null,
        montantTVA: dto.montantTVA ?? null,
        montantTTC: dto.montantTTC ?? null,
        tauxTva: dto.tauxTva ?? null,
        pourcentageAcompte: dto.pourcentageAcompte ?? null,
        montantAcompte: dto.montantAcompte ?? null,
      },
    });

    if (dto.lignes && dto.lignes.length > 0) {
      await this.prisma.ligneDevisLibre.createMany({
        data: dto.lignes.map((l) => ({ ...l, devisLibreId: id })),
      });
    }

    return this.prisma.devisLibre.findUnique({
      where: { id },
      include: INCLUDE_FULL,
    });
  }

  async remove(id: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const devis = await this.prisma.devisLibre.findUnique({ where: { id } });
    if (!devis) throw new NotFoundException();
    if (devis.centreId !== centreId) throw new ForbiddenException();
    if (devis.statut === 'ENVOYE' || devis.statut === 'ACCEPTE') {
      throw new ForbiddenException('Impossible de supprimer un devis envoyé ou accepté');
    }
    return this.prisma.devisLibre.delete({ where: { id } });
  }

  async envoyer(id: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const devis = await this.prisma.devisLibre.findUnique({
      where: { id },
      include: { ...INCLUDE_FULL },
    });
    if (!devis) throw new NotFoundException();
    if (devis.centreId !== centreId) throw new ForbiddenException();
    if (devis.statut !== 'BROUILLON') {
      throw new ForbiddenException('Seul un devis en brouillon peut être envoyé');
    }
    if (!devis.emailClient) {
      throw new BadRequestException('Email client requis pour envoyer le devis');
    }

    // ── Génération contrat Word → PDF ──────────────────────────────────────
    const templatePath = join(process.cwd(), 'assets', 'contrat-sauvageon.docx');
    let contratUrl: string | null = null;

    if (existsSync(templatePath)) {
      try {
        const templateBuffer = readFileSync(templatePath);
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        const fmt = (d: Date) =>
          d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

        doc.render({
          dateDebut: fmt(new Date(devis.dateDebut)),
          dateFin: fmt(new Date(devis.dateFin)),
          nomClient: devis.nomClient,
          prenomClient: devis.prenomClient ?? '',
          adresseClient: devis.adresseClient ?? '',
          telClient: devis.telClient ?? '',
          emailClient: devis.emailClient ?? '',
          dateSignature: fmt(new Date()),
          nomPrenomSignataire: `${devis.nomClient} ${devis.prenomClient ?? ''}`.trim(),
        });

        const contratDocxBuffer = doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;

        // Conversion docx → pdf via LibreOffice headless
        const tmpDocx = `/tmp/contrat-${id}.docx`;
        const tmpPdf = `/tmp/contrat-${id}.pdf`;
        writeFileSync(tmpDocx, contratDocxBuffer);

        execSync(
          `soffice --headless --convert-to pdf --outdir /tmp ${tmpDocx}`,
          { timeout: 30000 },
        );

        if (existsSync(tmpPdf)) {
          const pdfBuffer = readFileSync(tmpPdf);
          contratUrl = await this.storage.uploadBuffer(
            pdfBuffer,
            `contrat-${devis.numeroDevis}.pdf`,
            'contrats',
            'application/pdf',
          );
          // Nettoyage
          try { unlinkSync(tmpDocx); } catch {}
          try { unlinkSync(tmpPdf); } catch {}
        }
      } catch (err) {
        // Non bloquant — on envoie quand même l'email sans contrat PDF si erreur
        console.error('Erreur génération contrat PDF:', err);
      }
    }

    // ── Email au client ────────────────────────────────────────────────────
    const lienSignature = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/devis-libre/signer/${devis.tokenSignature}`;
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const htmlEmail = `
      <p>Bonjour ${devis.prenomClient ?? devis.nomClient},</p>
      <p>Veuillez trouver ci-dessous votre devis pour <strong>${devis.typeEvenement ?? 'votre événement'}</strong>
      du <strong>${fmt(new Date(devis.dateDebut))}</strong> au <strong>${fmt(new Date(devis.dateFin))}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">Montant TTC</td>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">Acompte (${devis.pourcentageAcompte ?? 30}%)</td>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#d97706">${Number(devis.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td></tr>
      </table>
      ${contratUrl ? `<p>📄 <a href="${contratUrl}">Télécharger le contrat PDF</a></p>` : ''}
      <p style="margin:24px 0">
        <a href="${lienSignature}" style="display:inline-block;background:#1B4060;color:#fff;padding:14px 32px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px">
          ✍️ Signer le devis en ligne
        </a>
      </p>
      <p style="color:#9ca3af;font-size:12px">
        Ce lien est personnel et sécurisé. En cliquant sur "Signer", vous acceptez les conditions générales du contrat.
      </p>
    `;

    await this.email.sendGenericNotification(
      devis.emailClient,
      `Devis ${devis.numeroDevis} — ${devis.typeEvenement ?? 'Événement'} · Chalet Le Sauvageon`,
      htmlEmail,
    );

    // ── Mise à jour statut ─────────────────────────────────────────────────
    return this.prisma.devisLibre.update({
      where: { id },
      data: {
        statut: 'ENVOYE',
        ...(contratUrl ? { contratUrl } : {}),
      },
      include: INCLUDE_FULL,
    });
  }

  async getForSignature(token: string) {
    const devis = await this.prisma.devisLibre.findUnique({
      where: { tokenSignature: token },
      include: {
        lignes: true,
        centre: {
          select: {
            nom: true, adresse: true, ville: true, codePostal: true,
            telephone: true, email: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Lien de signature invalide');
    if (devis.statut !== 'ENVOYE') {
      throw new ForbiddenException(
        devis.statut === 'ACCEPTE'
          ? 'Ce devis a déjà été signé'
          : 'Ce lien de signature n\'est plus actif',
      );
    }
    // Ne pas exposer les données sensibles
    const { notesInternes, signatureIp, signatureUserAgent, ...safe } = devis as any;
    return safe;
  }

  async signer(token: string, dto: SignerDevisDto, req: Request) {
    const devis = await this.prisma.devisLibre.findUnique({
      where: { tokenSignature: token },
      include: {
        centre: {
          select: { nom: true, email: true },
        },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (devis.statut !== 'ENVOYE') {
      throw new ForbiddenException('Ce devis ne peut plus être signé');
    }
    if (!dto.confirmation) {
      throw new BadRequestException('Vous devez accepter les conditions pour signer');
    }

    const now = new Date();
    const hash = createHash('sha256')
      .update(`${token}${dto.nomSignataire}${now.toISOString()}${devis.montantTTC ?? '0'}`)
      .digest('hex');

    await this.prisma.devisLibre.update({
      where: { id: devis.id },
      data: {
        statut: 'ACCEPTE',
        signatureClient: `Signé électroniquement par ${dto.nomSignataire} — ${now.toLocaleDateString('fr-FR')}`,
        dateSignatureClient: now,
        signatureIp: req.ip ?? null,
        signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
        signatureHash: hash,
      },
    });

    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Email confirmation client
    if (devis.emailClient) {
      await this.email.sendGenericNotification(
        devis.emailClient,
        `Confirmation de réservation — ${devis.typeEvenement ?? 'Événement'} · Chalet Le Sauvageon`,
        `<p>Bonjour,</p>
         <p>Nous confirmons la signature de votre devis <strong>${devis.numeroDevis}</strong>
         pour <strong>${devis.typeEvenement ?? 'votre événement'}</strong>
         du ${fmt(new Date(devis.dateDebut))} au ${fmt(new Date(devis.dateFin))}.</p>
         <p><strong>Signé par :</strong> ${dto.nomSignataire}<br>
         <strong>Date :</strong> ${fmt(now)}</p>
         <p>Un acompte de <strong>${Number(devis.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>
         est à régler par virement dans un délai d'un mois.</p>
         <p>À bientôt au Chalet Le Sauvageon !</p>`,
      );
    }

    // Email notification hébergeur
    if (devis.centre?.email) {
      await this.email.sendGenericNotification(
        devis.centre.email,
        `✅ Devis signé — ${devis.typeEvenement ?? 'Événement'} · ${devis.nomClient}`,
        `<p>Le devis <strong>${devis.numeroDevis}</strong> a été signé électroniquement.</p>
         <p><strong>Client :</strong> ${dto.nomSignataire}<br>
         <strong>Événement :</strong> ${devis.typeEvenement ?? '—'}<br>
         <strong>Dates :</strong> ${fmt(new Date(devis.dateDebut))} → ${fmt(new Date(devis.dateFin))}<br>
         <strong>Montant TTC :</strong> ${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>`,
      );
    }

    return { success: true, message: 'Devis signé avec succès' };
  }

  async ajouterVersement(id: string, dto: AjouterVersementDto, userId: string) {
    const centreId = await this.getCentreId(userId);
    const devis = await this.prisma.devisLibre.findUnique({
      where: { id },
      include: { versements: true },
    });
    if (!devis) throw new NotFoundException();
    if (devis.centreId !== centreId) throw new ForbiddenException();
    if (devis.statut !== 'ACCEPTE' && devis.statut !== 'PAYE') {
      throw new ForbiddenException('Seul un devis accepté peut recevoir un versement');
    }

    await this.prisma.versementDevisLibre.create({
      data: {
        devisLibreId: id,
        montant: dto.montant,
        datePaiement: new Date(dto.datePaiement),
        reference: dto.reference ?? null,
      },
    });

    const nouveauTotal = (devis.montantVerseTotal ?? 0) + dto.montant;
    const montantTTC = devis.montantTTC ?? 0;
    const estPaye = montantTTC > 0 && nouveauTotal >= montantTTC * 0.99;

    return this.prisma.devisLibre.update({
      where: { id },
      data: {
        montantVerseTotal: nouveauTotal,
        ...(estPaye ? { statut: 'PAYE' } : {}),
      },
      include: INCLUDE_FULL,
    });
  }
}
