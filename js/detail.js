/*
 * Detail page: the panel that opens when you pick an item.
 *
 * The opening animation (see "Opening and closing" below):
 *   1. The menu tiles turnstile out, one after another.
 *   2. The panel swings in on a hinge from the right, with a little overshoot.
 *   3. An accent stripe wipes down its left edge and the content slides in piece by piece.
 * Closing plays it in reverse.
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
    var t = el("div", "ico");
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
      item.bullets.forEach(function (b) {
        if (b && b.url) {   // { text, url }: a bullet that links somewhere
          var li = el("li"), a = el("a", null, b.text);
          a.href = b.url; a.target = "_blank"; a.rel = "noopener";
          li.appendChild(a); ul.appendChild(li);
        } else {
          ul.appendChild(el("li", null, b));
        }
      });
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
        var a = el("a", "btn", l.label);
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

  // Gender flag, label and pronoun chips, e.g. [flag] Non-binary  They/Them  She/Her
  function identity(id) {
    var row = el("div", "identity");
    var who = el("span", "id-label");
    if (id.flag) {
      var flag = el("span", "flag flag-" + id.flag);
      flag.setAttribute("aria-hidden", "true");
      who.appendChild(flag);
    }
    if (id.label) who.appendChild(document.createTextNode(id.label));
    row.appendChild(who);
    (id.pronouns || []).forEach(function (p) { row.appendChild(el("span", "pronoun", p)); });
    return row;
  }

  function buildItem(cat, item) {
    var parts = [];
    var head = el("div", "d-head");
    if (item.photo) {   // a portrait instead of the category icon
      var ph = el("img", "d-photo");
      ph.src = item.photo; ph.alt = item.title;
      head.appendChild(ph);
    } else {
      head.appendChild(tile(item.icon || cat.icon));
    }
    var titles = el("div");
    titles.appendChild(el("h2", null, item.title));
    if (item.subtitle) titles.appendChild(el("p", null, item.subtitle));
    if (item.identity) titles.appendChild(identity(item.identity));
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
        if (item.identity) block.appendChild(identity(item.identity));
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
  //
  // Open:  the menu tiles "turnstile" out (each swings away on its left edge,
  //        one after another), then the panel swings in on a hinge from the
  //        right and an accent stripe wipes down its edge.
  // Close: the same thing backwards.

  var turnstiled = [];   // tile animations held in their "swung out" state

  function turnstileOut() {
    var faces = window.XMB ? window.XMB.faces() : [];
    turnstiled = faces.map(function (f, i) {
      return f.animate(
        [{ transform: "none", opacity: 1 }, { transform: "rotateY(-95deg) translateX(-20px)", opacity: 0 }],
        { duration: 260, delay: i * 35, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
      );
    });
    return faces.length ? 260 + (faces.length - 1) * 35 : 0;
  }

  function turnstileIn() {
    turnstiled.forEach(function (a) { a.cancel(); });
    turnstiled = [];
    var faces = window.XMB ? window.XMB.faces() : [];
    faces.forEach(function (f, i) {
      f.animate(
        [{ transform: "rotateY(-95deg) translateX(-20px)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 380, delay: i * 40, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }
      );
    });
  }

  function staggerIn(delay) {
    var kids = scroller.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].animate(
        [{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }],
        { duration: 380, delay: delay + i * 55, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }
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
    isOpen = true;

    if (wasOpen) {   // switching page while already open: just restagger the contents
      staggerIn(0);
      return;
    }

    busy = true;
    sound("open");
    document.body.classList.add("detail-open");
    panel.classList.remove("opened");

    if (reduced()) {
      detail.hidden = false;
      panel.classList.add("opened");
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }).onfinish = done;
      return;
    }

    var wait = Math.min(turnstileOut(), 320);
    setTimeout(function () {
      detail.hidden = false;
      sound("swoosh");
      panel.animate([
        { opacity: 0, transform: "translateX(140px) rotateY(70deg)" },
        { opacity: 1, offset: 0.4 },
        { opacity: 1, transform: "none" }
      ], { duration: 560, easing: "cubic-bezier(.25,1.25,.4,1)" }).onfinish = done;
      setTimeout(function () { panel.classList.add("opened"); }, 200);
      staggerIn(220);
    }, wait);

    function done() {
      busy = false;
      closeBtn.focus({ preventScroll: true });
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    busy = true;
    sound("close");
    closeLightbox();

    function done() {
      detail.hidden = true;
      busy = false;
      current = null;
      panel.classList.remove("opened");
      document.body.classList.remove("detail-open");
      if (!reduced()) turnstileIn(); else { turnstiled.forEach(function (a) { a.cancel(); }); turnstiled = []; }
    }

    if (reduced()) {
      panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" }).onfinish = function () {
        done(); panel.getAnimations().forEach(function (a) { a.cancel(); });
      };
      return;
    }

    sound("swoosh");
    var anim = panel.animate([
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "translateX(120px) rotateY(70deg)" }
    ], { duration: 340, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
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
