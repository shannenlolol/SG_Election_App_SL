(function () {
  let lastSent = 0;
  let scheduled = false;

  function getContentHeight() {
    const body = document.body;
    const html = document.documentElement;

    // Use max of a few candidates (covers Dash quirks)
    const h = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      html ? html.scrollHeight : 0,
      html ? html.offsetHeight : 0
    );

    return Math.ceil(h);
  }

  function postHeight() {
    scheduled = false;

    const height = getContentHeight();

    // Ignore tiny changes (prevents 1–2px oscillation loops)
    if (Math.abs(height - lastSent) <= 2) {
      return;
    }

    lastSent = height;

    // In local dev, easiest is "*" (or set to your exact origin if you prefer)
    window.parent.postMessage({ type: "DASH_HEIGHT", height: height }, "*");
  }

  function schedulePost() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(postHeight);
  }

  window.addEventListener("load", schedulePost);
  window.addEventListener("resize", schedulePost);

  // Prefer ResizeObserver (much more stable than MutationObserver)
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(schedulePost);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
  } else {
    // Fallback: poll gently
    setInterval(schedulePost, 300);
  }
})();
