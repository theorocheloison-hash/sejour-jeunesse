import { Injectable, Logger } from '@nestjs/common';
import * as SibApiV3Sdk from '@sendinblue/client';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? 'noreply@sejour-jeunesse.fr';
const SENDER_NAME = process.env.BREVO_SENDER_NAME ?? 'Séjour Jeunesse';
const FRONTEND_URL = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

// ─── Couleurs Éducation Nationale ───────────────────────────────────────────
const PRIMARY = '#003189';
const BG = '#f5f7fa';

function emailLayout(title: string, body: string, buttonText?: string, buttonUrl?: string): string {
  const btn = buttonText && buttonUrl
    ? `<tr><td style="padding:24px 0 0">
         <a href="${buttonUrl}" style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">${buttonText}</a>
       </td></tr>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="background:${PRIMARY};padding:20px 32px">
      <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.5px">Séjour Jeunesse</span>
    </td></tr>
    <tr><td style="padding:32px">
      <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px">${title}</h2>
      <div style="color:#4a4a4a;font-size:14px;line-height:1.6">${body}</div>
      ${btn}
    </td></tr>
    <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #eee">
      <p style="margin:0;color:#999;font-size:11px">Cet email a été envoyé automatiquement par la plateforme Séjour Jeunesse. Ne répondez pas à cet email.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private api: SibApiV3Sdk.TransactionalEmailsApi;

  constructor() {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    if (BREVO_API_KEY) {
      this.api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!BREVO_API_KEY) {
      this.logger.warn(`[EMAIL SKIP] BREVO_API_KEY non configurée — ${subject} → ${to}`);
      return;
    }
    try {
      await this.api.sendTransacEmail({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      });
      this.logger.log(`[EMAIL OK] ${subject} → ${to}`);
    } catch (err) {
      this.logger.error(`[EMAIL FAIL] ${subject} → ${to}`, err);
    }
  }

  // ── a) Autorisation parentale ─────────────────────────────────────────

  async sendAutorisationParentale(
    to: string,
    eleveNom: string,
    sejourTitre: string,
    lienAutorisation: string,
  ) {
    const html = emailLayout(
      'Autorisation parentale requise',
      `<p>Bonjour,</p>
       <p>Votre enfant <strong>${eleveNom}</strong> est inscrit au séjour scolaire <strong>« ${sejourTitre} »</strong>.</p>
       <p>Nous avons besoin de votre autorisation parentale pour que votre enfant puisse participer à ce séjour. Veuillez cliquer sur le bouton ci-dessous pour consulter les détails et signer l'autorisation en ligne.</p>`,
      'Signer l\'autorisation',
      lienAutorisation,
    );
    await this.send(to, `Autorisation parentale — ${sejourTitre}`, html);
  }

  // ── b) Devis reçu ────────────────────────────────────────────────────

  async sendDevisRecu(
    to: string,
    enseignantNom: string,
    sejourTitre: string,
    centreNom: string,
    montant: string,
  ) {
    const html = emailLayout(
      'Nouveau devis reçu',
      `<p>Bonjour ${enseignantNom},</p>
       <p>Vous avez reçu un nouveau devis pour votre séjour <strong>« ${sejourTitre} »</strong> :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centreNom}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Montant total</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${montant} €</td></tr>
       </table>
       <p>Connectez-vous pour consulter le détail et comparer les offres.</p>`,
      'Voir les devis',
      `${FRONTEND_URL}/dashboard/teacher`,
    );
    await this.send(to, `Nouveau devis — ${sejourTitre}`, html);
  }

  // ── c) Séjour approuvé ───────────────────────────────────────────────

  async sendSejourApprouve(to: string, enseignantNom: string, sejourTitre: string) {
    const html = emailLayout(
      'Séjour approuvé !',
      `<p>Bonjour ${enseignantNom},</p>
       <p>Bonne nouvelle ! Votre séjour <strong>« ${sejourTitre} »</strong> a été <strong style="color:#16a34a">approuvé</strong> par le directeur.</p>
       <p>Vous pouvez maintenant gérer les autorisations parentales et poursuivre l'organisation.</p>`,
      'Accéder au séjour',
      `${FRONTEND_URL}/dashboard/teacher`,
    );
    await this.send(to, `Séjour approuvé — ${sejourTitre}`, html);
  }

  // ── d) Nouvelle demande de devis ──────────────────────────────────────

  async sendNouvelleDemandeDevis(
    to: string,
    centreNom: string,
    sejourTitre: string,
    destination: string,
    dateDebut: string,
    dateFin: string,
  ) {
    const html = emailLayout(
      'Nouvelle demande de devis',
      `<p>Bonjour ${centreNom},</p>
       <p>Un enseignant recherche un hébergement pour un séjour scolaire :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejourTitre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Destination</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${destination}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${dateDebut} → ${dateFin}</td></tr>
       </table>
       <p>Connectez-vous pour consulter la demande et envoyer votre devis.</p>`,
      'Voir la demande',
      `${FRONTEND_URL}/dashboard/venue/demandes`,
    );
    await this.send(to, `Nouvelle demande — ${sejourTitre}`, html);
  }

  // ── e) Devis sélectionné ──────────────────────────────────────────────

  async sendDevisSelectionne(to: string, centreNom: string, sejourTitre: string) {
    const html = emailLayout(
      'Votre devis a été sélectionné !',
      `<p>Bonjour ${centreNom},</p>
       <p>Félicitations ! Votre devis pour le séjour <strong>« ${sejourTitre} »</strong> a été <strong style="color:#16a34a">sélectionné</strong>.</p>
       <p>Le séjour passe maintenant en phase de convention. Connectez-vous à l'espace collaboratif pour échanger avec l'enseignant et organiser le séjour.</p>`,
      'Accéder à l\'espace collaboratif',
      `${FRONTEND_URL}/dashboard/venue`,
    );
    await this.send(to, `Devis sélectionné — ${sejourTitre}`, html);
  }

  // ── f) Ordre de mission accompagnateur ────────────────────────────────

  async sendOrdreMission(
    to: string,
    accompagnateurPrenom: string,
    accompagnateurNom: string,
    sejourTitre: string,
    lienOrdreMission: string,
  ) {
    const html = emailLayout(
      'Ordre de mission — Séjour scolaire',
      `<p>Bonjour ${accompagnateurPrenom} ${accompagnateurNom},</p>
       <p>Vous êtes désigné(e) comme <strong>accompagnateur(trice)</strong> pour le séjour scolaire <strong>« ${sejourTitre} »</strong>.</p>
       <p>Veuillez consulter et signer votre ordre de mission en cliquant sur le bouton ci-dessous :</p>`,
      'Signer mon ordre de mission',
      lienOrdreMission,
    );
    await this.send(to, `Ordre de mission — ${sejourTitre}`, html);
  }

  // ── g) Paiement disponible (parents) ─────────────────────────────────

  async sendPaiementDisponible(
    to: string,
    sejourTitre: string,
    etablissement: string,
    prixFormate: string,
    elevePrenom: string,
    eleveNom: string,
    lienAutorisation: string,
  ) {
    const html = emailLayout(
      'Paiement du séjour disponible',
      `<p>Bonjour,</p>
       <p>Le prix du séjour <strong>« ${sejourTitre} »</strong> organisé par <strong>${etablissement}</strong> vient d'être défini :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Prix par élève</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${prixFormate} €</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Paiement</td><td style="padding:8px 12px;font-size:13px;font-weight:600">En 1 à 10 fois sans frais</td></tr>
       </table>
       <p>Pour régler la participation de <strong>${elevePrenom} ${eleveNom}</strong>, cliquez sur le bouton ci-dessous.</p>
       <p style="color:#888;font-size:12px;margin-top:16px">Ce lien vous permettra également de retrouver l'ensemble des informations du séjour.</p>`,
      'Accéder au paiement',
      lienAutorisation,
    );
    await this.send(to, `Règlement du séjour ${sejourTitre} — paiement disponible`, html);
  }

  // ── g) Notification générique ────────────────────────────────────────

  async sendGenericNotification(to: string, subject: string, message: string) {
    const html = emailLayout(
      subject,
      `<p>${message}</p>`,
      'Accéder à la plateforme',
      `${FRONTEND_URL}/login`,
    );
    await this.send(to, subject, html);
  }

  // ── g) Vérification email ────────────────────────────────────────────

  async sendVerificationEmail(to: string, prenom: string, token: string) {
    const lien = `${FRONTEND_URL}/verify-email/${token}`;
    const html = emailLayout(
      'Vérifiez votre adresse email',
      `<p>Bonjour ${prenom},</p>
       <p>Bienvenue sur <strong>Séjour Jeunesse</strong> ! Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.</p>
       <p style="color:#888;font-size:12px;margin-top:16px">Ce lien est valable 48 heures.</p>`,
      'Vérifier mon email',
      lien,
    );
    await this.send(to, 'Vérifiez votre email — Séjour Jeunesse', html);
  }

  // ── g) Compte hébergeur en attente ─────────────────────────────────

  async sendVenueAccountPending(to: string, prenom: string, nomCentre: string) {
    const html = emailLayout(
      'Compte en attente de validation',
      `<p>Bonjour ${prenom},</p>
       <p>Votre inscription en tant qu'hébergeur pour le centre <strong>« ${nomCentre} »</strong> a bien été enregistrée.</p>
       <p>Votre compte est actuellement <strong style="color:#d97706">en attente de validation</strong> par notre équipe. Vous recevrez un email dès que votre compte sera activé.</p>
       <p>En attendant, vous pouvez vérifier votre email pour accélérer le processus.</p>`,
    );
    await this.send(to, 'Inscription hébergeur en attente — Séjour Jeunesse', html);
  }

  // ── h) Dossier soumis au rectorat ─────────────────────────────────────

  async sendDossierSoumisRectorat(
    to: string,
    rectoratEmail: string,
    sejourTitre: string,
    enseignantNom: string,
  ) {
    const html = emailLayout(
      'Dossier de séjour soumis',
      `<p>Bonjour,</p>
       <p>Un dossier de séjour scolaire a été soumis pour validation :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejourTitre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Enseignant</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${enseignantNom}</td></tr>
       </table>
       <p>Connectez-vous à la plateforme pour examiner le dossier complet.</p>`,
      'Examiner le dossier',
      `${FRONTEND_URL}/dashboard/rector`,
    );
    // Envoyer au rectorat
    await this.send(rectoratEmail, `Dossier séjour — ${sejourTitre}`, html);
    // Confirmation à l'enseignant
    const confirmHtml = emailLayout(
      'Dossier transmis au rectorat',
      `<p>Bonjour ${enseignantNom},</p>
       <p>Votre dossier pour le séjour <strong>« ${sejourTitre} »</strong> a bien été transmis au rectorat.</p>
       <p>Vous recevrez une notification lorsque le rectorat aura examiné votre dossier.</p>`,
    );
    await this.send(to, `Dossier transmis — ${sejourTitre}`, confirmHtml);
  }
}
