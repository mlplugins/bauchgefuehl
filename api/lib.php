<?php
// Hilfsfunktionen: Konfiguration, Datenbank, Antworten, Begrenzung, E-Mail, Google.

const CODE_TTL = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_IDLE = 400 * 24 * 60 * 60 * 1000;
const MAX_BODY = 1024 * 1024;

class HttpError extends Exception
{
    public $status;
    public $extra;

    public function __construct(int $status, string $message, array $extra = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->extra = $extra;
    }
}

function ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

function new_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function config(): array
{
    static $config = null;
    if ($config !== null) return $config;
    $file = getenv('BG_CONFIG') ?: __DIR__ . '/config.php';
    if (!is_file($file)) {
        throw new HttpError(500, 'config.php fehlt. Bitte config.example.php kopieren und ausfüllen.', ['secret_vorschlag' => bin2hex(random_bytes(32))]);
    }
    $config = require $file;
    if (empty($config['secret']) || strlen($config['secret']) < 32) {
        throw new HttpError(500, 'In config.php fehlt «secret» (mindestens 32 Zeichen).', ['secret_vorschlag' => bin2hex(random_bytes(32))]);
    }
    return $config;
}

function hmac(string $s): string
{
    return hash_hmac('sha256', $s, config()['secret']);
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config()['db'];
    $sqlite = ($c['driver'] ?? 'mysql') === 'sqlite';
    try {
        if ($sqlite) {
            $pdo = new PDO('sqlite:' . $c['path']);
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA busy_timeout = 5000');
        } else {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['port'] ?? 3306, $c['name']);
            $pdo = new PDO($dsn, $c['user'], $c['pass']);
        }
    } catch (PDOException $e) {
        error_log('Bauchgefühl DB: ' . $e->getMessage());
        throw new HttpError(500, 'Keine Verbindung zur Datenbank. Bitte Angaben in config.php prüfen.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    migrate($pdo, $sqlite);
    return $pdo;
}

// Tabellen beim ersten Aufruf anlegen. Präfix bg_, falls die Datenbank geteilt wird.
function migrate(PDO $pdo, bool $sqlite): void
{
    try {
        $pdo->query('SELECT 1 FROM bg_rate LIMIT 1');
        return;
    } catch (PDOException $e) {
        // Tabellen fehlen noch
    }
    if ($sqlite) {
        $sql = [
            'CREATE TABLE IF NOT EXISTS bg_users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, google_sub TEXT UNIQUE, created_at INTEGER NOT NULL)',
            'CREATE TABLE IF NOT EXISTS bg_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL, last_used INTEGER NOT NULL)',
            'CREATE INDEX IF NOT EXISTS bg_sessions_user ON bg_sessions(user_id)',
            'CREATE TABLE IF NOT EXISTS bg_login_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, link_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)',
            'CREATE TABLE IF NOT EXISTS bg_user_data (user_id INTEGER PRIMARY KEY, rev INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
            'CREATE TABLE IF NOT EXISTS bg_rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL)',
        ];
    } else {
        $t = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
        $sql = [
            'CREATE TABLE IF NOT EXISTS bg_users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, email VARCHAR(191) NOT NULL UNIQUE, google_sub VARCHAR(64) NULL UNIQUE, created_at BIGINT NOT NULL)' . $t,
            'CREATE TABLE IF NOT EXISTS bg_sessions (token_hash CHAR(64) PRIMARY KEY, user_id INT UNSIGNED NOT NULL, created_at BIGINT NOT NULL, last_used BIGINT NOT NULL, INDEX bg_sessions_user (user_id))' . $t,
            'CREATE TABLE IF NOT EXISTS bg_login_codes (email VARCHAR(191) PRIMARY KEY, code_hash CHAR(64) NOT NULL, link_hash CHAR(64) NOT NULL UNIQUE, expires_at BIGINT NOT NULL, attempts INT NOT NULL DEFAULT 0)' . $t,
            'CREATE TABLE IF NOT EXISTS bg_user_data (user_id INT UNSIGNED PRIMARY KEY, rev INT NOT NULL, data MEDIUMTEXT NOT NULL, updated_at BIGINT NOT NULL)' . $t,
            'CREATE TABLE IF NOT EXISTS bg_rate (k CHAR(64) PRIMARY KEY, n INT NOT NULL, reset_at BIGINT NOT NULL)' . $t,
        ];
    }
    foreach ($sql as $s) $pdo->exec($s);
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

// Begrenzung pro Schlüssel (IP oder E-Mail). Gespeichert wird nur ein Hash des Schlüssels.
function limit(string $key, int $max, int $windowMs): void
{
    $k = hmac('rate:' . $key);
    $now = ms();
    $row = q('SELECT n, reset_at FROM bg_rate WHERE k = ?', [$k])->fetch();
    if (!$row || (int) $row['reset_at'] < $now) {
        q('DELETE FROM bg_rate WHERE k = ?', [$k]);
        q('INSERT INTO bg_rate (k, n, reset_at) VALUES (?, 1, ?)', [$k, $now + $windowMs]);
        return;
    }
    q('UPDATE bg_rate SET n = n + 1 WHERE k = ?', [$k]);
    if ((int) $row['n'] + 1 > $max) throw new HttpError(429, 'Zu viele Versuche. Bitte später noch einmal probieren.');
}

// Abgelaufene Codes, Begrenzungen und lange unbenutzte Sitzungen gelegentlich aufräumen
function cleanup(): void
{
    if (random_int(1, 50) !== 1) return;
    $now = ms();
    q('DELETE FROM bg_login_codes WHERE expires_at < ?', [$now]);
    q('DELETE FROM bg_rate WHERE reset_at < ?', [$now]);
    q('DELETE FROM bg_sessions WHERE last_used < ?', [$now - SESSION_IDLE]);
}

function mime_header(string $s): string
{
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

function send_login_mail(string $to, string $code, string $link): void
{
    $m = config()['mail'] ?? [];
    if (($m['mode'] ?? 'php') === 'log') {
        $file = $m['log'] ?? __DIR__ . '/data/mail.log';
        file_put_contents($file, json_encode(['to' => $to, 'code' => $code, 'link' => $link]) . "\n", FILE_APPEND | LOCK_EX);
        return;
    }

    $from = $m['from_address'] ?? 'noreply@mlplugins.com';
    $name = $m['from_name'] ?? 'Bauchgefühl';
    $boundary = 'bg-' . bin2hex(random_bytes(8));
    $safeLink = htmlspecialchars($link, ENT_QUOTES);

    $text = "Hallo\r\n\r\nDein Anmeldecode für Bauchgefühl lautet: $code\r\n\r\n"
        . "Gib den Code in der App ein oder öffne diesen Link:\r\n$link\r\n\r\n"
        . "Der Code ist 15 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese E-Mail ignorieren.\r\n";
    $html = '<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0e1c19">'
        . '<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">'
        . '<h1 style="font-size:20px;margin:0 0 12px">Anmelden bei Bauchgefühl</h1>'
        . '<p style="margin:0 0 16px">Dein Anmeldecode lautet:</p>'
        . '<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 20px;color:#0f766e">' . $code . '</p>'
        . '<p style="margin:0 0 20px">Gib den Code in der App ein oder tippe auf den Knopf:</p>'
        . '<p style="margin:0 0 24px"><a href="' . $safeLink . '" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Jetzt anmelden</a></p>'
        . '<p style="font-size:13px;color:#5d6d69;margin:0">Der Code ist 15 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese E-Mail ignorieren.</p>'
        . '</div></body></html>';

    $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text))
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html))
        . "--$boundary--\r\n";
    $headers = [
        'From: ' . mime_header($name) . " <$from>",
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"$boundary\"",
    ];
    $subject = mime_header("Dein Anmeldecode für Bauchgefühl: $code");

    if (($m['mode'] ?? 'php') === 'smtp') {
        try {
            smtp_send($m, $from, $to, $subject, $headers, $body);
        } catch (RuntimeException $e) {
            error_log('Bauchgefühl: ' . $e->getMessage());
            throw new HttpError(502, 'Die E-Mail konnte nicht gesendet werden. Bitte später noch einmal probieren.');
        }
        return;
    }
    $ok = mail($to, $subject, $body, implode("\r\n", $headers), '-f' . $from);
    if (!$ok) {
        error_log('Bauchgefühl: Mailversand mit mail() fehlgeschlagen');
        throw new HttpError(502, 'Die E-Mail konnte nicht gesendet werden. Bitte später noch einmal probieren.');
    }
}

// Minimaler SMTP-Versand (STARTTLS oder SSL, AUTH LOGIN) ohne zusätzliche Bibliothek
function smtp_send(array $m, string $from, string $to, string $subject, array $headers, string $body): void
{
    $host = (string) ($m['host'] ?? '');
    $port = (int) ($m['port'] ?? 587);
    $secure = $m['secure'] ?? 'tls'; // 'tls' = STARTTLS (Port 587), 'ssl' = Port 465, 'none' nur zum Testen
    if ($host === '') throw new RuntimeException('SMTP: host fehlt in config.php');

    $ctx = stream_context_create(['ssl' => ['peer_name' => $host, 'verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("SMTP: keine Verbindung zu $host:$port ($errstr)");
    stream_set_timeout($fp, 20);

    $expect = function (?string $command, array $codes, bool $secret = false) use ($fp): string {
        if ($command !== null) fwrite($fp, $command . "\r\n");
        $reply = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') break; // letzte Zeile einer Antwort
        }
        if (!in_array((int) substr($reply, 0, 3), $codes, true)) {
            $shown = $secret ? '(Anmeldung mit Benutzer/Passwort)' : ($command === null ? '(Begrüssung)' : (strlen($command) < 100 ? $command : '(Nachricht)'));
            throw new RuntimeException('SMTP: ' . $shown . ' → ' . trim($reply));
        }
        return $reply;
    };

    try {
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $expect(null, [220]);
        $expect("EHLO $domain", [250]);
        if ($secure === 'tls') {
            $expect('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new RuntimeException('SMTP: TLS-Verschlüsselung fehlgeschlagen');
            }
            $expect("EHLO $domain", [250]);
        }
        if (!empty($m['user'])) {
            $expect('AUTH LOGIN', [334]);
            $expect(base64_encode((string) $m['user']), [334], true);
            $expect(base64_encode((string) ($m['pass'] ?? '')), [235], true);
        }
        $expect("MAIL FROM:<$from>", [250]);
        $expect("RCPT TO:<$to>", [250, 251]);
        $expect('DATA', [354]);
        $message = implode("\r\n", array_merge([
            'Date: ' . date('r'),
            "To: <$to>",
            "Subject: $subject",
            'Message-ID: <' . bin2hex(random_bytes(12)) . "@$domain>",
        ], $headers)) . "\r\n\r\n" . $body;
        $message = preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $message));
        $expect($message . "\r\n.", [250]);
        try { $expect('QUIT', [221]); } catch (RuntimeException $e) { /* Mail ist bereits angenommen */ }
    } finally {
        fclose($fp);
    }
}

function http_get(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        $res = curl_exec($ch);
        curl_close($ch);
        return $res === false ? null : $res;
    }
    $res = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]));
    return $res === false ? null : $res;
}

// Prüft das ID-Token von «Mit Google anmelden» über den tokeninfo-Endpunkt von Google
// (der kontrolliert Signatur und Ablauf). Gibt [sub, email] zurück.
function verify_google(string $credential): array
{
    $clientId = config()['google_client_id'] ?? '';
    if ($clientId === '') throw new HttpError(404, 'Google-Anmeldung ist nicht eingerichtet.');
    $res = $credential !== '' ? http_get('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential)) : null;
    $p = $res ? json_decode($res, true) : null;
    $verified = isset($p['email_verified']) && ($p['email_verified'] === true || $p['email_verified'] === 'true');
    if (!$p || ($p['aud'] ?? '') !== $clientId || !in_array($p['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
        || empty($p['email']) || empty($p['sub']) || !$verified) {
        throw new HttpError(401, 'Google-Anmeldung fehlgeschlagen.');
    }
    return [(string) $p['sub'], strtolower((string) $p['email'])];
}
