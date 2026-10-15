const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

function setup() {
  const mails = [];
  const config = {
    secret: 'test', appUrl: 'https://app.example/', origins: ['https://app.example'], trustProxy: false,
  };
  const store = openDb(':memory:');
  const app = createApp({
    config,
    store,
    mailer: { sendLoginCode: async (to, code, link) => { mails.push({ to, code, link }); } },
    verifyGoogle: async (cred) => {
      if (cred !== 'gueltig') throw new Error('ungültig');
      return { sub: 'g-123', email: 'anna@example.com' };
    },
  });
  const server = http.createServer(app.handle);
  return new Promise((resolve) => server.listen(0, () => {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (method, path, body, tok, headers = {}) => {
      const r = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
    };
    resolve({ call, mails, store, close: () => server.close() });
  }));
}

async function loginWithCode(t, email) {
  await t.call('POST', '/auth/email/start', { email });
  const { code } = t.mails[t.mails.length - 1];
  const r = await t.call('POST', '/auth/email/verify', { email, code });
  assert.strictEqual(r.status, 200);
  return r.body.token;
}

test('Anmeldung per Code: falscher Code, richtiger Code, Code nur einmal gültig', async () => {
  const t = await setup();
  try {
    assert.strictEqual((await t.call('POST', '/auth/email/start', { email: 'kein-mail' })).status, 400);
    assert.strictEqual((await t.call('POST', '/auth/email/start', { email: ' Max@Example.com ' })).status, 200);
    const { to, code, link } = t.mails[0];
    assert.strictEqual(to, 'max@example.com');
    assert.match(code, /^\d{6}$/);
    assert.match(link, /^https:\/\/app\.example\/\?login=[\w-]+#\/meine$/);

    const wrong = code === '000000' ? '111111' : '000000';
    assert.strictEqual((await t.call('POST', '/auth/email/verify', { email: 'max@example.com', code: wrong })).status, 400);
    const ok = await t.call('POST', '/auth/email/verify', { email: 'max@example.com', code });
    assert.strictEqual(ok.status, 200);
    assert.ok(ok.body.token);
    assert.strictEqual(ok.body.email, 'max@example.com');
    assert.strictEqual((await t.call('POST', '/auth/email/verify', { email: 'max@example.com', code })).status, 400);

    const acc = await t.call('GET', '/account', null, ok.body.token);
    assert.strictEqual(acc.body.email, 'max@example.com');
  } finally { t.close(); }
});

test('Nach 5 falschen Codes ist auch der richtige gesperrt', async () => {
  const t = await setup();
  try {
    await t.call('POST', '/auth/email/start', { email: 'a@b.ch' });
    const { code } = t.mails[0];
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await t.call('POST', '/auth/email/verify', { email: 'a@b.ch', code: wrong });
    assert.strictEqual((await t.call('POST', '/auth/email/verify', { email: 'a@b.ch', code })).status, 400);
  } finally { t.close(); }
});

test('Anmeldung per Link aus der E-Mail', async () => {
  const t = await setup();
  try {
    await t.call('POST', '/auth/email/start', { email: 'link@example.com' });
    const link = new URL(t.mails[0].link).searchParams.get('login');
    const r = await t.call('POST', '/auth/email/verify', { link });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.email, 'link@example.com');
    assert.strictEqual((await t.call('POST', '/auth/email/verify', { link })).status, 400);
  } finally { t.close(); }
});

test('Google-Anmeldung verknüpft sich mit bestehendem E-Mail-Konto', async () => {
  const t = await setup();
  try {
    const tok = await loginWithCode(t, 'anna@example.com');
    await t.call('PUT', '/data', { rev: 0, data: { v: 1, entries: { 'favs/x': { v: true, t: 1 } } } }, tok);
    assert.strictEqual((await t.call('POST', '/auth/google', { credential: 'falsch' })).status, 401);
    const g = await t.call('POST', '/auth/google', { credential: 'gueltig' });
    assert.strictEqual(g.status, 200);
    const d = await t.call('GET', '/data', null, g.body.token);
    assert.deepStrictEqual(d.body.data.entries['favs/x'], { v: true, t: 1 });
  } finally { t.close(); }
});

test('Daten speichern mit Versionsprüfung (409 bei veraltetem Stand)', async () => {
  const t = await setup();
  try {
    const tok = await loginWithCode(t, 'sync@example.com');
    assert.deepStrictEqual((await t.call('GET', '/data', null, tok)).body, { rev: 0, data: null });
    assert.strictEqual((await t.call('GET', '/data')).status, 401);

    const a = await t.call('PUT', '/data', { rev: 0, data: { n: 1 } }, tok);
    assert.deepStrictEqual(a.body, { rev: 1 });
    const stale = await t.call('PUT', '/data', { rev: 0, data: { n: 2 } }, tok);
    assert.strictEqual(stale.status, 409);
    assert.deepStrictEqual({ rev: stale.body.rev, data: stale.body.data }, { rev: 1, data: { n: 1 } });
    const b = await t.call('PUT', '/data', { rev: 1, data: { n: 3 } }, tok);
    assert.deepStrictEqual(b.body, { rev: 2 });
    assert.deepStrictEqual((await t.call('GET', '/data', null, tok)).body.data, { n: 3 });
  } finally { t.close(); }
});

test('Abmelden beendet nur diese Sitzung', async () => {
  const t = await setup();
  try {
    const t1 = await loginWithCode(t, 'zwei@example.com');
    const t2 = await loginWithCode(t, 'zwei@example.com');
    assert.strictEqual((await t.call('POST', '/auth/logout', null, t1)).status, 200);
    assert.strictEqual((await t.call('GET', '/account', null, t1)).status, 401);
    assert.strictEqual((await t.call('GET', '/account', null, t2)).status, 200);
  } finally { t.close(); }
});

test('Konto löschen entfernt Konto, Sitzungen und Daten', async () => {
  const t = await setup();
  try {
    const tok = await loginWithCode(t, 'weg@example.com');
    await t.call('PUT', '/data', { rev: 0, data: { geheim: true } }, tok);
    assert.strictEqual((await t.call('DELETE', '/account', null, tok)).status, 200);
    assert.strictEqual((await t.call('GET', '/account', null, tok)).status, 401);
    const { db } = t.store;
    for (const table of ['users', 'sessions', 'user_data']) {
      assert.strictEqual(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
    }
    // Neue Anmeldung mit derselben Adresse beginnt leer
    const neu = await loginWithCode(t, 'weg@example.com');
    assert.deepStrictEqual((await t.call('GET', '/data', null, neu)).body, { rev: 0, data: null });
  } finally { t.close(); }
});

test('CORS nur für erlaubte Adressen', async () => {
  const t = await setup();
  try {
    const ok = await t.call('GET', '/health', null, null, { Origin: 'https://app.example' });
    assert.strictEqual(ok.headers.get('access-control-allow-origin'), 'https://app.example');
    const bad = await t.call('GET', '/health', null, null, { Origin: 'https://boese.example' });
    assert.strictEqual(bad.headers.get('access-control-allow-origin'), null);
  } finally { t.close(); }
});
