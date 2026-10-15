/*
 * HTTP-API für Konto und Synchronisierung.
 *
 *   POST   /api/auth/email/start   { email }            Code + Link per E-Mail senden
 *   POST   /api/auth/email/verify  { email, code }      mit Code anmelden
 *                                  { link }             mit Link aus der E-Mail anmelden
 *   POST   /api/auth/google        { credential }       mit Google anmelden
 *   POST   /api/auth/logout                             Sitzung beenden
 *   GET    /api/account                                 E-Mail und Erstellungsdatum
 *   DELETE /api/account                                 Konto mit allen Daten löschen
 *   GET    /api/data                                    { rev, data }
 *   PUT    /api/data               { rev, data }        speichern; 409 wenn rev veraltet
 *
 * Angemeldet wird mit «Authorization: Bearer <token>». In der Datenbank liegen
 * nur Hashes von Sitzungen und Codes, nie die Klartext-Werte.
 */
const crypto = require('crypto');

const CODE_TTL = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_IDLE = 400 * 24 * 60 * 60 * 1000;
const MAX_BODY = 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

// Einfache Begrenzung pro Schlüssel (IP oder E-Mail) im Arbeitsspeicher
function createLimiter() {
  const hits = new Map();
  return function limit(key, max, windowMs) {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    h.n++;
    if (hits.size > 50000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (h.n > max) throw new HttpError(429, 'Zu viele Versuche. Bitte später noch einmal probieren.');
  };
}

function createApp({ config, store, mailer, verifyGoogle }) {
  const { q, db } = store;
  const limit = createLimiter();
  const hmac = (s) => crypto.createHmac('sha256', config.secret).update(s).digest('hex');

  function clientIp(req) {
    if (config.trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
    return req.socket.remoteAddress || '';
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new HttpError(413, 'Daten zu gross')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new HttpError(400, 'Ungültiges JSON')); }
      });
      req.on('error', reject);
    });
  }

  function createSession(userId) {
    const t = token(); const now = Date.now();
    q.insertSession.run(sha256(t), userId, now, now);
    return t;
  }

  function findOrCreateUser(email, googleSub) {
    let user = googleSub ? q.userByGoogle.get(googleSub) : null;
    if (!user) user = q.userByEmail.get(email);
    if (!user) {
      const r = q.insertUser.run(email, googleSub || null, Date.now());
      user = q.userById.get(r.lastInsertRowid);
    } else if (googleSub && !user.google_sub) {
      q.setGoogleSub.run(googleSub, user.id);
    }
    return user;
  }

  function loggedIn(user) {
    return { token: createSession(user.id), email: user.email };
  }

  function auth(req) {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    if (!m) throw new HttpError(401, 'Nicht angemeldet');
    const hash = sha256(m[1]);
    const s = q.session.get(hash);
    if (!s || s.last_used < Date.now() - SESSION_IDLE) throw new HttpError(401, 'Sitzung abgelaufen');
    if (s.last_used < Date.now() - 60 * 60 * 1000) q.touchSession.run(Date.now(), hash);
    const user = q.userById.get(s.user_id);
    if (!user) throw new HttpError(401, 'Konto nicht gefunden');
    return { user, hash };
  }

  const routes = {
    'GET /api/health': () => ({ ok: true }),

    'POST /api/auth/email/start': async (req, body) => {
      const email = String(body.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'Bitte eine gültige E-Mail-Adresse eingeben.');
      limit('ip:' + clientIp(req), 20, 60 * 60 * 1000);
      limit('mail:' + email, 5, 15 * 60 * 1000);
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const link = token();
      q.upsertCode.run(email, hmac(email + ':' + code), sha256(link), Date.now() + CODE_TTL);
      try { await mailer.sendLoginCode(email, code, `${config.appUrl}?login=${link}#/meine`); }
      catch (e) {
        console.error('Mailversand fehlgeschlagen:', e.message);
        throw new HttpError(502, 'Die E-Mail konnte nicht gesendet werden. Bitte später noch einmal probieren.');
      }
      return { ok: true };
    },

    'POST /api/auth/email/verify': (req, body) => {
      limit('verify:' + clientIp(req), 30, 15 * 60 * 1000);
      let row;
      if (body.link) {
        row = q.codeByLink.get(sha256(String(body.link)));
        if (!row || row.expires_at < Date.now()) throw new HttpError(400, 'Der Link ist abgelaufen. Bitte einen neuen Code anfordern.');
      } else {
        const email = String(body.email || '').trim().toLowerCase();
        const code = String(body.code || '').replace(/\D/g, '');
        row = q.codeByEmail.get(email);
        if (!row || row.expires_at < Date.now()) throw new HttpError(400, 'Der Code ist abgelaufen. Bitte einen neuen anfordern.');
        if (row.attempts >= MAX_CODE_ATTEMPTS) throw new HttpError(400, 'Zu viele falsche Eingaben. Bitte einen neuen Code anfordern.');
        const ok = crypto.timingSafeEqual(Buffer.from(hmac(email + ':' + code)), Buffer.from(row.code_hash));
        if (!ok) { q.countAttempt.run(email); throw new HttpError(400, 'Der Code stimmt nicht.'); }
      }
      q.deleteCode.run(row.email);
      return loggedIn(findOrCreateUser(row.email, null));
    },

    'POST /api/auth/google': async (req, body) => {
      if (!verifyGoogle) throw new HttpError(404, 'Google-Anmeldung ist nicht eingerichtet.');
      limit('google:' + clientIp(req), 30, 15 * 60 * 1000);
      let g;
      try { g = await verifyGoogle(String(body.credential || '')); }
      catch (e) { throw new HttpError(401, 'Google-Anmeldung fehlgeschlagen.'); }
      return loggedIn(findOrCreateUser(g.email, g.sub));
    },

    'POST /api/auth/logout': (req) => {
      const { hash } = auth(req);
      q.deleteSession.run(hash);
      return { ok: true };
    },

    'GET /api/account': (req) => {
      const { user } = auth(req);
      return { email: user.email, createdAt: user.created_at, google: !!user.google_sub };
    },

    // Löscht Konto, Sitzungen und gespeicherte Daten (ON DELETE CASCADE)
    'DELETE /api/account': (req) => {
      const { user } = auth(req);
      q.deleteUser.run(user.id);
      return { ok: true };
    },

    'GET /api/data': (req) => {
      const { user } = auth(req);
      const row = q.data.get(user.id);
      return row ? { rev: row.rev, data: JSON.parse(row.data), updatedAt: row.updated_at } : { rev: 0, data: null };
    },

    'PUT /api/data': (req, body) => {
      const { user } = auth(req);
      if (!body.data || typeof body.data !== 'object') throw new HttpError(400, 'Daten fehlen');
      const json = JSON.stringify(body.data);
      const base = Number(body.rev) || 0;
      const save = db.transaction(() => {
        const row = q.data.get(user.id);
        const now = Date.now();
        if (!row && base === 0) { q.insertData.run(user.id, json, now); return 1; }
        if (row && q.updateData.run(json, now, user.id, base).changes === 1) return base + 1;
        return null;
      });
      const rev = save();
      if (rev === null) {
        // Ein anderes Gerät war schneller: aktuellen Stand zurückgeben, damit der Client zusammenführt
        const row = q.data.get(user.id);
        throw new HttpError(409, 'Veraltet', row ? { rev: row.rev, data: JSON.parse(row.data) } : { rev: 0, data: null });
      }
      return { rev };
    },
  };

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && (config.origins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }

  function send(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  }

  async function handle(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
    const fn = routes[`${req.method} ${path}`];
    if (!fn) return send(res, 404, { error: 'Nicht gefunden' });
    try {
      const body = req.method === 'POST' || req.method === 'PUT' ? await readJson(req) : {};
      send(res, 200, await fn(req, body));
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.extra || {}) });
      console.error(e);
      send(res, 500, { error: 'Serverfehler' });
    }
  }

  // Abgelaufene Codes und lange unbenutzte Sitzungen aufräumen
  function cleanup() {
    q.pruneCodes.run(Date.now());
    q.pruneSessions.run(Date.now() - SESSION_IDLE);
  }

  return { handle, cleanup };
}

module.exports = { createApp };
