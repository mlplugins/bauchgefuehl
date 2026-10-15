/*
 * Tests für die PHP-API (api/). Startet für jeden Test einen PHP-Entwicklungsserver
 * mit eigener SQLite-Datenbank. Aufruf:  PHP_BIN=pfad/zu/php node tests/api.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PHP = process.env.PHP_BIN || 'php';
const PHP_INI = process.env.PHP_INI;

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
});

async function setup(overrides = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-api-'));
  const mailLog = path.join(dir, 'mail.log');
  const configFile = path.join(dir, 'config.php');
  fs.writeFileSync(configFile, `<?php return array_replace([
    'db' => ['driver' => 'sqlite', 'path' => ${JSON.stringify(path.join(dir, 'test.sqlite'))}],
    'secret' => str_repeat('x', 40),
    'app_url' => 'https://app.example/',
    'allowed_origins' => ['https://app.example'],
    'google_client_id' => '',
    'mail' => ['mode' => 'log', 'log' => ${JSON.stringify(mailLog)}],
  ], [${overrides}]);`);
  const port = await freePort();
  const args = [...(PHP_INI ? ['-c', PHP_INI] : []), '-S', `127.0.0.1:${port}`, '-t', ROOT];
  const proc = spawn(PHP, args, { env: { ...process.env, BG_CONFIG: configFile }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/api/index.php`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(base + '/nichts'); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
  const call = async (method, p, body, tok, headers = {}) => {
    const r = await fetch(base + p, {
      method,
      headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Auth-Token': tok } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
  };
  const mails = () => (fs.existsSync(mailLog) ? fs.readFileSync(mailLog, 'utf8').trim().split('\n').map(JSON.parse) : []);
  const close = () => { proc.kill(); };
  return { call, mails, close, dir };
}

async function loginWithCode(t, email) {
  await t.call('POST', '/auth/email/start', { email });
  const { code } = t.mails().pop();
  const r = await t.call('POST', '/auth/email/verify', { email, code });
  assert.strictEqual(r.status, 200);
  return r.body.token;
}

test('Health: Datenbank wird angelegt, Google ist aus', async () => {
  const t = await setup();
  try {
    const r = await t.call('GET', '/health');
    assert.deepStrictEqual(r.body, { ok: true, mail: 'log', google: false });
    assert.strictEqual((await t.call('GET', '/gibt-es-nicht')).status, 404);
  } finally { t.close(); }
});

test('Fehlendes secret: verständliche Meldung mit Vorschlag', async () => {
  const t = await setup("'secret' => ''");
  try {
    const r = await t.call('GET', '/health');
    assert.strictEqual(r.status, 500);
    assert.match(r.body.error, /secret/);
    assert.match(r.body.secret_vorschlag, /^[0-9a-f]{64}$/);
  } finally { t.close(); }
});

test('Anmeldung per Code: falscher Code, richtiger Code, Code nur einmal gültig', async () => {
  const t = await setup();
  try {
    assert.strictEqual((await t.call('POST', '/auth/email/start', { email: 'kein-mail' })).status, 400);
    assert.strictEqual((await t.call('POST', '/auth/email/start', { email: ' Max@Example.com ' })).status, 200);
    const { to, code, link } = t.mails()[0];
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
    const { code } = t.mails()[0];
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await t.call('POST', '/auth/email/verify', { email: 'a@b.ch', code: wrong });
    assert.strictEqual((await t.call('POST', '/auth/email/verify', { email: 'a@b.ch', code })).status, 400);
  } finally { t.close(); }
});

test('Mehr als 5 Code-Anfragen pro Adresse werden gebremst', async () => {
  const t = await setup();
  try {
    const st = [];
    for (let i = 0; i < 6; i++) st.push((await t.call('POST', '/auth/email/start', { email: 'viel@example.com' })).status);
    assert.deepStrictEqual(st, [200, 200, 200, 200, 200, 429]);
  } finally { t.close(); }
});

test('Anmeldung per Link aus der E-Mail', async () => {
  const t = await setup();
  try {
    await t.call('POST', '/auth/email/start', { email: 'link@example.com' });
    const link = new URL(t.mails()[0].link).searchParams.get('login');
    const r = await t.call('POST', '/auth/email/verify', { link });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.email, 'link@example.com');
    assert.strictEqual((await t.call('POST', '/auth/email/verify', { link })).status, 400);
  } finally { t.close(); }
});

test('Google-Anmeldung ohne Client-ID ist ausgeschaltet', async () => {
  const t = await setup();
  try {
    assert.strictEqual((await t.call('POST', '/auth/google', { credential: 'x' })).status, 404);
  } finally { t.close(); }
});

test('Daten speichern mit Versionsprüfung, leere Objekte bleiben Objekte', async () => {
  const t = await setup();
  try {
    const tok = await loginWithCode(t, 'sync@example.com');
    assert.deepStrictEqual((await t.call('GET', '/data', null, tok)).body, { rev: 0, data: null });
    assert.strictEqual((await t.call('GET', '/data')).status, 401);

    const doc = { v: 1, entries: { 'favs/x': { v: true, t: 1 }, 'custom/y': { v: { aliases: [], groups: [], extra: {} }, t: 2 } } };
    assert.deepStrictEqual((await t.call('PUT', '/data', { rev: 0, data: doc }, tok)).body, { rev: 1 });
    assert.deepStrictEqual((await t.call('GET', '/data', null, tok)).body.data, doc);

    const stale = await t.call('PUT', '/data', { rev: 0, data: { n: 2 } }, tok);
    assert.strictEqual(stale.status, 409);
    assert.deepStrictEqual({ rev: stale.body.rev, data: stale.body.data }, { rev: 1, data: doc });
    assert.deepStrictEqual((await t.call('PUT', '/data', { rev: 1, data: { entries: {} } }, tok)).body, { rev: 2 });
    assert.deepStrictEqual((await t.call('GET', '/data', null, tok)).body.data, { entries: {} });
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
    const other = await loginWithCode(t, 'bleibt@example.com');
    await t.call('PUT', '/data', { rev: 0, data: { geheim: true } }, tok);
    await t.call('PUT', '/data', { rev: 0, data: { andere: true } }, other);
    assert.strictEqual((await t.call('DELETE', '/account', null, tok)).status, 200);
    assert.strictEqual((await t.call('GET', '/account', null, tok)).status, 401);
    // Neue Anmeldung mit derselben Adresse beginnt leer, andere Konten bleiben unberührt
    const neu = await loginWithCode(t, 'weg@example.com');
    assert.deepStrictEqual((await t.call('GET', '/data', null, neu)).body, { rev: 0, data: null });
    assert.deepStrictEqual((await t.call('GET', '/data', null, other)).body.data, { andere: true });
  } finally { t.close(); }
});

test('CORS nur für erlaubte Adressen, Preflight mit X-Auth-Token', async () => {
  const t = await setup();
  try {
    const ok = await t.call('GET', '/health', null, null, { Origin: 'https://app.example' });
    assert.strictEqual(ok.headers.get('access-control-allow-origin'), 'https://app.example');
    assert.match(ok.headers.get('access-control-allow-headers'), /X-Auth-Token/);
    const bad = await t.call('GET', '/health', null, null, { Origin: 'https://boese.example' });
    assert.strictEqual(bad.headers.get('access-control-allow-origin'), null);
    const pre = await t.call('OPTIONS', '/data', null, null, { Origin: 'https://app.example', 'Access-Control-Request-Method': 'PUT' });
    assert.strictEqual(pre.status, 204);
    assert.match(pre.headers.get('access-control-allow-methods'), /PUT/);
  } finally { t.close(); }
});
