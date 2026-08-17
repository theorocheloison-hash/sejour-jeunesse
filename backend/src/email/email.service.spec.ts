import { EmailService } from './email.service';

/**
 * Tests du paramètre `button` de sendGenericNotification (F1bis) :
 * - absent → bouton historique « Accéder à la plateforme » → /login ;
 * - null → aucun bouton ;
 * - { text, url } → bouton custom.
 * On espionne send() (privée) pour inspecter le HTML final sans dépendre de
 * BREVO_API_KEY ni du réseau.
 */
describe('EmailService.sendGenericNotification — paramètre button', () => {
  let service: EmailService;
  let sendSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new EmailService();
    sendSpy = jest
      .spyOn(service as any, 'send')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const htmlEnvoye = (): string => sendSpy.mock.calls[0][2];

  it('button absent → bouton historique « Accéder à la plateforme » vers /login', async () => {
    await service.sendGenericNotification('dest@test.fr', 'Sujet', 'Corps du message');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const html = htmlEnvoye();
    expect(html).toContain('Accéder à la plateforme');
    expect(html).toContain('/login');
  });

  it('button null → aucun bouton (ni libellé historique ni /login)', async () => {
    await service.sendGenericNotification(
      'dest@test.fr',
      'Sujet',
      'Corps du message',
      undefined,
      undefined,
      null,
    );

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const html = htmlEnvoye();
    expect(html).not.toContain('Accéder à la plateforme');
    expect(html).not.toContain('/login');
  });

  it('button { text, url } → bouton custom rendu avec le texte et l’URL fournis', async () => {
    await service.sendGenericNotification(
      'dest@test.fr',
      'Sujet',
      'Corps du message',
      undefined,
      undefined,
      { text: 'X', url: 'https://y' },
    );

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const html = htmlEnvoye();
    expect(html).toContain('X');
    expect(html).toContain('https://y');
  });
});
