/*
 * Zutaten-Check: zerlegt eine Zutatenliste und bewertet jede Zutat.
 * Regeln werden der Reihe nach geprüft, die erste Übereinstimmung gewinnt –
 * deshalb stehen Ausnahmen (z.B. «Knoblauchöl», «Milchsäure») vor den allgemeinen Regeln.
 * Alle Muster sind ohne Umlaute geschrieben (ä→a, ö→o, ü→u, ß→ss).
 */
(function () {
  'use strict';

  // [Muster, Ampel, Begründung, Gruppen]
  const RULES = [
    // --- Ausnahmen: verträglich trotz verdächtigem Wortteil
    [/knoblauchol|knoblauch ol/, 'g', 'Knoblauchöl – Fruktane gehen nicht ins Öl über'],
    [/schnittlauch|bohnenkraut/, 'g', 'Kraut – FODMAP-arm'],
    [/fruhlingszwiebelgrun|lauchgrun/, 'g', 'Grüner Teil – FODMAP-arm'],
    [/laktosefrei|lactosefrei/, 'g', 'Laktosefrei'],
    [/milchsaure|kokosmilch|kokosnussmilch|milchprotein|milcheiweiss|kasein|casein|molkenproteinisolat|molkeneiweissisolat|isolat/, 'g', 'Enthält kaum Laktose'],
    [/kakao|kaffee/, 'g', 'FODMAP-arm'],
    [/johannisbrotkernmehl|guarkernmehl|pektin|xanthan|agar|gelatine|carrageen/, 'g', 'Verdickungsmittel – unbedenklich'],
    [/apfelessig|apfelsaure/, 'g', 'Unbedenklich'],
    [/kirschwasser|kirschbrand/, 'g', 'Destillat – FODMAP-arm'],
    [/maltodextrin|dextrose|glukosesirup|glucosesirup|traubenzucker|maltosesirup|maltose|starkesirup/, 'g', 'Glukose-basiert – verträglich'],
    [/sojalecithin|lecithin|sojaol|sojasauce|sojasosse|tamari|sojaprotein|sojaeiweiss|erbsenprotein|erbseneiweiss|reisprotein/, 'g', 'Enthält kaum FODMAPs'],
    [/starke/, 'g', 'Stärke – FODMAP-arm'],
    [/kokosblutenzucker/, 'y', 'Kokosblütenzucker enthält etwas Fruktane', 'F'],

    // --- Fruktose & Zucker
    [/fruktose ?glukose|fructose ?glucose|fruktose ?glucose|fructose ?glukose/, 'r', 'Fruktose-Glukose-Sirup: mehr als 50 % Fruktose', 'X'],
    [/glukose ?fruktose|glucose ?fructose|glukose ?fructose|glucose ?fruktose|isoglukose/, 'y', 'Glukose-Fruktose-Sirup: 5–50 % Fruktose', 'X'],
    [/invertzucker/, 'y', 'Invertzucker enthält freie Fruktose', 'X'],
    [/honig/, 'r', 'Honig – Fruktose-Überschuss', 'X'],
    [/agave/, 'r', 'Agavendicksaft – Fruktose-Überschuss', 'X'],
    [/fruktose|fructose|fruchtzucker/, 'r', 'Freie Fruktose', 'X'],

    // --- Fruktane
    [/zwiebel|schalotte/, 'r', 'Zwiebel – stark fruktanhaltig', 'F'],
    [/knoblauch/, 'r', 'Knoblauch – stark fruktanhaltig', 'F'],
    [/barlauch|lauch|porree/, 'r', 'Lauch – fruktanhaltig', 'F'],
    [/inulin|chicoree|zichorie|oligofruktose|oligofructose|fructo ?oligo|frukto ?oligo|^fos$/, 'r', 'Inulin/FOS – konzentrierte Fruktane', 'F'],
    [/galacto ?oligo|galakto ?oligo|^gos$/, 'r', 'GOS-Ballaststoff', 'G'],
    [/mais|reis|kartoffel|hirse|buchweizen|quinoa|tapioka|hafer|amaranth/, 'g', 'FODMAP-arm'],
    [/malzextrakt|gerstenmalz|malz/, 'y', 'Gerstenmalz enthält Fruktane – in kleinen Mengen meist ok', 'F'],
    [/weizen|dinkel|roggen|gerste|kamut|emmer|einkorn|grunkern|triticale|couscous|bulgur|griess|paniermehl|semmelbrosel|^mehl$/, 'y', 'Getreide mit Fruktanen – in kleinen Mengen meist ok', 'F'],

    // --- Obst
    [/birnendicksaft|apfeldicksaft|apfelsaft|birnensaft|apfel|birne|mango|wassermelone|feige|dattel|rosine|sultanine|korinthe|trockenfr|dorrobst/, 'r', 'Obst mit viel Fruktose oder Sorbit', 'X S'],
    [/pflaume|zwetschg|zwetschk|powidl|aprikose|marille|pfirsich|nektarine|brombeer|kirsch|litschi/, 'r', 'Obst mit viel Sorbit', 'S'],
    [/fruchtsaftkonzentrat|fruchtsaft|saftkonzentrat|fruchtpuree|fruchtzubereitung|fruchtmark/, 'y', 'Fruchtsaft unbekannter Sorte – je nach Frucht problematisch', 'X'],

    // --- Polyole
    [/sorbit|^e ?420/, 'r', 'Sorbit (Zuckeralkohol)', 'S'],
    [/mannit|^e ?421/, 'r', 'Mannit (Zuckeralkohol)', 'M'],
    [/isomalt|^e ?953|maltit|^e ?965|lactit|^e ?966|xylit|^e ?967|polyglycit|^e ?964/, 'r', 'Zuckeralkohol (Polyol)', 'P'],
    [/erythrit|^e ?968/, 'y', 'Erythrit – meist besser verträglich als andere Polyole', 'P'],
    [/polydextrose|^e ?1200/, 'y', 'Polydextrose – in grösseren Mengen blähend'],

    // --- Laktose
    [/laktose|lactose|milchzucker/, 'r', 'Laktose', 'L'],
    [/milchpulver|molke|buttermilch|kondensmilch|milchserum|milcherzeugnis|milchbestandteil/, 'y', 'Milchbestandteil mit Laktose – Menge entscheidend', 'L'],
    [/joghurt|jogurt|quark|frischkase|ricotta|mascarpone|rahm|sahne|obers|topfen|schmand|milch/, 'y', 'Milchprodukt mit Laktose', 'L'],
    [/butter|kase|ghee/, 'g', 'Praktisch laktosefrei'],

    // --- Hülsenfrüchte & Nüsse
    [/cashew|pistazie/, 'r', 'Reich an GOS und Fruktanen', 'G F'],
    [/kichererbse|linse|bohne|erbse|lupine|soja/, 'r', 'Hülsenfrucht (GOS)', 'G'],
    [/mandel|haselnuss/, 'y', 'In grösseren Mengen GOS', 'G'],

    // --- Gemüse
    [/pilz|champignon/, 'r', 'Pilze – Mannit', 'M'],
    [/blumenkohl/, 'r', 'Blumenkohl – Mannit', 'M'],
    [/sellerie/, 'y', 'Sellerie – Mannit (in Gewürzen meist nur wenig)', 'M'],
    [/spargel|artischocke|topinambur/, 'r', 'Reich an Fruktanen', 'F'],
    [/kokosmehl/, 'r', 'Kokosmehl – Sorbit/Fruktane', 'S F'],
    [/carob|johannisbrot/, 'r', 'Carob – Fruktane', 'F'],
    [/gemusepulver|gemuseextrakt|bouillon|bruhe|gemuse/, 'y', 'Kann Zwiebel oder Lauch enthalten', 'F'],

    // --- Würzung
    [/aroma|vanillin/, 'g', 'Aromen – unbedenklich'],
    [/gewurz|wurze/, 'y', 'Nicht näher bezeichnet – kann Zwiebel/Knoblauch enthalten', 'F'],

    // --- Häufige verträgliche Grundzutaten
    [/zucker|saccharose|salz|wasser|ol$|ole$|fett|essig|saure|ascorbin|tocopherol|^e ?\d{3}|hefe|^eier?$|eigelb|eiweiss|vollei|pfeffer|paprika|kurkuma|zimt|vanille|chili|tomate|karotte|spinat|gurke|olive|fleisch|schwein|rind|huhn|poulet|fisch|lachs|thunfisch|erdnuss|walnuss|macadamia|pekan|sonnenblumenkern|kurbiskern|sesam|leinsamen|chia|kokos|zitrone|limette|orange|erdbeer|himbeer|heidelbeer|ananas|banane|kiwi|ingwer|senf|petersilie|basilikum|oregano|thymian|rosmarin|kurbis/, 'g', 'FODMAP-arm'],
  ];

  const CLASS_WORDS = /^(zutaten|emulgator(en)?|sauerungsmittel|saureregulator(en)?|verdickungsmittel|geliermittel|stabilisator(en)?|antioxidationsmittel|konservierungsstoff(e)?|farbstoff(e)?|backtriebmittel|trennmittel|feuchthaltemittel|geschmacksverstarker|sussungsmittel|sussstoff(e)?|uberzugsmittel|mehlbehandlungsmittel|raucharoma|zusatzstoff(e)?|und|mit|aus|bio)$/;

  function norm(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[-_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanToken(s) {
    let t = s.replace(/\*+/g, '');
    if (t.includes(':')) t = t.slice(t.lastIndexOf(':') + 1);
    t = t.replace(/\d+([.,·]\d+)?\s*%/g, '')
      .replace(/^[\s.\-–:]+|[\s.\-–:]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return t;
  }

  function parse(text) {
    let t = String(text || '').replace(/\r/g, '');
    // Spurenhinweise und Allergenangaben am Ende abschneiden
    t = t.split(/kann spuren|spuren von|allergiker ?hinweis|allergene:/i)[0];
    // Dezimalzahlen schützen (7,4 % bzw. 7.4 %), damit sie nicht als Trennzeichen gelten
    t = t.replace(/(\d)[.,](\d)/g, '$1·$2');
    const out = [];
    const parents = [];
    let depth = 0, buf = '', top = 1, any = false;
    const flush = () => {
      const s = cleanToken(buf);
      buf = '';
      if (!s || s.length < 2) return;
      if (CLASS_WORDS.test(norm(s))) return;
      out.push({ text: s, pos: top, sub: depth > 0, parent: parents.length ? parents[parents.length - 1] : -1 });
      any = true;
    };
    for (const ch of t) {
      if ('([{'.includes(ch)) {
        flush();
        const last = out.length - 1;
        parents.push(last >= 0 && out[last].pos === top ? last : -1);
        depth++;
        continue;
      }
      if (')]}'.includes(ch)) { flush(); depth = Math.max(0, depth - 1); parents.pop(); continue; }
      if (ch === ',' || ch === ';' || ch === '\n' || (ch === '.' && depth === 0)) {
        flush();
        if (depth === 0 && any) { top++; any = false; }
        continue;
      }
      buf += ch;
    }
    flush();
    return out;
  }

  /** findFood(normName) -> Datenbank-Eintrag oder null (Fallback für unbekannte Zutaten) */
  function analyze(text, findFood) {
    const parts = parse(text);
    const res = [];
    for (const p of parts) res.push(rate(p, res, findFood));
    return summarize(parts, res);
  }

  // Allergen-Herkunftsangaben wie «Lecithine (Soja)» oder «Stärke (Weizen)»
  const SOURCE_WORDS = /^(soja|milch|weizen|gerste|roggen|dinkel|hafer|ei|eier|senf|sellerie|lupine|sesam|mais|kartoffel|erbse|erbsen)$/;

  function rate(p, done, findFood) {
      const n = norm(p.text);
      const parent = p.parent >= 0 ? done[p.parent] : null;
      if (parent && parent.status && SOURCE_WORDS.test(n)) {
        return { ...p, status: parent.status, reason: `Herkunftsangabe zu «${parent.text}»`, groups: [] };
      }
      for (const [re, status, reason, groups] of RULES) {
        if (re.test(n)) return { ...p, status, reason, groups: (groups || '').split(' ').filter(Boolean) };
      }
      const food = findFood ? findFood(n) : null;
      if (food) return { ...p, status: food.status, reason: 'Aus der Datenbank: ' + food.name, groups: food.groups, food };
      return { ...p, status: null, reason: 'Nicht erkannt – keine bekannten FODMAP-Probleme', groups: [] };
  }

  function summarize(parts, res) {
    const total = parts.length ? parts[parts.length - 1].pos : 0;
    const reds = res.filter((r) => r.status === 'r');
    const yellows = res.filter((r) => r.status === 'y');
    let verdict;
    if (!res.length) verdict = null;
    else if (reds.length) verdict = { status: 'r', title: 'Enthält kritische Zutaten', text: 'Kritisch: ' + uniq(reds.map((r) => r.text)).join(', ') + '.' };
    else if (yellows.length) verdict = { status: 'y', title: 'In Massen geniessen', text: 'Mit Vorsicht: ' + uniq(yellows.map((r) => r.text)).join(', ') + '. Kleine Portionen sind meist verträglich.' };
    else verdict = { status: 'g', title: 'Sieht gut aus', text: 'Keine bekannten FODMAP-Auslöser gefunden.' };
    return { items: res, total, verdict };
  }

  function uniq(a) { return [...new Set(a)]; }

  window.IngredientCheck = { analyze, norm };
})();
