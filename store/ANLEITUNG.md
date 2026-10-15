# Bauchgefühl in den Play Store bringen – Schritt für Schritt

Konto: Play Console als **Organisation** (LoveSpirit KLG). Dadurch gibt es **keinen** Pflicht-Test mit 12 Testern über 14 Tage. Ablauf: interner Test → (optional) geschlossener Test → Produktion.

Die Texte und Formular-Antworten zum Kopieren stehen in [store-eintrag.md](store-eintrag.md).

---

## 0. Vorher: Schlüssel sichern (5 Minuten, einmalig)

Ordner: `C:\Users\LKB-Lappi\Bauchgefuehl-Signatur\`

1. Datei `PASSWORT-hier-rausnehmen.txt` öffnen und das Passwort in deinen **Passwort-Manager** übernehmen (Eintrag z.B. «Bauchgefühl Upload-Schlüssel», Alias `upload`).
2. Den ganzen Ordner auf einen **USB-Stick** kopieren (oder in ein verschlüsseltes Backup). Den Stick an einem sicheren Ort aufbewahren.
3. Danach die Datei `PASSWORT-hier-rausnehmen.txt` **löschen** (auf dem Laptop und auf dem Stick).

Warum so: Mit diesem «Upload-Schlüssel» beweist du Google, dass ein Update wirklich von dir kommt. Die App selbst signiert Google mit einem eigenen Schlüssel (Play App-Signatur), den Google sicher verwahrt. Geht der Upload-Schlüssel verloren, kann man ihn über den Google-Support zurücksetzen lassen – das dauert aber einige Tage. Nie ins Git-Repo, nie per E-Mail verschicken, nicht in OneDrive/Dropbox ohne Verschlüsselung.

---

## 1. App in der Play Console anlegen

1. https://play.google.com/console öffnen → **App erstellen**.
2. App-Name: `Bauchgefühl – FODMAP-Datenbank` · Standardsprache: **Deutsch – de-DE** · **App** · **Kostenlos**.
3. Die beiden Erklärungen (Programmrichtlinien, US-Exportgesetze) bestätigen → **App erstellen**.

## 2. Interner Test mit der AAB

1. Links **Testen und veröffentlichen → Testen → Interner Test** → **Neuen Release erstellen**.
2. Bei «App-Signatur durch Google Play» die Standardeinstellung **«Von Google generierten Schlüssel verwenden»** lassen und bestätigen.
3. AAB hochladen: `C:\Users\LKB-Lappi\Bauchgefuehl-Android\app-release-bundle.aab`
4. Release-Name bleibt `1 (1.0.0)`. Versionshinweise aus store-eintrag.md («Erste Version im Play Store.»).
5. Reiter **Tester**: E-Mail-Liste anlegen (z.B. «Bauchgefühl intern») mit deiner eigenen Gmail-Adresse und ein, zwei weiteren.
6. **Speichern** → **Überprüfen** → **Einführung starten**. *(Vorher mir Bescheid geben, ich schaue gerne mit drauf.)*

## 3. Fingerabdruck der Play App-Signatur holen → mir schicken

1. Links **Testen und veröffentlichen → App-Integrität** → **App-Signatur** (bzw. «Einstellungen» neben Play App Signing).
2. Unter **«Zertifikat für den App-Signaturschlüssel»** die Zeile **SHA-256-Zertifikatfingerabdruck** kopieren (sieht aus wie `AB:12:CD:…`, 32 Paare).
3. Mir diese Zeile schicken. Ich trage sie in `.well-known/assetlinks.json` ein, committe und pushe.

Ohne diesen Schritt zeigt die App aus dem Play Store oben eine Adressleiste.

## 4. assetlinks.json per FTP hochladen

Mit FileZilla (oder deinem FTP-Programm) auf den Server, in den Ordner, in dem auch `index.html` liegt:

1. Rechts (Server) prüfen, ob es den Ordner **`.well-known`** schon gibt. In FileZilla sieht man Ordner mit Punkt nur, wenn **Server → «Anzeige versteckter Dateien erzwingen»** aktiv ist.
2. Falls nicht vorhanden: rechts Rechtsklick → **Verzeichnis erstellen** → Name genau `.well-known` (mit Punkt, ohne Leerzeichen).
3. Den Ordner öffnen und die Datei `.well-known/assetlinks.json` aus dem Repo hineinziehen.
4. Kontrolle im Browser: https://bauchgefuehl.mlplugins.com/.well-known/assetlinks.json muss den Text mit `com.mlplugins.bauchgefuehl` zeigen (keine Weiterleitung, keine Fehlermeldung).
5. Zusätzlich prüfen mit https://developers.google.com/digital-asset-links/tools/generator : Hosting site `https://bauchgefuehl.mlplugins.com`, App package `com.mlplugins.bauchgefuehl`, Fingerabdruck der Play App-Signatur → «Test statement» muss erfolgreich sein.

## 5. Auf dem Handy testen

1. In der Play Console beim internen Test → Reiter **Tester** → **Link kopieren** («Über das Web beitreten»).
2. Den Link auf dem Android-Handy öffnen (mit dem Google-Konto, das in der Testerliste steht) → **Tester werden** → zum Play Store → **Installieren**.
3. Prüfen:
   - Startet ohne Adressleiste oben?
   - Suche, Zutaten-Check, Merkliste funktionieren?
   - Flugmodus ein: App läuft trotzdem?
   - Anmelden mit E-Mail-Code, Merkliste erscheint auf dem Computer?
   - Profil → Konto → Konto löschen funktioniert?

Siehst du doch eine Adressleiste: assetlinks.json prüfen (Schritt 4), Fingerabdruck vergleichen, App einmal deinstallieren und neu installieren.

## 6. Store-Eintrag und App-Inhalte ausfüllen

Alles aus [store-eintrag.md](store-eintrag.md):

1. **Wachstum → Store-Präsenz → Haupt-Store-Eintrag:** Name, Kurz- und Langbeschreibung, App-Symbol, Feature-Grafik, Screenshots.
2. **Store-Einstellungen:** Kategorie Gesundheit & Fitness, Kontaktdaten.
3. **Richtlinien → App-Inhalte:** Datenschutzerklärung, App-Zugriff, Werbung, Altersfreigabe, Zielgruppe, Nachrichten-App, Gesundheits-Apps, Datensicherheit, Behörden-Apps, Finanzfunktionen.

Auf dem **Dashboard** zeigt Google eine Checkliste. Alles muss grün sein, bevor Produktion möglich ist.

## 7. Geschlossener Test (optional)

Für Organisationskonten nicht Pflicht. Sinnvoll, wenn ein paar Bekannte die App vorher ausprobieren sollen:
**Testen → Geschlossener Test → Track erstellen** → gleiche AAB aus der Mediathek wählen («Aus Mediathek hinzufügen») → Tester-Liste → Länder → Einführung. Der geschlossene Test wird von Google geprüft (meist 1–3 Tage, bei neuen Apps auch bis zu 7).

## 8. Produktion

1. **Testen und veröffentlichen → Produktion → Länder/Regionen:** Schweiz, Deutschland, Österreich, Liechtenstein.
2. **Neuen Release erstellen** → «Aus Mediathek hinzufügen» → die AAB Version 1 (1.0.0) → Versionshinweise → **Überprüfen** → **An Google zur Überprüfung senden**. *(Vorher mir Bescheid geben.)*
3. Prüfung durch Google: oft 1–3 Tage, bei neuen Apps bis zu 7 Tage. Danach ist Bauchgefühl im Play Store.

---

## Später: Updates

- **Neue Lebensmittel, Texte, Funktionen:** wie bisher per FTP auf die Website. Die App zeigt das automatisch, keine neue Play-Version nötig. Wie immer `VERSION` in `sw.js` erhöhen.
- **Neue Play-Version** nur bei Änderungen am Android-Teil oder wenn Google eine neue Ziel-Android-Version verlangt (etwa einmal pro Jahr, Google schickt dazu eine E-Mail). Anleitung in [android/README.md](../android/README.md).
