# Android-App (Google Play)

Die Android-App ist eine **Trusted Web Activity (TWA)**: ein kleines Android-Gerüst, das https://bauchgefuehl.mlplugins.com im Chrome-Motor ohne Adressleiste öffnet. Inhalte und Daten kommen weiterhin von der Website. Ein Update der Website (FTP) ist sofort auch in der App sichtbar, ohne neue Play-Version.

Gebaut wird mit [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). In diesem Ordner liegt nur die Konfiguration `twa-manifest.json`. Das eigentliche Android-Projekt wird daraus erzeugt.

## Wo was liegt (auf Michis Laptop)

| Was | Ort | Ins Repo? |
|---|---|---|
| Konfiguration | `android/twa-manifest.json` (hier) | ja |
| Android-Projekt + fertige AAB | `C:\Users\LKB-Lappi\Bauchgefuehl-Android\` | nein |
| Upload-Schlüssel | `C:\Users\LKB-Lappi\Bauchgefuehl-Signatur\upload.keystore` | **nie** |
| Java 17, Android SDK | `C:\Users\LKB-Lappi\.bubblewrap\` | nein |

Fingerabdruck (SHA-256) des Upload-Schlüssels:
`C6:53:4C:6E:60:2B:BB:65:A3:16:10:8C:84:08:69:76:E8:F0:1E:0E:7B:4D:CB:22:9D:C0:F8:6E:EA:3F:6F:12`

## Neue Version bauen

Nur nötig, wenn sich am Android-Teil etwas ändert (Name, Icon, Farben, Startseite) oder Google eine neue Ziel-Android-Version verlangt. Für neue Lebensmittel oder App-Funktionen reicht der FTP-Upload der Website.

1. In `twa-manifest.json` `appVersionCode` um 1 erhöhen (z.B. 2) und `appVersion` anpassen (z.B. `1.0.1`).
2. Projekt neu erzeugen und bauen (PowerShell):

```powershell
bubblewrap update --skipVersionUpgrade --directory="C:\Users\LKB-Lappi\Bauchgefuehl-Android" --manifest="E:\OneDrive\Cowork\FODMAPS\android\twa-manifest.json"
Copy-Item E:\OneDrive\Cowork\FODMAPS\android\twa-manifest.json C:\Users\LKB-Lappi\Bauchgefuehl-Android\
cd C:\Users\LKB-Lappi\Bauchgefuehl-Android
bubblewrap build --skipPwaValidation
```

Bubblewrap fragt nach den beiden Passwörtern (beide gleich, aus dem Passwort-Manager). Ergebnis: `app-release-bundle.aab` im Projektordner.

## Digital Asset Links

`/.well-known/assetlinks.json` auf dem Server bestätigt, dass App und Website zusammengehören. Nur dann verschwindet die Adressleiste. Darin müssen stehen:

- der Fingerabdruck des **Upload-Schlüssels** (oben, für selbst installierte Test-APKs)
- der Fingerabdruck der **Play App-Signatur** (Play Console → Testen und veröffentlichen → App-Integrität → App-Signatur → «Zertifikat für den App-Signaturschlüssel», SHA-256):
  `A0:12:EE:B2:4A:39:65:1A:D6:7B:7F:ED:5D:35:5C:14:35:8A:77:C6:AE:0F:F5:2F:4D:F9:BC:EB:9E:FC:01:D9`

Prüfen: https://developers.google.com/digital-asset-links/tools/generator
