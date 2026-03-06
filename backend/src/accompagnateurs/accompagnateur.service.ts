import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateAccompagnateurDto } from './dto/create-accompagnateur.dto.js';
import { SignerAccompagnateurDto } from './dto/signer-accompagnateur.dto.js';

const FRONTEND_URL = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

@Injectable()
export class AccompagnateurService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateAccompagnateurDto, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: dto.sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const accompagnateur = await this.prisma.accompagnateurMission.create({
      data: {
        sejourId: dto.sejourId,
        prenom: dto.prenom,
        nom: dto.nom,
        email: dto.email,
        telephone: dto.telephone ?? null,
      },
    });

    const lien = `${FRONTEND_URL}/ordre-mission/${accompagnateur.tokenAcces}`;
    await this.email.sendGenericNotification(
      dto.email,
      `Ordre de mission — ${sejour.titre}`,
      `Bonjour ${dto.prenom} ${dto.nom},<br><br>Vous êtes désigné(e) comme accompagnateur pour le séjour scolaire <strong>« ${sejour.titre} »</strong>.<br><br>Veuillez signer votre ordre de mission en cliquant sur le lien suivant :<br><a href="${lien}">${lien}</a>`,
    );

    return accompagnateur;
  }

  async getBySejour(sejourId: string) {
    return this.prisma.accompagnateurMission.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByToken(token: string) {
    const accompagnateur = await this.prisma.accompagnateurMission.findUnique({
      where: { tokenAcces: token },
      include: {
        sejour: {
          select: {
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            description: true,
            niveauClasse: true,
            createur: { select: { prenom: true, nom: true, etablissementNom: true, etablissementVille: true } },
            hebergements: { select: { nom: true, adresse: true, ville: true }, take: 1 },
          },
        },
      },
    });
    if (!accompagnateur) throw new NotFoundException('Ordre de mission introuvable');

    const sejour = accompagnateur.sejour;
    return {
      prenom: accompagnateur.prenom,
      nom: accompagnateur.nom,
      email: accompagnateur.email,
      signeeAt: accompagnateur.signeeAt,
      sejour: {
        titre: sejour.titre,
        lieu: sejour.lieu,
        dateDebut: sejour.dateDebut,
        dateFin: sejour.dateFin,
        description: sejour.description,
        niveauClasse: sejour.niveauClasse,
        etablissement: sejour.createur?.etablissementNom ?? null,
        etablissementVille: sejour.createur?.etablissementVille ?? null,
        enseignant: sejour.createur ? `${sejour.createur.prenom} ${sejour.createur.nom}` : null,
      },
      hebergement: sejour.hebergements[0] ?? null,
    };
  }

  async signer(token: string, dto: SignerAccompagnateurDto) {
    if (!dto.rgpdAccepte) {
      throw new BadRequestException('Vous devez accepter les conditions RGPD.');
    }

    const accompagnateur = await this.prisma.accompagnateurMission.findUnique({
      where: { tokenAcces: token },
    });
    if (!accompagnateur) throw new NotFoundException('Ordre de mission introuvable');
    if (accompagnateur.signeeAt) throw new ConflictException('Cet ordre de mission a déjà été signé');

    return this.prisma.accompagnateurMission.update({
      where: { tokenAcces: token },
      data: {
        signeeAt: new Date(),
        signatureNom: dto.signatureNom,
        contactUrgenceNom: dto.contactUrgenceNom ?? null,
        contactUrgenceTel: dto.contactUrgenceTel ?? null,
      },
    });
  }

  async getOrdreMissionHtml(id: string) {
    const accompagnateur = await this.prisma.accompagnateurMission.findUnique({
      where: { id },
      include: {
        sejour: {
          select: {
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            createur: { select: { prenom: true, nom: true, etablissementNom: true, etablissementAdresse: true, etablissementVille: true } },
            hebergements: { select: { nom: true, adresse: true, ville: true }, take: 1 },
          },
        },
      },
    });
    if (!accompagnateur) throw new NotFoundException('Accompagnateur introuvable');

    const s = accompagnateur.sejour;
    const c = s.createur;
    const h = s.hebergements[0];
    const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const signatureDate = accompagnateur.signeeAt ? fmtDate(accompagnateur.signeeAt) : 'Non signé';

    return {
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Segoe UI',sans-serif;margin:40px;color:#1a1a1a;line-height:1.6}
.header{text-align:center;border-bottom:2px solid #003189;padding-bottom:16px;margin-bottom:32px}
.header h1{color:#003189;font-size:22px;margin:0}
.header p{color:#666;font-size:13px;margin:4px 0 0}
h2{color:#003189;font-size:18px;text-align:center;margin:32px 0 24px;text-transform:uppercase;letter-spacing:2px}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px 12px;font-size:14px;border-bottom:1px solid #eee}
td:first-child{color:#666;width:200px}
td:last-child{font-weight:600}
.signature{margin-top:48px;border-top:1px solid #ccc;padding-top:24px}
.signature p{font-size:13px;color:#666}
.signature .name{font-size:16px;font-weight:700;color:#003189}
</style></head><body>
<div class="header">
  <h1>${c?.etablissementNom ?? 'Établissement scolaire'}</h1>
  <p>${c?.etablissementAdresse ?? ''} ${c?.etablissementVille ?? ''}</p>
</div>
<h2>Ordre de mission</h2>
<table>
  <tr><td>Accompagnateur</td><td>${accompagnateur.prenom} ${accompagnateur.nom}</td></tr>
  <tr><td>Email</td><td>${accompagnateur.email}</td></tr>
  ${accompagnateur.telephone ? `<tr><td>Téléphone</td><td>${accompagnateur.telephone}</td></tr>` : ''}
  <tr><td>Séjour</td><td>${s.titre}</td></tr>
  <tr><td>Destination</td><td>${s.lieu}</td></tr>
  <tr><td>Dates</td><td>Du ${fmtDate(s.dateDebut)} au ${fmtDate(s.dateFin)}</td></tr>
  ${h ? `<tr><td>Hébergement</td><td>${h.nom}${h.adresse ? `, ${h.adresse}` : ''}${h.ville ? `, ${h.ville}` : ''}</td></tr>` : ''}
  ${accompagnateur.contactUrgenceNom ? `<tr><td>Contact d'urgence</td><td>${accompagnateur.contactUrgenceNom} — ${accompagnateur.contactUrgenceTel ?? ''}</td></tr>` : ''}
  <tr><td>Enseignant responsable</td><td>${c ? `${c.prenom} ${c.nom}` : '—'}</td></tr>
</table>
<div class="signature">
  <p>Signature électronique</p>
  <p class="name">${accompagnateur.signatureNom ?? '—'}</p>
  <p>Date : ${signatureDate}</p>
</div>
</body></html>`,
    };
  }
}
