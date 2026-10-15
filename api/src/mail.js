const nodemailer = require('nodemailer');

// Ohne SMTP-Zugang (lokale Entwicklung) wird die E-Mail nur in der Konsole ausgegeben.
function createMailer(config) {
  const transport = config.smtp.host
    ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
    : null;

  async function sendLoginCode(to, code, link) {
    const subject = `Dein Anmeldecode für Bauchgefühl: ${code}`;
    const text = [
      'Hallo',
      '',
      `Dein Anmeldecode für Bauchgefühl lautet: ${code}`,
      '',
      'Gib den Code in der App ein oder öffne diesen Link:',
      link,
      '',
      'Der Code ist 15 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese E-Mail ignorieren.',
    ].join('\n');
    const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0e1c19">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <h1 style="font-size:20px;margin:0 0 12px">Anmelden bei Bauchgefühl</h1>
    <p style="margin:0 0 16px">Dein Anmeldecode lautet:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 20px;color:#0f766e">${code}</p>
    <p style="margin:0 0 20px">Gib den Code in der App ein oder tippe auf den Knopf:</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Jetzt anmelden</a></p>
    <p style="font-size:13px;color:#5d6d69;margin:0">Der Code ist 15 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese E-Mail ignorieren.</p>
  </div>
</body></html>`;

    if (!transport) {
      console.log(`[Mail an ${to}] Code ${code} · Link ${link}`);
      return;
    }
    await transport.sendMail({ from: config.mailFrom, to, subject, text, html });
  }

  return { sendLoginCode };
}

module.exports = { createMailer };
