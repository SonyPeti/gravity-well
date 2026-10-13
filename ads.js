'use strict';

// ============================================================
//  GRAVITY WELL — ads
//  One place for all ad logic. The game only calls:
//    Ads.rewarded(placement) → Promise<boolean>  (true = grant the reward)
//
//  In the Android app it plays an AdMob rewarded video (@capacitor-community/admob).
//  On the website it shows a stand-in ad so the flow can still be tested.
// ============================================================

const Ads = (() => {
  const MOCK_SECONDS = 5;
  // Google's official test IDs: always safe to show. Swap in the real ones from your AdMob account before release
  // (the app ID also lives in android/app/src/main/AndroidManifest.xml).
  const AD_UNIT = 'ca-app-pub-3940256099942544/5224354917';
  const TESTING = true;
  let noAds = false;   // set when the player buys "Remove ads": rewards are granted instantly
  let busy = false;

  const AdMob = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
    && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;

  // Start the SDK early and ask for consent where the law needs it (EU/UK), then preload the first ad
  let ready = null;
  if (AdMob) {
    ready = (async () => {
      await AdMob.initialize({ initializeForTesting: TESTING });
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
      await AdMob.prepareRewardVideoAd({ adId: AD_UNIT, isTesting: TESTING });
    })().catch(() => {});
  }

  // Real rewarded video. Resolves true only if the player watched to the reward.
  async function showAdMob() {
    await ready;
    try { await AdMob.prepareRewardVideoAd({ adId: AD_UNIT, isTesting: TESTING }); } catch (e) { /* already loaded */ }
    return new Promise(resolve => {
      let earned = false, done = false;
      const finish = v => { if (done) return; done = true; listeners.forEach(l => l.then(h => h.remove())); resolve(v); };
      // The plugin only answers when a reward is earned, so also listen for the ad closing or failing
      const listeners = [
        AdMob.addListener('onRewardedVideoAdDismissed', () => setTimeout(() => finish(earned), 300)),
        AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish(false)),
      ];
      AdMob.showRewardVideoAd().then(() => { earned = true; }).catch(() => finish(false));
    }).finally(() => {
      // Load the next one in the background so it's ready next time
      AdMob.prepareRewardVideoAd({ adId: AD_UNIT, isTesting: TESTING }).catch(() => {});
    });
  }

  // Stand-in for a real rewarded video
  function showMockAd() {
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
      return await (AdMob ? showAdMob() : showMockAd(placement));
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
