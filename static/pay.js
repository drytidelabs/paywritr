(function () {
  const paywall = document.getElementById('paywall');
  if (!paywall) return;

  const slug = paywall.dataset.slug;
  const price = Number(paywall.dataset.price || 0);

  const btn = document.getElementById('unlockBtn');
  const invoiceBox = document.getElementById('invoice');
  const bolt11El = document.getElementById('bolt11');
  const statusEl = document.getElementById('status');
  const qrEl = document.getElementById('qrcode');

  let pollTimer = null;
  let pollInFlight = false;
  let pollStartedAt = 0;

  async function createInvoice() {
    const r = await fetch(`/api/invoice?slug=${encodeURIComponent(slug)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data;
  }

  async function checkPaid(payment_hash, state) {
    const r = await fetch(
      `/api/invoice/status?payment_hash=${encodeURIComponent(payment_hash)}&state=${encodeURIComponent(state)}`,
      { credentials: 'same-origin' }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data.paid === true;
  }

  function setStatus(txt) {
    statusEl.textContent = txt;
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    pollInFlight = false;
  }

  function startPolling(inv) {
    stopPolling();
    pollStartedAt = Date.now();

    const MAX_POLL_MS = 15 * 60 * 1000; // keep in sync with server-side state exp

    const tick = async () => {
      pollTimer = setTimeout(tick, 2000);
      if (pollInFlight) return;
      if (Date.now() - pollStartedAt > MAX_POLL_MS) {
        stopPolling();
        setStatus('Invoice expired. Please create a new invoice.');
        btn.disabled = false;
        return;
      }

      pollInFlight = true;
      try {
        const paid = await checkPaid(inv.payment_hash, inv.state);
        if (paid) {
          stopPolling();
          setStatus('Paid. Reloading…');
          window.location.reload();
          return;
        }
      } catch (e) {
        // transient errors happen; keep polling quietly
      } finally {
        pollInFlight = false;
      }
    };

    tick();
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Creating invoice…';
    try {
      const inv = await createInvoice();
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

      setStatus('Waiting for payment…');
      startPolling(inv);

      btn.textContent = `Unlock for ${price} sats`;
    } catch (e) {
      stopPolling();
      btn.disabled = false;
      btn.textContent = `Unlock for ${price} sats`;
      alert(e.message);
    }
  });
})();
