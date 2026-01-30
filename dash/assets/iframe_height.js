(function () {
  // Set this to your React origin (port matters)
  const PARENT_ORIGIN = "http://localhost:5173";

  function getDocHeight() {
    const body = document.body;
    const html = document.documentElement;

    if (!body || !html) return 0;

    return Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.scrollHeight,
      html.offsetHeight
    );
  }

  let lastSent = 0;
  let timerId = null;

  function sendHeight() {
    const h = getDocHeight();
    if (!Number.isFinite(h) || h <= 0) return;

    // ignore tiny diffs
    if (Math.abs(lastSent - h) <= 2) return;

    lastSent = h;
    window.parent.postMessage({ type: "DASH_HEIGHT", height: h }, PARENT_ORIGIN);
  }

  function scheduleSend(delayMs) {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(sendHeight, delayMs);
  }

  // Initial sends (Dash/Plotly often grows after first paint)
  window.addEventListener("load", function () {
    sendHeight();
    scheduleSend(100);
    scheduleSend(300);
    scheduleSend(800);
    scheduleSend(1500);
  });

  window.addEventListener("resize", function () {
    scheduleSend(80);
  });

  // Observe DOM size changes (table expand/collapse, graphs, tabs)
  try {
    const ro = new ResizeObserver(function () {
      scheduleSend(60);
    });

    ro.observe(document.documentElement);
    if (document.body) {
      ro.observe(document.body);
    }
  } catch (e) {
    // ResizeObserver not available; fallback to periodic checks
    setInterval(sendHeight, 500);
  }

  // Parent can request height explicitly
  window.addEventListener("message", function (e) {
    if (!e || !e.data) return;
    if (e.data.type !== "DASH_HEIGHT_REQUEST") return;

    sendHeight();
    scheduleSend(150);
  });
})();
    