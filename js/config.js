/* Einstellungen für Konto und Synchronisierung. */
window.BAUCHGEFUEHL_CONFIG = {
  // Lokal spricht die App mit dem Entwicklungsserver aus api/ (npm start)
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8787/api'
    : 'https://bauchgefuehl.mlplugins.com/api',
  // OAuth-Client-ID aus der Google Cloud Console (leer = kein «Mit Google anmelden»)
  googleClientId: '',
};
