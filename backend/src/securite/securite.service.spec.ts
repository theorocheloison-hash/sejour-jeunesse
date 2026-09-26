import { SecuriteService, SEUILS_SECURITE, estDocumentMedical, JOURS_CONSERVATION_JOURNAL_SECURITE } from './securite.service';

/** Alertes maison — règles, anti-doublon, non-blocage, purge. */
function make(opts: { counts?: number[]; user?: { email: string; role: string } | null } = {}) {
  const counts = [...(opts.counts ?? [])];
  const prisma = {
    evenementSecurite: {
      create: jest.fn().mockResolvedValue({}),
      // Chaque count consomme la valeur suivante ; 0 par défaut (dont l'anti-doublon).
      count: jest.fn().mockImplementation(() => Promise.resolve(counts.length ? counts.shift() : 0)),
      deleteMany: jest.fn().mockResolvedValue({ count: 7 }),
    },
    user: { findUnique: jest.fn().mockResolvedValue(opts.user ?? { email: 'prof@ecole.fr', role: 'ORGANISATEUR' }) },
  };
  const email = {
    sendNotifAdmin: jest.fn().mockResolvedValue(undefined),
    sendGenericNotification: jest.fn().mockResolvedValue(undefined),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new SecuriteService(prisma as any, email as any);
  return { service, prisma, email };
}
const types = (prisma: ReturnType<typeof make>['prisma']) =>
  prisma.evenementSecurite.create.mock.calls.map((c) => c[0].data.type);
const now = new Date('2026-10-01T10:00:00Z');

describe('SecuriteService', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  describe('échecs de connexion', () => {
    it('journalise (email normalisé) sans alerter sous le seuil', async () => {
      const { service, prisma, email } = make({ counts: [9, 9] });
      await service.connexionEchouee('  Heb@Centre.FR ', { ip: '1.2.3.4', userAgent: 'UA' }, now);
      expect(prisma.evenementSecurite.create.mock.calls[0][0].data).toMatchObject({
        type: 'CONNEXION_ECHEC', email: 'heb@centre.fr', ip: '1.2.3.4', userAgent: 'UA',
      });
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
    });

    it(`alerte à ${SEUILS_SECURITE.echecsEmail15min} échecs en 15 min`, async () => {
      const { service, email, prisma } = make({ counts: [10, 10] });
      await service.connexionEchouee('heb@centre.fr', { ip: '1.2.3.4' }, now);
      expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
      expect(email.sendNotifAdmin.mock.calls[0][0]).toContain('heb@centre.fr');
      expect(types(prisma)).toEqual(['CONNEXION_ECHEC', 'ALERTE_ENVOYEE']);
    });

    it(`alerte à ${SEUILS_SECURITE.echecsEmail24h} échecs en 24 h (attaque lente)`, async () => {
      const { service, email } = make({ counts: [2, 20] });
      await service.connexionEchouee('heb@centre.fr', {}, now);
      expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
    });

    it('anti-doublon : même clé déjà alertée dans l\'heure → pas de 2e mail', async () => {
      const { service, email } = make({ counts: [10, 10, 1] });
      await service.connexionEchouee('heb@centre.fr', {}, now);
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
    });

    it('ne lève jamais, même si la base et l\'email tombent', async () => {
      const { service, prisma, email } = make();
      prisma.evenementSecurite.create.mockRejectedValue(new Error('db down'));
      prisma.evenementSecurite.count.mockRejectedValue(new Error('db down'));
      email.sendNotifAdmin.mockRejectedValue(new Error('brevo down'));
      await expect(service.connexionEchouee('x@y.fr', {}, now)).resolves.toBeUndefined();
    });
  });

  describe('connexion réussie', () => {
    it('admin depuis une IP jamais vue → alerte, puis journal', async () => {
      const { service, email, prisma } = make({ counts: [0] });
      await service.connexionReussie({ id: 'u1', email: 'admin@liavo.fr', role: 'ADMIN' }, { ip: '9.9.9.9' }, false, now);
      expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
      const where = prisma.evenementSecurite.count.mock.calls[0][0].where;
      expect(where).toMatchObject({ userId: 'u1', ip: '9.9.9.9' });
      expect(where.createdAt.gte).toEqual(new Date(now.getTime() - JOURS_CONSERVATION_JOURNAL_SECURITE * 86400000));
      expect(types(prisma)).toEqual(['ALERTE_ENVOYEE', 'CONNEXION_OK']);
    });

    it('admin depuis une IP connue → pas d\'alerte', async () => {
      const { service, email } = make({ counts: [3] });
      await service.connexionReussie({ id: 'u1', email: 'a@liavo.fr', role: 'ADMIN' }, { ip: '9.9.9.9' }, false, now);
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
    });

    it('non-admin → journal seul (type lien magique respecté)', async () => {
      const { service, email, prisma } = make();
      await service.connexionReussie({ id: 'u2', email: 'P@E.fr', role: 'ORGANISATEUR' }, { ip: '1.1.1.1' }, true, now);
      expect(prisma.evenementSecurite.count).not.toHaveBeenCalled();
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
      expect(prisma.evenementSecurite.create.mock.calls[0][0].data).toMatchObject({ type: 'CONNEXION_LIEN_MAGIQUE', userId: 'u2', email: 'p@e.fr' });
    });
  });

  describe('blocages anti-abus', () => {
    it('route hors /auth → journal BLOCAGE_LIMITE, jamais d\'alerte', async () => {
      const { service, email, prisma } = make({ counts: [99] });
      await service.blocageLimite('/sejours', { ip: '5.5.5.5' }, 60000, now);
      expect(types(prisma)).toEqual(['BLOCAGE_LIMITE']);
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
    });

    it(`/auth/* : alerte à ${SEUILS_SECURITE.blocagesAuthIp1h} blocages de la même IP en 1 h`, async () => {
      const { service, email, prisma } = make({ counts: [3] });
      await service.blocageLimite('/auth/login', { ip: '5.5.5.5' }, 60000, now);
      expect(types(prisma)[0]).toBe('BLOCAGE_LIMITE_AUTH');
      expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
    });

    it('un même blocage n\'est journalisé qu\'une fois par période de blocage', async () => {
      const { service, prisma } = make();
      await service.blocageLimite('/auth/login', { ip: '5.5.5.5' }, 60000, now);
      await service.blocageLimite('/auth/login', { ip: '5.5.5.5' }, 60000, new Date(now.getTime() + 30000));
      await service.blocageLimite('/auth/login', { ip: '5.5.5.5' }, 60000, new Date(now.getTime() + 61000));
      expect(prisma.evenementSecurite.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('mot de passe & rôle', () => {
    it('prévient le titulaire du compte et journalise', async () => {
      const { service, email, prisma } = make();
      await service.motDePasseChange({ id: 'u1', email: 'heb@centre.fr', prenom: 'Léa' }, 'REINITIALISE', { ip: '1.1.1.1' }, now);
      expect(types(prisma)).toEqual(['MDP_REINITIALISE']);
      expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
      const [to, sujet, , , , bouton] = email.sendGenericNotification.mock.calls[0];
      expect(to).toBe('heb@centre.fr');
      expect(sujet).toBe('Votre mot de passe LIAVO a été modifié');
      expect(bouton.url).toMatch(/\/forgot-password$/);
    });

    it('changement de rôle → alerte systématique', async () => {
      const { service, email, prisma } = make();
      await service.roleModifie('admin1', { id: 'u1', email: 'x@y.fr' }, 'ORGANISATEUR', 'ADMIN', now);
      expect(types(prisma)).toEqual(['ROLE_MODIFIE', 'ALERTE_ENVOYEE']);
      expect(email.sendNotifAdmin.mock.calls[0][0]).toContain('ADMIN');
    });
  });

  describe('consultations massives', () => {
    const flush = () => new Promise((r) => setImmediate(r));

    it(`alerte au ${SEUILS_SECURITE.sejoursDistincts1h}e séjour distinct en 1 h, pas avant`, async () => {
      const { service, email } = make();
      for (let i = 0; i < SEUILS_SECURITE.sejoursDistincts1h - 1; i++) service.consultationParticipants('u1', `s${i}`, now);
      service.consultationParticipants('u1', 's0', now); // même séjour : ne compte pas deux fois
      await flush();
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
      service.consultationParticipants('u1', 'dernier', now);
      await flush();
      expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
    });

    it('les consultations de plus d\'une heure sortent de la fenêtre', async () => {
      const { service, email } = make();
      const avant = new Date(now.getTime() - 3600001);
      for (let i = 0; i < SEUILS_SECURITE.sejoursDistincts1h - 1; i++) service.consultationParticipants('u1', `s${i}`, avant);
      service.consultationParticipants('u1', 'x', now);
      await flush();
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
    });

    it('seuls les documents médicaux sont comptés', async () => {
      const { service, email } = make();
      for (let i = 0; i < SEUILS_SECURITE.documentsMedicaux1h; i++) {
        service.lienDocumentGenere('u1', `https://s3.gra.io.cloud.ovh.net/liavo-uploads/journal/s1/${i}.jpg`, now);
      }
      await flush();
      expect(email.sendNotifAdmin).not.toHaveBeenCalled();
      for (let i = 0; i < SEUILS_SECURITE.documentsMedicaux1h; i++) {
        service.lienDocumentGenere('u1', `https://s3.gra.io.cloud.ovh.net/liavo-uploads/documents-medicaux/${i}.pdf`, now);
      }
      await flush();
      expect(email.sendNotifAdmin).toHaveBeenCalled();
    });

    it('estDocumentMedical', () => {
      expect(estDocumentMedical('https://h/liavo-uploads/documents-medicaux/a.pdf')).toBe(true);
      expect(estDocumentMedical('https://h/liavo-uploads/documents/a.pdf')).toBe(false);
      expect(estDocumentMedical('pas une url documents-medicaux/a')).toBe(false);
    });
  });

  describe('purge', () => {
    it(`supprime au-delà de ${JOURS_CONSERVATION_JOURNAL_SECURITE} jours`, async () => {
      const { service, prisma } = make();
      await expect(service.purgerJournal(now)).resolves.toEqual({ supprimes: 7 });
      expect(prisma.evenementSecurite.deleteMany.mock.calls[0][0].where.createdAt.lt)
        .toEqual(new Date(now.getTime() - JOURS_CONSERVATION_JOURNAL_SECURITE * 86400000));
    });

    it('le cron ne fait rien sans ENABLE_CRON=true', async () => {
      const { service, prisma } = make();
      const avant = process.env.ENABLE_CRON;
      delete process.env.ENABLE_CRON;
      await service.cronPurge();
      expect(prisma.evenementSecurite.deleteMany).not.toHaveBeenCalled();
      if (avant !== undefined) process.env.ENABLE_CRON = avant;
    });
  });
});
