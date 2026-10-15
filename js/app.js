(function () {
  'use strict';

  const { CATEGORIES, GROUPS, STATUS, items: BASE_ITEMS, slug } = window.FODMAP;
  const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const VERSION = '1.0.0';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SHORT = { g: 'Verträglich', y: 'Gelegentlich', r: 'Meiden' };
  const LONG = { g: 'Verträglich', y: 'Gelegentlich – Portion beachten', r: 'Besser meiden' };
  const MY = { g: 'Vertrage ich gut', y: 'Nur wenig', r: 'Vertrage ich nicht' };

  // ---------- Speicher (nur auf diesem Gerät) ----------
  const KEY = 'bauchgefuehl.v1';
  const store = loadStore();

  function loadStore() {
    const def = { ratings: {}, favs: {}, notes: {}, custom: [], groups: {}, recent: [], theme: 'auto' };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(def, JSON.parse(raw));
    } catch (e) { /* privater Modus o.ä. */ }
    return def;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { toast('Speichern nicht möglich'); }
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* optional */ }

  // ---------- Suche ----------
  function norm(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
      .replace(/[^a-z0-9&]+/g, ' ')
      .trim();
  }

  let ALL = [];
  let BY_ID = {};
  function buildIndex() {
    ALL = BASE_ITEMS.concat(store.custom.map((c) => ({ ...c, own: true })));
    BY_ID = {};
    for (const it of ALL) {
      it._n = norm(it.name);
      it._a = it.aliases.map(norm);
      it._c = norm(CAT[it.cat] ? CAT[it.cat].name : '');
      BY_ID[it.id] = it;
    }
  }

  function dist(a, b, max) {
    // Damerau-Levenshtein (eingeschränkt) mit frühem Abbruch
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[n];
  }

  function matchScore(t, q, words) {
    if (!t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if ((' ' + t).includes(' ' + q)) return 80;
    if (t.includes(q)) return 66;
    if (words.length > 1 && words.every((w) => t.includes(w))) return 60;
    if (q.length >= 3) {
      const max = q.length <= 5 ? 1 : 2;
      let best = max + 1;
      for (const w of t.split(' ')) {
        best = Math.min(best, dist(w.slice(0, q.length), q, max), dist(w, q, max));
        if (best === 0) break;
      }
      if (best <= max) return 45 - best * 10;
    }
    return 0;
  }

  function scoreItem(it, q, words) {
    let best = matchScore(it._n, q, words), via = null;
    it._a.forEach((a, i) => {
      const s = matchScore(a, q, words) * 0.95;
      if (s > best) { best = s; via = it.aliases[i]; }
    });
    const c = matchScore(it._c, q, words) * 0.4;
    if (c > best) { best = c; via = null; }
    return { score: best, via };
  }

  // ---------- Filterzustand ----------
  const state = { q: '', status: 'all', cat: null, groups: new Set(), onlyFav: false, onlyMine: false, hideEst: false, sort: 'auto' };

  const eff = (it) => store.ratings[it.id] || it.status;

  function groupHint(it) {
    if (!it.groups.length) return null;
    if (it.groups.some((g) => store.groups[g] === 'bad')) return 'bad';
    if (it.status !== 'g' && it.groups.every((g) => store.groups[g] === 'ok')) return 'ok';
    return null;
  }

  function filtersActive() {
    return state.groups.size + (state.onlyFav ? 1 : 0) + (state.onlyMine ? 1 : 0) + (state.hideEst ? 1 : 0) + (state.sort !== 'auto' ? 1 : 0);
  }

  function isHome() {
    return !state.q && !state.cat && state.status === 'all' && !filtersActive();
  }

  const ORDER = { g: 0, y: 1, r: 2 };
  const collator = new Intl.Collator('de-CH');

  function query() {
    const q = norm(state.q);
    const words = q.split(' ').filter(Boolean);
    let list = [];
    for (const it of ALL) {
      if (state.cat && it.cat !== state.cat) continue;
      if (state.onlyFav && !store.favs[it.id]) continue;
      if (state.onlyMine && !store.ratings[it.id]) continue;
      if (state.hideEst && it.est) continue;
      if (state.groups.size && !it.groups.some((g) => state.groups.has(g))) continue;
      if (q) {
        const { score, via } = scoreItem(it, q, words);
        if (score <= 0) continue;
        list.push({ it, score, via });
      } else list.push({ it, score: 0, via: null });
    }
    // Unscharfe Treffer (Tippfehler) nur zeigen, wenn es keine direkten Treffer gibt
    if (q && list.some((r) => r.score >= 60)) list = list.filter((r) => r.score >= 50);
    else if (q && list.length) {
      const top = Math.max(...list.map((r) => r.score));
      list = list.filter((r) => r.score >= top - 5);
    }
    const counts = { all: list.length, g: 0, y: 0, r: 0 };
    for (const r of list) counts[eff(r.it)]++;
    if (state.status !== 'all') list = list.filter((r) => eff(r.it) === state.status);

    const byName = (a, b) => collator.compare(a.it.name, b.it.name);
    if (state.sort === 'az') list.sort(byName);
    else if (state.sort === 'status') list.sort((a, b) => ORDER[eff(a.it)] - ORDER[eff(b.it)] || byName(a, b));
    else if (q) list.sort((a, b) => b.score - a.score || byName(a, b));
    else list.sort(byName);
    return { list, counts };
  }

  // ---------- Rendering: Suche ----------
  const elContent = $('#search-content');
  const elQ = $('#q');

  function renderStatusSeg(counts) {
    const opts = [['all', 'Alle'], ['g', SHORT.g], ['y', SHORT.y], ['r', SHORT.r]];
    $('#status-seg').innerHTML = opts.map(([v, l]) =>
      `<button type="button" role="tab" data-status="${v}" aria-selected="${state.status === v}"><span class="l">${v !== 'all' ? `<span class="pill-dot s-${v}"></span>` : ''}${l}</span></button>`
    ).join('');
    void counts;
  }

  function renderCatChips() {
    $('#cat-chips').innerHTML = CATEGORIES.map((c) =>
      `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${c.icon} ${esc(c.name)}</button>`
    ).join('');
  }

  function subLine(it) {
    const parts = [];
    if (it.portion) parts.push(it.portion);
    if (it.groups.length) parts.push(it.groups.map((g) => GROUPS[g].short).join(', '));
    return (CAT[it.cat] ? CAT[it.cat].icon + ' ' : '') + (parts.join(' · ') || (CAT[it.cat] ? CAT[it.cat].name : ''));
  }

  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';

  // Merken direkt aus der Liste, ohne die Detailansicht zu öffnen
  function toggleFavFromList(btn) {
    const id = btn.dataset.fav, it = BY_ID[id];
    if (!it) return;
    const on = !store.favs[id];
    if (on) store.favs[id] = true; else delete store.favs[id];
    save();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${it.name} ${on ? 'aus Merkliste entfernen' : 'merken'}`);
    toast(on ? `«${it.name}» gemerkt` : `«${it.name}» aus Merkliste entfernt`);
  }

  function itemHTML(it, via) {
    const st = eff(it);
    const mine = store.ratings[it.id];
    const hint = !mine && groupHint(it);
    const marks = [];
    if (mine) marks.push('<span class="mark">● Meine Bewertung</span>');
    else if (hint === 'ok') marks.push('<span class="mark">✓ Für dich wohl ok</span>');
    else if (hint === 'bad') marks.push('<span class="mark" style="color:var(--r)">! Deine Problemgruppe</span>');
    if (it.own) marks.push('<span class="mark">Eigener Eintrag</span>');
    const fav = !!store.favs[it.id];
    return `<div class="item-wrap"><button type="button" class="item s-${st}" data-id="${esc(it.id)}">
      <span class="item-main">
        <span class="item-name">${esc(it.name)}${via ? `<small>${esc(via)}</small>` : ''}</span>
        <span class="item-sub">${esc(subLine(it))}</span>
      </span>
      <span class="item-side">
        <span class="pill s-${st}">${SHORT[st]}</span>
        ${marks.length ? `<span class="item-tags">${marks.join('')}</span>` : ''}
      </span>
    </button><button type="button" class="item-fav" data-fav="${esc(it.id)}" aria-pressed="${fav}" aria-label="${esc(it.name)} ${fav ? 'aus Merkliste entfernen' : 'merken'}">${STAR}</button></div>`;
  }

  function renderList(container, rows, emptyHTML) {
    if (!rows.length) { container.innerHTML = emptyHTML; return; }
    const CHUNK = 60;
    let shown = 0;
    container.innerHTML = '<div class="list"></div><div class="sentinel"></div>';
    const list = $('.list', container);
    const sentinel = $('.sentinel', container);
    const more = () => {
      list.insertAdjacentHTML('beforeend', rows.slice(shown, shown + CHUNK).map((r) => itemHTML(r.it, r.via)).join(''));
      shown += CHUNK;
      if (shown >= rows.length) { io && io.disconnect(); sentinel.remove(); }
    };
    let io = null;
    if (rows.length > CHUNK && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((e) => { if (e[0].isIntersecting) more(); }, { rootMargin: '600px' });
      io.observe(sentinel);
    }
    more();
    if (!io && shown < rows.length) { list.insertAdjacentHTML('beforeend', rows.slice(shown).map((r) => itemHTML(r.it, r.via)).join('')); }
  }

  function renderHome() {
    const recent = store.recent.map((id) => BY_ID[id]).filter(Boolean).slice(0, 10);
    const tiles = CATEGORIES.map((c) => {
      const its = ALL.filter((i) => i.cat === c.id);
      const n = { g: 0, y: 0, r: 0 };
      its.forEach((i) => n[eff(i)]++);
      const t = its.length || 1;
      return `<button type="button" class="cat-tile" data-cat="${c.id}">
        <span class="emo" aria-hidden="true">${c.icon}</span>
        <span class="t">${esc(c.name)}</span>
        <span class="bar" aria-hidden="true"><span class="bg" style="width:${n.g / t * 100}%"></span><span class="by" style="width:${n.y / t * 100}%"></span><span class="br" style="width:${n.r / t * 100}%"></span></span>
        <span class="n">${its.length} Einträge · ${n.g} verträglich</span>
      </button>`;
    }).join('');
    elContent.innerHTML = `
      ${recent.length ? `<div class="section-title">Zuletzt angesehen</div>
        <div class="recent">${recent.map((i) => `<button type="button" class="chip" data-id="${esc(i.id)}"><span class="pill-dot s-${eff(i)}"></span>${esc(i.name)}</button>`).join('')}</div>` : ''}
      <div class="section-title">Kategorien</div>
      <div class="cat-grid">${tiles}</div>`;
  }

  function renderSearch() {
    const { list, counts } = query();
    // Segment-Zähler
    $$('#status-seg button').forEach((b) => {
      const v = b.dataset.status;
      b.setAttribute('aria-selected', String(state.status === v));
      let n = $('.n', b);
      if (!n) { n = document.createElement('span'); n.className = 'n'; b.appendChild(n); }
      n.textContent = counts[v];
    });
    $$('#cat-chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(state.cat === b.dataset.cat)));
    const fa = filtersActive();
    $('#filter-badge').hidden = !fa;
    $('#filter-badge').textContent = fa;
    $('#q-clear').hidden = !state.q;

    if (isHome()) { renderHome(); return; }

    const label = [state.cat ? CAT[state.cat].name : null, state.q ? `«${state.q}»` : null].filter(Boolean).join(' · ');
    const reset = !isHome() ? '<button type="button" id="reset-all">Zurücksetzen</button>' : '';
    const empty = `<div class="empty"><div class="big">🔍</div>
      <p><strong>Nichts gefunden${state.q ? ` für «${esc(state.q)}»` : ''}.</strong></p>
      <p>Versuche einen anderen Begriff oder entferne Filter.</p>
      ${state.q ? `<p style="margin-top:14px"><button type="button" class="btn" id="add-from-search">«${esc(state.q)}» als eigenen Eintrag anlegen</button></p>` : ''}
    </div>`;
    elContent.innerHTML = `<div class="result-meta"><span>${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}${label ? ' · ' + esc(label) : ''}</span>${reset}</div><div id="results"></div>`;
    renderList($('#results'), list, empty);
  }

  // ---------- Bottom-Sheet ----------
  const sheet = $('#sheet'), backdrop = $('#sheet-backdrop'), sheetBody = $('#sheet-body');
  let sheetOpen = false, sheetCloseTimer = null, onSheetClose = null;

  function openSheet(html, mount, onClose) {
    clearTimeout(sheetCloseTimer);
    sheetBody.innerHTML = html;
    sheetBody.scrollTop = 0;
    onSheetClose = onClose || null;
    sheet.hidden = false; backdrop.hidden = false;
    sheet.style.transform = '';
    requestAnimationFrame(() => { sheet.classList.add('open'); backdrop.classList.add('open'); });
    if (!sheetOpen) { history.pushState({ sheet: true }, ''); sheetOpen = true; }
    document.body.style.overflow = 'hidden';
    if (mount) mount(sheetBody);
  }

  function closeSheet(fromPop) {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    sheet.style.transform = '';
    document.body.style.overflow = '';
    sheetCloseTimer = setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; sheetBody.innerHTML = ''; }, 280);
    const cb = onSheetClose; onSheetClose = null;
    if (!fromPop) history.back();
    if (cb) cb();
  }

  $('#sheet-close').addEventListener('click', () => closeSheet());
  backdrop.addEventListener('click', () => closeSheet());

  // Nach unten wischen zum Schliessen
  (function swipe() {
    let y0 = null, dy = 0;
    sheet.addEventListener('touchstart', (e) => {
      if (sheetBody.scrollTop > 0 && !e.target.closest('.sheet-grip')) return;
      if (e.target.closest('textarea, input, select')) return;
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; }
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (y0 === null) return;
      sheet.style.transition = '';
      if (dy > 110) closeSheet(); else sheet.style.transform = '';
      y0 = null;
    });
  })();

  // ---------- Detailansicht ----------
  function openDetail(id) {
    const it = BY_ID[id];
    if (!it) return;
    store.recent = [id].concat(store.recent.filter((x) => x !== id)).slice(0, 12);
    save();
    openSheet(detailHTML(it), (body) => mountDetail(body, it), refreshCurrent);
  }

  function detailHTML(it) {
    const mine = store.ratings[it.id];
    const st = it.status;
    const c = CAT[it.cat];
    const hint = groupHint(it);
    const groups = it.groups.map((g) => {
      const t = store.groups[g];
      return `<div class="d-group ${t || ''}"><span class="gtag">${esc(GROUPS[g].short)}</span><span>${esc(GROUPS[g].text)}${t === 'ok' ? ' <b>Du verträgst diese Gruppe.</b>' : t === 'bad' ? ' <b>Du verträgst diese Gruppe nicht.</b>' : ''}</span></div>`;
    }).join('');
    return `
      <div class="d-cat">${c ? c.icon + ' ' + esc(c.name) : ''}${it.own ? ' · Eigener Eintrag' : ''}</div>
      <h2>${esc(it.name)}</h2>
      ${it.aliases.length ? `<div class="d-alias">Auch: ${esc(it.aliases.join(', '))}</div>` : ''}
      <div class="d-status s-${st}">
        <span class="big-dot"></span>
        <div><strong>${LONG[st]}</strong><p>${esc(STATUS[st].long)}</p></div>
      </div>
      ${mine && mine !== st ? `<div class="callout">Deine Bewertung: ${MY[mine]} – sie wird in den Listen anstelle der allgemeinen Ampel angezeigt.</div>` : ''}
      ${!mine && hint === 'ok' ? `<div class="callout">Du verträgst alle hier enthaltenen FODMAP-Gruppen – für dich vermutlich unproblematisch.</div>` : ''}
      ${hint === 'bad' ? `<div class="callout" style="background:var(--r-soft);color:var(--r)">Enthält eine FODMAP-Gruppe, die du nicht verträgst.</div>` : ''}
      ${(it.portion || it.limit) ? `<div class="d-facts" style="margin-top:12px">
        <div class="fact"><div class="k">Verträgliche Portion</div><div class="v">${esc(it.portion || '–')}</div></div>
        <div class="fact"><div class="k">Kritisch ab</div><div class="v">${esc(it.limit || '–')}</div></div>
      </div>` : ''}
      ${groups ? `<div class="card"><h2 style="font-size:15px">Enthaltene FODMAPs</h2><div class="d-groups">${groups}</div></div>` : ''}
      ${it.note ? `<div class="note">💡 ${esc(it.note)}</div>` : ''}
      ${it.est ? `<div class="est">ⓘ <span>Diese Einstufung ist aus den typischen Zutaten abgeleitet und nicht labor-getestet. Rezepturen unterscheiden sich – im Zweifel Etikett im Zutaten-Check prüfen.</span></div>` : ''}
      <div class="card mine-box">
        <div class="row"><h2 style="font-size:15px;margin:0">Für mich</h2>
          <button type="button" class="btn fav-btn" id="d-fav" aria-pressed="${!!store.favs[it.id]}">
            <svg class="i" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>
            <span>${store.favs[it.id] ? 'Favorit' : 'Merken'}</span>
          </button>
        </div>
        <div class="rate" id="d-rate">
          ${['g', 'y', 'r'].map((v) => `<button type="button" data-v="${v}" aria-pressed="${mine === v}"><span class="dot"></span>${MY[v]}</button>`).join('')}
        </div>
        <textarea id="d-note" rows="2" placeholder="Eigene Notiz, z.B. «Nach 2 Scheiben leichte Blähungen»">${esc(store.notes[it.id] || '')}</textarea>
      </div>
      ${it.own ? `<div class="row gap" style="margin-top:4px">
        <button type="button" class="btn" id="d-edit">Bearbeiten</button>
        <button type="button" class="btn btn-danger" id="d-delete">Löschen</button></div>` : ''}
    `;
  }

  function mountDetail(body, it) {
    $('#d-fav', body).addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (store.favs[it.id]) delete store.favs[it.id]; else store.favs[it.id] = true;
      save();
      b.setAttribute('aria-pressed', String(!!store.favs[it.id]));
      $('span', b).textContent = store.favs[it.id] ? 'Favorit' : 'Merken';
    });
    $('#d-rate', body).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = b.dataset.v;
      if (store.ratings[it.id] === v) delete store.ratings[it.id]; else store.ratings[it.id] = v;
      save();
      const y = body.scrollTop;
      body.innerHTML = detailHTML(it);
      mountDetail(body, it);
      body.scrollTop = y;
    });
    let t;
    $('#d-note', body).addEventListener('input', (e) => {
      clearTimeout(t);
      const val = e.target.value;
      t = setTimeout(() => {
        if (val.trim()) store.notes[it.id] = val; else delete store.notes[it.id];
        save();
      }, 300);
    });
    if (it.own) {
      $('#d-edit', body).addEventListener('click', () => openFoodForm(it));
      $('#d-delete', body).addEventListener('click', () => {
        if (!confirm(`«${it.name}» wirklich löschen?`)) return;
        store.custom = store.custom.filter((c) => c.id !== it.id);
        delete store.ratings[it.id]; delete store.favs[it.id]; delete store.notes[it.id];
        save(); buildIndex(); closeSheet(); toast('Eintrag gelöscht');
      });
    }
  }

  // ---------- Filter-Sheet ----------
  function openFilter() {
    const html = () => `
      <h2>Filter</h2>
      <div class="section-title">Enthält FODMAP-Gruppe</div>
      <div class="opt-grid" id="f-groups">
        ${Object.entries(GROUPS).map(([k, g]) => `<button type="button" class="opt" data-g="${k}" aria-pressed="${state.groups.has(k)}"><span class="box"></span>${esc(g.short)}</button>`).join('')}
      </div>
      <div class="section-title">Persönlich</div>
      <div class="opt-grid" id="f-flags">
        <button type="button" class="opt" data-f="onlyFav" aria-pressed="${state.onlyFav}"><span class="box"></span>Nur Favoriten</button>
        <button type="button" class="opt" data-f="onlyMine" aria-pressed="${state.onlyMine}"><span class="box"></span>Nur selbst bewertete</button>
        <button type="button" class="opt" data-f="hideEst" aria-pressed="${state.hideEst}"><span class="box"></span>Nur getestete Werte</button>
      </div>
      <div class="section-title">Sortierung</div>
      <div class="seg" id="f-sort" style="grid-template-columns:repeat(3,1fr)">
        ${[['auto', 'Relevanz'], ['az', 'A–Z'], ['status', 'Ampel']].map(([v, l]) => `<button type="button" data-sort="${v}" aria-selected="${state.sort === v}">${l}</button>`).join('')}
      </div>
      <div class="row gap" style="margin-top:20px">
        <button type="button" class="btn btn-primary" id="f-done" style="flex:1">Fertig</button>
        <button type="button" class="btn" id="f-reset">Zurücksetzen</button>
      </div>`;
    const mount = (body) => {
      body.addEventListener('click', (e) => {
        const g = e.target.closest('[data-g]'), f = e.target.closest('[data-f]'), s = e.target.closest('[data-sort]');
        if (g) { state.groups.has(g.dataset.g) ? state.groups.delete(g.dataset.g) : state.groups.add(g.dataset.g); }
        else if (f) { state[f.dataset.f] = !state[f.dataset.f]; }
        else if (s) { state.sort = s.dataset.sort; }
        else if (e.target.closest('#f-reset')) { state.groups.clear(); state.onlyFav = state.onlyMine = state.hideEst = false; state.sort = 'auto'; }
        else if (e.target.closest('#f-done')) { closeSheet(); return; }
        else return;
        body.innerHTML = html();
        renderSearch();
      });
    };
    openSheet(html(), mount);
  }

  // ---------- Eigenes Lebensmittel ----------
  function openFoodForm(existing, presetName) {
    const it = existing || { name: presetName || '', cat: 'fertig', status: 'g', aliases: [], portion: '', limit: '', groups: [], note: '' };
    const html = `
      <h2>${existing ? 'Eintrag bearbeiten' : 'Eigenes Lebensmittel'}</h2>
      <p class="muted" style="margin:6px 0 14px">Wird nur auf diesem Gerät gespeichert.</p>
      <form id="food-form">
        <label class="field"><span>Name *</span><input type="text" name="name" required value="${esc(it.name)}" placeholder="z.B. Zweifel Paprika Chips"></label>
        <label class="field"><span>Kategorie</span><select name="cat">${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === it.cat ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></label>
        <div class="field"><span class="muted" style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Ampel</span>
          <div class="rate small" id="ff-status">${['g', 'y', 'r'].map((v) => `<button type="button" data-v="${v}" aria-pressed="${it.status === v}"><span class="dot"></span>${SHORT[v]}</button>`).join('')}</div>
        </div>
        <label class="field" style="margin-top:12px"><span>Verträgliche Portion</span><input type="text" name="portion" value="${esc(it.portion)}" placeholder="z.B. 1 Handvoll"></label>
        <label class="field"><span>Kritisch ab</span><input type="text" name="limit" value="${esc(it.limit)}" placeholder="z.B. ab ½ Beutel"></label>
        <label class="field"><span>Synonyme (mit Komma getrennt)</span><input type="text" name="aliases" value="${esc(it.aliases.join(', '))}"></label>
        <div class="field"><span class="muted" style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">FODMAP-Gruppen</span>
          <div class="opt-grid" id="ff-groups">${Object.entries(GROUPS).map(([k, g]) => `<button type="button" class="opt" data-g="${k}" aria-pressed="${it.groups.includes(k)}"><span class="box"></span>${esc(g.short)}</button>`).join('')}</div>
        </div>
        <label class="field" style="margin-top:12px"><span>Hinweis</span><textarea name="note" rows="2">${esc(it.note)}</textarea></label>
        <button type="submit" class="btn btn-primary btn-block">Speichern</button>
      </form>`;
    const mount = (body) => {
      let status = it.status;
      const groups = new Set(it.groups);
      $('#ff-status', body).addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        status = b.dataset.v;
        $$('#ff-status button', body).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      $('#ff-groups', body).addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const g = b.dataset.g;
        groups.has(g) ? groups.delete(g) : groups.add(g);
        b.setAttribute('aria-pressed', String(groups.has(g)));
      });
      $('#food-form', body).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const name = String(f.get('name') || '').trim();
        if (!name) return;
        const rec = {
          id: existing ? existing.id : 'eigen-' + slug(name) + '-' + Date.now().toString(36),
          name, cat: f.get('cat'), status, est: false,
          aliases: String(f.get('aliases') || '').split(',').map((s) => s.trim()).filter(Boolean),
          portion: String(f.get('portion') || '').trim(), limit: String(f.get('limit') || '').trim(),
          groups: Object.keys(GROUPS).filter((g) => groups.has(g)), note: String(f.get('note') || '').trim(),
        };
        if (existing) store.custom = store.custom.map((c) => (c.id === rec.id ? rec : c));
        else store.custom.push(rec);
        save(); buildIndex();
        toast(existing ? 'Gespeichert' : 'Eintrag hinzugefügt');
        sheetBody.innerHTML = detailHTML(BY_ID[rec.id]);
        mountDetail(sheetBody, BY_ID[rec.id]);
        onSheetClose = refreshCurrent;
      });
    };
    openSheet(html, mount, refreshCurrent);
  }

  // ---------- Meine Liste ----------
  let mineTab = 'favs';
  function renderMine() {
    const el = $('#mine-content');
    const favs = ALL.filter((i) => store.favs[i.id]);
    const rated = ALL.filter((i) => store.ratings[i.id]);
    const own = ALL.filter((i) => i.own);
    const lists = { favs, rated, own };
    const empties = {
      favs: '<div class="empty"><div class="big">⭐</div><p><strong>Noch keine Favoriten.</strong></p><p>Tippe in der Liste auf den Stern ☆ oder öffne ein Lebensmittel und tippe auf «Merken».</p></div>',
      rated: '<div class="empty"><div class="big">📝</div><p><strong>Noch nichts bewertet.</strong></p><p>Bewerte Lebensmittel nach deiner eigenen Erfahrung – deine Bewertung ersetzt dann die Ampel.</p></div>',
      own: '<div class="empty"><div class="big">➕</div><p><strong>Noch keine eigenen Einträge.</strong></p><p>Fehlt dir ein Produkt? Lege es selbst an.</p></div>',
    };
    el.innerHTML = `
      <div class="seg" id="mine-seg" style="grid-template-columns:repeat(3,1fr);margin:0 0 12px">
        ${[['favs', 'Favoriten'], ['rated', 'Bewertet'], ['own', 'Eigene']].map(([k, l]) => `<button type="button" data-tab="${k}" aria-selected="${mineTab === k}">${l}<span class="n">${lists[k].length}</span></button>`).join('')}
      </div>
      <div id="mine-list"></div>
      ${mineTab === 'own' ? '<button type="button" class="btn btn-primary btn-block" id="add-food" style="margin:12px 0 4px">+ Eigenes Lebensmittel anlegen</button>' : ''}

      <div class="section-title">Meine Verträglichkeit je FODMAP-Gruppe</div>
      <div class="card">
        <p class="muted" style="font-size:13px">Nach der Wiedereinführungsphase weisst du, welche Gruppen du verträgst. Die App markiert dann passende Lebensmittel für dich.</p>
        ${Object.entries(GROUPS).map(([k, g]) => `<div class="grow"><div class="gname">${esc(g.short)}<small>${esc(g.hint)}</small></div>
          <div class="tri" data-g="${k}">${[['', 'Unklar'], ['ok', 'Ok'], ['bad', 'Nicht']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${(store.groups[k] || '') === v}">${l}</button>`).join('')}</div></div>`).join('')}
      </div>

      <div class="section-title">Sicherung</div>
      <div class="card">
        <p class="muted" style="font-size:13px">Deine Daten liegen nur auf diesem Gerät. Erstelle ab und zu eine Sicherung, z.B. vor einem Handywechsel.</p>
        <div class="row gap">
          <button type="button" class="btn" id="exp">Sicherung exportieren</button>
          <button type="button" class="btn" id="imp">Sicherung importieren</button>
          <input type="file" id="imp-file" accept="application/json,.json" hidden>
        </div>
      </div>`;
    const rows = lists[mineTab].sort((a, b) => collator.compare(a.name, b.name)).map((it) => ({ it, via: null }));
    renderList($('#mine-list'), rows, empties[mineTab]);
  }

  $('#mine-content').addEventListener('click', (e) => {
    const tab = e.target.closest('#mine-seg [data-tab]');
    if (tab) { mineTab = tab.dataset.tab; renderMine(); return; }
    const tri = e.target.closest('.tri button');
    if (tri) {
      const g = tri.parentElement.dataset.g;
      if (tri.dataset.v) store.groups[g] = tri.dataset.v; else delete store.groups[g];
      save();
      $$('button', tri.parentElement).forEach((b) => b.setAttribute('aria-pressed', String(b === tri)));
      return;
    }
    if (e.target.closest('#add-food')) { openFoodForm(); return; }
    if (e.target.closest('#exp')) { exportData(); return; }
    if (e.target.closest('#imp')) { $('#imp-file').click(); return; }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      toggleFavFromList(favBtn);
      if (mineTab === 'favs') renderMine();
      return;
    }
    const item = e.target.closest('.item');
    if (item) openDetail(item.dataset.id);
  });
  $('#mine-content').addEventListener('change', (e) => {
    if (e.target.id === 'imp-file' && e.target.files[0]) importData(e.target.files[0]);
  });

  function exportData() {
    const data = JSON.stringify({ app: 'bauchgefuehl', version: 1, exported: new Date().toISOString(), ...store }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bauchgefuehl-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Sicherung erstellt');
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.app !== 'bauchgefuehl') throw new Error('falsches Format');
        if (!confirm('Sicherung importieren? Deine aktuellen persönlichen Daten werden ersetzt.')) return;
        for (const k of ['ratings', 'favs', 'notes', 'custom', 'groups', 'recent']) if (d[k]) store[k] = d[k];
        save(); buildIndex(); renderMine();
        toast('Sicherung importiert');
      } catch (e) { toast('Datei konnte nicht gelesen werden'); }
    };
    r.readAsText(file);
  }

  // ---------- Zutaten-Check ----------
  const NAME_INDEX = () => {
    const m = new Map();
    for (const it of ALL) {
      m.set(window.IngredientCheck.norm(it.name), it);
      for (const a of it.aliases) m.set(window.IngredientCheck.norm(a), it);
    }
    return m;
  };

  function runCheck() {
    const text = $('#ing-input').value;
    const idx = NAME_INDEX();
    const { items, total, verdict } = window.IngredientCheck.analyze(text, (n) => idx.get(n) || null);
    const out = $('#ing-result');
    if (!verdict) { out.innerHTML = '<div class="empty"><p>Keine Zutaten erkannt. Bitte Liste einfügen.</p></div>'; return; }
    out.innerHTML = `
      <div class="verdict s-${verdict.status}"><strong>${esc(verdict.title)}</strong><p>${esc(verdict.text)}</p></div>
      <div class="card"><div class="ing-list">
        ${items.map((i) => `<div class="ing ${i.status ? 's-' + i.status : ''} ${i.sub ? 'sub' : ''}">
          <span class="dot"></span>
          <span class="t"><b>${esc(i.text)}</b><small>${esc(i.reason)}${(() => { const gs = i.groups.map((g) => (GROUPS[g] ? GROUPS[g].short : g)).filter((g) => !i.reason.includes(g)); return gs.length ? ' · ' + gs.join(', ') : ''; })()}</small></span>
          <span class="pos">${i.sub ? 'in ' : ''}Nr. ${i.pos}</span>
        </div>`).join('')}
      </div></div>
      <p class="hint">Zutaten sind nach Menge sortiert (Nr. 1 = grösster Anteil). Weit hinten stehende Zutaten sind meist nur in kleinen Mengen enthalten – bei Zwiebel und Knoblauch reichen aber oft schon kleine Mengen. ${total} Hauptzutaten erkannt.</p>`;
  }

  $('#ing-check').addEventListener('click', () => { runCheck(); $('#ing-input').blur(); });
  $('#ing-example').addEventListener('click', () => {
    $('#ing-input').value = 'Zutaten: Kartoffeln, Sonnenblumenöl, Gewürzmischung (Zucker, Salz, Paprika, Zwiebelpulver, Knoblauchpulver, Hefeextrakt, Milchzucker), Molkenpulver (Milch), Glukose-Fruktose-Sirup, Säuerungsmittel: Citronensäure, Inulin. Kann Spuren von Senf enthalten.';
    runCheck();
  });
  $('#ing-paste').addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { $('#ing-input').value = t; runCheck(); } else toast('Zwischenablage ist leer');
    } catch (e) { toast('Einfügen nicht erlaubt – bitte lange ins Feld tippen'); }
  });

  // ---------- Info ----------
  function renderInfo() {
    const n = { g: 0, y: 0, r: 0 };
    BASE_ITEMS.forEach((i) => n[i.status]++);
    const est = BASE_ITEMS.filter((i) => i.est).length;
    $('#info-content').innerHTML = `
      <div class="card">
        <h2>Die Ampel</h2>
        <div class="legend">
          <div><span class="pill s-g">${SHORT.g}</span><span>In normaler Portion FODMAP-arm. Kann bedenkenlos gegessen werden.</span></div>
          <div><span class="pill s-y">${SHORT.y}</span><span>In der angegebenen Portion verträglich. Grössere Mengen oder mehrere solche Lebensmittel in einer Mahlzeit können Beschwerden auslösen.</span></div>
          <div><span class="pill s-r">${SHORT.r}</span><span>Schon in üblichen Mengen reich an FODMAPs. Höchstens in sehr kleinen Mengen.</span></div>
          <div><span class="pill me">Meine Bewertung</span><span>Deine eigene Einschätzung ersetzt in den Listen die allgemeine Ampel.</span></div>
        </div>
      </div>
      <div class="card">
        <h2>Die FODMAP-Gruppen</h2>
        <div class="d-groups">${Object.values(GROUPS).map((g) => `<div class="d-group"><span class="gtag">${esc(g.short)}</span><span>${esc(g.text)}</span></div>`).join('')}</div>
      </div>
      <div class="card">
        <h2>So funktioniert die FODMAP-Diät</h2>
        <ol class="steps">
          <li><b>Reduktion (2–6 Wochen):</b> Nur Lebensmittel mit grüner Ampel bzw. in den angegebenen Portionen.</li>
          <li><b>Wiedereinführung:</b> Eine FODMAP-Gruppe nach der anderen gezielt testen und Reaktionen notieren.</li>
          <li><b>Langzeit:</b> Nur noch die Gruppen meiden, die du wirklich nicht verträgst. Unter «Meine» kannst du sie festhalten.</li>
        </ol>
        <p class="hint">Portionen addieren sich: Mehrere «gelegentlich»-Lebensmittel in einer Mahlzeit können zusammen zu viel sein.</p>
      </div>
      <div class="card">
        <h2>Datenbank</h2>
        <div class="stat-row">
          <div class="stat"><b style="color:var(--g)">${n.g}</b><span>verträglich</span></div>
          <div class="stat"><b style="color:var(--y)">${n.y}</b><span>gelegentlich</span></div>
          <div class="stat"><b style="color:var(--r)">${n.r}</b><span>meiden</span></div>
        </div>
        <p style="margin-top:12px">Die Angaben basieren auf öffentlich verfügbaren Daten zu Labormessungen (v.a. Monash University) und Fachliteratur. ${est} Einträge – meist Markenprodukte und Gerichte – sind aus den typischen Zutaten abgeleitet und mit ⓘ markiert.</p>
        <p class="muted" style="font-size:13px">Die Werte sind Richtwerte und ersetzen keine Ernährungsberatung. Rezepturen ändern sich – bei Fertigprodukten das Etikett prüfen. Die verbindliche Referenz ist die kostenpflichtige Monash FODMAP App.</p>
      </div>
      <div class="card">
        <h2>Darstellung</h2>
        <div class="seg" id="theme-seg" style="grid-template-columns:repeat(3,1fr);margin-top:4px">
          ${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) => `<button type="button" data-theme="${v}" aria-selected="${store.theme === v}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="card">
        <h2>Als App installieren</h2>
        <p>Android (Chrome): Menü ⋮ → <b>«Zum Startbildschirm hinzufügen»</b> bzw. <b>«App installieren»</b>. Danach funktioniert Bauchgefühl auch ohne Internet.</p>
      </div>
      <p class="hint" style="text-align:center">Bauchgefühl ${VERSION}</p>`;
  }

  $('#info-content').addEventListener('click', (e) => {
    const b = e.target.closest('#theme-seg button');
    if (!b) return;
    store.theme = b.dataset.theme; save(); applyTheme(); renderInfo();
  });

  function applyTheme() {
    const r = document.documentElement;
    if (store.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = store.theme;
  }

  // ---------- Navigation ----------
  const ROUTES = { '#/suche': 'search', '#/meine': 'mine', '#/check': 'check', '#/info': 'info' };
  let currentView = null;

  function route() {
    const v = ROUTES[location.hash] || 'search';
    if (v !== currentView) {
      $$('.view').forEach((el) => { el.hidden = el.dataset.view !== v; });
      $$('.tabbar a').forEach((a) => { if (a.dataset.tab === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      window.scrollTo(0, 0);
      currentView = v;
    }
    if (v === 'search') renderSearch();
    if (v === 'mine') renderMine();
    if (v === 'info') renderInfo();
  }

  function refreshCurrent() {
    if (currentView === 'search') renderSearch();
    else if (currentView === 'mine') renderMine();
  }

  window.addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); else route(); });
  window.addEventListener('hashchange', () => { if (sheetOpen) closeSheet(true); route(); });

  // ---------- Events: Suche ----------
  let qTimer;
  elQ.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = elQ.value.trim(); renderSearch(); window.scrollTo(0, 0); }, 90);
  });
  elQ.addEventListener('keydown', (e) => { if (e.key === 'Enter') elQ.blur(); });
  $('#q-clear').addEventListener('click', () => { elQ.value = ''; state.q = ''; renderSearch(); elQ.focus(); });
  $('#status-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.status = b.dataset.status; renderSearch();
  });
  $('#cat-chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.cat = state.cat === b.dataset.cat ? null : b.dataset.cat;
    renderSearch();
    if (state.cat) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
  $('#btn-filter').addEventListener('click', openFilter);
  elContent.addEventListener('click', (e) => {
    const tile = e.target.closest('.cat-tile');
    if (tile) {
      state.cat = tile.dataset.cat; renderSearch(); window.scrollTo(0, 0);
      const chip = $(`#cat-chips [data-cat="${state.cat}"]`);
      if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest' });
      return;
    }
    if (e.target.closest('#reset-all')) {
      Object.assign(state, { q: '', status: 'all', cat: null, onlyFav: false, onlyMine: false, hideEst: false, sort: 'auto' });
      state.groups.clear(); elQ.value = ''; renderSearch(); return;
    }
    if (e.target.closest('#add-from-search')) { openFoodForm(null, state.q); return; }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) { toggleFavFromList(favBtn); return; }
    const it = e.target.closest('[data-id]');
    if (it) openDetail(it.dataset.id);
  });

  window.addEventListener('scroll', () => {
    const s = window.scrollY > 4;
    $$('.topbar').forEach((t) => t.classList.toggle('scrolled', s));
  }, { passive: true });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, action, onAction) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
    el.hidden = false;
    if (action) $('button', el).addEventListener('click', () => { el.hidden = true; onAction(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, action ? 10000 : 2200);
  }

  // ---------- Offline / Updates ----------
  // Lokal (Entwicklung) nur mit ?sw=1, damit Änderungen sofort sichtbar sind
  const isDev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1/.test(location.search);
  if (isDev && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw && nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Neue Version verfügbar', 'Aktualisieren', () => nw.postMessage('skipWaiting'));
            }
          });
        });
      }).catch(() => { /* offline-Funktion nicht verfügbar */ });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return; reloaded = true; location.reload();
      });
    });
  }

  // ---------- Start ----------
  applyTheme();
  buildIndex();
  elQ.value = ''; // vom Browser wiederhergestellte Eingaben verwerfen
  $('#count-total').textContent = `${BASE_ITEMS.length} Lebensmittel`;
  renderStatusSeg();
  renderCatChips();
  if (!location.hash) history.replaceState(null, '', '#/suche');
  route();
})();
