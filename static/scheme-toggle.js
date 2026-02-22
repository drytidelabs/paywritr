(function () {
  const btns = Array.from(document.querySelectorAll('.scheme-toggle'));
  if (!btns.length) return;

  const COOKIE_NAME = 'paywritr_color_scheme';
  const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

  const SUN_SVG = `<svg class="scheme-toggle__svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>`;

  const MOON_SVG = `<svg class="scheme-toggle__svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M21 14.3A8.4 8.4 0 0 1 9.7 3a7.6 7.6 0 1 0 11.3 11.3Z"/>
  </svg>`;

  function currentScheme() {
    const v = String(document.documentElement.getAttribute('data-color-scheme') || '').toLowerCase();
    return v === 'dark' ? 'dark' : 'light';
  }

  function setScheme(scheme) {
    const v = scheme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-color-scheme', v);
    try {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(v)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
    } catch {}
  }

  function render() {
    const v = currentScheme();
    const next = v === 'dark' ? 'light' : 'dark';

    for (const btn of btns) {
      btn.innerHTML = v === 'dark' ? SUN_SVG : MOON_SVG;
      btn.setAttribute('aria-label', next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode');
    }
  }

  for (const btn of btns) {
    btn.addEventListener('click', () => {
      const next = currentScheme() === 'dark' ? 'light' : 'dark';
      setScheme(next);
      render();
    });
  }

  // Initial render based on the scheme chosen by the early head script (#72/#73).
  render();
})();
