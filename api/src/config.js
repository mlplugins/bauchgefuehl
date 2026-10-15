// Einstellungen kommen aus Umgebungsvariablen (siehe .env.example).
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

const config = {
  port: Number(process.env.PORT) || 8787,
  dbPath: process.env.DB_PATH || require('path').join(__dirname, '..', 'data', 'bauchgefuehl.db'),
  // Geheimer Schlüssel zum Hashen der Anmeldecodes. Lang und zufällig wählen.
  secret: process.env.SECRET || '',
  // Adresse der App, wird im Anmeldelink der E-Mail verwendet.
  appUrl: (process.env.APP_URL || 'https://mlplugins.github.io/bauchgefuehl/').replace(/\/?$/, '/'),
  // Webseiten, die die API aufrufen dürfen (CORS).
  origins: list(process.env.ALLOWED_ORIGINS || 'https://mlplugins.github.io,https://bauchgefuehl.mlplugins.com'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // Hinter einem Reverse Proxy (nginx, Caddy, Traefik) die echte Client-IP aus X-Forwarded-For lesen.
  trustProxy: process.env.TRUST_PROXY === '1',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === '1',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || 'Bauchgefühl <noreply@mlplugins.com>',
};

if (!config.secret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('SECRET fehlt. Bitte in der .env-Datei setzen.');
    process.exit(1);
  }
  config.secret = 'nur-fuer-die-entwicklung';
}

module.exports = config;
