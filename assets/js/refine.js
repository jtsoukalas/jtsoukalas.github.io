/*
  Refinements: the news timeline and the career map at the top of the CV.
  Both are drawn from the page's own entries, so they stay right whenever
  a news item or CV row is added or edited.

  News is laid out as a changelog (data-news="log" on <html>); the CV map
  is one lane of bars per category, with a tooltip on each entry.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var NS = "http://www.w3.org/2000/svg";
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var today = new Date();
  var NOW = today.getFullYear() + today.getMonth() / 12 + 0.5 / 12;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // "May 2026", "2020" -> fractional year; isEnd pushes a bare year to its end
  function point(text, isEnd) {
    text = text.trim().toLowerCase();
    if (text === "now") return NOW;
    var m = text.match(/^([a-z]{3})\w*\s+(\d{4})$/);
    if (m) return +m[2] + (MONTHS[m[1]] + (isEnd ? 1 : 0)) / 12;
    var y = text.match(/^(\d{4})$/);
    if (y) return +y[1] + (isEnd ? 1 : 0);
    return null;
  }

  function span(when) {
    var parts = when.split(/\s+[–-]\s+/);
    var start = point(parts[0], false);
    var end = parts.length > 1 ? point(parts[1], true) : point(parts[0], true);
    if (start === null || end === null) return null;
    return { start: start, end: end, open: /now/i.test(parts[1] || "") };
  }

  function duration(a, b) {
    var months = Math.max(1, Math.round((b - a) * 12));
    var y = Math.floor(months / 12), m = months % 12;
    var out = [];
    if (y) out.push(y + (y === 1 ? " yr" : " yrs"));
    if (m) out.push(m + (m === 1 ? " mo" : " mos"));
    return out.join(" ");
  }

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function scrollToRow(row) {
    row.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
  }

  /* ================================================================ */
  /* News                                                              */
  /* ================================================================ */

  var newsList = document.querySelector(".rows--news");
  var newsCards = newsList ? Array.prototype.slice.call(newsList.querySelectorAll(".news-card")) : [];

  if (newsList && newsCards.length) {
    // Year on the first entry of each year (used by the changelog layout)
    var lastYear = null;
    newsCards.forEach(function (card) {
      var when = card.querySelector(".row__when");
      var t = point(when.textContent, false);
      card._t = t;
      var year = Math.floor(t);
      if (year !== lastYear) card.setAttribute("data-year", year);
      lastYear = year;
    });

    // ---- Changelog: show this year's updates, the rest behind a button ----
    // (at least the latest three, so the list is never empty early in a year)
    var thisYear = new Date().getFullYear();
    var KEEP = Math.max(3, newsCards.filter(function (c) { return c._t >= thisYear; }).length);
    var more = document.createElement("button");
    more.type = "button";
    more.className = "news-more";
    var hidden = newsCards.length - KEEP;
    var setMore = function (open) {
      newsList.classList.toggle("is-open", open);
      more.setAttribute("aria-expanded", open ? "true" : "false");
      more.textContent = open ? "Show fewer updates" : "Show earlier updates";
    };
    more.addEventListener("click", function () { setMore(!newsList.classList.contains("is-open")); });
    if (hidden > 0) {
      newsCards.slice(KEEP).forEach(function (c) { c.classList.add("is-older"); });
      newsCards[KEEP - 1].classList.add("is-cut"); // the timeline line ends here while closed
      newsList.parentNode.insertBefore(more, newsList.nextSibling);
      setMore(false);
    }

  }

  /* ================================================================ */
  /* Career map                                                        */
  /* ================================================================ */

  var cv = document.querySelector("#cv .section__body");
  if (!cv) return;

  // One lane per CV heading that is followed by a list of dated rows
  var lanes = [];
  var all = [];
  cv.querySelectorAll(".cv-head").forEach(function (head) {
    var list = head.nextElementSibling;
    while (list && !list.matches("ol.rows, .cv-head")) list = list.nextElementSibling;
    if (!list || !list.matches("ol.rows")) return;
    var name = head.textContent.trim();
    if (name.indexOf(":") !== -1) name = name.split(":").pop().trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    var lane = { name: name, tint: head.style.getPropertyValue("--tint"), items: [] };
    list.querySelectorAll(":scope > .row").forEach(function (row) {
      var when = row.querySelector(".row__when");
      var title = row.querySelector("h3");
      var where = row.querySelector(".where");
      var s = when && span(when.textContent);
      if (!s) return;
      var item = {
        lane: lane, row: row,
        title: title ? title.textContent.trim() : "",
        where: where ? where.textContent.trim() : "",
        when: when.textContent.replace(/\s+/g, " ").trim(),
        start: s.start, end: s.end, open: s.open
      };
      lane.items.push(item);
      all.push(item);
      row.addEventListener("mouseenter", function () { if (item.node) item.node.classList.add("is-hot"); });
      row.addEventListener("mouseleave", function () { if (item.node) item.node.classList.remove("is-hot"); });
    });
    if (lane.items.length) lanes.push(lane);
  });
  if (!lanes.length) return;

  var min = Math.floor(Math.min.apply(null, all.map(function (i) { return i.start; })));
  var max = Math.ceil(NOW);

  var figure = document.createElement("figure");
  figure.className = "career";
  var scroller = document.createElement("div");
  scroller.className = "career__scroll";
  figure.appendChild(scroller);

  var key = document.createElement("figcaption");
  key.className = "career__key";
  figure.appendChild(key);

  var tip = document.createElement("div");
  tip.className = "career__tip";
  tip.setAttribute("role", "status");
  tip.hidden = true;
  figure.appendChild(tip);

  cv.insertBefore(figure, cv.firstElementChild);

  var active = null;   // the map entry whose tooltip is showing
  var pointer = "mouse";

  function showTip(item, anchor, clientX) {
    tip.innerHTML = "";
    var cat = document.createElement("span");
    cat.className = "career__tip-cat";
    cat.style.setProperty("--tint", item.lane.tint);
    cat.textContent = item.lane.name;
    var h = document.createElement("strong");
    h.textContent = item.title;
    var w = document.createElement("span");
    w.className = "career__tip-where";
    w.textContent = item.where;
    var d = document.createElement("span");
    d.className = "career__tip-when";
    d.textContent = item.when + " · " + duration(item.start, Math.min(item.end, NOW));
    tip.appendChild(cat);
    tip.appendChild(h);
    if (item.where) tip.appendChild(w);
    tip.appendChild(d);
    if (pointer === "touch") {
      var hint = document.createElement("span");
      hint.className = "career__tip-hint";
      hint.textContent = "Tap again to open it in the CV";
      tip.appendChild(hint);
    }
    tip.hidden = false;
    active = item;
    placeTip(anchor, clientX);
  }

  // Above the entry, centred on the pointer (or on the entry for keyboard
  // and touch); below it only when there is no room above in the window.
  function placeTip(anchor, clientX) {
    var fr = figure.getBoundingClientRect();
    var ar = anchor.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var cx = clientX != null ? clientX : ar.left + Math.min(ar.width, 160) / 2;
    var x = cx - fr.left - tw / 2;
    x = Math.max(8, Math.min(fr.width - tw - 8, x));
    var y = ar.top - fr.top - th - 10;
    if (ar.top - th - 10 < 70) y = ar.bottom - fr.top + 10;
    tip.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  function hideTip() {
    tip.hidden = true;
    if (active && active.node) active.node.classList.remove("is-hot");
    if (active) active.row.classList.remove("is-hot");
    active = null;
  }

  function wire(node, item) {
    item.node = node;
    var anchor = node._anchor || node;
    var on = function (clientX) {
      if (active && active !== item) hideTip();
      node.classList.add("is-hot");
      item.row.classList.add("is-hot");
      showTip(item, anchor, clientX);
    };
    var open = function () { hideTip(); scrollToRow(item.row); };
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", item.title + ", " + item.when + ". Show in CV");
    node.addEventListener("pointerdown", function (e) { pointer = e.pointerType || "mouse"; });
    node.addEventListener("mouseenter", function (e) { if (pointer !== "touch") on(e.clientX); });
    node.addEventListener("mousemove", function (e) { if (active === item && pointer !== "touch") placeTip(anchor, e.clientX); });
    node.addEventListener("mouseleave", function () { if (pointer !== "touch" && active === item) hideTip(); });
    node.addEventListener("focus", function () { if (pointer !== "touch") on(null); });
    node.addEventListener("blur", function () { if (active === item) hideTip(); });
    node.addEventListener("click", function (e) {
      // On touch the first tap shows the details, the second opens the entry
      if (pointer === "touch" && active !== item) { e.preventDefault(); on(null); return; }
      open();
    });
    node.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      if (e.key === "Escape") hideTip();
    });
  }

  // A tap outside the map, or scrolling it sideways, closes the tooltip
  document.addEventListener("pointerdown", function (e) {
    pointer = e.pointerType || "mouse";
    if (active && !scroller.contains(e.target)) hideTip();
  });
  scroller.addEventListener("scroll", function () { if (active) hideTip(); }, { passive: true });


  function axisAndGrid(svg, x, top, bottom) {
    for (var yr = min; yr <= max; yr++) {
      el("line", { class: "c-grid", x1: x(yr), x2: x(yr), y1: top, y2: bottom }, svg);
      if (yr < max) {
        var t = el("text", { class: "c-year", x: x(yr + 0.5), y: bottom + 18, "text-anchor": "middle" }, svg);
        t.textContent = yr;
      }
    }
    el("line", { class: "c-now", x1: x(NOW), x2: x(NOW), y1: top - 4, y2: bottom + 4 }, svg);
    var now = el("text", { class: "c-nowlabel", x: x(NOW) + 5, y: bottom + 18 }, svg);
    now.textContent = "now";
  }

  /* ---- Swimlanes: one lane per category, labels and a tooltip ---- */
  function drawGantt() {
    var W = 820, LABEL = 150, PAD_R = 40, TOP = 8, BAR = 18, GAP = 5, LANE_PAD = 9, AXIS = 28;
    var x = function (v) { return LABEL + (v - min) / (max - min) * (W - LABEL - PAD_R); };

    lanes.forEach(function (l) {
      var tracks = [];
      l.items.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (it) {
        for (var t = 0; t < tracks.length; t++) {
          if (tracks[t] <= it.start + 0.01) { it.track = t; tracks[t] = it.end; return; }
        }
        it.track = tracks.length;
        tracks.push(it.end);
      });
      l.tracks = tracks.length;
    });

    var y = TOP;
    lanes.forEach(function (l) {
      l.y = y;
      l.h = LANE_PAD * 2 + l.tracks * BAR + (l.tracks - 1) * GAP;
      y += l.h;
    });
    var H = y + AXIS;

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "career__svg", "aria-label": "Career map: " + lanes.map(function (l) { return l.name; }).join(", ") + ", from " + min + " to now" });
    lanes.forEach(function (l, i) {
      if (i % 2 === 0) el("rect", { class: "c-band", x: LABEL - 6, y: l.y, width: W - LABEL - PAD_R + 12, height: l.h, rx: 6 }, svg);
    });
    axisAndGrid(svg, x, TOP, y);

    lanes.forEach(function (l) {
      var label = el("g", { style: "--tint:" + l.tint }, svg);
      el("rect", { class: "c-swatch", x: 0, y: l.y + l.h / 2 - 5, width: 10, height: 10, rx: 3 }, label);
      var t = el("text", { class: "c-lane", x: 16, y: l.y + l.h / 2 + 4 }, label);
      t.textContent = l.name;

      l.items.forEach(function (it) {
        var by = l.y + LANE_PAD + it.track * (BAR + GAP);
        var x1 = x(it.start), x2 = Math.max(x(Math.min(it.end, NOW)), x1 + 6);
        var g = el("g", { class: "c-item", style: "--tint:" + l.tint }, svg);
        el("rect", { class: "c-bar", x: x1, y: by, width: x2 - x1, height: BAR, rx: 4 }, g);
        if (it.open) el("path", { class: "c-open", d: "M" + (x2 + 3) + " " + (by + BAR / 2) + "h14" }, g);
        var w = x2 - x1;
        var label = it.title;
        // Short bars show the start of the title; the tooltip has it in full
        var pad = w < 70 ? 5 : 7;
        var fit = Math.floor((w - pad * 2) / 5.9);
        if (label.length > fit) label = fit >= 4 ? label.slice(0, fit - 1).replace(/[\s,(&]+$/, "") + "…" : "";
        if (label) {
          var lt = el("text", { class: "c-barlabel", x: x1 + pad, y: by + BAR / 2 + 4 }, g);
          lt.textContent = label;
        }
        wire(g, it);
      });
    });
    return svg;
  }

  function render() {
    scroller.appendChild(drawGantt());
    var legend = document.createElement("span");
    legend.className = "career__legend";
    lanes.forEach(function (l) {
      var k = document.createElement("span");
      k.style.setProperty("--tint", l.tint);
      k.textContent = l.name;
      legend.appendChild(k);
    });
    key.appendChild(legend);
    // On narrow screens the map scrolls sideways; start at the recent years
    scroller.scrollLeft = scroller.scrollWidth;
  }

  render();
})();

/*
  Punch-card details and the CV listing as a git graph, switched on by
  attributes on <html>:
    data-punch  = any of "stub bands footer" (space separated)
    data-cvlist = "git" (remove it for a plain list)
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var NS = "http://www.w3.org/2000/svg";

  /* ================================================================ */
  /* Punch cards: real IBM 029 Hollerith code, 12 rows per column     */
  /* ================================================================ */

  var ROWS = ["12", "11", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  var SPECIAL = {
    "&": ["12"], "-": ["11"], "/": ["0", "1"], ".": ["12", "3", "8"], ",": ["0", "3", "8"],
    "(": ["12", "5", "8"], ")": ["11", "5", "8"], "'": ["5", "8"], ":": ["2", "8"], "@": ["4", "8"]
  };

  function holes(ch) {
    if (SPECIAL[ch]) return SPECIAL[ch];
    if (/[0-9]/.test(ch)) return [ch];
    var i = ch.charCodeAt(0) - 65;
    if (i < 0 || i > 25) return [];
    if (i < 9) return ["12", String(i + 1)];
    if (i < 18) return ["11", String(i - 8)];
    return ["0", String(i - 16)];
  }

  // An SVG of the punched columns. o: col (column pitch), row (row pitch),
  // hw/hh (hole size), top (room for the printed line), digits (print 0-9)
  function punch(text, o) {
    text = text.toUpperCase();
    var n = o.cols || text.length;
    var W = n * o.col + (o.padX || 0) * 2;
    var H = (o.top || 0) + ROWS.length * o.row + (o.padY || 0);
    var px = function (c) { return (o.padX || 0) + c * o.col + o.col / 2; };
    var py = function (r) { return (o.top || 0) + r * o.row + o.row / 2; };
    var d = "", g = "", xs = [], line = "", out = [];
    var digits = ROWS.map(function () { return { x: [], s: "" }; });
    for (var c = 0; c < n; c++) {
      var ch = text.charAt(c) || " ";
      var h = holes(ch);
      ROWS.forEach(function (name, r) {
        if (h.indexOf(name) !== -1) {
          d += "M" + (px(c) - o.hw / 2).toFixed(1) + " " + (py(r) - o.hh / 2).toFixed(1) + "h" + o.hw + "v" + o.hh + "h-" + o.hw + "z";
        } else if (o.grid) {
          g += "M" + (px(c) - 0.5).toFixed(1) + " " + (py(r) - 0.5).toFixed(1) + "h1v1h-1z";
        } else if (o.digits && r >= 2) {
          digits[r].x.push(px(c).toFixed(1));
          digits[r].s += name;
        }
      });
      if (ch !== " ") { xs.push(px(c).toFixed(1)); line += ch; }
    }
    out.push('<svg xmlns="' + NS + '" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">');
    if (o.frame) out.push('<path class="p-frame" d="M' + o.frame + ' 0.5H' + (W - 0.5) + "V" + (H - 0.5) + "H0.5V" + o.frame + 'Z"/>');
    if (o.top && line) out.push('<text class="p-print" y="' + (o.top - 3) + '" x="' + xs.join(" ") + '" text-anchor="middle">' + line + "</text>");
    if (o.digits) digits.forEach(function (row, r) {
      if (row.s) out.push('<text class="p-digit" y="' + (py(r) + o.row * 0.32).toFixed(1) + '" x="' + row.x.join(" ") + '" text-anchor="middle">' + row.s + "</text>");
    });
    if (g) out.push('<path class="p-grid" d="' + g + '"/>');
    out.push('<path class="p-hole" d="' + d + '"/>');
    out.push("</svg>");
    return out.join("");
  }

  function deco(className, html) {
    var div = document.createElement("div");
    div.className = className;
    div.setAttribute("aria-hidden", "true");
    div.innerHTML = html;
    return div;
  }

  // What the cards are punched with: the stub at the top and the card at the end
  var CARD_TEXT = "Jason Tsoukalas  PhD  Responsible Systems by Design  HUA 2026";

  // 1. A tear-off stub under the "at a glance" card
  var glance = document.querySelector(".hero .card");
  if (glance) {
    glance.appendChild(deco("punch-stub", punch(CARD_TEXT, {
      col: 7, row: 5.2, hw: 3, hh: 4.4, top: 11, digits: true
    })));
  }

  // 2. A small band under each section title, punched with its number and name
  document.querySelectorAll(".section__head").forEach(function (head) {
    var num = head.querySelector(".section__num");
    var h2 = head.querySelector("h2");
    if (!h2) return;
    var n = num ? num.textContent.replace(/\D/g, "") : "";
    var label = (n ? ("0" + n).slice(-2) + " " : "") + h2.textContent.trim();
    label = label.replace(/[^A-Za-z0-9 &\-\/.,]/g, "").slice(0, 26);
    h2.insertAdjacentElement("afterend", deco("punch-band", punch(label, {
      col: 7, row: 3.6, hw: 2.2, hh: 3.4, top: 10, grid: true
    })));
  });

  // 3. A full 80-column card above the footer
  var footer = document.querySelector(".footer");
  if (footer) {
    // Same words as the stub at the top, centred on the 80 columns
    var lead = Math.floor((80 - CARD_TEXT.length) / 2);
    var card = deco("punch-footer__card", punch(new Array(lead + 1).join(" ") + CARD_TEXT, {
      cols: 80, col: 7.2, row: 15, hw: 3.6, hh: 9, top: 16, digits: true, padX: 10, padY: 12, frame: 22
    }));
    // The caption lives in index.html; the card goes above it
    var holder = document.querySelector(".punch-footer");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "punch-footer";
      footer.parentNode.insertBefore(holder, footer);
    }
    holder.insertBefore(card, holder.firstChild);
  }

  // 4. For visitors who clicked the punch card in the email signature
  //    (?ref=sig-photo): that card, decoded, above the intro. It reads the
  //    tag before visits.js tidies it from the address, so a reload hides it.
  var params = new URLSearchParams(location.search);
  var hero = document.querySelector(".hero");
  if (hero && params.get("ref") === "sig-photo") sigCard(hero, "PHD CANDIDATE & RESEARCH ASSOCIATE");

  function sigCard(before, text) {
    var COL = 24, ROW = 17, HW = 9, HH = 12, TOP = 26, LEFT = 26;
    var n = text.length, W = LEFT + n * COL, H = TOP + ROWS.length * ROW;
    var px = function (c) { return LEFT + c * COL + COL / 2; };
    var py = function (r) { return TOP + r * ROW + ROW / 2; };
    var esc = function (ch) { return ch === "&" ? "&amp;" : ch; };

    var s = '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true" focusable="false">';
    ROWS.forEach(function (name, r) {
      s += '<text class="k-rowname" x="' + (LEFT - 8) + '" y="' + (py(r) + 3) + '" text-anchor="end">' + name + "</text>";
    });
    for (var c = 0; c < n; c++) {
      var ch = text.charAt(c), h = holes(ch);
      s += '<g class="k-col"><rect class="k-hit" x="' + (px(c) - COL / 2) + '" y="0" width="' + COL + '" height="' + H + '"/>';
      if (ch !== " ") s += '<text class="k-print" x="' + px(c) + '" y="' + (TOP - 10) + '" text-anchor="middle">' + esc(ch) + "</text>";
      ROWS.forEach(function (name, r) {
        s += h.indexOf(name) !== -1
          ? '<rect class="k-hole" x="' + (px(c) - HW / 2) + '" y="' + (py(r) - HH / 2) + '" width="' + HW + '" height="' + HH + '" rx="1.5"/>'
          : '<circle class="k-dot" cx="' + px(c) + '" cy="' + py(r) + '" r="1.1"/>';
      });
      s += "</g>";
    }

    var band = document.createElement("aside");
    band.className = "sigcard";
    band.setAttribute("aria-label", "The card from my email");
    band.innerHTML =
      '<div class="sigcard__card" tabindex="0" role="img" aria-label="A punch card that reads PhD candidate and research associate">' + s + "</svg></div>" +
      '<div class="sigcard__text"><p class="sigcard__kicker">The card from my email</p>' +
      "<p>It's my title, punched in IBM 029 code, the way computers read cards in the 1960s. Each column is one letter.</p></div>" +
      '<p class="sigcard__read" aria-live="polite">Tap or point at a column to read it.</p>' +
      '<button class="sigcard__close" type="button" aria-label="Close"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>';
    before.parentNode.insertBefore(band, before);

    // Hover, tap or the arrow keys read out a column
    var card = band.querySelector(".sigcard__card");
    var out = band.querySelector(".sigcard__read");
    var idle = out.innerHTML;
    var cols = band.querySelectorAll(".k-col");
    var current = -1;
    function show(i) {
      current = i;
      cols.forEach(function (g, j) { g.classList.toggle("is-on", j === i); });
      if (i < 0) { out.innerHTML = idle; return; }
      var ch = text.charAt(i), r = holes(ch);
      out.innerHTML = ch === " "
        ? "Column " + (i + 1) + " is blank: a space between words."
        : "<b>" + esc(ch) + "</b> is punched in row" + (r.length > 1 ? "s " + r.join(" and ") : " " + r[0]) + ".";
    }
    cols.forEach(function (g, i) {
      g.addEventListener("mouseenter", function () { show(i); });
      g.addEventListener("click", function () { show(i); });
    });
    card.addEventListener("mouseleave", function () { if (document.activeElement !== card) show(-1); });
    card.addEventListener("keydown", function (e) {
      var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      show(Math.min(n - 1, Math.max(0, (current < 0 ? (step > 0 ? -1 : n) : current) + step)));
    });
    card.addEventListener("blur", function () { show(-1); });

    band.querySelector(".sigcard__close").addEventListener("click", function () {
      band.remove();
      var name = document.getElementById("name");
      if (name) { name.setAttribute("tabindex", "-1"); name.focus({ preventScroll: true }); }
    });
  }

  /* ================================================================ */
  /* The CV listing as a git graph: one coloured branch per category, */
  /* each entry a commit on it, all branches merging at the top in JT */
  /* ================================================================ */

  var body = document.querySelector("#cv .section__body");
  if (!body) return;

  var lanes = [];
  body.querySelectorAll(".cv-head").forEach(function (head) {
    var list = head.nextElementSibling;
    while (list && !list.matches("ol.rows, .cv-head")) list = list.nextElementSibling;
    if (!list || !list.matches("ol.rows")) return;
    var rows = Array.prototype.slice.call(list.querySelectorAll(":scope > .row"));
    if (!rows.length) return;
    lanes.push({ head: head, tint: head.style.getPropertyValue("--tint"), rows: rows });
  });
  if (!lanes.length) return;

  // Each category heading names itself as a branch ("Positions branch")
  lanes.forEach(function (lane) {
    var tag = document.createElement("span");
    tag.className = "cv-head__branch";
    tag.setAttribute("aria-hidden", "true");
    tag.textContent = "branch";
    // Keep it in the same line box as the title, so a long title wraps with it
    var label = document.createElement("span");
    Array.prototype.slice.call(lane.head.childNodes).forEach(function (n) {
      if (!(n.nodeType === 1 && n.classList.contains("cv-head__icon"))) label.appendChild(n);
    });
    label.appendChild(document.createTextNode(" "));
    label.appendChild(tag);
    lane.head.appendChild(label);
  });

  var svg = null;
  var hotDot = null;

  function svgEl(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function draw() {
    if (svg) { svg.remove(); svg = null; }
    if (root.dataset.cvlist !== "git") { body.style.removeProperty("--gut"); return; }

    var narrow = window.innerWidth < 640;
    var COL = narrow ? 11 : 15, X0 = 17, R = narrow ? 13 : 16;
    var x = function (i) { return X0 + i * COL; };
    body.style.setProperty("--gut", (x(lanes.length - 1) + (narrow ? 16 : 26)) + "px");

    var br = body.getBoundingClientRect();
    var rel = function (r) { return r.top - br.top; };
    var jy = rel(lanes[0].head.getBoundingClientRect()) - (narrow ? 34 : 40);

    svg = svgEl("svg", { class: "cvgit", width: x(lanes.length - 1) + 20, height: br.height, "aria-hidden": "true" });
    body.insertBefore(svg, body.firstChild);

    var fanEnd = jy + R + 30;
    lanes.forEach(function (lane, i) {
      var g = svgEl("g", { style: "--tint:" + lane.tint }, svg);
      var hy = rel(lane.head.getBoundingClientRect()) + lane.head.getBoundingClientRect().height / 2;
      var ys = lane.rows.map(function (row) {
        var when = row.querySelector(".row__when") || row;
        var r = when.getBoundingClientRect();
        return rel(r) + Math.min(r.height, 20) / 2 + 1;
      });
      var last = ys[ys.length - 1];
      // from JT: fan out to this branch's column, then straight down
      var d = i === 0
        ? "M" + x(0) + " " + (jy + R) + " V" + last
        : "M" + x(0) + " " + (jy + R) + " C" + x(0) + " " + (fanEnd - 8) + " " + x(i) + " " + (jy + R + 6) + " " + x(i) + " " + fanEnd + " V" + last;
      svgEl("path", { class: "cg-pass", d: d }, g);
      svgEl("path", { class: "cg-line", d: "M" + x(i) + " " + hy + " V" + last }, g);
      // the branch label sits where the category heading is
      svgEl("rect", { class: "cg-label", x: x(i) - 4.5, y: hy - 4.5, width: 9, height: 9, rx: 2.5 }, g);
      ys.forEach(function (y, k) {
        var row = lane.rows[k];
        var open = !!row.querySelector(".row__when .now");
        var dot = svgEl("circle", { class: "cg-dot" + (open ? " is-open" : ""), cx: x(i), cy: y, r: open ? 5 : 4.2 }, g);
        if (open) svgEl("circle", { class: "cg-halo", cx: x(i), cy: y, r: 9 }, g);
        row._cgDot = dot;
      });
    });

    // JT on the main line, where every branch merges
    var jt = svgEl("g", { class: "cg-jt" }, svg);
    svgEl("circle", { cx: x(0), cy: jy, r: R }, jt);
    var t = svgEl("text", { x: x(0), y: jy + R * 0.33, "text-anchor": "middle" }, jt);
    t.textContent = "JT";
    var head = svgEl("text", { class: "cg-headlabel", x: x(0) + R + 8, y: jy + 4 }, svg);
    head.textContent = "main";
  }

  lanes.forEach(function (lane) {
    lane.rows.forEach(function (row) {
      row.addEventListener("mouseenter", function () { if (row._cgDot) { hotDot = row._cgDot; hotDot.classList.add("is-hot"); } });
      row.addEventListener("mouseleave", function () { if (hotDot) hotDot.classList.remove("is-hot"); hotDot = null; });
    });
  });

  var queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; draw(); });
  }

  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  if (window.ResizeObserver) {
    var lastH = 0, lastW = 0;
    new ResizeObserver(function (entries) {
      var r = entries[0].contentRect;
      if (Math.abs(r.height - lastH) < 1 && Math.abs(r.width - lastW) < 1) return;
      lastH = r.height; lastW = r.width;
      redraw();
    }).observe(body);
  } else {
    window.addEventListener("resize", redraw);
  }
})();

/* Research: the sprint cycle, animated. Plain JS, no libraries.
   <figure data-anim="3" data-story="1"> runs one sprint at a time, only while on
   screen. At rest it is the static drawing, so reduced motion and print show that. */
(function () {
  "use strict";

  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motionOn = !reduce;
  var figs = [];

  // ---------------------------------------------------------------- helpers
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function tween(ms, fn, linear) {
    return new Promise(function (res) {
      var t0 = performance.now();
      function f(now) {
        var t = Math.min(1, (now - t0) / ms);
        fn(linear ? t : ease(t));
        if (t < 1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q(el, s) { return el.querySelector(s); }
  function qa(el, s) { return Array.prototype.slice.call(el.querySelectorAll(s)); }
  function at(dot, x, y) { dot.setAttribute("cx", x.toFixed(1)); dot.setAttribute("cy", y.toFixed(1)); }
  function show(el, on) { if (el) el.style.opacity = on ? 1 : 0; }
  function hide(p) { var L = p.getTotalLength(); p._L = L; p.style.strokeDasharray = L + " " + L; p.style.strokeDashoffset = L; p.style.opacity = 1; }
  function draw(p, ms) { return tween(ms || 260, function (t) { p.style.strokeDashoffset = p._L * (1 - t); }); }
  function plain(p) { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; p.style.opacity = ""; }
  function fade(el, a, b, ms) { return tween(ms, function (t) { el.style.opacity = a + (b - a) * t; }); }
  function moveX(dot, x0, x1, y, ms) { return tween(ms, function (t) { at(dot, x0 + (x1 - x0) * t, y); }); }
  function along(dot, path, f0, f1, ms, linear) {
    var L = path.getTotalLength();
    return tween(ms, function (t) { var p = path.getPointAtLength(L * (f0 + (f1 - f0) * t)); at(dot, p.x, p.y); }, linear);
  }
  function pulse(ring) {
    return tween(800, function (t) { ring.style.opacity = 0.9 * (1 - t); ring.style.transform = "scale(" + (1 + 0.16 * t) + ")"; }, true);
  }
  function ready(fig) { return motionOn && fig._vis; }
  function until(fig) {
    return new Promise(function (res) {
      (function check() { if (ready(fig)) res(); else fig._wake = check; })();
    });
  }
  function poke() { figs.forEach(function (f) { var w = f._wake; f._wake = null; if (w) w(); }); }

  // Shared story state: one sprint per block plus the held one, sprint 3 fails Safety, shipped sprints add a block
  function Story(fig) {
    this.n = 1;
    this.shipped = 0;
    this.on = fig.dataset.story === "1";
    this.failAt = +(fig.dataset.fail || 3);
    this.incs = qa(fig, ".a-inc rect");
    this.incG = q(fig, ".a-inc");
    this.held = q(fig, ".a-held");
  }
  Story.prototype.fails = function () { return this.on && this.n === this.failAt; };
  Story.prototype.begin = function () {
    if (!this.on) return;
    if (this.n > this.incs.length + 1) { this.n = 1; this.shipped = 0; this.incs.forEach(function (r) { r.classList.remove("is-on"); }); }
    show(this.incG, true);
    show(this.held, false);
  };
  Story.prototype.ship = function () {
    if (this.on && this.shipped < this.incs.length) this.incs[this.shipped++].classList.add("is-on");
  };
  Story.prototype.rest = function () {
    this.n = 1; this.shipped = 0;
    this.incs.forEach(function (r) { r.classList.remove("is-on"); });
    show(this.incG, false); show(this.held, false);
  };

  // ---------------------------------------------------------------- 3: the sprint cycle
  function make3(fig) {
    var s = new Story(fig);
    var dot = q(fig, ".a-dot"), dot2 = q(fig, ".a-dot2"), ring = q(fig, ".a-ring"), track = q(fig, ".a-track");
    var gates = qa(fig, ".a-gate"), pips = qa(fig, ".a-pip"), next = q(fig, ".a-next");
    // The return path is only taken by a sprint that does not ship
    var heldOnly = fig.dataset.ret === "held";
    function clear() { gates.forEach(function (g) { g.classList.remove("is-on", "is-fail"); }); }
    return {
      rest: function () {
        show(dot, false); show(dot2, false); pips.forEach(function (p) { p.style.opacity = ""; });
        clear(); next.textContent = "next sprint"; next.classList.remove("is-held");
        s.rest();
      },
      sprint: async function () {
        s.begin();
        clear(); pips.forEach(function (p) { p.style.opacity = 0; });
        next.textContent = "next sprint"; next.classList.remove("is-held");
        var f = 0, failed = false;
        at(dot, 130, 120); show(dot, true);
        await moveX(dot, 130, 280, 120, 700);
        await along(dot, track, 0, 0.25, 1000);
        f = 0.25;
        for (var i = 0; i < gates.length; i++) {
          var g = gates[i], gf = +g.dataset.f;
          await along(dot, track, f, gf, 360, true); f = gf;
          if (s.fails() && i === 1) { g.classList.add("is-fail"); failed = true; await wait(500); continue; }
          g.classList.add("is-on");
          if (pips[i]) fade(pips[i], 0, 1, 200);
        }
        await along(dot, track, f, 0.5, 300, true);
        if (heldOnly && !failed) {
          // Shipped: the same dot carries on into the product
          await moveX(dot, 446, 592, 120, 700); show(dot, false);
          pulse(ring); s.ship();
          pips.forEach(function (p) { fade(p, 1, 0, 1200); });
          await wait(1400);
          clear(); s.n++; return;
        }
        if (failed) {
          await fade(s.held, 0, 1, 300);
          next.textContent = "fix it next sprint"; next.classList.add("is-held");
        } else {
          at(dot2, 446, 120); show(dot2, true);
          moveX(dot2, 446, 592, 120, 700).then(function () { show(dot2, false); pulse(ring); s.ship(); });
        }
        pips.forEach(function (p) { fade(p, 1, 0, 1600); });
        await along(dot, track, 0.5, 1, 2000, true);
        clear(); show(dot, false);
        await wait(failed ? 900 : 300);
        s.n++;
      }
    };
  }

  // ---------------------------------------------------------------- wiring
  var makers = { "3": make3 };

  async function loop(fig) {
    var a = fig._anim;
    for (;;) {
      if (!ready(fig)) { a.rest(); await until(fig); }
      await a.sprint();
    }
  }

  qa(document, "[data-anim]").forEach(function (fig) {
    var make = makers[fig.dataset.anim];
    if (!make) return;
    fig._anim = make(fig);
    fig._vis = false;
    figs.push(fig);
    fig._anim.rest();
    loop(fig);
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target._vis = e.isIntersecting; });
      poke();
    }, { threshold: 0.35 });
    figs.forEach(function (f) { io.observe(f); });
  } else {
    figs.forEach(function (f) { f._vis = true; });
  }

})();
