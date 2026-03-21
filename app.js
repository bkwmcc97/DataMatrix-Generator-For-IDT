(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const lotTypeEl      = document.getElementById('lotType');
  const expiryEl       = document.getElementById('expiryManual');
  const lotNumberEl    = document.getElementById('lotNumber');
  const variableEl     = document.getElementById('variableData');
  const generateBtn    = document.getElementById('generateBtn');
  const copyBtn        = document.getElementById('copyBtn');
  const downloadBtn    = document.getElementById('downloadBtn');
  const resetBtn       = document.getElementById('resetBtn');
  const outputSection  = document.getElementById('outputSection');
  const payloadDisplay = document.getElementById('payloadDisplay');
  const barcodeCanvas  = document.getElementById('barcode');

  // GS1 FNC1 separator byte
  const FNC1 = String.fromCharCode(29);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Build the GS1 DataMatrix payload.
   * @param {string} lot      AI 240 value
   * @param {string} exp      6-char YYMMDD string
   * @param {string} lotNo    AI 10 value
   * @param {string} varData  AI 21 value (optional)
   * @param {'human'|'machine'} mode
   */
  function buildPayload(lot, exp, lotNo, varData, mode) {
    const sep = mode === 'machine' ? FNC1 : '[F1]';
    return '240' + lot + sep +
           '17'  + exp +
           '10'  + lotNo + sep +
           '21'  + (varData || '');
  }

  /** Highlight the AI identifiers in the payload for display */
  function highlightPayload(str) {
    // Replace known AI prefixes with styled spans (human mode)
    return str
      .replace(/^(240)/,    '<span class="ai">$1</span>')
      .replace(/(\[F1\])/g, '<span class="sep">$1</span>')
      .replace(/(17)(\d{6})/, '<span class="ai">$1</span>$2')
      .replace(/(10)([^\[]+?)(\[F1\]|21)/, '<span class="ai">$1</span>$2$3')
      .replace(/(21)(.*)$/,  '<span class="ai">$1</span>$2');
  }

  /** Render DataMatrix barcode onto the canvas using bwip-js */
  function renderBarcode(data) {
    try {
      bwipjs.toCanvas(barcodeCanvas, {
        bcid:        'datamatrix',
        text:        data,
        scale:       4,
        includetext: false,
        parsefnc:    true,
      });
    } catch (err) {
      console.error('bwip-js render error:', err);
    }
  }

  /** Show a small toast message */
  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // ── Payload display style injection ──────────────────────────────────────
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .payload-display .ai  { color: #f97316; font-weight: 500; }
    .payload-display .sep { color: #6b6b78; }
  `;
  document.head.appendChild(styleTag);

  // ── Event: Generate ───────────────────────────────────────────────────────
  generateBtn.addEventListener('click', function () {
    const mode    = document.querySelector("input[name='mode']:checked").value;
    const exp     = expiryEl.value.trim();
    const lot     = lotTypeEl.value.trim();
    const lotNo   = lotNumberEl.value.trim();
    const varData = variableEl.value.trim();

    // Validation
    if (!exp || exp.length !== 6 || !/^\d{6}$/.test(exp)) {
      shake(expiryEl);
      showToast('Expiry must be exactly 6 digits (YYMMDD)');
      return;
    }
    if (!lot) {
      shake(lotTypeEl);
      showToast('Lot type is required');
      return;
    }
    if (!lotNo) {
      shake(lotNumberEl);
      showToast('Lot number is required');
      return;
    }

    const humanPayload   = buildPayload(lot, exp, lotNo, varData, 'human');
    const machinePayload = buildPayload(lot, exp, lotNo, varData, 'machine');

    // Display with syntax highlights
    payloadDisplay.innerHTML = highlightPayload(
      mode === 'human' ? humanPayload : machinePayload
    );

    // Always render barcode with real GS1 FNC1 bytes
    renderBarcode(machinePayload);

    // Show output section
    outputSection.classList.remove('hidden');
    setTimeout(() => {
      outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  });

  // ── Event: Copy ───────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', function () {
    const text = payloadDisplay.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  });

  // ── Event: Download ───────────────────────────────────────────────────────
  downloadBtn.addEventListener('click', function () {
    const text = payloadDisplay.textContent;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'datamatrix_payload.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('File downloaded');
  });

  // ── Event: Reset ──────────────────────────────────────────────────────────
  resetBtn.addEventListener('click', function () {
    lotTypeEl.value   = '';
    expiryEl.value    = '';
    lotNumberEl.value = '';
    variableEl.value  = '';
    payloadDisplay.innerHTML = '';
    outputSection.classList.add('hidden');
    const ctx = barcodeCanvas.getContext('2d');
    ctx.clearRect(0, 0, barcodeCanvas.width, barcodeCanvas.height);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Shake animation for invalid fields ───────────────────────────────────
  function shake(el) {
    el.style.transition = 'transform 0.05s ease, border-color 0.15s ease';
    el.style.borderColor = '#ef4444';
    const steps = [6, -6, 5, -5, 3, -3, 0];
    let i = 0;
    const next = () => {
      if (i >= steps.length) {
        el.style.transform = '';
        setTimeout(() => { el.style.borderColor = ''; }, 1000);
        return;
      }
      el.style.transform = `translateX(${steps[i]}px)`;
      i++;
      setTimeout(next, 55);
    };
    next();
    el.focus();
  }

  // ── Allow only digits in expiry field ────────────────────────────────────
  expiryEl.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
  });

})();
