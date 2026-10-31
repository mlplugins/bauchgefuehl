<?php
/*
 * Bauchgefühl-API für Konto und Synchronisierung (PHP, MariaDB/MySQL oder SQLite).
 *
 *   POST   /api/index.php/auth/email/start   { email }            Code + Link per E-Mail senden
 *   POST   /api/index.php/auth/email/verify  { email, code }      mit Code anmelden
 *                                            { link }             mit Link aus der E-Mail anmelden
 *   POST   /api/index.php/auth/google        { credential }       mit Google anmelden
 *   POST   /api/index.php/auth/logout                             Sitzung beenden
 *   GET    /api/index.php/account                                 E-Mail und Erstellungsdatum
 *   DELETE /api/index.php/account                                 Konto mit allen Daten löschen
 *   GET    /api/index.php/data                                    { rev, data }
 *   PUT    /api/index.php/data               { rev, data }        speichern; 409 wenn rev veraltet
 *   GET    /api/index.php/health                                  Einrichtung prüfen
 *
 * Angemeldet wird mit dem Header «X-Auth-Token: <token>». In der Datenbank liegen
 * nur Hashes von Sitzungen und Codes, nie die Klartext-Werte.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

function cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $allowed = [];
    try { $allowed = config()['allowed_origins'] ?? []; } catch (HttpError $e) { /* Einrichtung unvollständig */ }
    if (in_array($origin, $allowed, true) || preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Max-Age: 86400');
    }
}

function send(int $status, $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    header('Content-Length: ' . strlen($json));
    echo $json;
}

function body(): object
{
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || $raw === '') return new stdClass();
    if (strlen($raw) > MAX_BODY) throw new HttpError(413, 'Daten zu gross');
    $b = json_decode($raw); // Objekte bleiben Objekte, damit {} nicht zu [] wird
    if (!is_object($b)) throw new HttpError(400, 'Ungültiges JSON');
    return $b;
}

function str($v): string
{
    return is_scalar($v) ? trim((string) $v) : '';
}

// Festes Konto für die Google-Prüfung: Code aus config.php statt per E-Mail
function review_code(string $email): ?string
{
    $r = config()['review_login'] ?? [];
    if (strtolower(trim((string) ($r['email'] ?? ''))) !== $email) return null;
    return preg_match('/^\d{6}$/', (string) ($r['code'] ?? '')) ? (string) $r['code'] : null;
}

function create_session(int $userId): string
{
    $t = new_token();
    $now = ms();
    q('INSERT INTO bg_sessions (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)', [hash('sha256', $t), $userId, $now, $now]);
    return $t;
}

function find_or_create_user(string $email, ?string $googleSub): array
{
    $user = $googleSub ? q('SELECT * FROM bg_users WHERE google_sub = ?', [$googleSub])->fetch() : false;
    if (!$user) $user = q('SELECT * FROM bg_users WHERE email = ?', [$email])->fetch();
    if (!$user) {
        q('INSERT INTO bg_users (email, google_sub, created_at) VALUES (?, ?, ?)', [$email, $googleSub, ms()]);
        $user = q('SELECT * FROM bg_users WHERE email = ?', [$email])->fetch();
    } elseif ($googleSub && !$user['google_sub']) {
        q('UPDATE bg_users SET google_sub = ? WHERE id = ?', [$googleSub, $user['id']]);
    }
    return $user;
}

function logged_in(array $user): array
{
    return ['token' => create_session((int) $user['id']), 'email' => $user['email']];
}

function auth(): array
{
    $t = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    if ($t === '' && preg_match('/^Bearer (\S+)$/', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $m)) $t = $m[1];
    if ($t === '') throw new HttpError(401, 'Nicht angemeldet');
    $hash = hash('sha256', $t);
    $s = q('SELECT * FROM bg_sessions WHERE token_hash = ?', [$hash])->fetch();
    if (!$s || (int) $s['last_used'] < ms() - SESSION_IDLE) throw new HttpError(401, 'Sitzung abgelaufen');
    if ((int) $s['last_used'] < ms() - 3600 * 1000) q('UPDATE bg_sessions SET last_used = ? WHERE token_hash = ?', [ms(), $hash]);
    $user = q('SELECT * FROM bg_users WHERE id = ?', [$s['user_id']])->fetch();
    if (!$user) throw new HttpError(401, 'Konto nicht gefunden');
    return [$user, $hash];
}

$routes = [
    'GET /health' => function () {
        db();
        return ['ok' => true, 'mail' => config()['mail']['mode'] ?? 'php', 'google' => (config()['google_client_id'] ?? '') !== ''];
    },

    'POST /auth/email/start' => function (object $b) {
        $email = strtolower(str($b->email ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 191) throw new HttpError(400, 'Bitte eine gültige E-Mail-Adresse eingeben.');
        limit('ip:' . client_ip(), 20, 3600 * 1000);
        limit('mail:' . $email, 5, 15 * 60 * 1000);
        $review = review_code($email);
        $code = $review ?? str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $link = new_token();
        $pdo = db();
        $pdo->beginTransaction();
        q('DELETE FROM bg_login_codes WHERE email = ?', [$email]);
        q('INSERT INTO bg_login_codes (email, code_hash, link_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)',
            [$email, hmac($email . ':' . $code), hash('sha256', $link), ms() + CODE_TTL]);
        $pdo->commit();
        $appUrl = rtrim(config()['app_url'] ?? 'https://bauchgefuehl.mlplugins.com/', '/') . '/';
        if ($review === null) send_login_mail($email, $code, $appUrl . '?login=' . $link . '#/meine');
        return ['ok' => true];
    },

    'POST /auth/email/verify' => function (object $b) {
        limit('verify:' . client_ip(), 30, 15 * 60 * 1000);
        if (!empty($b->link)) {
            $row = q('SELECT * FROM bg_login_codes WHERE link_hash = ?', [hash('sha256', str($b->link))])->fetch();
            if (!$row || (int) $row['expires_at'] < ms()) throw new HttpError(400, 'Der Link ist abgelaufen. Bitte einen neuen Code anfordern.');
        } else {
            $email = strtolower(str($b->email ?? ''));
            $code = preg_replace('/\D/', '', str($b->code ?? ''));
            $row = q('SELECT * FROM bg_login_codes WHERE email = ?', [$email])->fetch();
            if (!$row || (int) $row['expires_at'] < ms()) throw new HttpError(400, 'Der Code ist abgelaufen. Bitte einen neuen anfordern.');
            if ((int) $row['attempts'] >= MAX_CODE_ATTEMPTS) throw new HttpError(400, 'Zu viele falsche Eingaben. Bitte einen neuen Code anfordern.');
            if (!hash_equals($row['code_hash'], hmac($email . ':' . $code))) {
                q('UPDATE bg_login_codes SET attempts = attempts + 1 WHERE email = ?', [$email]);
                throw new HttpError(400, 'Der Code stimmt nicht.');
            }
        }
        q('DELETE FROM bg_login_codes WHERE email = ?', [$row['email']]);
        return logged_in(find_or_create_user($row['email'], null));
    },

    'POST /auth/google' => function (object $b) {
        limit('google:' . client_ip(), 30, 15 * 60 * 1000);
        [$sub, $email] = verify_google(str($b->credential ?? ''));
        return logged_in(find_or_create_user($email, $sub));
    },

    'POST /auth/logout' => function () {
        [, $hash] = auth();
        q('DELETE FROM bg_sessions WHERE token_hash = ?', [$hash]);
        return ['ok' => true];
    },

    'GET /account' => function () {
        [$user] = auth();
        return ['email' => $user['email'], 'createdAt' => (int) $user['created_at'], 'google' => !empty($user['google_sub'])];
    },

    // Löscht Konto, alle Sitzungen und gespeicherten Daten
    'DELETE /account' => function () {
        [$user] = auth();
        $pdo = db();
        $pdo->beginTransaction();
        q('DELETE FROM bg_user_data WHERE user_id = ?', [$user['id']]);
        q('DELETE FROM bg_sessions WHERE user_id = ?', [$user['id']]);
        q('DELETE FROM bg_login_codes WHERE email = ?', [$user['email']]);
        q('DELETE FROM bg_users WHERE id = ?', [$user['id']]);
        $pdo->commit();
        return ['ok' => true];
    },

    'GET /data' => function () {
        [$user] = auth();
        $row = q('SELECT rev, data, updated_at FROM bg_user_data WHERE user_id = ?', [$user['id']])->fetch();
        return $row
            ? ['rev' => (int) $row['rev'], 'data' => json_decode($row['data']), 'updatedAt' => (int) $row['updated_at']]
            : ['rev' => 0, 'data' => null];
    },

    'PUT /data' => function (object $b) {
        [$user] = auth();
        if (!isset($b->data) || !is_object($b->data)) throw new HttpError(400, 'Daten fehlen');
        $json = json_encode($b->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $base = (int) ($b->rev ?? 0);
        $pdo = db();
        $pdo->beginTransaction();
        $row = q('SELECT rev FROM bg_user_data WHERE user_id = ?', [$user['id']])->fetch();
        $rev = null;
        if (!$row && $base === 0) {
            q('INSERT INTO bg_user_data (user_id, rev, data, updated_at) VALUES (?, 1, ?, ?)', [$user['id'], $json, ms()]);
            $rev = 1;
        } elseif ($row && (int) $row['rev'] === $base) {
            q('UPDATE bg_user_data SET rev = rev + 1, data = ?, updated_at = ? WHERE user_id = ? AND rev = ?', [$json, ms(), $user['id'], $base]);
            $rev = $base + 1;
        }
        $pdo->commit();
        if ($rev === null) {
            // Ein anderes Gerät war schneller: aktuellen Stand zurückgeben, damit der Client zusammenführt
            $cur = q('SELECT rev, data FROM bg_user_data WHERE user_id = ?', [$user['id']])->fetch();
            throw new HttpError(409, 'Veraltet', $cur ? ['rev' => (int) $cur['rev'], 'data' => json_decode($cur['data'])] : ['rev' => 0, 'data' => null]);
        }
        return ['rev' => $rev];
    },
];

cors();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
$path = rtrim($_SERVER['PATH_INFO'] ?? ($_GET['r'] ?? ''), '/');
$fn = $routes["$method $path"] ?? null;
if (!$fn) {
    send(404, ['error' => 'Nicht gefunden']);
    exit;
}
try {
    $b = ($method === 'POST' || $method === 'PUT') ? body() : new stdClass();
    $result = $fn($b);
    cleanup();
    send(200, $result);
} catch (HttpError $e) {
    if (db_in_transaction()) db()->rollBack();
    send($e->status, ['error' => $e->getMessage()] + $e->extra);
} catch (Throwable $e) {
    if (db_in_transaction()) db()->rollBack();
    error_log('Bauchgefühl: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    send(500, ['error' => 'Serverfehler']);
}

function db_in_transaction(): bool
{
    try { return db()->inTransaction(); } catch (Throwable $e) { return false; }
}
