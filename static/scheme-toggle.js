(function () {
  const btn = document.getElementById('schemeToggle');
  if (!btn) return;

  const COOKIE_NAME = 'paywritr_color_scheme';
  const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

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
    btn.textContent = v === 'dark' ? 'Dark' : 'Light';
    btn.setAttribute('aria-pressed', v === 'dark' ? 'true' : 'false');
  }

  btn.addEventListener('click', () => {
    const next = currentScheme() === 'dark' ? 'light' : 'dark';
    setScheme(next);
    render();
  });

  // Initial render based on the scheme chosen by the early head script (#72/#73).
  render();
})();
