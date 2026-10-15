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
        'https://mlplugins.github.io',
    ],

    // OAuth-Client-ID aus der Google Cloud Console (leer = Google-Anmeldung aus)
    'google_client_id' => '',

    // E-Mail-Versand über PHP mail() des Hostings
    'mail' => [
        'mode'         => 'php',        // 'php' = senden, 'log' = nur in data/mail.log schreiben (Test)
        'from_address' => 'noreply@mlplugins.com',
        'from_name'    => 'Bauchgefühl',
    ],
];
