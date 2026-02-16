(function () {
  const paywall = document.getElementById('paywall');
  if (!paywall) return;

  const slug = paywall.dataset.slug;
  const price = Number(paywall.dataset.price || 0);

  const statusEl = document.getElementById('status');
  const statusHelpEl = document.getElementById('statusHelp');

  const getInvoiceBtn = document.getElementById('getInvoiceBtn');
  const newInvoiceBtn = document.getElementById('newInvoiceBtn');

  const invoiceBox = document.getElementById('invoice');
  const bolt11El = document.getElementById('bolt11');
  const copyInvoiceBtn = document.getElementById('copyInvoiceBtn');
  const refreshStatusBtn = document.getElementById('refreshStatusBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const qrEl = document.getElementById('qrcode');

  let pollTimer = null;
  let pollInFlight = false;
  let pollStartedAt = 0;
  let currentInvoice = null;
  let consecutiveErrors = 0;

  const MAX_POLL_MS = 15 * 60 * 1000; // keep in sync with server-side state exp
  const JUST_PAID_MS = 5 * 60 * 1000;
  const paidKey = `paywritr:lastPaid:${slug}`;

  async function createInvoice() {
    const r = await fetch(`/api/invoice?slug=${encodeURIComponent(slug)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not create an invoice.');
    return data;
  }

  async function checkPaid(payment_hash, state) {
    const r = await fetch(
      `/api/invoice/status?payment_hash=${encodeURIComponent(payment_hash)}&state=${encodeURIComponent(state)}`,
      { credentials: 'same-origin' }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not check payment status.');
    return data.paid === true;
  }

  function setStatus(txt, help) {
    statusEl.textContent = txt || '';
    if (typeof help === 'string') statusHelpEl.textContent = help;
  }

  function setButtons({ canGetInvoice, canNewInvoice, canRefresh }) {
    getInvoiceBtn.disabled = !canGetInvoice;
    newInvoiceBtn.hidden = !canNewInvoice;
    newInvoiceBtn.disabled = !canNewInvoice;
    refreshStatusBtn.disabled = !canRefresh;
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    pollInFlight = false;
  }

  function showIntro() {
    invoiceBox.hidden = true;
    setStatus('To continue, pay once via Lightning.', 'After payment, this page unlocks automatically on this device.');
    setButtons({ canGetInvoice: true, canNewInvoice: false, canRefresh: false });
  }

  function showInvoice(inv) {
    invoiceBox.hidden = false;
    bolt11El.textContent = inv.payment_request;
    qrEl.innerHTML = '';
    // qrcode.js global
    new QRCode(qrEl, {
      text: inv.payment_request,
      width: 180,
      height: 180,
      correctLevel: QRCode.CorrectLevel.M,
    });

    setStatus('Scan to pay or copy the invoice.', 'Keep this tab open until payment completes.');
    setButtons({ canGetInvoice: false, canNewInvoice: true, canRefresh: true });
  }

  function markPaidAndReload(inv) {
    try {
      sessionStorage.setItem(paidKey, JSON.stringify({ payment_hash: inv.payment_hash, state: inv.state, ts: Date.now() }));
    } catch {}
    setStatus('Payment confirmed. Unlocking…', 'One moment.');
    window.location.reload();
  }

  async function tickOnce() {
    if (!currentInvoice) return;

    if (Date.now() - pollStartedAt > MAX_POLL_MS) {
      stopPolling();
      setStatus('This invoice expired.', 'Generate a new invoice to try again.');
      setButtons({ canGetInvoice: false, canNewInvoice: true, canRefresh: false });
      return;
    }

    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const paid = await checkPaid(currentInvoice.payment_hash, currentInvoice.state);
      consecutiveErrors = 0;
      if (paid) {
        stopPolling();
        markPaidAndReload(currentInvoice);
        return;
      }
      setStatus('Waiting for payment…', 'If you paid in your wallet, we’ll unlock as soon as it confirms.');
    } catch {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) {
        setStatus('Still waiting for confirmation.', 'If your wallet shows the payment as sent, try “Refresh status” or wait a moment.');
      }
    } finally {
      pollInFlight = false;
    }
  }

  function startPolling(inv) {
    stopPolling();
    pollStartedAt = Date.now();
    currentInvoice = inv;
    consecutiveErrors = 0;

    const loop = async () => {
      pollTimer = setTimeout(loop, 2000);
      await tickOnce();
    };

    loop();
  }

  async function createAndShowInvoice() {
    setButtons({ canGetInvoice: false, canNewInvoice: false, canRefresh: false });
    setStatus('Generating invoice…', 'This usually takes a few seconds.');
    try {
      const inv = await createInvoice();
      showInvoice(inv);
      startPolling(inv);
      return;
    } catch (e) {
      stopPolling();
      currentInvoice = null;
      invoiceBox.hidden = true;
      setStatus('Couldn’t create an invoice.', 'Please check your connection and try again in a moment.');
      setButtons({ canGetInvoice: true, canNewInvoice: false, canRefresh: false });
    }
  }

  getInvoiceBtn.addEventListener('click', createAndShowInvoice);
  newInvoiceBtn.addEventListener('click', () => {
    stopPolling();
    currentInvoice = null;
    createAndShowInvoice();
  });

  refreshStatusBtn.addEventListener('click', async () => {
    await tickOnce();
  });

  reloadBtn.addEventListener('click', () => window.location.reload());

  copyInvoiceBtn.addEventListener('click', async () => {
    const txt = bolt11El.textContent || '';
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      setStatus('Invoice copied.', statusHelpEl.textContent);
    } catch {
      // ignore
    }
  });

  // If we just observed a payment and reloaded but are still paywalled,
  // it likely means the browser blocked the unlock cookie.
  (async () => {
    try {
      const raw = sessionStorage.getItem(paidKey);
      if (!raw) {
        showIntro();
        return;
      }
      const data = JSON.parse(raw);
      if (!data || !data.payment_hash || !data.state || !data.ts) {
        sessionStorage.removeItem(paidKey);
        showIntro();
        return;
      }
      if (Date.now() - Number(data.ts) > JUST_PAID_MS) {
        sessionStorage.removeItem(paidKey);
        showIntro();
        return;
      }

      // Re-check status; if it is paid but still locked, guide user about cookies.
      const paid = await checkPaid(String(data.payment_hash), String(data.state));
      if (paid) {
        setStatus(
          'Payment confirmed, but we couldn’t save your unlock.',
          'Your browser may be blocking cookies for this site. Enable cookies, then reload.'
        );
        setButtons({ canGetInvoice: false, canNewInvoice: false, canRefresh: true });
        invoiceBox.hidden = true;
        return;
      }

      sessionStorage.removeItem(paidKey);
      showIntro();
    } catch {
      showIntro();
    }
  })();
})();
