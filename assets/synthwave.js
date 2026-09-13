/* ============================================================
   Synth Wave Ribbon — animated edge decoration
   Draws two twisting ribbons pinned to the left and right of
   the viewport. Purely decorative: hidden on narrow screens,
   paused when the tab is hidden.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = {
    width: 200,        // px width of each ribbon column
    centre: 92,        // x position of the ribbon's axis within that column
    meander: 34,       // how far the whole ribbon snakes left/right
    meanderPeriod: 400,// px of page height per snake
    ribbon: 74,        // half-width of the fan when it faces you
    twistPeriod: 200,  // px of page height per half-turn
    strands: 16,
    step: 6,           // sampling resolution in px (lower = smoother, costlier)
    minViewport: 1400, // below this width the ribbons are hidden
    driftSpeed: 6,     // px per second the pattern travels upward
    twistSpeed: 1   // radians per second the ribbon rotates
  };

  var THEMES = {
    dark:  { blue: "80, 185, 168",  pink: "255, 95, 168", glow: 9, alpha: 0.85 },
    light: { blue: "59, 141, 127",  pink: "194, 68, 126", glow: 3, alpha: 0.55 }
  };

  var canvases = [];
  var frame = null;
  var startedAt = null;
  var elapsed = 0;      // seconds of animation already played
  var visible = false;

  function isDark() {
    return document.body.classList.contains("quarto-dark") ||
           document.documentElement.getAttribute("data-bs-theme") === "dark";
  }

  function makeCanvas(side) {
    var c = document.createElement("canvas");
    c.className = "synthwave-ribbon synthwave-" + side;
    c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    return { el: c, ctx: c.getContext("2d"), side: side };
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvases.forEach(function (c) {
      c.el.width = CONFIG.width * dpr;
      c.el.height = window.innerHeight * dpr;
      c.el.style.width = CONFIG.width + "px";
      c.el.style.height = window.innerHeight + "px";
      c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  // One strand of the fan. u = 0 at the spine, 1 at the outer edge.
  function drawStrand(ctx, h, u, lag, drift, twist, colour, alpha, width, glow) {
    var meanderK = (2 * Math.PI) / CONFIG.meanderPeriod;
    var twistK = (2 * Math.PI) / CONFIG.twistPeriod;

    ctx.beginPath();
    for (var y = -CONFIG.step; y <= h + CONFIG.step; y += CONFIG.step) {
      var cx = CONFIG.centre + CONFIG.meander * Math.sin(meanderK * (y + drift));
      var x = cx + u * CONFIG.ribbon * Math.cos(twistK * (y + drift) + lag + twist);
      if (y <= -CONFIG.step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(" + colour + "," + alpha + ")";
    ctx.lineWidth = width;
    ctx.shadowColor = "rgba(" + colour + ",0.85)";
    ctx.shadowBlur = glow;
    ctx.stroke();
  }

  function render(now) {
    if (startedAt === null) startedAt = now;
    var t = elapsed + (now - startedAt) / 1000;

    var drift = -t * CONFIG.driftSpeed;      // negative = travels upward
    var twist = t * CONFIG.twistSpeed;
    var theme = THEMES[isDark() ? "dark" : "light"];
    var h = window.innerHeight;

    canvases.forEach(function (c) {
      var ctx = c.ctx;
      ctx.save();
      ctx.clearRect(0, 0, CONFIG.width, h);
      if (c.side === "right") {           // mirror so the spine faces inward
        ctx.translate(CONFIG.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.lineCap = "round";

      var sideTwist = c.side === "right" ? -twist : twist;
      var sideDrift = c.side === "right" ? -drift : drift;

      for (var i = 1; i <= CONFIG.strands; i++) {
        var u = i / CONFIG.strands;
        drawStrand(ctx, h, u, u * 0.8, sideDrift, sideTwist, theme.blue,
                   (0.28 + 0.5 * u) * theme.alpha, 0.7 + 0.3 * (1 - u), theme.glow * 0.5);
      }
      drawStrand(ctx, h, 1.02, 0.85, sideDrift, sideTwist, theme.blue,
                 0.85 * theme.alpha, 1.5, theme.glow);
      drawStrand(ctx, h, 0.13, 0.10, sideDrift, sideTwist, theme.pink,
                 0.6 * theme.alpha, 1.1, theme.glow * 0.6);
      drawStrand(ctx, h, 0.02, 0.00, sideDrift, sideTwist, theme.pink,
                 0.95 * theme.alpha, 2.2, theme.glow);

      ctx.restore();
    });

    frame = requestAnimationFrame(render);
  }

  function start() {
    if (frame === null && visible) frame = requestAnimationFrame(render);
  }

  function stop(now) {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
      // Bank the time played so the ribbon resumes instead of snapping back.
      if (startedAt !== null) {
        elapsed += ((now || performance.now()) - startedAt) / 1000;
      }
    }
    startedAt = null;
  }

  function applyWidth() {
    var wide = window.innerWidth >= CONFIG.minViewport;
    if (wide === visible) return;
    visible = wide;
    canvases.forEach(function (c) { c.el.style.display = wide ? "" : "none"; });
    if (wide) { resize(); start(); } else { stop(); }
  }

  function init() {
    // Canvases are always created, so widening the window later works
    // without a reload; CSS + applyWidth decide whether they show.
    canvases = [makeCanvas("left"), makeCanvas("right")];
    applyWidth();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        applyWidth();
        if (visible) resize();
      }, 150);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    // Redraw on theme switch so colours track light/dark immediately.
    var onThemeChange = function () {
      if (frame === null && visible && !document.hidden) {
        startedAt = null;
        requestAnimationFrame(render);
      }
    };
    new MutationObserver(onThemeChange).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-bs-theme", "class"]
    });
    new MutationObserver(onThemeChange).observe(document.body, {
      attributes: true, attributeFilter: ["class"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();