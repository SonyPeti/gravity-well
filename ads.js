'use strict';

// ============================================================
//  GRAVITY WELL — ads
//  One place for all ad logic. The game only calls:
//    Ads.rewarded(placement) → Promise<boolean>  (true = grant the reward)
//
//  Right now this shows a stand-in ad so the flow can be tested.
//  When the game is wrapped as an app (Capacitor), replace showProviderAd()
//  with the AdMob rewarded-ad call (@capacitor-community/admob).
// ============================================================

const Ads = (() => {
  const MOCK_SECONDS = 5;
  let noAds = false;   // set when the player buys "Remove ads": rewards are granted instantly
  let busy = false;

  // Stand-in for a real rewarded video
  function showProviderAd() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'ad-mock';
      el.innerHTML = `
        <div class="ad-label">Advertisement</div>
        <div class="ad-box">
          <div class="ad-title">Ad placeholder</div>
          <p>A real rewarded video plays here once the game is published as an app.</p>
          <div class="ad-count"><span>${MOCK_SECONDS}</span></div>
        </div>
        <button class="ad-close" disabled>Reward in ${MOCK_SECONDS}s</button>`;
      document.body.appendChild(el);
      const btn = el.querySelector('.ad-close');
      const num = el.querySelector('.ad-count span');
      let left = MOCK_SECONDS;
      const timer = setInterval(() => {
        left--;
        num.textContent = Math.max(0, left);
        if (left > 0) { btn.textContent = `Reward in ${left}s`; return; }
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = 'Close ✕';
      }, 1000);
      btn.onclick = () => { el.remove(); resolve(true); };
    });
  }

  async function rewarded(placement) {
    if (noAds) return true;
    if (busy) return false;
    busy = true;
    // Silence game audio while the ad plays, like real ad SDKs require
    if (typeof Sound !== 'undefined') Sound.mute(true);
    try {
      return await showProviderAd(placement);
    } catch (e) {
      return false;
    } finally {
      if (typeof Sound !== 'undefined') Sound.mute(false);
      busy = false;
    }
  }

  return {
    rewarded,
    setNoAds(v) { noAds = !!v; },
    get noAds() { return noAds; },
  };
})();
