/*
 * Detail page: the glass panel that opens when you pick an item.
 *
 * The opening animation:
 *   1. The menu behind blurs and shrinks back (CSS: body.detail-open).
 *   2. A copy of the item's icon flies from the menu to the panel header.
 *   3. The panel "unfolds" from that spot: scale + 3D tilt + blur-to-sharp, with a little overshoot.
 *   4. A light sweeps across the glass, then the content fades in one piece at a time.
 * Closing plays it in reverse, back toward the item in the menu.
 *
 * Pages are linked with the URL hash, e.g.  #/projects/project-1  or  #/plain
 * so the browser Back button and shared links both work.
 */

(function () {
  var detail = document.getElementById("detail");
  var panel = detail.querySelector(".panel");
  var scroller = detail.querySelector(".panel-scroll");
  var closeBtn = detail.querySelector(".close");
  var lightbox = document.getElementById("lightbox");

  var isOpen = false;
  var busy = false;           // true while an open/close animation is running
  var current = null;         // { cat, item } currently shown
  var pushedHistory = false;  // did we add a history entry when opening?
  var lbImages = [], lbIndex = 0;

  function reduced() { return document.documentElement.classList.contains("reduce-motion"); }
  function sound(name) { if (window.Sound) window.Sound.play(name); }

  // ---------- Building the page content ----------------------------------

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function tile(iconSrc) {
    var t = el("div", "tile");
    var img = el("img");
    img.src = iconSrc; img.alt = "";
    t.appendChild(img);
    return t;
  }

  // Everything below the header, shared by the item page and the plain page
  function itemBody(item, parts) {
    (item.body || []).forEach(function (p) { parts.push(el("p", null, p)); });

    if (item.bullets && item.bullets.length) {
      var ul = el("ul", "bullets");
      item.bullets.forEach(function (b) { ul.appendChild(el("li", null, b)); });
      parts.push(ul);
    }
    if (item.tags && item.tags.length) {
      var tags = el("ul", "tags");
      item.tags.forEach(function (t) { tags.appendChild(el("li", null, t)); });
      parts.push(tags);
    }
    if (item.images && item.images.length) parts.push(gallery(item.images));
    if (item.links && item.links.length) {
      var links = el("div", "links");
      item.links.forEach(function (l) {
        var a = el("a", "gel", l.label);
        a.href = l.url;
        if (/^https?:/.test(l.url)) { a.target = "_blank"; a.rel = "noopener"; }
        links.appendChild(a);
      });
      parts.push(links);
    }
  }

  function gallery(images) {
    var wrap = el("div", "gallery");
    var main = el("figure", "main");
    var mainImg = el("img");
    var cap = el("figcaption");
    main.appendChild(mainImg); main.appendChild(cap);
    wrap.appendChild(main);

    var index = 0;
    var thumbs = el("div", "thumbs");
    function show(i) {
      index = i;
      mainImg.src = images[i].src;
      mainImg.alt = images[i].caption || "";
      cap.textContent = images[i].caption || "";
      Array.prototype.forEach.call(thumbs.children, function (b, j) { b.classList.toggle("sel", j === i); });
    }
    if (images.length > 1) {
      images.forEach(function (im, i) {
        var b = el("button");
        b.type = "button";
        b.setAttribute("aria-label", "Show image " + (i + 1));
        var t = el("img"); t.src = im.src; t.alt = "";
        b.appendChild(t);
        b.addEventListener("click", function () { show(i); sound("move"); });
        thumbs.appendChild(b);
      });
      wrap.appendChild(thumbs);
    }
    main.addEventListener("click", function () { openLightbox(images, index); });
    show(0);
    return wrap;
  }

  function buildItem(cat, item) {
    var parts = [];
    var head = el("div", "d-head");
    head.appendChild(tile(item.icon || cat.icon));
    var titles = el("div");
    titles.appendChild(el("h2", null, item.title));
    if (item.subtitle) titles.appendChild(el("p", null, item.subtitle));
    head.appendChild(titles);
    parts.push(head);
    itemBody(item, parts);
    return parts;
  }

  // One long page with every category: the "plain résumé"
  function buildPlain() {
    var site = window.SITE;
    var parts = [];
    var head = el("div", "d-head");
    var titles = el("div");
    titles.appendChild(el("h2", null, site.name));
    if (site.tagline) titles.appendChild(el("p", null, site.tagline));
    head.appendChild(titles);
    parts.push(head);

    site.categories.forEach(function (cat) {
      var sec = el("section", "plain-section");
      sec.appendChild(el("h3", null, cat.label));
      cat.items.forEach(function (item) {
        if (cat.id === "about" && item.id === "resume") return;   // skip the link to this page
        var block = el("div", "plain-item");
        block.appendChild(el("h4", null, item.title));
        if (item.subtitle) block.appendChild(el("div", "sub", item.subtitle));
        var inner = [];
        itemBody(item, inner);
        inner.forEach(function (n) { block.appendChild(n); });
        sec.appendChild(block);
      });
      parts.push(sec);
    });
    return parts;
  }

  // ---------- Opening and closing ----------------------------------------

  // Where on screen the animation should start from / return to
  function originRect() {
    var src = window.XMB && current && current.cat && window.XMB.tileFor(current.cat.id, current.item && current.item.id);
    if (src) return src.getBoundingClientRect();
    var w = window.innerWidth, h = window.innerHeight;
    return { left: w / 2 - 30, top: h / 2 - 30, width: 60, height: 60 };
  }

  function setOrigin(r) {
    var p = panel.getBoundingClientRect();
    var ox = r.left + r.width / 2 - p.left;
    var oy = r.top + r.height / 2 - p.top;
    panel.style.transformOrigin = ox + "px " + oy + "px";
  }

  // A floating copy of the icon that flies between the menu and the panel header
  function flyIcon(fromRect, toEl, reverse, duration) {
    var srcImg = toEl && toEl.querySelector("img");
    if (!srcImg || !fromRect.width) return;
    var to = toEl.getBoundingClientRect();
    var ghost = document.createElement("img");
    ghost.src = srcImg.src;
    ghost.style.cssText = "position:fixed;z-index:35;pointer-events:none;left:0;top:0;" +
      "width:" + to.width * 0.58 + "px;height:" + to.height * 0.58 + "px;" +
      "filter:drop-shadow(0 0 12px var(--glow))";
    document.body.appendChild(ghost);

    var size = to.width * 0.58;
    var a = { x: fromRect.left + fromRect.width / 2 - size / 2, y: fromRect.top + fromRect.height / 2 - size / 2, s: fromRect.width / to.width };
    var b = { x: to.left + to.width / 2 - size / 2, y: to.top + to.height / 2 - size / 2, s: 1 };
    var mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 60, s: 1.6 };   // arc upward, grow, then settle
    var frames = [a, mid, b].map(function (f) { return { transform: "translate(" + f.x + "px," + f.y + "px) scale(" + f.s + ")" }; });
    frames[0].opacity = 1; frames[2].opacity = 1; frames[1].opacity = 1;
    if (reverse) frames.reverse();

    var anim = ghost.animate(frames, { duration: duration, easing: "cubic-bezier(.4,0,.2,1)" });
    toEl.style.visibility = "hidden";
    anim.onfinish = function () { ghost.remove(); toEl.style.visibility = ""; };
  }

  function staggerIn() {
    var kids = scroller.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].animate(
        [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
        { duration: 450, delay: 180 + i * 70, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }
      );
    }
  }

  function render(target) {
    scroller.innerHTML = "";
    var parts = target === "plain" ? buildPlain() : buildItem(target.cat, target.item);
    parts.forEach(function (n) { scroller.appendChild(n); });
    scroller.scrollTop = 0;
  }

  function open(target) {
    var wasOpen = isOpen;
    current = target === "plain" ? null : target;
    render(target);
    detail.hidden = false;
    isOpen = true;
    document.body.classList.add("detail-open");

    if (wasOpen) {   // switching page while already open: just crossfade the contents
      staggerIn();
      return;
    }

    busy = true;
    sound("open");
    sound("swoosh");
    var r = originRect();

    if (reduced()) {
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).onfinish = done;
      return;
    }

    setOrigin(r);
    panel.animate([
      { opacity: 0, transform: "rotateX(22deg) rotateY(-14deg) scale(.18)", filter: "blur(14px)" },
      { opacity: 1, offset: 0.55, filter: "blur(2px)" },
      { opacity: 1, transform: "none", filter: "blur(0)" }
    ], { duration: 720, easing: "cubic-bezier(.2,.9,.25,1.12)" }).onfinish = done;

    flyIcon(r, scroller.querySelector(".d-head .tile"), false, 720);
    staggerIn();

    function done() {
      busy = false;
      panel.classList.remove("sheen");
      void panel.offsetWidth;   // restart the CSS animation
      panel.classList.add("sheen");
      closeBtn.focus({ preventScroll: true });
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    busy = true;
    sound("close");
    closeLightbox();
    document.body.classList.remove("detail-open");

    function done() {
      detail.hidden = true;
      busy = false;
      panel.classList.remove("sheen");
      current = null;
    }

    if (reduced()) {
      panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" }).onfinish = function () {
        done(); panel.getAnimations().forEach(function (a) { a.cancel(); });
      };
      return;
    }

    var r = originRect();
    setOrigin(r);
    flyIcon(r, scroller.querySelector(".d-head .tile"), true, 480);
    var anim = panel.animate([
      { opacity: 1, transform: "none", filter: "blur(0)" },
      { opacity: 0, transform: "rotateX(-10deg) rotateY(12deg) scale(.15)", filter: "blur(12px)" }
    ], { duration: 480, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
    anim.onfinish = function () { done(); anim.cancel(); };
  }

  // ---------- Hash routing -------------------------------------------------

  function findTarget(hash) {
    var m = /^#\/([^/]+)(?:\/([^/]+))?/.exec(hash);
    if (!m) return null;
    if (m[1] === "plain") return "plain";
    var cat = window.SITE.categories.find(function (c) { return c.id === m[1]; });
    if (!cat) return null;
    var item = cat.items.find(function (i) { return i.id === m[2]; }) || cat.items[0];
    return item ? { cat: cat, item: item } : null;
  }

  function route() {
    var target = findTarget(location.hash);
    if (target) {
      if (target !== "plain" && window.XMB) window.XMB.select(target.cat.id, target.item.id);
      open(target);
    } else {
      close();
    }
  }

  window.addEventListener("hashchange", route);

  // ---------- Lightbox ----------------------------------------------------

  function openLightbox(images, i) {
    lbImages = images; lbIndex = i;
    lightbox.hidden = false;
    lightbox.querySelector(".lb-prev").hidden = lightbox.querySelector(".lb-next").hidden = images.length < 2;
    showLb();
    sound("open");
  }
  function showLb() {
    var im = lbImages[lbIndex];
    lightbox.querySelector("img").src = im.src;
    lightbox.querySelector("img").alt = im.caption || "";
    lightbox.querySelector("figcaption").textContent = im.caption || "";
  }
  function stepLb(d) { lbIndex = (lbIndex + d + lbImages.length) % lbImages.length; showLb(); sound("move"); }
  function closeLightbox() { lightbox.hidden = true; }

  lightbox.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); stepLb(-1); });
  lightbox.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); stepLb(1); });
  lightbox.addEventListener("click", closeLightbox);

  // ---------- Controls ----------------------------------------------------

  closeBtn.addEventListener("click", function () { Detail.back(); });
  detail.addEventListener("click", function (e) { if (e.target === detail) Detail.back(); });   // click outside the panel

  document.addEventListener("keydown", function (e) {
    if (!lightbox.hidden) {
      if (e.key === "Escape" || e.key === "Backspace") { closeLightbox(); e.preventDefault(); }
      else if (e.key === "ArrowLeft") stepLb(-1);
      else if (e.key === "ArrowRight") stepLb(1);
      e.stopImmediatePropagation();
      return;
    }
    if (isOpen && (e.key === "Escape" || e.key === "Backspace")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      Detail.back();
    }
  }, true);   // capture phase: runs before the menu's key handler

  // ---------- Public API (used by xmb.js) ----------------------------------

  window.Detail = {
    // Open an item by changing the URL; route() then does the animation
    show: function (catId, itemId) {
      if (busy) return;
      pushedHistory = true;
      location.hash = "#/" + catId + "/" + itemId;
    },
    back: function () {
      if (busy && isOpen) return;
      if (pushedHistory) {
        pushedHistory = false;
        history.back();             // the hashchange that follows closes the panel
      } else {
        // Opened from a shared link: there's no earlier page to go back to, so clear the hash
        history.replaceState(null, "", location.pathname + location.search);
        route();
      }
    },
    isOpen: function () { return isOpen; },
    route: route
  };
})();
