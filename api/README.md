# Bauchgefühl-API (PHP)

Kleiner Server für Konten und den Abgleich zwischen Geräten. Läuft auf normalem PHP-Webhosting
(Hetzner konsoleH) mit MariaDB/MySQL, ohne Docker und ohne Kommandozeile.

Gespeichert wird pro Konto: E-Mail-Adresse, optional die Google-Konto-ID und die persönlichen
App-Daten (Merkliste, Bewertungen, Notizen, eigene Einträge, Gruppen-Verträglichkeit).

## Einrichten auf Hetzner (konsoleH)

### 1. Subdomain anlegen

In konsoleH die Subdomain `bauchgefuehl.mlplugins.com` anlegen und **SSL (Let's Encrypt)** aktivieren.
PHP 8.1 oder neuer auswählen.

### 2. Datenbank anlegen

In konsoleH unter «Datenbanken» eine neue **MariaDB/MySQL-Datenbank** mit Benutzer anlegen.
Datenbankname, Benutzer, Passwort und Server (meist `localhost`, sonst steht der Hostname in konsoleH) notieren.

### 3. Dateien per FTP hochladen

In das Verzeichnis der Subdomain hochladen:

```
index.html
datenschutz.html
manifest.webmanifest
sw.js
css/
js/
data/
icons/
api/          (index.php, lib.php, .htaccess, config.example.php, data/.htaccess)
```

Nicht nötig: `tests/`, `server.js`, `README.md`, `.git`.

Achtung: Dateien, die mit einem Punkt beginnen (`.htaccess`), blenden manche FTP-Programme aus.
In FileZilla: Menü «Server» → «Anzeige versteckter Dateien erzwingen».

### 4. config.php anlegen

1. Im Browser `https://bauchgefuehl.mlplugins.com/api/index.php/health` öffnen.
   Die Antwort meldet, dass `config.php` fehlt, und schlägt unter `secret_vorschlag` einen Zufallswert vor.
2. `api/config.example.php` kopieren, als `api/config.php` speichern und ausfüllen:
   - `db` → `name`, `user`, `pass` (und `host`, falls nicht `localhost`)
   - `secret` → den vorgeschlagenen Zufallswert
3. `config.php` per FTP in den Ordner `api/` hochladen.
4. `https://bauchgefuehl.mlplugins.com/api/index.php/health` nochmals öffnen. Antwort:

   ```json
   {"ok":true,"mail":"php","google":false}
   ```

   Die Tabellen (alle mit Präfix `bg_`) legt der Server dabei selbst an.

### 5. Ausprobieren

`https://bauchgefuehl.mlplugins.com` öffnen → «Profil» → «Anmelden» → E-Mail-Adresse eingeben.
Der Code kommt per E-Mail.

## E-Mail-Versand (SMTP)

Die Anmeldecodes werden über ein normales Postfach verschickt, wie mit einem Mailprogramm.

1. In konsoleH unter «E-Mail» ein Postfach anlegen (oder ein bestehendes nehmen), z.B. `support@mlplugins.com`.
2. In `api/config.php` den Block `mail` ausfüllen:

   ```php
   'mail' => [
       'mode'         => 'smtp',
       'from_address' => 'support@mlplugins.com',
       'from_name'    => 'Bauchgefühl',
       'host'         => 'mail.your-server.de',
       'port'         => 587,
       'secure'       => 'tls',
       'user'         => 'support@mlplugins.com',
       'pass'         => 'Passwort des Postfachs',
   ],
   ```

   `mail.your-server.de` ist der Mailserver für Postfächer bei Hetzner. Liegt das Postfach
   bei einem anderen Anbieter, dessen SMTP-Server, Port und Zugangsdaten eintragen
   (Port 465 dann mit `'secure' => 'ssl'`).
3. `config.php` per FTP hochladen und in der App eine Anmeldung ausprobieren.

`from_address` sollte dasselbe Postfach sein wie `user` – sonst lehnen viele Mailserver den Versand ab.
Klappt es nicht, meldet die App «Die E-Mail konnte nicht gesendet werden». Die genaue Ursache
(z.B. falsches Passwort) steht dann im PHP-Fehlerprotokoll in konsoleH.

Weitere Modi: `'php'` nutzt PHP `mail()` des Hostings, `'log'` schreibt die Codes nur in
`api/data/mail.log` (zum Testen).

## Google-Anmeldung (optional)

1. https://console.cloud.google.com → Projekt anlegen.
2. «APIs & Dienste» → «OAuth-Zustimmungsbildschirm»: Typ «Extern», App-Name «Bauchgefühl»,
   Datenschutz-Link `https://bauchgefuehl.mlplugins.com/datenschutz.html`.
3. «Anmeldedaten» → «OAuth-Client-ID» → Typ «Webanwendung». Unter «Autorisierte JavaScript-Quellen»:
   - `https://bauchgefuehl.mlplugins.com`
   - `http://localhost:5173` (lokales Testen)
4. Die Client-ID (`….apps.googleusercontent.com`) eintragen:
   - Server: `google_client_id` in `api/config.php`
   - App: `googleClientId` in `js/config.js`

Die Client-ID ist nicht geheim.

## Updates

Geänderte Dateien einfach wieder per FTP hochladen. `api/config.php` nie überschreiben –
sie liegt nicht im Git-Repo. Nach Änderungen an der App die `VERSION` in `sw.js` erhöhen,
damit installierte Apps das Update laden.

## Sicherheit und Datenschutz

- `.htaccess` sperrt `config.php`, `lib.php` und den Ordner `data/` für direkte Aufrufe.
- In der Datenbank liegen nur Hashes von Anmeldecodes, Sitzungen und Begrenzungs-Schlüsseln, nie Klartext-Werte.
- Anmeldecodes verfallen nach 15 Minuten, Sitzungen nach 400 Tagen ohne Nutzung.
- Pro E-Mail-Adresse höchstens 5 Code-Anfragen in 15 Minuten, 5 Fehlversuche pro Code.
- «Konto löschen» in der App entfernt Konto, Sitzungen und Daten sofort.

## Lokal entwickeln

PHP 8.1+ mit `pdo_sqlite` (und `openssl`, `curl`, `mbstring`). Lokale `api/config.php` z.B. mit
`'db' => ['driver' => 'sqlite', 'path' => __DIR__ . '/data/dev.sqlite']` und `'mail' => ['mode' => 'log']`.

```bash
php -S localhost:8787 -t .
```

Die App unter `http://localhost:5173` (`node server.js`) oder direkt unter `http://localhost:8787`
spricht dann mit `http://localhost:8787/api/index.php`.

Tests (starten eigene PHP-Server mit Wegwerf-Datenbank):

```bash
PHP_BIN=php node tests/api.test.js
```
