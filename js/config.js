/* Einstellungen für Konto und Synchronisierung. */
window.BAUCHGEFUEHL_CONFIG = {
  // Lokal spricht die App mit dem PHP-Entwicklungsserver (php -S localhost:8787)
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'http://localhost:8787/api/index.php'
    : 'https://bauchgefuehl.mlplugins.com/api/index.php',
  // OAuth-Client-ID aus der Google Cloud Console (leer = kein «Mit Google anmelden»)
  googleClientId: '',
};
