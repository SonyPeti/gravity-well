'use strict';

// ============================================================
//  GRAVITY WELL — store (in-app purchases)
//  Two one-time products. Nothing here sells power you can't also earn.
//
//  Where it runs:
//    'test'  localhost: a stand-in purchase sheet, no money involved, for trying the flow
//    'web'   the public website: products are shown, buying needs the app
//    'app'   the Android app: Google Play Billing will plug in here (not connected yet, so "coming soon")
//  Loaded before game.js; uses game globals (save, persist, Sound...) only at call time.
// ============================================================

const Store = (() => {
  const PRODUCTS = [
    { id: 'remove_ads', name: 'Remove Ads', price: '$3.99', emoji: '🚫',
      desc: 'Every ad reward becomes instant: Second Wind, Double Stardust and Offline ×2. No ads, ever.' },
    { id: 'supporter', name: 'Supporter Pack', price: '$2.99', art: 'skin_solar', glow: '#FFD34A',
      desc: 'The exclusive <b>Solar Crown</b> planet and <b>500 Stardust</b>. Thank you for supporting the game!' },
  ];
  const SUPPORTER_DUST = 500;

  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const mode = native ? 'app' : local ? 'test' : 'web';

  const owned = id => !!(save.purchases && save.purchases[id]);

  // Hand out what a purchase unlocks (also used by "restore purchases" later)
  function grant(id) {
    if (!save.purchases) save.purchases = {};
    if (save.purchases[id]) return;
    save.purchases[id] = true;
    if (id === 'remove_ads') { save.noAds = true; Ads.setNoAds(true); }
    if (id === 'supporter') {
      if (!save.skins.includes('solar')) save.skins.push('solar');
      save.stardust += SUPPORTER_DUST;
    }
    persist();
  }

  // Stand-in for the Play Store purchase sheet
  function testPurchase(p) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'buy-sheet-wrap';
      el.innerHTML = `
        <div class="buy-sheet">
          <div class="buy-sheet-tag">TEST PURCHASE</div>
          <div class="buy-sheet-name">${p.name}</div>
          <div class="buy-sheet-price">${p.price}</div>
          <p class="muted small">This is a test store: no money is charged. In the app, payment goes through Google Play.</p>
          <button class="btn primary" data-ok>Buy</button>
          <button class="link-btn" data-no>Cancel</button>
        </div>`;
      document.body.appendChild(el);
      const done = v => { el.remove(); resolve(v); };
      el.querySelector('[data-ok]').onclick = () => done(true);
      el.querySelector('[data-no]').onclick = () => done(false);
      el.onclick = e => { if (e.target === el) done(false); };
    });
  }

  let busy = false;
  async function buy(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || owned(id) || busy || mode !== 'test') return;
    busy = true;
    try {
      if (!(await testPurchase(p))) return;
      grant(id);
      if (typeof Sound !== 'undefined') Sound.play('fanfare');
      if (typeof toast === 'function') toast(id === 'supporter' ? `☀️ Solar Crown unlocked · +${SUPPORTER_DUST} Stardust` : '🚫 Ads removed. Thank you!');
      render();
    } finally {
      busy = false;
    }
  }

  function render() {
    const el = document.getElementById('store-body');
    if (!el) return;
    const note = { test: 'Test mode: purchases are free and only change this device.',
                   web: 'Purchases are made in the Android app.',
                   app: 'Purchases are coming soon.' }[mode];
    let html = `<p class="muted small">${note}</p>`;
    for (const p of PRODUCTS) {
      const has = owned(p.id);
      const btn = has ? '<button disabled>Owned ✓</button>'
        : mode === 'test' ? `<button data-buy="${p.id}">${p.price}</button>`
        : `<button disabled>${mode === 'web' ? 'In the app' : 'Soon'}</button>`;
      html += `
        <div class="product ${has ? 'owned' : ''}" style="--glow:${p.glow || '#3FF2E0'}">
          ${p.art ? `<img src="assets/${p.art}.png" alt="">` : `<div class="pemoji">${p.emoji}</div>`}
          <div class="minfo">
            <div class="pname">${p.name}</div>
            <div class="small pdesc">${p.desc}</div>
          </div>
          ${btn}
        </div>`;
    }
    html += '<p class="muted small">One-time purchases. No subscriptions, no loot boxes.</p>';
    el.innerHTML = html;
    el.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => buy(b.dataset.buy); });
  }

  return { PRODUCTS, owned, grant, buy, render, get mode() { return mode; } };
})();
