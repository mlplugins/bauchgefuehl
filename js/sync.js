/*
 * Synchronisierung der persönlichen Daten mit dem Konto auf dem Server.
 *
 * Die Daten werden in einzelne Einträge zerlegt («favs/<id>», «ratings/<id>», …).
 * Jede lokale Änderung bekommt einen Zeitstempel, gelöschte Einträge bleiben als
 * Grabstein (Wert null) erhalten. Beim Zusammenführen gewinnt pro Eintrag die
 * jüngere Änderung – so kommt z.B. ein auf dem Handy entfernter Favorit nicht
 * vom Computer zurück. «recent» und «theme» bleiben pro Gerät.
 */
(function () {
  'use strict';

  const META_KEY = 'bauchgefuehl.sync';
  const MAPS = ['favs', 'ratings', 'notes', 'groups'];
  const TOMBSTONE_TTL = 365 * 24 * 60 * 60 * 1000;

  function flatten(store) {
    const out = {};
    for (const k of MAPS) for (const [id, v] of Object.entries(store[k] || {})) out[`${k}/${id}`] = v;
    for (const c of store.custom || []) out[`custom/${c.id}`] = c;
    return out;
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Pro Eintrag gewinnt die jüngere Änderung; alte Grabsteine werden entfernt.
  function merge(a, b) {
    const out = {};
    const cutoff = Date.now() - TOMBSTONE_TTL;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key], y = b[key];
      const win = !x ? y : !y ? x : (y.t > x.t ? y : x);
      if (win.v === null && win.t < cutoff) continue;
      out[key] = win;
    }
    return out;
  }

  function create({ api, store, persist, onChange }) {
    let meta = load();
    let timer = null, running = null, again = false;
    const listeners = new Set();

    function load() {
      try { const m = JSON.parse(localStorage.getItem(META_KEY)); if (m && m.mod) return m; } catch (e) { /* leer */ }
      // Erster Start: bestehende Daten gelten als «alt», damit sie Änderungen anderer Geräte nicht überschreiben
      const snap = flatten(store), mod = {};
      for (const k of Object.keys(snap)) mod[k] = 1;
      return { token: null, email: null, rev: 0, lastSync: 0, mod, snap };
    }
    function saveMeta() {
      try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* voll oder privat */ }
    }
    function emit() { listeners.forEach((fn) => fn(status())); }

    function status() {
      return { loggedIn: !!meta.token, email: meta.email, lastSync: meta.lastSync, busy: !!running, error: meta.error || null };
    }

    // Nach jedem lokalen Speichern aufrufen: merkt sich, welche Einträge sich geändert haben
    function track() {
      const now = Date.now();
      const cur = flatten(store);
      let changed = false;
      for (const key of new Set([...Object.keys(cur), ...Object.keys(meta.snap)])) {
        if (!same(cur[key], meta.snap[key])) { meta.mod[key] = now; changed = true; }
      }
      if (!changed) return;
      meta.snap = cur;
      saveMeta();
      schedule(1500);
    }

    function localEntries() {
      const out = {};
      for (const [key, t] of Object.entries(meta.mod)) out[key] = { v: key in meta.snap ? meta.snap[key] : null, t };
      return out;
    }

    // Zusammengeführten Stand in die lokalen Daten übernehmen
    function apply(entries) {
      for (const k of MAPS) store[k] = {};
      const custom = [];
      for (const [key, e] of Object.entries(entries)) {
        if (e.v === null) continue;
        const i = key.indexOf('/'), kind = key.slice(0, i), id = key.slice(i + 1);
        if (kind === 'custom') custom.push(e.v);
        else if (MAPS.includes(kind)) store[kind][id] = e.v;
      }
      store.custom = custom;
      meta.mod = {};
      for (const [key, e] of Object.entries(entries)) meta.mod[key] = e.t;
      meta.snap = flatten(store);
      persist();
    }

    async function request(method, path, body) {
      let r;
      try {
        r = await fetch(api + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...(meta.token ? { Authorization: 'Bearer ' + meta.token } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        throw new Error('Server nicht erreichbar. Bitte später noch einmal probieren.');
      }
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 && meta.token) { signOutLocal(); throw Object.assign(new Error('Bitte erneut anmelden.'), { status: 401 }); }
      if (!r.ok && r.status !== 409) throw Object.assign(new Error(data.error || 'Server nicht erreichbar'), { status: r.status });
      return { status: r.status, data };
    }

    async function syncOnce() {
      let { data: remote } = await request('GET', '/data');
      for (let i = 0; i < 4; i++) {
        const remoteEntries = (remote.data && remote.data.entries) || {};
        const before = localEntries();
        const merged = merge(before, remoteEntries);
        if (!same(merged, before)) { apply(merged); onChange(); }
        if (same(merged, remoteEntries) && remote.rev > 0) { meta.rev = remote.rev; return; }
        const put = await request('PUT', '/data', { rev: remote.rev, data: { v: 1, entries: merged } });
        if (put.status !== 409) { meta.rev = put.data.rev; return; }
        remote = put.data; // ein anderes Gerät war schneller → nochmals zusammenführen
      }
      throw new Error('Synchronisierung fehlgeschlagen');
    }

    function syncNow() {
      if (!meta.token) return Promise.resolve();
      if (running) { again = true; return running; }
      clearTimeout(timer);
      running = (async () => {
        try {
          await syncOnce();
          meta.lastSync = Date.now();
          meta.error = null;
        } catch (e) {
          meta.error = navigator.onLine === false ? 'Offline – wird später nachgeholt' : e.message;
        } finally {
          saveMeta();
          running = null;
          emit();
          if (again) { again = false; schedule(500); }
        }
      })();
      emit();
      return running;
    }

    function schedule(ms) {
      if (!meta.token) return;
      clearTimeout(timer);
      timer = setTimeout(syncNow, ms);
    }

    async function signedIn(res) {
      meta.token = res.token;
      meta.email = res.email;
      meta.rev = 0;
      meta.error = null;
      saveMeta();
      await syncNow();
      return res;
    }

    function signOutLocal() {
      meta.token = null; meta.email = null; meta.rev = 0; meta.lastSync = 0; meta.error = null;
      saveMeta();
      emit();
    }

    const sync = {
      track,
      syncNow,
      status,
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      async startEmail(email) { await request('POST', '/auth/email/start', { email }); },
      async verifyCode(email, code) { return signedIn((await request('POST', '/auth/email/verify', { email, code })).data); },
      async verifyLink(link) { return signedIn((await request('POST', '/auth/email/verify', { link })).data); },
      async google(credential) { return signedIn((await request('POST', '/auth/google', { credential })).data); },
      async logout() {
        await syncNow();
        try { await request('POST', '/auth/logout'); } catch (e) { /* trotzdem lokal abmelden */ }
        signOutLocal();
      },
      async deleteAccount() {
        await request('DELETE', '/account');
        signOutLocal();
      },
    };

    // Beim Zurückkehren zur App, nach dem Wiederverbinden und regelmässig im Vordergrund abgleichen
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); });
    window.addEventListener('online', () => schedule(300));
    setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 5 * 60 * 1000);
    if (meta.token) schedule(300);

    return sync;
  }

  window.BauchSync = { create, merge, flatten };
})();
