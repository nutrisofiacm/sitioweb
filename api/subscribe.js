// Serverless function: receives the "Guía Práctica" signup form and
// notifies Sofía by email (via Resend) with each new registration.
// No database is used — every submission is simply emailed to her.

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { nombre, email, empresa, wantsInfo } = body;

    // Honeypot field: real users never fill this hidden input.
    // If it's filled, silently pretend success without sending anything.
    if (empresa) {
      return res.status(200).json({ ok: true });
    }

    const name = typeof nombre === 'string' ? nombre.trim().slice(0, 200) : '';
    const mail = typeof email === 'string' ? email.trim().slice(0, 200) : '';
    const wantsInfoText = wantsInfo ? 'Sí' : 'No';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !mail || !emailRegex.test(mail)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY no está configurada en Vercel');
      return res.status(500).json({ error: 'Configuración incompleta' });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nutrisofía <onboarding@resend.dev>',
        to: ['sofiachi_08@uc.cl'],
        reply_to: mail,
        subject: 'Nuevo inscrito de Guía Práctica',
        text: `Nombre: ${name}\nMail: ${mail}\nQuiere recibir información: ${wantsInfoText}`,
        html: `<p>Nombre: ${escapeHtml(name)}</p><p>Mail: ${escapeHtml(mail)}</p><p>Quiere recibir información: ${wantsInfoText}</p>`,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', resendRes.status, errText);
      return res.status(502).json({ error: 'No se pudo enviar el aviso' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
