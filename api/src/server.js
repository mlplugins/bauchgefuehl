const http = require('http');
const config = require('./config');
const { openDb } = require('./db');
const { createMailer } = require('./mail');
const { createGoogleVerifier } = require('./google');
const { createApp } = require('./app');

const store = openDb(config.dbPath);
const app = createApp({
  config,
  store,
  mailer: createMailer(config),
  verifyGoogle: createGoogleVerifier(config.googleClientId),
});

app.cleanup();
setInterval(app.cleanup, 60 * 60 * 1000).unref();

const server = http.createServer(app.handle);
server.listen(config.port, () => {
  console.log(`Bauchgefühl-API läuft auf Port ${config.port}`);
  if (!config.smtp.host) console.log('Kein SMTP eingerichtet: Anmeldecodes erscheinen nur hier im Log.');
  if (!config.googleClientId) console.log('GOOGLE_CLIENT_ID fehlt: Google-Anmeldung ist ausgeschaltet.');
});

function shutdown() {
  server.close(() => { store.db.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
