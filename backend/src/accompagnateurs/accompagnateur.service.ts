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
    console.log(`[ACCOMPAGNATEUR] Envoi email ordre de mission à ${dto.email} — lien: ${lien}`);
    await this.email.sendOrdreMission(
      dto.email,
      dto.prenom,
      dto.nom,
      sejour.titre,
      lien,
    );
    console.log(`[ACCOMPAGNATEUR] Email envoyé avec succès à ${dto.email}`);

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
            id: true,
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            description: true,
            niveauClasse: true,
            placesTotales: true,
            createur: {
              select: {
                prenom: true,
                nom: true,
                etablissementNom: true,
                etablissementAdresse: true,
                etablissementVille: true,
                etablissementUai: true,
                etablissementEmail: true,
                etablissementTelephone: true,
              },
            },
            hebergements: { select: { nom: true, adresse: true, ville: true }, take: 1 },
          },
        },
      },
    });
    if (!accompagnateur) throw new NotFoundException('Ordre de mission introuvable');

    const sejour = accompagnateur.sejour;
    const c = sejour.createur;
    return {
      id: accompagnateur.id,
      prenom: accompagnateur.prenom,
      nom: accompagnateur.nom,
      email: accompagnateur.email,
      signeeAt: accompagnateur.signeeAt,
      signatureNom: accompagnateur.signatureNom,
      createdAt: accompagnateur.createdAt,
      sejour: {
        id: sejour.id,
        titre: sejour.titre,
        lieu: sejour.lieu,
        dateDebut: sejour.dateDebut,
        dateFin: sejour.dateFin,
        description: sejour.description,
        niveauClasse: sejour.niveauClasse,
        placesTotales: sejour.placesTotales,
        etablissement: c?.etablissementNom ?? null,
        etablissementAdresse: c?.etablissementAdresse ?? null,
        etablissementVille: c?.etablissementVille ?? null,
        etablissementUai: c?.etablissementUai ?? null,
        etablissementEmail: c?.etablissementEmail ?? null,
        etablissementTelephone: c?.etablissementTelephone ?? null,
        enseignant: c ? `${c.prenom} ${c.nom}` : null,
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
        moyenTransport: dto.moyenTransport ?? null,
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
            id: true,
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            niveauClasse: true,
            placesTotales: true,
            createur: {
              select: {
                prenom: true,
                nom: true,
                etablissementNom: true,
                etablissementAdresse: true,
                etablissementVille: true,
                etablissementUai: true,
                etablissementEmail: true,
                etablissementTelephone: true,
              },
            },
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

    const annee = s.dateDebut.getFullYear();
    const idShort = accompagnateur.id.slice(0, 4).toUpperCase();
    const numOM = `OM-${annee}-${idShort}`;

    const msPerDay = 86_400_000;
    const nuits = Math.round((s.dateFin.getTime() - s.dateDebut.getTime()) / msPerDay);
    const jours = nuits + 1;

    return {
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{margin:20mm 15mm}
body{font-family:'Times New Roman',Georgia,serif;margin:0;padding:40px;color:#1a1a1a;line-height:1.5;font-size:13px}
.ministere{text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#003189;font-weight:700;margin-bottom:4px}
.republique{text-align:center;font-size:10px;color:#666;margin-bottom:20px}
.entete{display:flex;justify-content:space-between;border-bottom:2px solid #003189;padding-bottom:16px;margin-bottom:24px}
.entete-gauche{font-size:12px;line-height:1.5}
.entete-gauche .etab{font-size:15px;font-weight:700;color:#003189}
.entete-droite{text-align:right;font-size:11px;line-height:1.5}
.entete-droite .num{font-size:14px;font-weight:700;color:#003189;margin-bottom:4px}
h2{color:#003189;font-size:18px;text-align:center;margin:28px 0 20px;text-transform:uppercase;letter-spacing:3px;border-bottom:1px solid #003189;padding-bottom:8px}
.section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#003189;background:#f0f4fa;padding:6px 12px;margin:20px 0 12px;border-left:3px solid #003189}
table{width:100%;border-collapse:collapse;margin:0 0 8px}
td{padding:5px 12px;font-size:13px;vertical-align:top}
td:first-child{color:#555;width:220px;font-weight:400}
td:last-child{font-weight:600;color:#1a1a1a}
.reglementaire{font-size:11px;color:#555;line-height:1.6;border:1px solid #ddd;padding:12px 16px;margin:20px 0;background:#fafafa;text-align:justify}
.signature-block{margin-top:40px;display:flex;justify-content:space-between;gap:40px}
.signature-col{flex:1}
.signature-col .label{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.signature-col .name{font-size:14px;font-weight:700;color:#003189;margin-top:8px}
.signature-col .date{font-size:12px;color:#666;margin-top:4px}
.footer{margin-top:40px;border-top:1px solid #ccc;padding-top:12px;font-size:10px;color:#999;text-align:center}
</style></head><body>
<div class="ministere">Ministère de l'Éducation Nationale</div>
<div class="republique">République Française — Liberté, Égalité, Fraternité</div>
<div class="entete">
  <div class="entete-gauche">
    <div class="etab">${c?.etablissementNom ?? 'Établissement scolaire'}</div>
    ${c?.etablissementAdresse ? `<div>${c.etablissementAdresse}</div>` : ''}
    ${c?.etablissementVille ? `<div>${c.etablissementVille}</div>` : ''}
    ${c?.etablissementUai ? `<div>UAI : ${c.etablissementUai}</div>` : ''}
    ${c?.etablissementTelephone ? `<div>Tél. : ${c.etablissementTelephone}</div>` : ''}
    ${c?.etablissementEmail ? `<div>${c.etablissementEmail}</div>` : ''}
  </div>
  <div class="entete-droite">
    <div class="num">${numOM}</div>
    <div>Date d'émission : ${fmtDate(accompagnateur.createdAt)}</div>
  </div>
</div>
<h2>Ordre de mission</h2>
<div class="section-title">Désignation de l'agent</div>
<table>
  <tr><td>Nom et prénom</td><td>${accompagnateur.nom} ${accompagnateur.prenom}</td></tr>
  <tr><td>Qualité / Fonction</td><td>Enseignant(e) accompagnateur(trice)</td></tr>
  <tr><td>Email</td><td>${accompagnateur.email}</td></tr>
  ${accompagnateur.telephone ? `<tr><td>Téléphone</td><td>${accompagnateur.telephone}</td></tr>` : ''}
  <tr><td>Établissement d'affectation</td><td>${c?.etablissementNom ?? '—'}</td></tr>
</table>
<div class="section-title">Objet de la mission</div>
<table>
  <tr><td>Objet</td><td>Accompagnement pédagogique — séjour scolaire</td></tr>
  <tr><td>Intitulé du séjour</td><td>${s.titre}</td></tr>
  ${s.niveauClasse ? `<tr><td>Niveau de classe</td><td>${s.niveauClasse}</td></tr>` : ''}
  <tr><td>Nombre d'élèves encadrés</td><td>${s.placesTotales}</td></tr>
  <tr><td>Enseignant responsable</td><td>${c ? `${c.prenom} ${c.nom}` : '—'}</td></tr>
</table>
<div class="section-title">Lieu et dates de mission</div>
<table>
  <tr><td>Destination</td><td>${s.lieu}</td></tr>
  ${h ? `<tr><td>Hébergement</td><td>${h.nom}${h.adresse ? `, ${h.adresse}` : ''}${h.ville ? `, ${h.ville}` : ''}</td></tr>` : ''}
  <tr><td>Date de départ</td><td>${fmtDate(s.dateDebut)}</td></tr>
  <tr><td>Date de retour</td><td>${fmtDate(s.dateFin)}</td></tr>
  <tr><td>Durée</td><td>${nuits} nuit${nuits > 1 ? 's' : ''} / ${jours} jour${jours > 1 ? 's' : ''}</td></tr>
</table>
${accompagnateur.contactUrgenceNom ? `
<div class="section-title">Contact d'urgence</div>
<table>
  <tr><td>Nom</td><td>${accompagnateur.contactUrgenceNom}</td></tr>
  ${accompagnateur.contactUrgenceTel ? `<tr><td>Téléphone</td><td>${accompagnateur.contactUrgenceTel}</td></tr>` : ''}
</table>` : ''}
<div class="section-title">Références réglementaires</div>
<div class="reglementaire">
Le présent ordre de mission est établi conformément au Décret n°2006-781 du 3 juillet 2006 fixant les conditions et les modalités de règlement des frais occasionnés par les déplacements temporaires des personnels civils de l'État, et à la circulaire n°2011-117 du 3 août 2011 relative aux sorties et voyages scolaires. L'agent désigné est autorisé à se rendre sur le lieu de mission indiqué ci-dessus pour y exercer les fonctions d'accompagnement pédagogique dans le cadre du séjour scolaire.
</div>
<div class="signature-block">
  <div class="signature-col">
    <div class="label">Signature de l'accompagnateur</div>
    <div class="name">${accompagnateur.signatureNom ?? '—'}</div>
    <div class="date">Date : ${signatureDate}</div>
  </div>
  <div class="signature-col" style="text-align:right">
    <div class="label">Le chef d'établissement</div>
    <div class="name">${c ? `${c.prenom} ${c.nom}` : '—'}</div>
    <div class="date">${c?.etablissementNom ?? ''}</div>
  </div>
</div>
<div class="footer">Document généré automatiquement par la plateforme Séjour Jeunesse — ${numOM}</div>
</body></html>`,
    };
  }
}
