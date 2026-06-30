import { Injectable, Logger } from '@nestjs/common';
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'theo.rocheloison@gmail.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME ?? 'Liavo';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://liavo.fr';

// ─── Couleurs LIAVO ─────────────────────────────────────────────────────────
const PRIMARY = '#1B4060';
const BG = '#f5f7fa';

function emailLayout(title: string, body: string, buttonText?: string, buttonUrl?: string, replyToName?: string): string {
  const btn = buttonText && buttonUrl
    ? `<tr><td style="padding:24px 0 0">
         <a href="${buttonUrl}" style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">${buttonText}</a>
       </td></tr>`
    : '';
  // Footer adapté : si un reply-to est actif, on invite le destinataire à répondre.
  const footerText = replyToName
    ? `Vous pouvez répondre directement à cet email pour contacter ${replyToName}.`
    : 'Cet email a été envoyé automatiquement par la plateforme Liavo. Ne répondez pas à cet email.';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="background:${PRIMARY};padding:20px 32px">
      <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.5px">Liavo</span>
    </td></tr>
    <tr><td style="padding:32px">
      <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px">${title}</h2>
      <div style="color:#4a4a4a;font-size:14px;line-height:1.6">${body}</div>
      ${btn}
    </td></tr>
    <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #eee">
      <p style="margin:0;color:#999;font-size:11px">${footerText}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private api: TransactionalEmailsApi;

  constructor() {
    this.api = new TransactionalEmailsApi();
    if (BREVO_API_KEY) {
      this.api.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
    }
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    fromName?: string,
    replyTo?: { name: string; email: string },
    attachment?: Array<{ content: string; name: string }>,
  ) {
    if (!BREVO_API_KEY) {
      this.logger.warn(`[send] BREVO_API_KEY non configurée — subject="${subject}"`);
      return;
    }
    const senderName = fromName?.trim() || SENDER_NAME;
    this.logger.log(`[send] ${subject} → ${to}`);
    try {
      await this.api.sendTransacEmail({
        sender: { name: senderName, email: SENDER_EMAIL },
        to: [{ email: to }],
        ...(replyTo ? { replyTo } : {}),
        subject,
        htmlContent: html,
        ...(attachment ? { attachment } : {}),
      });
      this.logger.log(`[send OK] ${subject} → ${to}`);
    } catch (err: any) {
      const body = err?.response?.body ?? err?.body ?? err?.message ?? err;
      this.logger.error(`[send FAIL] ${subject} → ${to}`, JSON.stringify(body));
      throw err;
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
    magicUrl?: string,
  ) {
    const html = emailLayout(
      'Nouveau devis reçu',
      `<p>Bonjour ${enseignantNom},</p>
       <p>Vous avez reçu un nouveau devis pour votre séjour <strong>« ${sejourTitre} »</strong> :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centreNom}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Montant total</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${montant} €</td></tr>
       </table>
       <p>Cliquez ci-dessous pour consulter le détail du devis.${magicUrl ? ' Aucun mot de passe requis.' : ''}</p>`,
      'Consulter le devis',
      magicUrl ?? `${FRONTEND_URL}/login`,
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
    periodeLabel: string,
    typeContexte?: string,
  ) {
    const contexteLabel = typeContexte === 'COLO'
      ? 'Un organisateur recherche un hébergement pour une colonie de vacances'
      : typeContexte === 'GROUPE'
      ? 'Un organisateur recherche un hébergement pour un séjour de groupe'
      : 'Un enseignant recherche un hébergement pour un séjour scolaire';

    const html = emailLayout(
      'Nouvelle demande de devis',
      `<p>Bonjour ${centreNom},</p>
       <p>${contexteLabel} :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejourTitre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Destination</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${destination}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Dates / Période</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${periodeLabel}</td></tr>
       </table>
       <p>Connectez-vous pour consulter la demande et envoyer votre devis.</p>`,
      'Voir la demande',
      `${FRONTEND_URL}/dashboard/hebergeur/demandes`,
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
      `${FRONTEND_URL}/dashboard/hebergeur`,
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

  async sendGenericNotification(
    to: string,
    subject: string,
    message: string,
    fromName?: string,
    replyTo?: { name: string; email: string },
  ) {
    const html = emailLayout(
      subject,
      `<p>${message}</p>`,
      'Accéder à la plateforme',
      `${FRONTEND_URL}/login`,
      replyTo?.name,
    );
    await this.send(to, subject, html, fromName, replyTo);
  }

  /**
   * Envoie une facture par email avec le PDF en pièce jointe.
   * Action manuelle déclenchée par l'hébergeur (découplée de l'émission).
   * Le replyTo pointe vers le centre : le destinataire répond directement à l'hébergeur.
   */
  async sendFactureParEmail(
    to: string,
    subject: string,
    messageHtml: string,
    pdfBuffer: Buffer,
    pdfFilename: string,
    replyTo: { name: string; email: string },
  ): Promise<void> {
    const base64 = pdfBuffer.toString('base64');
    const html = emailLayout(subject, messageHtml, undefined, undefined, replyTo.name);
    await this.send(to, subject, html, undefined, replyTo, [{ content: base64, name: pdfFilename }]);
  }

  /**
   * Notifie l'admin (contact@liavo.fr) qu'un nouveau compte a été créé.
   * Réutilise sendGenericNotification (zéro duplication). À appeler en
   * fire-and-forget côté appelant : `.catch(() => {})` (jamais bloquant).
   */
  async notifyAdminNewAccount(
    user: { prenom: string; nom: string; email: string; role: string },
    extra?: string,
  ): Promise<void> {
    const ROLE_LABEL: Record<string, string> = {
      ORGANISATEUR: 'Organisateur',
      SIGNATAIRE: 'Signataire',
      HEBERGEUR: 'Hébergeur',
      ADMIN: 'Admin',
      RESEAU: 'Réseau',
      PARENT: 'Parent',
    };
    const roleLabel = ROLE_LABEL[user.role] ?? user.role;
    const date = new Date().toLocaleString('fr-FR');
    await this.sendGenericNotification(
      'contact@liavo.fr',
      `Nouveau compte ${roleLabel} — ${user.prenom} ${user.nom}`,
      `Un nouveau compte vient d'être créé sur LIAVO.<br><br>` +
        `Prénom&nbsp;: ${user.prenom}<br>` +
        `Nom&nbsp;: ${user.nom}<br>` +
        `Email&nbsp;: ${user.email}<br>` +
        `Rôle&nbsp;: ${roleLabel}<br>` +
        `Date&nbsp;: ${date}` +
        (extra ? `<br>${extra}` : ''),
      'LIAVO Admin',
    );
  }

  async sendMagicLink(to: string, prenom: string, titreSejourOuAction: string, magicUrl: string) {
    const html = emailLayout(
      'Votre demande a été envoyée',
      `<p>Bonjour ${prenom},</p>
       <p>Votre demande <strong>« ${titreSejourOuAction} »</strong> a bien été transmise aux hébergeurs.</p>
       <p>Cliquez ci-dessous pour suivre les réponses et gérer votre séjour. Ce lien crée automatiquement votre espace sécurisé.</p>
       <p style="color:#888;font-size:12px;margin-top:16px">Lien valable 7 jours. Si vous n'avez pas soumis cette demande, ignorez cet email.</p>`,
      'Accéder à mon espace LIAVO →',
      magicUrl,
    );
    await this.send(to, `Votre demande de séjour a été envoyée — Activez votre espace LIAVO`, html);
  }

  // ── g) Vérification email ────────────────────────────────────────────

  async sendVerificationEmail(to: string, prenom: string, token: string) {
    const lien = `${FRONTEND_URL}/verify-email/${token}`;
    const html = emailLayout(
      'Vérifiez votre adresse email',
      `<p>Bonjour ${prenom},</p>
       <p>Bienvenue sur <strong>Liavo</strong> ! Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.</p>
       <p style="color:#888;font-size:12px;margin-top:16px">Ce lien est valable 48 heures.</p>`,
      'Vérifier mon email',
      lien,
    );
    await this.send(to, 'Vérifiez votre email — Liavo', html);
  }

  // ── g) Compte hébergeur en attente ─────────────────────────────────

  async sendHebergeurAccountPending(to: string, prenom: string, nomCentre: string) {
    const html = emailLayout(
      'Compte en attente de validation',
      `<p>Bonjour ${prenom},</p>
       <p>Votre inscription en tant qu'hébergeur pour le centre <strong>« ${nomCentre} »</strong> a bien été enregistrée.</p>
       <p>Votre compte est actuellement <strong style="color:#d97706">en attente de validation</strong> par notre équipe. Vous recevrez un email dès que votre compte sera activé.</p>
       <p>En attendant, vous pouvez vérifier votre email pour accélérer le processus.</p>`,
    );
    await this.send(to, 'Inscription hébergeur en attente — Liavo', html);
  }

  // ── h) Compte hébergeur validé ──────────────────────────────────────

  async sendHebergeurAccountValidated(to: string, prenom: string, nomCentre: string) {
    const html = emailLayout(
      'Compte validé !',
      `<p>Bonjour ${prenom},</p>
       <p>Bonne nouvelle ! Votre compte hébergeur pour le centre <strong>« ${nomCentre} »</strong> a été <strong style="color:#16a34a">validé</strong> par notre équipe.</p>
       <p>Vous pouvez dès maintenant vous connecter et répondre aux demandes de devis des enseignants.</p>`,
      'Accéder à mon espace',
      `${FRONTEND_URL}/dashboard/hebergeur`,
    );
    await this.send(to, 'Compte hébergeur validé — Liavo', html);
  }

  // ── i) Compte hébergeur refusé ────────────────────────────────────────

  async sendHebergeurAccountRefused(to: string, prenom: string, nomCentre: string, motif?: string) {
    const motifHtml = motif
      ? `<p><strong>Motif :</strong> ${motif}</p>`
      : '';
    const html = emailLayout(
      'Inscription non retenue',
      `<p>Bonjour ${prenom},</p>
       <p>Nous avons examiné votre demande d'inscription en tant qu'hébergeur pour le centre <strong>« ${nomCentre} »</strong>.</p>
       <p>Malheureusement, votre inscription <strong style="color:#dc2626">n'a pas été retenue</strong>.</p>
       ${motifHtml}
       <p>Si vous pensez qu'il s'agit d'une erreur, n'hésitez pas à nous contacter.</p>`,
    );
    await this.send(to, 'Inscription hébergeur non retenue — Liavo', html);
  }

  // ── j) Confirmation mandat de facturation ───────────────────────────

  async sendMandatFacturationConfirmation(
    email: string,
    nomCentre: string,
    dateAcceptation: Date,
    version: string,
  ) {
    const dateFormatee = dateAcceptation.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }) + ' à ' + dateAcceptation.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });

    const html = emailLayout(
      'Mandat de facturation accepté',
      `<p>Bonjour,</p>
       <p>Vous avez accepté le mandat de facturation LIAVO (version ${version}) le ${dateFormatee}.</p>
       <p>En vertu de ce mandat (art. 289-I-2 du CGI), LIAVO est autorisée à émettre des factures électroniques Chorus Pro en votre nom et pour votre compte, pour les séjours scolaires dont les devis ont été validés sur la plateforme.</p>
       <p><strong>Résumé des points essentiels :</strong></p>
       <ul style="padding-left:16px;line-height:1.8">
         <li>LIAVO émet les factures d'acompte et de solde en votre nom sur la base des devis validés</li>
         <li>Vous êtes seul responsable de l'exactitude de votre SIRET, TVA, adresse et IBAN dans votre profil</li>
         <li>La responsabilité de LIAVO est limitée aux dysfonctionnements techniques de la plateforme</li>
         <li>Ce mandat est actif tant que votre compte LIAVO est actif — révocable depuis vos paramètres</li>
       </ul>
       <p>Les métadonnées suivantes ont été enregistrées lors de votre acceptation :</p>
       <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px">
         <tr style="background:#f5f7fa"><td style="padding:6px 10px;color:#666">Date d'acceptation</td><td style="padding:6px 10px;font-weight:600">${dateFormatee}</td></tr>
         <tr><td style="padding:6px 10px;color:#666">Version du mandat</td><td style="padding:6px 10px;font-weight:600">${version}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:6px 10px;color:#666">Centre</td><td style="padding:6px 10px;font-weight:600">${nomCentre}</td></tr>
       </table>
       <p>Texte intégral du mandat : <a href="https://liavo.fr/legal/mandat-facturation" style="color:#1B4060">liavo.fr/legal/mandat-facturation</a></p>
       <p style="margin-top:16px;padding:12px;background:#fef9ec;border:1px solid #f0c040;border-radius:6px;font-size:12px;color:#856404">
         <strong>Important :</strong> Conservez cet email comme preuve de votre acceptation du mandat. Il fait foi en cas de litige.
       </p>`,
    );
    await this.send(email, 'Mandat de facturation Chorus Pro accepté — LIAVO', html);
  }

  // ── k) Dossier rectorat (HTML complet en email) ──────────────────────

  async sendDossierRectorat(
    to: string,
    nomEnseignant: string,
    titreSejour: string,
    htmlDossier: string,
    cc?: string,
  ): Promise<void> {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:32px">
        <div style="background:${PRIMARY};padding:20px 32px;border-radius:12px 12px 0 0">
          <span style="color:#fff;font-size:18px;font-weight:700">Liavo</span>
        </div>
        <div style="padding:24px 32px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:20px">Dossier voyage scolaire prêt</h2>
          <p style="color:#4a4a4a;font-size:14px;line-height:1.6">Bonjour,</p>
          <p style="color:#4a4a4a;font-size:14px;line-height:1.6">Le dossier de voyage scolaire "<strong>${titreSejour}</strong>" (enseignant organisateur : ${nomEnseignant}) a été validé par la direction et est prêt à être examiné.</p>
          <p style="color:#4a4a4a;font-size:14px;line-height:1.6">Vous trouverez ci-dessous le dossier complet conforme à la circulaire du 16 juillet 2024.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          ${htmlDossier}
        </div>
      </div>
    </body></html>`;
    const subject = `Dossier voyage scolaire à soumettre au rectorat — ${titreSejour}`;
    if (!BREVO_API_KEY) {
      this.logger.warn(`[sendDossierRectorat] BREVO_API_KEY non configurée — subject="${subject}"`);
      return;
    }
    this.logger.log(`[sendDossierRectorat] ${subject} → ${to}${cc ? ` cc: ${cc}` : ''}`);
    try {
      await this.api.sendTransacEmail({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        ...(cc ? { cc: [{ email: cc }] } : {}),
        subject,
        htmlContent: html,
      });
      this.logger.log(`[sendDossierRectorat OK] ${subject} → ${to}`);
    } catch (err: any) {
      const body = err?.response?.body ?? err?.body ?? err?.message ?? err;
      this.logger.error(`[sendDossierRectorat FAIL] ${subject} → ${to}`, JSON.stringify(body));
      throw err;
    }
  }

  // ── k) Dossier soumis au rectorat (notification) ────────────────────

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
      `${FRONTEND_URL}/dashboard/autorite`,
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

  async sendTrialExpirationAlert(
    centreNom: string,
    hebergeurEmail: string,
    hebergeurPrenom: string,
    joursRestants: number,
    expirationDate: Date,
  ) {
    const dateFormatee = expirationDate.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? 'contact@liavo.fr';
    const html = emailLayout(
      `Relance essai J+25 — ${centreNom}`,
      `<p>Bonjour,</p>
       <p>L'essai gratuit du centre <strong>${centreNom}</strong> expire dans <strong>${joursRestants} jour${joursRestants > 1 ? 's' : ''}</strong> (le ${dateFormatee}).</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centreNom}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Contact</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${hebergeurPrenom} — <a href="mailto:${hebergeurEmail}" style="color:#1B4060">${hebergeurEmail}</a></td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Expiration</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${dateFormatee}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Jours restants</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${joursRestants} jour${joursRestants > 1 ? 's' : ''}</td></tr>
       </table>
       <p>👉 Contacter l'hébergeur pour proposer un abonnement avant expiration.</p>`,
      `Écrire à ${hebergeurPrenom}`,
      `mailto:${hebergeurEmail}?subject=Votre essai LIAVO expire bientôt&body=Bonjour ${hebergeurPrenom},%0A%0A`,
    );
    await this.send(adminEmail, `[LIAVO] Relance essai — ${centreNom} — J-${joursRestants}`, html);
  }

  // ── l) Confirmation abonnement activé ────────────────────────────────

  async sendConfirmationAbonnement(
    to: string,
    prenom: string,
    centreNom: string,
    plan: string,
    frequenceLabel: string,
    montantLabel: string,
    ibanMasque: string,
  ) {
    const html = emailLayout(
      'Votre abonnement est activé',
      `<p>Bonjour ${prenom},</p>
       <p>Votre abonnement LIAVO <strong>${plan}</strong> (${frequenceLabel}) a bien été activé pour <strong>${centreNom}</strong>.</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Montant</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${montantLabel} € HT</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">IBAN enregistré</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${ibanMasque}</td></tr>
       </table>
       <p>Le prélèvement SEPA sera effectué sous quelques jours.</p>`,
      'Gérer mon abonnement',
      `${FRONTEND_URL}/dashboard/hebergeur/abonnement`,
    );
    await this.send(to, 'Votre abonnement LIAVO a été activé', html);
  }

  // ── m) Confirmation annulation abonnement ────────────────────────────

  async sendConfirmationAnnulation(
    to: string,
    prenom: string,
    centreNom: string,
    dateExpiration: string,
  ) {
    const html = emailLayout(
      'Annulation de votre abonnement',
      `<p>Bonjour ${prenom},</p>
       <p>Votre abonnement LIAVO pour <strong>${centreNom}</strong> a bien été annulé.</p>
       <p>Votre accès reste actif jusqu'au <strong>${dateExpiration}</strong>.</p>
       <p>Vous pouvez réactiver votre abonnement à tout moment depuis votre espace.</p>`,
      'Gérer mon abonnement',
      `${FRONTEND_URL}/dashboard/hebergeur/abonnement`,
    );
    await this.send(to, 'Annulation de votre abonnement LIAVO', html);
  }

  // ── n) Notification admin générique ──────────────────────────────────

  async sendNotifAdmin(subject: string, bodyHtml: string) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? 'contact@liavo.fr';
    const html = emailLayout(subject, bodyHtml);
    await this.send(adminEmail, subject, html);
  }
}
