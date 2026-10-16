<?php
// Vorlage: kopieren nach config.php und ausfüllen.
// config.php enthält Passwörter – nie ins Git-Repo hochladen (steht in .gitignore).
return [
    // Datenbank aus konsoleH (MariaDB/MySQL)
    'db' => [
        'driver' => 'mysql',            // 'mysql' für MariaDB/MySQL, 'sqlite' für eine einfache Datei
        'host'   => 'localhost',
        'port'   => 3306,
        'name'   => '',                 // Datenbankname
        'user'   => '',                 // Datenbankbenutzer
        'pass'   => '',                 // Passwort
        'path'   => __DIR__ . '/data/bauchgefuehl.sqlite', // nur bei 'sqlite'
    ],

    // Langer Zufallswert. Leer lassen und /api/index.php/health aufrufen – dort steht ein Vorschlag.
    'secret' => '',

    // Adresse der App (für den Link in der Anmelde-E-Mail)
    'app_url' => 'https://bauchgefuehl.mlplugins.com/',

    // Webseiten, die die API aufrufen dürfen
    'allowed_origins' => [
        'https://bauchgefuehl.mlplugins.com',
    ],

    // OAuth-Client-ID aus der Google Cloud Console (leer = Google-Anmeldung aus)
    'google_client_id' => '',

    // E-Mail-Versand für die Anmeldecodes
    'mail' => [
        'mode'         => 'smtp',       // 'smtp' = über ein Postfach senden (empfohlen)
                                        // 'php'  = PHP mail() des Hostings
                                        // 'log'  = nur in data/mail.log schreiben (Test)
        'from_address' => 'support@mlplugins.com', // Absender – am besten dasselbe Postfach wie 'user'
        'from_name'    => 'Bauchgefühl',

        // SMTP-Zugang des Postfachs (bei Hetzner-Postfächern: mail.your-server.de)
        'host'   => 'mail.your-server.de',
        'port'   => 587,                // 587 mit 'tls' oder 465 mit 'ssl'
        'secure' => 'tls',
        'user'   => 'support@mlplugins.com',
        'pass'   => '',                 // Passwort des Postfachs
    ],
];
