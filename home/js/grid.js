/*
 * grid.js: the icon grid, edit mode, drag and drop, plus the clock, grain,
 * weather and sound that match Dreamliner.web.
 *
 * Normal mode: tap an icon to open its site.
 * Edit mode (the Edit button): drag icons to any cell, tap one to change it,
 * tap a + to add one, tap the red x to remove one.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var gridEl = $('grid'), homeEl = $('home'), hintEl = $('hint');
  var editBtn = $('edit'), muteBtn = $('mute');
  var editorEl = $('editor'), form = editorEl.querySelector('form');

  var items = Shortcuts.load();
  var editing = false, justDragged = false;
  var cols = 5, rows = 3, cell = 92, gap = 26, rowStep = 148;
  var pos = {};                                 // id -> { x, y } as shown on this screen

  // ---------- Layout -------------------------------------------------------

  function measure() {
    var w = window.innerWidth;
    cell = w < 480 ? 66 : w < 800 ? 80 : 92;
    gap = w < 480 ? 14 : w < 800 ? 20 : 26;
    cols = Math.max(3, Math.min(6, Math.floor((w - 32 + gap) / (cell + gap))));
    rowStep = cell + 30 + gap;
    gridEl.style.setProperty('--cols', cols);
    gridEl.style.setProperty('--cell', cell + 'px');
    gridEl.style.setProperty('--gap', gap + 'px');
  }

  // Where each icon is drawn. If the screen is narrower than where an icon was
  // placed, everything is packed in order instead, so nothing falls off the edge.
  function layout() {
    pos = {};
    var sorted = items.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var fits = sorted.every(function (it) { return it.x < cols; });
    sorted.forEach(function (it, i) {
      pos[it.id] = fits ? { x: it.x, y: it.y } : { x: i % cols, y: Math.floor(i / cols) };
    });
    var maxY = -1;
    sorted.forEach(function (it) { maxY = Math.max(maxY, pos[it.id].y); });
    rows = Math.max(3, maxY + 1) + (editing ? 1 : 0);
  }

  function commitPositions() {
    items.forEach(function (it) { it.x = pos[it.id].x; it.y = pos[it.id].y; });
    Shortcuts.save(items);
  }

  // ---------- Drawing ------------------------------------------------------

  function glyphFor(it) {
    var g = document.createElement('span');
    g.className = 'glyph' + (/^[\x00-\x7f]+$/.test(it.emoji) ? ' text' : '');
    g.textContent = it.emoji || it.name.charAt(0).toUpperCase();
    return g;
  }

  function makeTile(it) {
    var a = document.createElement('a');
    a.className = 'tile';
    a.href = it.url;
    a.dataset.id = it.id;
    a.draggable = false;
    a.style.gridColumn = pos[it.id].x + 1;
    a.style.gridRow = pos[it.id].y + 1;
    var face = document.createElement('span');
    face.className = 'face';
    face.style.setProperty('--c', it.color);
    if (it.emoji) {
      face.appendChild(glyphFor(it));
    } else {
      var img = document.createElement('img');
      img.alt = ''; img.draggable = false;
      img.src = Shortcuts.favicon(it.url);
      img.onerror = function () { img.remove(); face.appendChild(glyphFor(it)); };
      face.appendChild(img);
    }
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = it.name;
    var rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'remove'; rm.textContent = '×';
    rm.setAttribute('aria-label', 'Remove ' + it.name);
    rm.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    rm.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (window.confirm('Remove ' + it.name + '?')) removeItem(it.id);
    });
    a.appendChild(rm); a.appendChild(face); a.appendChild(label);
    a.addEventListener('click', function (e) {
      if (!editing) return;                       // normal mode: just follow the link
      e.preventDefault();
      if (justDragged) return;
      openEditor(it, null);
    });
    a.addEventListener('pointerdown', function (e) { if (editing) startDrag(e, a, it); });
    return a;
  }

  function render() {
    layout();
    gridEl.innerHTML = '';
    var occupied = {};
    items.forEach(function (it) { occupied[pos[it.id].x + ',' + pos[it.id].y] = true; });
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (occupied[x + ',' + y]) continue;
        var s = document.createElement('div');
        s.className = 'slot add';
        s.textContent = '+';
        s.style.gridColumn = x + 1; s.style.gridRow = y + 1;
        s.setAttribute('role', 'button');
        s.setAttribute('aria-label', 'Add a shortcut');
        (function (cx, cy) { s.addEventListener('click', function () { if (editing) openEditor(null, { x: cx, y: cy }); }); })(x, y);
        gridEl.appendChild(s);
      }
    }
    items.forEach(function (it) { gridEl.appendChild(makeTile(it)); });
    hintEl.hidden = !editing;
  }

  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    editBtn.textContent = on ? 'Done' : 'Edit';
    editBtn.setAttribute('aria-pressed', String(on));
    render();
  }
  editBtn.addEventListener('click', function () { setEditing(!editing); });

  function removeItem(id) {
    items = items.filter(function (it) { return it.id !== id; });
    Shortcuts.save(items);
    render();
  }

  // ---------- Drag and drop (mouse and touch) ---------------------------------

  var drag = null;

  function cellAt(e) {
    var r = gridEl.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(cols - 1, Math.floor((e.clientX - r.left) / (cell + gap)))),
      y: Math.max(0, Math.min(rows - 1, Math.floor((e.clientY - r.top) / rowStep)))
    };
  }

  function startDrag(e, el, it) {
    if (e.button > 0) return;
    drag = { el: el, it: it, sx: e.clientX, sy: e.clientY, active: false, id: e.pointerId, mark: null, cell: null };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 8) return;
      drag.active = true;
      var r = drag.el.getBoundingClientRect();
      drag.dx = drag.sx - r.left; drag.dy = drag.sy - r.top;
      drag.el.style.width = r.width + 'px';
      drag.el.classList.add('dragging');
      drag.mark = document.createElement('div');
      drag.mark.className = 'mark';
      gridEl.appendChild(drag.mark);
    }
    drag.el.style.left = (e.clientX - drag.dx) + 'px';
    drag.el.style.top = (e.clientY - drag.dy) + 'px';
    drag.cell = cellAt(e);
    drag.mark.style.gridColumn = drag.cell.x + 1;
    drag.mark.style.gridRow = drag.cell.y + 1;
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    d.el.removeEventListener('pointermove', onMove);
    d.el.removeEventListener('pointerup', onUp);
    d.el.removeEventListener('pointercancel', onUp);
    if (!d.active) return;                          // it was a tap: the click handler opens the editor
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
    if (e.type === 'pointerup' && d.cell) {
      var from = pos[d.it.id];
      var other = items.filter(function (o) { return o !== d.it && pos[o.id].x === d.cell.x && pos[o.id].y === d.cell.y; })[0];
      if (other) pos[other.id] = { x: from.x, y: from.y };   // dropped on an icon: swap places
      pos[d.it.id] = { x: d.cell.x, y: d.cell.y };
      commitPositions();
    }
    render();
  }

  // ---------- Add / edit dialog -------------------------------------------------

  var editTarget = null, editCell = null, chosenColor = Shortcuts.COLORS[0];
  var swatchBox = $('swatches');

  function paintSwatches() {
    swatchBox.innerHTML = '';
    Shortcuts.COLORS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.style.setProperty('--c', c);
      b.setAttribute('aria-label', 'Colour ' + c);
      b.setAttribute('aria-pressed', String(c === chosenColor));
      b.addEventListener('click', function () { chosenColor = c; paintSwatches(); });
      swatchBox.appendChild(b);
    });
  }

  function openEditor(it, at) {
    editTarget = it; editCell = at;
    $('editor-title').textContent = it ? 'Edit shortcut' : 'New shortcut';
    form.name.value = it ? it.name : '';
    form.url.value = it ? it.url : '';
    form.emoji.value = it ? it.emoji : '';
    form.url.setCustomValidity('');
    chosenColor = it ? it.color : Shortcuts.COLORS[Math.floor(Math.random() * Shortcuts.COLORS.length)];
    $('editor-delete').hidden = !it;
    paintSwatches();
    editorEl.hidden = false;
    form.name.focus();
  }
  function closeEditor() { editorEl.hidden = true; }

  form.url.addEventListener('input', function () { form.url.setCustomValidity(''); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = Shortcuts.normalizeUrl(form.url.value);
    if (!url) { form.url.setCustomValidity('Enter a web address, like example.com'); form.url.reportValidity(); return; }
    var name = form.name.value.trim() || new URL(url).hostname;
    if (editTarget) {
      editTarget.name = name; editTarget.url = url; editTarget.color = chosenColor; editTarget.emoji = form.emoji.value.trim();
    } else {
      items.push({ id: Shortcuts.uid(), name: name, url: url, color: chosenColor, emoji: form.emoji.value.trim(), x: editCell.x, y: editCell.y });
    }
    Shortcuts.save(items);
    closeEditor();
    render();
  });
  $('editor-cancel').addEventListener('click', closeEditor);
  $('editor-delete').addEventListener('click', function () {
    if (editTarget && window.confirm('Remove ' + editTarget.name + '?')) { closeEditor(); removeItem(editTarget.id); }
  });
  editorEl.addEventListener('mousedown', function (e) { if (e.target === editorEl) closeEditor(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!editorEl.hidden) closeEditor(); else if (editing) setEditing(false); }
  });

  // ---------- Clock, grain, sound, background -------------------------------------

  function tickClock() {
    var now = new Date();
    document.querySelector('.clock-time').textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    document.querySelector('.clock-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function makeGrain() {
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 160;
      var g = c.getContext('2d');
      var img = g.createImageData(160, 160);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      $('grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
    } catch (e) { /* no grain */ }
  }

  function syncMute() {
    var silent = !Sound.isMusicOn() && !Sound.isRainOn();
    muteBtn.classList.toggle('off', silent);
    muteBtn.setAttribute('aria-pressed', String(silent));
  }
  muteBtn.addEventListener('click', function () {
    var on = !Sound.isMusicOn() && !Sound.isRainOn();
    Sound.unlock();
    Sound.setMusic(on);
    Sound.setRain(on);
    syncMute();
  });

  // Rain/snow switch: lasts until the season changes (see js/rain.js).
  var weatherBtn = $('weather');
  function syncWeather() {
    var w = window.RainFX ? RainFX.weather() : 'rain';
    weatherBtn.textContent = w === 'snow' ? '\u2744' : '\u2602';
    weatherBtn.setAttribute('aria-label', 'Weather: ' + w + '. Switch to ' + (w === 'snow' ? 'rain' : 'snow'));
  }
  weatherBtn.addEventListener('click', function () {
    if (window.RainFX) RainFX.setWeather(RainFX.weather() === 'snow' ? 'rain' : 'snow');
    syncWeather();
  });
  syncWeather();

  // Browsers only allow sound after a click or key press, so the first one starts it.
  function unlockSound() {
    document.removeEventListener('pointerdown', unlockSound, true);
    document.removeEventListener('keydown', unlockSound, true);
    if (window.Sound) Sound.unlock().then(syncMute);
  }
  document.addEventListener('pointerdown', unlockSound, true);
  document.addEventListener('keydown', unlockSound, true);

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('reduce-motion', reduced);

  makeGrain();
  if (window.Scene) {
    Scene.setReducedMotion(reduced);
    Scene.init($('bg'));
  }
  if (window.RainFX) RainFX.setReducedMotion(reduced);
  if (window.Sound) syncMute();
  tickClock();
  setInterval(tickClock, 1000);

  measure();
  render();
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measure(); render(); }, 120);
  });
})();
