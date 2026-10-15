# Bauchgefühl – FODMAP-Datenbank

Installierbare Web-App (PWA): 761 Lebensmittel mit Ampel (verträglich / gelegentlich / meiden), Portionen, FODMAP-Gruppen, Zutaten-Check und persönlichen Bewertungen. Läuft offline. Gedacht für die Schweiz, Deutschland und Österreich: Die Suche kennt auch die regionalen Namen (z.B. Rüebli, Möhre, Karotte oder Quark, Topfen).

- **App:** https://bauchgefuehl.mlplugins.com (Kopie ohne eigenen Server: https://mlplugins.github.io/bauchgefuehl)
- **Code:** https://github.com/mlplugins/bauchgefuehl

## Lokal testen

```bash
node server.js
```

Danach im Browser öffnen: http://localhost:5173. Lokal ist der Offline-Speicher absichtlich ausgeschaltet, damit Änderungen sofort sichtbar sind. Mit `http://localhost:5173/?sw=1` lässt er sich trotzdem testen.

## Auf das Android-Handy bringen

Die App muss einmal über **https** erreichbar sein. Danach in Chrome: Menü ⋮ → **«App installieren»**.

Am einfachsten geht das mit Netlify Drop:

1. https://app.netlify.com/drop öffnen und ein kostenloses Konto anlegen.
2. Den ganzen Ordner `FODMAPS` ins Fenster ziehen.
3. Die angezeigte Adresse (`https://….netlify.app`) auf dem Handy in Chrome öffnen und installieren.

## Android-App (Google Play)

Die App gibt es zusätzlich als Android-App im Play Store (Paket `com.mlplugins.bauchgefuehl`). Sie ist eine Trusted Web Activity: Sie zeigt die Website ohne Adressleiste an, Updates der Website gelten also sofort auch für die App. Bau und Signatur: [android/README.md](android/README.md). Store-Texte, Grafiken und Anleitung für die Play Console: [store/](store/ANLEITUNG.md). Die Datei `.well-known/assetlinks.json` muss auf dem Server liegen, sonst erscheint in der App eine Adressleiste.

## Daten bearbeiten

Die Lebensmittel stehen in `data/*.js`, eine Zeile pro Eintrag:

```
Name | Ampel | Synonyme | Verträgliche Portion | Kritisch ab | Gruppen | Hinweis
```

- **Ampel:** `g`, `y` oder `r`. Ein angehängtes `~` (z.B. `y~`) bedeutet «aus Zutaten abgeleitet».
- **Gruppen:** `F` Fruktane, `G` GOS, `L` Laktose, `X` Fruktose, `S` Sorbit, `M` Mannit, `P` weitere Polyole.

**Wichtig:** Nach jeder Änderung in `sw.js` die `VERSION` erhöhen. Sonst erhält das installierte Handy das Update nicht.

## Persönliche Daten und Konto

Bewertungen, Favoriten, Notizen und eigene Einträge liegen im Browser des Geräts. Unter «Profil → Sicherung» lassen sie sich als JSON-Datei exportieren und wieder importieren.

Wer sich unter «Profil» anmeldet (E-Mail-Code oder Google), dessen Daten werden über den eigenen Server abgeglichen – so sind Merkliste und Bewertungen auf Handy und Computer gleich. Der Server liegt im Ordner [`api/`](api/README.md) (PHP + MariaDB/MySQL) und läuft zusammen mit der App per FTP auf dem Hetzner-Webhosting unter `https://bauchgefuehl.mlplugins.com`. Die Einrichtung steht in [api/README.md](api/README.md). Adresse und Google-Client-ID der App stehen in `js/config.js`.

Lokal testen mit Konto: `php -S localhost:8787 -t .` (mit einer lokalen `api/config.php`, siehe api/README.md).

## Hinweis

Die Angaben sind Richtwerte auf Basis öffentlich verfügbarer Daten (v.a. Monash University). Sie ersetzen keine Ernährungsberatung.
