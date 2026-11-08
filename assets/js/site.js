/*
  jtsoukalas.gr
  Small, dependency-free behaviour: appearance toggle, email, copy buttons,
  the sliding section lens, and the pointer highlight on glass.
*/

(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  var announcer = document.getElementById("announcer");

  function announce(text) {
    if (!announcer) return;
    announcer.textContent = "";
    requestAnimationFrame(function () { announcer.textContent = text; });
  }

  /* ---------------------------------------------------------------- */
  /* Appearance                                                        */
  /* Follows the system until the visitor picks one; the pick is kept. */
  /* ---------------------------------------------------------------- */

  var toggle = document.querySelector(".theme-toggle");

  function currentTheme() {
    return root.dataset.theme || (systemDark.matches ? "dark" : "light");
  }

  function labelToggle() {
    if (!toggle) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", "Switch to " + next + " appearance");
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch (e) {}
    labelToggle();
  }

  if (toggle) {
    labelToggle();
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      // Cross-fade the whole page rather than snapping between brightness levels
      if (document.startViewTransition && !reduceMotion.matches) {
        // The browser may skip the animation (e.g. a hidden tab); the theme still changes
        document.startViewTransition(function () { setTheme(next); }).ready.catch(function () {});
      } else {
        setTheme(next);
      }
    });
    systemDark.addEventListener("change", labelToggle);
  }

  /* ---------------------------------------------------------------- */
  /* Email: assembled here so the address is not sitting in the HTML   */
  /* ---------------------------------------------------------------- */

  var address = "";

  document.querySelectorAll(".js-email").forEach(function (a) {
    address = a.dataset.user + "@" + a.dataset.domain;
    a.href = "mailto:" + address;
    if (a.textContent.indexOf("[at]") !== -1) a.textContent = address;
  });

  /* ---------------------------------------------------------------- */
  /* Copy buttons                                                      */
  /* ---------------------------------------------------------------- */

  function flash(button) {
    button.classList.add("is-done");
    clearTimeout(button._t);
    button._t = setTimeout(function () { button.classList.remove("is-done"); }, 1600);
  }

  function copyText(text, button) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(function () {
      flash(button);
      announce("Copied to clipboard");
    });
  }

  document.querySelectorAll("[data-copy-email]").forEach(function (b) {
    b.addEventListener("click", function () { copyText(address, b); });
  });

  document.querySelectorAll("[data-copy-from]").forEach(function (b) {
    b.addEventListener("click", function () {
      var src = b.parentElement.querySelector(b.dataset.copyFrom);
      if (src) copyText(src.textContent, b);
    });
  });

  if (!navigator.clipboard) {
    document.querySelectorAll(".copy").forEach(function (b) { b.hidden = true; });
  }

  /* "Save as PDF" opens the print dialog; the print stylesheet lays the  */
  /* page out as a one-document CV                                      */
  document.querySelectorAll(".js-print").forEach(function (b) {
    b.addEventListener("click", function () { window.print(); });
  });

  /* ---------------------------------------------------------------- */
  /* News cards: arrow buttons and the fade at the end of the row      */
  /* ---------------------------------------------------------------- */

  var newsRow = document.querySelector(".rows--news");
  var newsBtns = document.querySelectorAll("[data-news]");

  if (newsRow) {
    var updateNews = function () {
      var max = newsRow.scrollWidth - newsRow.clientWidth;
      var atStart = newsRow.scrollLeft <= 2;
      var atEnd = newsRow.scrollLeft >= max - 2;
      newsRow.classList.toggle("at-start", atStart);
      newsRow.classList.toggle("at-end", atEnd);
      newsBtns.forEach(function (b) {
        b.disabled = b.dataset.news === "-1" ? atStart : atEnd;
      });
    };
    newsBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var card = newsRow.querySelector(".news-card");
        var step = card ? card.offsetWidth + 14 : newsRow.clientWidth * 0.8;
        newsRow.scrollBy({ left: step * Number(b.dataset.news) });
      });
    });
    newsRow.addEventListener("scroll", updateNews, { passive: true });
    window.addEventListener("resize", updateNews);
    updateNews();
  }

  /* ---------------------------------------------------------------- */
  /* Springs                                                           */
  /* Parameterised the way Apple describes them: a response time and a */
  /* damping ratio. Each spring keeps its own value and velocity, so a */
  /* new target mid-flight just bends the motion instead of restarting.*/
  /* ---------------------------------------------------------------- */

  function Spring(value, response, damping) {
    var omega = (2 * Math.PI) / response;
    this.k = omega * omega;
    this.c = 2 * damping * omega;
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  Spring.prototype.step = function (dt) {
    var force = -this.k * (this.value - this.target) - this.c * this.velocity;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
  };

  Spring.prototype.settled = function (eps) {
    eps = eps || 0.25; // in the spring's own units (px by default)
    return Math.abs(this.velocity) < eps * 2 && Math.abs(this.value - this.target) < eps;
  };

  Spring.prototype.tune = function (response, damping) {
    var omega = (2 * Math.PI) / response;
    this.k = omega * omega;
    this.c = 2 * damping * omega;
  };

  Spring.prototype.snap = function (v) {
    this.value = this.target = v;
    this.velocity = 0;
  };

  /* ---------------------------------------------------------------- */
  /* Section lens                                                      */
  /* ---------------------------------------------------------------- */

  var tabs = document.querySelector(".tabs");
  var lens = tabs && tabs.querySelector(".lens");
  var links = tabs ? Array.prototype.slice.call(tabs.querySelectorAll("a[href^='#']")) : [];
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });

  if (tabs && lens && links.length) {
    var x = new Spring(0, 0.38, 1);
    var w = new Spring(0, 0.38, 1);
    var active = null;
    var visible = false;
    var frame = 0;
    var last = 0;
    var lockedUntilScrollEnds = false;
    var unlockTimer = 0;

    var render = function () {
      lens.style.transform = "translateX(" + x.value.toFixed(2) + "px)";
      lens.style.width = w.value.toFixed(2) + "px";
    };

    var tick = function (now) {
      var dt = Math.min((now - last) / 1000, 0.064);
      last = now;
      // Fixed small substeps keep the integration stable on slow frames
      var steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (var i = 0; i < steps; i++) {
        x.step(dt / steps);
        w.step(dt / steps);
      }
      render();
      if (x.settled() && w.settled()) {
        x.snap(x.target);
        w.snap(w.target);
        render();
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    var moveTo = function (link, instant) {
      if (link === active && !instant) return;
      links.forEach(function (a) {
        if (a === link) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      active = link;

      if (!link) {
        visible = false;
        lens.classList.remove("is-on");
        return;
      }

      var tx = link.offsetLeft;
      var tw = link.offsetWidth;

      // Appearing from nothing, or asked not to animate: place it, then fade in
      if (!visible || instant || reduceMotion.matches) {
        x.snap(tx);
        w.snap(tw);
        render();
        visible = true;
        lens.classList.add("is-on");
        return;
      }

      x.target = tx;
      w.target = tw;
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    var sectionInView = function () {
      var line = window.innerHeight * 0.38;
      var current = -1;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i] && sections[i].getBoundingClientRect().top <= line) current = i;
      }
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = sections.length - 1;
      return current === -1 ? null : links[current];
    };

    var onScroll = function () {
      if (lockedUntilScrollEnds) {
        clearTimeout(unlockTimer);
        unlockTimer = setTimeout(unlock, 160);
        return;
      }
      moveTo(sectionInView());
    };

    var unlock = function () {
      lockedUntilScrollEnds = false;
      moveTo(sectionInView());
    };

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        onScroll();
      });
    }, { passive: true });

    // Clicking a tab moves the lens straight there and ignores the sections
    // the page scrolls past on the way.
    links.forEach(function (a) {
      a.addEventListener("click", function () {
        lockedUntilScrollEnds = true;
        clearTimeout(unlockTimer);
        unlockTimer = setTimeout(unlock, 900);
        moveTo(a);
      });
    });

    window.addEventListener("resize", function () {
      if (active) moveTo(active, true);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (active) moveTo(active, true); });
    }

    moveTo(sectionInView(), true);
  }

  /* ---------------------------------------------------------------- */
  /* Brand: once the big name has scrolled away, the JT monogram       */
  /* unfolds into the full name, if the top bar has room for it.       */
  /* ---------------------------------------------------------------- */

  var brand = document.querySelector(".brand");
  var heroName = document.getElementById("name");

  if (brand && heroName && "IntersectionObserver" in window) {
    var measure = brand.querySelector(".brand__measure");
    var parts = Array.prototype.slice.call(brand.querySelectorAll(".brand__x"));
    var widths = [];
    // Progress 0..1 per hidden part. Unfolding is a little bouncy; the surname
    // has a slightly slower response so it trails the first name by a beat.
    var unfold = parts.map(function () { return new Spring(0, 0.5, 0.62); });
    var nameGone = false;
    var named = false;
    var brandFrame = 0;
    var brandLast = 0;

    var measureParts = function () {
      widths = parts.map(function (p) { return p.firstElementChild.scrollWidth; });
    };

    var paintBrand = function () {
      parts.forEach(function (p, i) {
        p.style.width = Math.max(0, unfold[i].value * widths[i]).toFixed(2) + "px";
      });
    };

    var brandTick = function (now) {
      var dt = Math.min((now - brandLast) / 1000, 0.064);
      brandLast = now;
      var steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      var moving = false;
      unfold.forEach(function (s) {
        for (var i = 0; i < steps; i++) s.step(dt / steps);
        if (s.settled(0.002)) s.snap(s.target);
        else moving = true;
      });
      paintBrand();
      brandFrame = moving ? requestAnimationFrame(brandTick) : 0;
    };

    var setNamed = function (on, instant) {
      if (on === named) return;
      named = on;
      if (instant) {
        // Letters skip their fade too; the class comes off once the new state has painted
        brand.classList.add("is-instant");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { brand.classList.remove("is-instant"); });
        });
      }
      brand.classList.toggle("is-named", on);
      if (!widths.length || !widths[0]) measureParts();
      unfold.forEach(function (s, i) {
        if (on) s.tune(0.5 + i * 0.1, 0.62);
        else s.tune(0.38, 1);
        s.target = on ? 1 : 0;
      });
      if (instant || reduceMotion.matches) {
        unfold.forEach(function (s) { s.snap(s.target); });
        paintBrand();
        return;
      }
      if (!brandFrame) {
        brandLast = performance.now();
        brandFrame = requestAnimationFrame(brandTick);
      }
    };

    var hasRoom = function () {
      var style = getComputedStyle(brand);
      var needed = measure.offsetWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
      // On phones the tabs float at the bottom, so the neighbour is the theme button
      var neighbour = tabs && getComputedStyle(tabs).position !== "fixed" ? tabs : toggle;
      if (!neighbour) return true;
      var room = neighbour.getBoundingClientRect().left - brand.getBoundingClientRect().left - 16;
      return needed <= room;
    };

    var updateBrand = function (instant) {
      setNamed(nameGone && hasRoom(), instant === true);
    };

    // A page that loads already scrolled (a link to #projects, a reload)
    // shows the name straight away instead of animating on arrival
    var firstObservation = true;

    new IntersectionObserver(function (entries) {
      var entry = entries[entries.length - 1];
      nameGone = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      updateBrand(firstObservation);
      firstObservation = false;
    }, { rootMargin: "-72px 0px 0px 0px" }).observe(heroName);

    window.addEventListener("resize", function () { updateBrand(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measureParts();
        paintBrand();
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Pointer highlight on glass (mouse and trackpad only)              */
  /* ---------------------------------------------------------------- */

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".glass").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
    });
  }
})();
