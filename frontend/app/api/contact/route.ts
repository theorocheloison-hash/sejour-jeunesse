import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { nom, email, message } = await req.json();
    if (!nom || !email || !message) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: 'Config manquante' }, { status: 500 });
    }

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'LIAVO Contact', email: 'contact@liavo.fr' },
        to: [{ email: 'contact@liavo.fr', name: 'LIAVO' }],
        replyTo: { email, name: nom },
        subject: `[LIAVO Contact] Message de ${nom}`,
        htmlContent: `
          <h3>Nouveau message depuis liavo.fr</h3>
          <p><strong>Nom :</strong> ${nom}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Message :</strong></p>
          <p>${message.replace(/\n/g, '<br/>')}</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
