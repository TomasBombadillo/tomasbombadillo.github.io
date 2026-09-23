/* ------------------------------------------------------------------
   "Share this page": a dialog with a QR code and a copy-link button.
   QR generation uses the vendored qrcode-generator (assets/js/vendor),
   so nothing is fetched from a third-party service and it works offline.
   ------------------------------------------------------------------ */

(function () {
  const dialog    = document.getElementById('shareDialog');
  const openBtn   = document.getElementById('shareBtn');
  const closeBtn  = document.getElementById('shareClose');
  const qrImg     = document.getElementById('shareQr');
  const urlInput  = document.getElementById('shareUrl');
  const copyLink  = document.getElementById('copyLinkBtn');
  const copyQr    = document.getElementById('copyQrBtn');
  const statusEl  = document.getElementById('shareStatus');

  let qrCanvas = null;
  let statusTimer = null;

  function pageUrl() {
    if (typeof SITE_URL === 'string' && SITE_URL) return SITE_URL;
    const u = new URL(window.location.href);
    u.hash = '';
    u.search = '';
    return u.toString();
  }

  /* Draws the QR on a canvas: 10px modules + the 4-module quiet zone the
     spec requires, dark on white, so it scans from a screen or a printout. */
  function buildQrCanvas(text) {
    const qr = qrcode(0, 'M');          // type 0 = pick the smallest version that fits
    qr.addData(text);
    qr.make();

    const modules = qr.getModuleCount();
    const quiet = 4;
    const scale = 10;
    const size = (modules + quiet * 2) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#20232b';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
        }
      }
    }
    return canvas;
  }

  function setStatus(message) {
    statusEl.textContent = message;
    clearTimeout(statusTimer);
    if (message) statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }

  /* Briefly swaps a button's label for "Copied!" */
  function flash(btn) {
    const original = btn.textContent;
    btn.textContent = t('share.copied');
    btn.disabled = true;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1600);
  }

  function openDialog() {
    const url = pageUrl();
    urlInput.value = url;
    setStatus('');
    try {
      qrCanvas = buildQrCanvas(url);
      qrImg.src = qrCanvas.toDataURL('image/png');
    } catch (err) {
      console.error('QR generation failed:', err);
      qrCanvas = null;
      qrImg.removeAttribute('src');
    }
    copyQr.disabled = !qrCanvas;
    dialog.showModal();
    copyLink.focus();
  }

  async function handleCopyLink() {
    const url = urlInput.value;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        urlInput.select();
        if (!document.execCommand('copy')) throw new Error('execCommand failed');
      }
      flash(copyLink);
    } catch (err) {
      urlInput.select();
      setStatus(t('share.copyFailed'));
    }
  }

  function downloadQr() {
    const a = document.createElement('a');
    a.href = qrCanvas.toDataURL('image/png');
    a.download = 'gender-shapes-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleCopyQr() {
    if (!qrCanvas) return;
    // Passing a promise (not a finished blob) keeps Safari happy: it requires
    // the clipboard write to start synchronously inside the click.
    const canCopyImages = navigator.clipboard && window.ClipboardItem && window.isSecureContext;
    if (!canCopyImages) {
      downloadQr();
      setStatus(t('share.downloaded'));
      return;
    }
    try {
      const blob = new Promise(resolve => qrCanvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash(copyQr);
    } catch (err) {
      console.warn('Image copy failed, falling back to download:', err);
      downloadQr();
      setStatus(t('share.downloaded'));
    }
  }

  openBtn.addEventListener('click', openDialog);
  closeBtn.addEventListener('click', () => dialog.close());
  copyLink.addEventListener('click', handleCopyLink);
  copyQr.addEventListener('click', handleCopyQr);
  urlInput.addEventListener('focus', () => urlInput.select());

  // Click on the dimmed backdrop (the <dialog> element itself) closes it.
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
})();
