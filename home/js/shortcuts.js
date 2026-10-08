/*
 * shortcuts.js: the list of home page shortcuts, saved in this browser.
 *
 * window.Shortcuts
 *   Shortcuts.load()            -> [{ id, name, url, color, emoji, x, y }]  (x = column, y = row)
 *   Shortcuts.save(items)
 *   Shortcuts.normalizeUrl(s)   -> a safe http(s) address, or null
 *   Shortcuts.favicon(url)      -> address of the site's icon
 *   Shortcuts.COLORS            colour choices for an icon
 */
(function () {
  'use strict';

  var KEY = 'home.shortcuts';
  var COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#64748b', '#f97316', '#111827'];

  var DEFAULTS = [
    { name: 'Google', url: 'https://www.google.com', color: COLORS[0] },
    { name: 'YouTube', url: 'https://www.youtube.com', color: COLORS[1] },
    { name: 'GitHub', url: 'https://github.com', color: COLORS[9] },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', color: COLORS[7] },
    { name: 'Maps', url: 'https://maps.google.com', color: COLORS[3] }
  ];

  function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function normalizeUrl(s) {
    s = String(s || '').trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    try {
      var u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;   // no javascript:, data:, etc.
      if (!u.hostname) return null;
      return u.href;
    } catch (e) { return null; }
  }

  function favicon(url) {
    try { return 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(new URL(url).hostname); }
    catch (e) { return ''; }
  }

  function clean(list) {
    var out = [];
    if (!Array.isArray(list)) return null;
    list.forEach(function (it) {
      var url = it && normalizeUrl(it.url);
      if (!url) return;
      out.push({
        id: String(it.id || uid()),
        name: String(it.name || '').slice(0, 24) || new URL(url).hostname,
        url: url,
        color: /^#[0-9a-f]{6}$/i.test(it.color) ? it.color : COLORS[0],
        emoji: String(it.emoji || '').slice(0, 4),
        x: Math.max(0, parseInt(it.x, 10) || 0),
        y: Math.max(0, parseInt(it.y, 10) || 0)
      });
    });
    return out;
  }

  function load() {
    var list = null;
    try { list = clean(JSON.parse(window.localStorage.getItem(KEY))); } catch (e) { list = null; }
    if (list) return list;
    return clean(DEFAULTS.map(function (d, i) { d.x = i; d.y = 0; return d; }));
  }

  function save(items) {
    try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* private mode: changes last until reload */ }
  }

  window.Shortcuts = { load: load, save: save, normalizeUrl: normalizeUrl, favicon: favicon, uid: uid, COLORS: COLORS };
})();
