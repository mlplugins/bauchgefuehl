# Store-Eintrag Bauchgefühl (Google Play)

Alles zum Kopieren in die Play Console. Feldnamen wie in der deutschen Play Console.

## Hauptdetails des Store-Eintrags

**App-Name** (26 von max. 30 Zeichen)

```
Bauchgefühl – FODMAP-Ampel
```

**Kurzbeschreibung** (79 von max. 80 Zeichen)

```
Low-FODMAP-Liste mit 760 Lebensmitteln: Portionen, Zutaten-Check und Merkliste.
```

**Vollständige Beschreibung** (max. 4000 Zeichen)

```
Welche Lebensmittel vertrage ich bei einer FODMAP-armen Ernährung? Bauchgefühl gibt dir die Antwort in Sekunden – übersichtlich mit einer Ampel.

🟢 Verträglich – in normaler Portion FODMAP-arm
🟠 Gelegentlich – nur in kleinen Mengen
🔴 Meiden – enthält viele FODMAPs

WAS BAUCHGEFÜHL KANN
• Über 760 Lebensmittel: Gemüse, Obst, Brot, Milchprodukte, Fleisch, Snacks, Saucen, Getränke und typische Fertigprodukte
• Verträgliche Portion und «kritisch ab» – damit du weisst, wie viel geht
• FODMAP-Gruppen auf einen Blick: Fruktane, GOS, Laktose, Fruktose, Sorbit, Mannit
• Zutaten-Check: Zutatenliste einer Packung einfügen und sehen, welche Zutaten kritisch sind
• Regionale Namen aus der Schweiz, Deutschland und Österreich: Die Suche findet Rüebli, Möhre und Karotte genauso wie Quark und Topfen
• Merkliste, eigene Bewertungen und Notizen («Vertrage ich gut», «Nur wenig», «Vertrage ich nicht»)
• Deine Verträglichkeit je FODMAP-Gruppe nach der Wiedereinführungsphase
• Eigene Lebensmittel ergänzen
• Funktioniert offline, auch im Laden ohne Empfang
• Hell- und Dunkelmodus

OHNE KONTO, OHNE WERBUNG
Bauchgefühl funktioniert ohne Anmeldung. Deine Eingaben bleiben dann nur auf deinem Gerät. Wer möchte, meldet sich mit der E-Mail-Adresse an und gleicht Merkliste und Bewertungen zwischen Handy und Computer ab. Das Konto lässt sich jederzeit in der App löschen. Keine Werbung, kein Tracking, kein Verkauf von Daten.

WICHTIGER HINWEIS
Die Angaben sind Richtwerte auf Basis öffentlich verfügbarer Labordaten und Fachliteratur. Bauchgefühl ist kein Medizinprodukt, stellt keine Diagnosen und ersetzt keine medizinische Beratung. Besprich deine Ernährung bei Beschwerden mit deiner Ärztin, deinem Arzt oder einer Ernährungsberatung. Rezepturen von Fertigprodukten ändern sich – prüfe immer das Etikett.

Entwickelt in der Schweiz von LoveSpirit KLG (mlplugins.com).
```

**Was ist neu** (Versionshinweis für die erste Version in der Produktion, 1.0.1)

```
Erste Version im Play Store.
```

## Grafiken

| Feld | Datei | Vorgabe |
|---|---|---|
| App-Symbol | `store/play-icon-512.png` | 512 × 512 PNG |
| Feature-Grafik | `store/feature-grafik-1024x500.png` | 1024 × 500 |
| Smartphone-Screenshots | `screenshots/01-suche.png` bis `06-dunkel.png` | 2–8 Stück, 1080 × 1920 |

**Erklärung zu KI-Assets:** «Assets nicht kennzeichnen» (Entscheid vom 2026-10-31). Symbol und Feature-Grafik sind schlichte, mit KI-Hilfe erstellte Grafiken, die Screenshots echte Aufnahmen der App.

Tablet-Screenshots sind freiwillig. Ohne sie wird die App auf Tablets weniger prominent gezeigt, ist aber installierbar.

## Store-Einstellungen

- **App oder Spiel:** App
- **Kategorie:** Gesundheit & Fitness
- **Tags:** Ernährung, Gesundheit (die Console schlägt passende vor, bis zu 5)
- **E-Mail-Adresse:** support@mlplugins.com
- **Website:** leer lassen (freiwillig). `bauchgefuehl.mlplugins.com` führt nur wieder zur App, `mlplugins.com` zeigt WooCommerce-Plugins.
- **Telefonnummer:** leer lassen (freiwillig)
- **Kostenlos oder kostenpflichtig:** Kostenlos. Achtung: Eine kostenlose App kann später nicht mehr kostenpflichtig werden.
- **Länder:** Schweiz, Deutschland, Österreich, Liechtenstein (bei Bedarf Luxemburg)
- **Standardsprache:** Deutsch – de-DE (Play hat kein de-CH). Texte oben verwenden «ss», das ist für alle drei Länder in Ordnung.

## App-Inhalte (Richtlinien)

### Datenschutzerklärung
```
https://bauchgefuehl.mlplugins.com/datenschutz.html
```

### Anmeldedaten (früher «App-Zugriff»)
**Ja**, ein Teil der App ist zugangsbeschränkt: Abgleich zwischen Geräten und Konto löschen brauchen eine Anmeldung. Die Prüfer können laut Google keine Konten erstellen und keine E-Mails empfangen, deshalb gibt es ein Prüfkonto ([api/README.md](../api/README.md), Abschnitt «Prüfkonto für Google Play»). Adresse und Code stehen in `api/config.php` auf dem Server und im Passwort-Manager, nicht hier.

Anleitung für die Prüfer:

```
The food lists and all other functions work without an account. An account is optional and only used to sync data between devices.

To sign in, open "Profil", tap "Anmelden", enter the email address above and tap "Code per E-Mail senden". No email is sent for this test account. Enter the code above in the "Code" field. It does not change.

To delete the account, use "Konto löschen" under "Profil". The test account can be used again afterwards.
```

### Werbung
**Nein**, die App enthält keine Werbung.

### Werbe-ID
**Nein**. Die AAB enthält keine Berechtigung `AD_ID`.

### Altersfreigabe (Fragebogen, IARC)
- E-Mail-Adresse: support@mlplugins.com
- Kategorie: **Alle anderen App-Typen**
- Freigaberelevante Inhalte im App-Paket? **Nein**
- Können Nutzer miteinander kommunizieren oder Inhalte teilen? **Nein** (alles bleibt privat)
- Online-Inhalte, die nicht Teil des App-Downloads sind? **Ja** (die App lädt ihre Inhalte von der Website)
- Gewalt, Sexualität, anstössige Sprache: **Nein**
- Drogen, Sucht- und Rauschmittel oder Verweise darauf? **Ja**: Die Liste enthält die Kategorie «Alkohol» mit 🍷-Symbol.
  - Schwerpunkt der App? **Nein**
  - Visuelle Darstellungen? **Ja** (das Symbol)
  - Schriftliche Hinweise? **Ja** (Bier, Wein usw. als Lebensmittel mit FODMAP-Angaben)
- Schwerpunkt auf Bewerben oder Verkaufen altersbeschränkter Produkte? **Nein**
- Wird der Standort geteilt? **Nein**
- Digitale Käufe? **Nein**
- Geldauszahlungen, Gutscheine, Krypto-Prämien, NFTs? **Nein**
- Webbrowser oder Suchmaschine? **Nein**
- Hauptsächlich Nachrichten oder Bildung? **Nein**

### Zielgruppe und Inhalte
- Altersgruppen: **16–17 und 18 und älter**. Google weist darauf hin, dass jüngere Nutzer je nach Land als Kinder gelten, dann gelten strengere Regeln, auch beim Datenschutz. Das ist nur die Zielgruppe, keine Sperre für Jüngere.
- Spricht die App Kinder an? **Nein**

### Nachrichten-App
**Nein**

### Behörden-Apps / Finanzfunktionen
Keine.

### Gesundheits-Apps
- Kategorie: **Ernährung und Gewichtsmanagement**
- Keine weiteren Kategorien (kein Medizinprodukt, keine Diagnose, keine Behandlung, kein Health Connect)
- Falls gefragt «Ist deine App ein Medizinprodukt / unterliegt sie einer Zulassung?» → **Nein**
- Hinweis in der App vorhanden: Info-Seite «Die Werte sind Richtwerte und keine medizinische Beratung …» und in der Datenschutzerklärung.

### Datensicherheit

**Übersicht**
- Erfasst oder teilt deine App erforderliche Nutzerdatentypen? **Ja**
- Werden alle erfassten Nutzerdaten bei der Übertragung verschlüsselt? **Ja**
- Welche Kontoerstellungsmethoden unterstützt deine App? **Nutzername und andere Authentifizierung** (Anmeldung mit E-Mail-Adresse und Einmal-Code, kein Passwort)
- Link zum Löschen des Kontos (Web):
```
https://bauchgefuehl.mlplugins.com/datenschutz.html#konto-loeschen
```
- Können Nutzer das Löschen von Daten auch ohne Löschen des Kontos anfordern? **Nein** – nicht nötig. (Hinweis: Lokale Daten kann man in der App jederzeit selbst löschen; auf dem Server gibt es nur «ganzes Konto löschen».)

**Datentypen** – alle: *erfasst = Ja*, *geteilt = Nein*, *sitzungsspezifisch (flüchtig) verarbeitet = Nein*, *erforderlich oder optional = Optional (Nutzer können wählen)*

| Kategorie | Datentyp | Zweck |
|---|---|---|
| Personenbezogene Daten | E-Mail-Adresse | Kontoverwaltung, App-Funktionen |
| Gesundheit und Fitness | Gesundheitsdaten (eigene Bewertungen, Verträglichkeit je FODMAP-Gruppe) | App-Funktionen |
| App-Aktivitäten | Andere von Nutzern erstellte Inhalte (Merkliste, Notizen, eigene Lebensmittel) | App-Funktionen |

Nicht ankreuzen: Standort, Finanzdaten, Kontakte, Fotos, Dateien, Kalender, Geräte-IDs, Absturzberichte, Analysen, Werbung.

Begründung «nicht geteilt»: Hetzner (Hosting und E-Mail-Versand) und Cloudflare (Auslieferung und Schutz vor Angriffen) sind nur Auftragsverarbeiter, das gilt bei Google nicht als Weitergabe.

Später beachten: Wird «Mit Google anmelden» aktiviert (`googleClientId` in `js/config.js`), zusätzlich **Personenbezogene Daten → Nutzer-IDs** (Google-Konto-ID, Zweck Kontoverwaltung) ankreuzen.
