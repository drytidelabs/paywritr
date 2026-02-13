(function(){
  const paywall = document.getElementById('paywall');
  if(!paywall) return;

  const slug = paywall.dataset.slug;
  const price = Number(paywall.dataset.price || 0);

  const btn = document.getElementById('unlockBtn');
  const invoiceBox = document.getElementById('invoice');
  const bolt11El = document.getElementById('bolt11');
  const statusEl = document.getElementById('status');
  const qrEl = document.getElementById('qrcode');

  let polling = null;

  async function createInvoice(){
    const r = await fetch(`/api/invoice?slug=${encodeURIComponent(slug)}`);
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || 'failed');
    return data;
  }

  async function checkPaid(payment_hash, state){
    const r = await fetch(`/api/invoice/status?payment_hash=${encodeURIComponent(payment_hash)}&state=${encodeURIComponent(state)}`, { credentials: 'same-origin' });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || 'failed');
    return data.paid === true;
  }

  function setStatus(txt){ statusEl.textContent = txt; }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Creating invoice…';
    try{
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

      if(polling) clearInterval(polling);
      polling = setInterval(async () => {
        try{
          const paid = await checkPaid(inv.payment_hash, inv.state);
          if(paid){
            clearInterval(polling);
            setStatus('Paid. Reloading…');
            window.location.reload();
          }
        } catch(e){
          // keep quiet; transient errors happen
        }
      }, 2000);

      btn.textContent = `Unlock for ${price} sats`;
    } catch(e){
      btn.disabled = false;
      btn.textContent = `Unlock for ${price} sats`;
      alert(e.message);
    }
  });
})();
