# Bauchgefühl – FODMAP-Datenbank

Installierbare Web-App (PWA): 663 Lebensmittel mit Ampel (verträglich / gelegentlich / meiden), Portionen, FODMAP-Gruppen, Zutaten-Check und persönlichen Bewertungen. Läuft offline.

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

## Persönliche Daten

Bewertungen, Favoriten, Notizen und eigene Einträge liegen nur im Browser des Geräts. Unter «Meine → Sicherung» lassen sie sich als JSON-Datei exportieren und wieder importieren.

## Hinweis

Die Angaben sind Richtwerte auf Basis öffentlich verfügbarer Daten (v.a. Monash University). Sie ersetzen keine Ernährungsberatung.
