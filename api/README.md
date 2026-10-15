# Bauchgefühl-API

Kleiner Server für Konten und den Abgleich zwischen Geräten. Er speichert pro Konto:
E-Mail-Adresse, optional die Google-Konto-ID und die persönlichen App-Daten
(Merkliste, Bewertungen, Notizen, eigene Einträge, Gruppen-Verträglichkeit).
Node.js + SQLite, läuft als Docker-Container.

## Installation auf dem Server (Hetzner)

1. Repo auf den Server holen und in den Ordner wechseln:

   ```bash
   git clone https://github.com/mlplugins/bauchgefuehl.git
   cd bauchgefuehl/api
   ```

2. Einstellungen anlegen:

   ```bash
   cp .env.example .env
   openssl rand -hex 32
   ```

   Den ausgegebenen Wert bei `SECRET=` eintragen, dann die SMTP-Angaben ergänzen
   (siehe unten). `GOOGLE_CLIENT_ID` kann vorerst leer bleiben.

3. Starten:

   ```bash
   docker compose up -d --build
   curl http://127.0.0.1:8787/api/health
   ```

   Antwort: `{"ok":true}`.

4. Reverse Proxy für `https://bauchgefuehl.mlplugins.com` einrichten (siehe unten) und im
   DNS einen A-Eintrag `bauchgefuehl` auf die Server-IP setzen.

### Reverse Proxy

**Caddy** (holt das Zertifikat automatisch):

```
bauchgefuehl.mlplugins.com {
    reverse_proxy /api/* 127.0.0.1:8787
}
```

**nginx** (Zertifikat z.B. mit certbot):

```nginx
server {
    server_name bauchgefuehl.mlplugins.com;
    listen 443 ssl http2;
    # ssl_certificate … / ssl_certificate_key … (certbot)

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 2m;
    }
}
```

Bei **Traefik** statt `ports:` in `docker-compose.yml` die üblichen Labels setzen und den
Container ins Traefik-Netzwerk hängen.

## E-Mail (SMTP)

Für die Anmeldecodes braucht der Server ein Postfach zum Versenden, z.B. `noreply@mlplugins.com`
beim bestehenden Mail-Anbieter. In `.env`:

```
SMTP_HOST=smtp.dein-anbieter.ch
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=noreply@mlplugins.com
SMTP_PASS=…
MAIL_FROM=Bauchgefühl <noreply@mlplugins.com>
```

Damit die Mails nicht im Spam landen, sollten SPF und DKIM für die Absender-Domain eingerichtet sein.
Ohne SMTP-Angaben schreibt der Server die Codes nur ins Log (`docker compose logs`) – praktisch zum Testen.

## Google-Anmeldung

1. https://console.cloud.google.com → Projekt anlegen (oder bestehendes nehmen).
2. «APIs & Dienste» → «OAuth-Zustimmungsbildschirm»: Typ «Extern», App-Name «Bauchgefühl»,
   Link zur Datenschutzerklärung: `https://mlplugins.github.io/bauchgefuehl/datenschutz.html`.
3. «Anmeldedaten» → «Anmeldedaten erstellen» → «OAuth-Client-ID» → Typ «Webanwendung».
   Unter «Autorisierte JavaScript-Quellen» eintragen:
   - `https://mlplugins.github.io`
   - `https://bauchgefuehl.mlplugins.com`
   - `http://localhost:5173` (zum lokalen Testen)
4. Die Client-ID (endet auf `.apps.googleusercontent.com`) an zwei Stellen eintragen:
   - Server: `GOOGLE_CLIENT_ID=` in `.env`, dann `docker compose up -d`
   - App: `googleClientId` in `js/config.js`

Die Client-ID ist nicht geheim und darf im Repo stehen.

## Updates

```bash
cd bauchgefuehl && git pull && cd api && docker compose up -d --build
```

## Sicherung der Datenbank

Die Datenbank liegt im Docker-Volume `api_bauchgefuehl-data`. Sicherung im laufenden Betrieb:

```bash
docker compose exec bauchgefuehl-api node -e "require('better-sqlite3')('/data/bauchgefuehl.db').backup('/data/backup.db').then(()=>console.log('ok'))"
docker cp bauchgefuehl-api:/data/backup.db ./bauchgefuehl-backup-$(date +%F).db
```

## Lokal entwickeln

```bash
cd api
npm install
npm start      # http://localhost:8787, Codes erscheinen in der Konsole
npm test
```

Die App unter `http://localhost:5173` (`node server.js` im Hauptordner) spricht automatisch mit
`http://localhost:8787/api`.

## Datenschutz

- In der Datenbank liegen nur Hashes von Anmeldecodes und Sitzungen, nie die Klartext-Werte.
- Anmeldecodes verfallen nach 15 Minuten, Sitzungen nach 400 Tagen ohne Nutzung.
- «Konto löschen» in der App entfernt Konto, Sitzungen und Daten sofort und endgültig.
- Der Server protokolliert keine E-Mail-Adressen (ausser im Testmodus ohne SMTP).
