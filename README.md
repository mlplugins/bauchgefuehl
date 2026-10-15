# Bauchgefühl – FODMAP-Datenbank

Installierbare Web-App (PWA): 761 Lebensmittel mit Ampel (verträglich / gelegentlich / meiden), Portionen, FODMAP-Gruppen, Zutaten-Check und persönlichen Bewertungen. Läuft offline. Gedacht für die Schweiz, Deutschland und Österreich: Die Suche kennt auch die regionalen Namen (z.B. Rüebli, Möhre, Karotte oder Quark, Topfen).

- **App:** https://mlplugins.github.io/bauchgefuehl
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

## Daten bearbeiten

Die Lebensmittel stehen in `data/*.js`, eine Zeile pro Eintrag:

```
Name | Ampel | Synonyme | Verträgliche Portion | Kritisch ab | Gruppen | Hinweis
```

- **Ampel:** `g`, `y` oder `r`. Ein angehängtes `~` (z.B. `y~`) bedeutet «aus Zutaten abgeleitet».
- **Gruppen:** `F` Fruktane, `G` GOS, `L` Laktose, `X` Fruktose, `S` Sorbit, `M` Mannit, `P` weitere Polyole.

**Wichtig:** Nach jeder Änderung in `sw.js` die `VERSION` erhöhen. Sonst erhält das installierte Handy das Update nicht.

## Persönliche Daten und Konto

Bewertungen, Favoriten, Notizen und eigene Einträge liegen im Browser des Geräts. Unter «Meine → Sicherung» lassen sie sich als JSON-Datei exportieren und wieder importieren.

Wer sich unter «Meine» anmeldet (E-Mail-Code oder Google), dessen Daten werden über den eigenen Server abgeglichen – so sind Merkliste und Bewertungen auf Handy und Computer gleich. Der Server liegt im Ordner [`api/`](api/README.md) (Node.js + SQLite, Docker) und läuft unter `https://bauchgefuehl.mlplugins.com/api`. Adresse und Google-Client-ID der App stehen in `js/config.js`.

Lokal testen mit Konto: zusätzlich `cd api && npm install && npm start` – die Anmeldecodes erscheinen dann in der Konsole.

## Hinweis

Die Angaben sind Richtwerte auf Basis öffentlich verfügbarer Daten (v.a. Monash University). Sie ersetzen keine Ernährungsberatung.
