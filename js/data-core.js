/*
 * Datenkern: Kategorien, FODMAP-Gruppen und Parser für die Datendateien.
 *
 * Zeilenformat in data/*.js (Felder durch | getrennt):
 *   Name | Ampel | Synonyme (Komma) | Verträgliche Portion | Kritisch ab | Gruppen | Hinweis
 * Ampel: g = verträglich, y = gelegentlich / Portion beachten, r = meiden.
 * Ein angehängtes ~ (z.B. "y~") markiert Einträge, die aus den Zutaten
 * abgeleitet und nicht labor-getestet sind.
 * Gruppen: F Fruktane, G GOS, L Laktose, X Fruktose, S Sorbit, M Mannit, P weitere Polyole.
 */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'gemuese', name: 'Gemüse', icon: '🥕' },
    { id: 'kraeuter', name: 'Kräuter & Gewürze', icon: '🌿' },
    { id: 'obst', name: 'Obst', icon: '🍓' },
    { id: 'brot', name: 'Brot & Backwaren', icon: '🥖' },
    { id: 'getreide', name: 'Getreide, Pasta & Reis', icon: '🍚' },
    { id: 'milch', name: 'Milchprodukte & Alternativen', icon: '🧀' },
    { id: 'fleisch', name: 'Fleisch, Fisch & Eier', icon: '🍗' },
    { id: 'vegi', name: 'Tofu & Hülsenfrüchte', icon: '🌱' },
    { id: 'nuesse', name: 'Nüsse & Samen', icon: '🥜' },
    { id: 'snacks', name: 'Snacks & Chips', icon: '🍿' },
    { id: 'suesses', name: 'Süsses & Gebäck', icon: '🍫' },
    { id: 'aufstriche', name: 'Aufstriche & Süssungsmittel', icon: '🍯' },
    { id: 'saucen', name: 'Saucen, Öle & Würzmittel', icon: '🥫' },
    { id: 'getraenke', name: 'Getränke', icon: '☕' },
    { id: 'alkohol', name: 'Alkohol', icon: '🍷' },
    { id: 'fertig', name: 'Fertiggerichte & Fast Food', icon: '🍕' },
    { id: 'schweiz', name: 'Schweizer Klassiker', icon: '🏔️' },
  ];

  const GROUPS = {
    F: { short: 'Fruktane', hint: 'z.B. Weizen, Zwiebel, Knoblauch', name: 'Fruktane', text: 'Ketten aus Fruchtzucker. Stecken v.a. in Weizen, Roggen, Gerste, Zwiebeln, Knoblauch und Inulin.' },
    G: { short: 'GOS', hint: 'z.B. Bohnen, Linsen, Cashews', name: 'Galakto-Oligosaccharide (GOS)', text: 'Stecken v.a. in Hülsenfrüchten (Bohnen, Linsen, Kichererbsen), Cashews und Pistazien.' },
    L: { short: 'Laktose', hint: 'z.B. Milch, Joghurt, Quark', name: 'Laktose (Milchzucker)', text: 'In Milch, Joghurt, Quark, Frischkäse und Glace. Hartkäse ist praktisch laktosefrei.' },
    X: { short: 'Fruktose', hint: 'z.B. Apfel, Birne, Honig', name: 'Fruktose (Überschuss)', text: 'Mehr Fruchtzucker als Traubenzucker. Typisch: Apfel, Birne, Mango, Honig, Agavensirup.' },
    S: { short: 'Sorbit', hint: 'z.B. Steinobst, Avocado, Kaugummi', name: 'Sorbit', text: 'Zuckeralkohol in Steinobst, Brombeeren, Avocado und zuckerfreien Süssigkeiten (E420).' },
    M: { short: 'Mannit', hint: 'z.B. Pilze, Blumenkohl, Sellerie', name: 'Mannit', text: 'Zuckeralkohol in Pilzen, Blumenkohl, Sellerie und Süsskartoffeln (E421).' },
    P: { short: 'Polyole', hint: 'z.B. Xylit, Maltit, Isomalt', name: 'Weitere Polyole', text: 'Zugesetzte Zuckeralkohole wie Xylit, Maltit, Isomalt. Wirken oft abführend.' },
  };

  const STATUS = {
    g: { label: 'Verträglich', long: 'In normaler Portion FODMAP-arm.' },
    y: { label: 'Portion beachten', long: 'In kleiner Menge meist verträglich, grössere Portionen können Beschwerden auslösen.' },
    r: { label: 'Meiden', long: 'Schon in üblichen Mengen reich an FODMAPs.' },
  };

  const items = [];
  const seen = new Set();

  function slug(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function add(cat, text) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const p = line.split('|').map((s) => s.trim());
      let status = p[1] || 'g';
      const est = status.endsWith('~');
      status = status.replace('~', '');
      let id = slug(cat + '-' + p[0]);
      if (seen.has(id)) {
        console.warn('Doppelter Eintrag:', p[0]);
        id += '-2';
      }
      seen.add(id);
      items.push({
        id,
        name: p[0],
        cat,
        status,
        est,
        aliases: (p[2] || '').split(',').map((s) => s.trim()).filter(Boolean),
        portion: p[3] || '',
        limit: p[4] || '',
        groups: (p[5] || '').split(/\s+/).filter((g) => GROUPS[g]),
        note: p[6] || '',
      });
    }
  }

  window.FODMAP = { CATEGORIES, GROUPS, STATUS, items, add, slug };
})();
