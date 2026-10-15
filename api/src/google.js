const { createRemoteJWKSet, jwtVerify } = require('jose');

// Prüft das ID-Token, das «Mit Google anmelden» im Browser liefert.
function createGoogleVerifier(clientId) {
  if (!clientId) return null;
  const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  return async function verify(credential) {
    const { payload } = await jwtVerify(credential, jwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    if (!payload.email || payload.email_verified !== true) throw new Error('E-Mail nicht bestätigt');
    return { sub: String(payload.sub), email: String(payload.email).toLowerCase() };
  };
}

module.exports = { createGoogleVerifier };
