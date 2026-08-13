/* PWA lifecycle: install, durable storage and safe update hand-off. */
(function (w) {
  'use strict';
  var deferredInstall = null;
  var registration = null;

  function isStandalone() {
    try {
      return !!((w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || w.navigator.standalone || (w.RTCNative && w.RTCNative.isNative()));
    } catch (e) { return false; }
  }

  function exposeInstall(available) {
    document.querySelectorAll('[data-pwa-install]').forEach(function (el) {
      el.classList.toggle('hidden', !available || isStandalone());
    });
  }

  async function install() {
    if (isStandalone()) return { installed: true, reason: 'standalone' };
    if (!deferredInstall) return { installed: false, reason: 'unavailable' };
    deferredInstall.prompt();
    var choice = await deferredInstall.userChoice;
    deferredInstall = null;
    exposeInstall(false);
    return { installed: choice && choice.outcome === 'accepted', reason: choice && choice.outcome };
  }

  function offerUpdate(worker) {
    if (!worker || !w.RTCUI) return;
    w.RTCUI.showConfirm(
      'تحديث جديد جاهز',
      'نزّل النسخة الأحدث الآن بدون فقد بياناتك أو جلستك.',
      function () { worker.postMessage({ type: 'SKIP_WAITING' }); },
      { danger: false, yesLabel: 'تحديث الآن', noLabel: 'لاحقًا' }
    );
  }

  function watchRegistration(reg) {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
  }

  async function init() {
    exposeInstall(false);
    if (w.RTCNative && w.RTCNative.isNative && w.RTCNative.isNative()) return;
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
    if (!('serviceWorker' in navigator)) return;
    try {
      watchRegistration(await navigator.serviceWorker.register('./sw.js?v=100.0.0', { scope: './' }));
      navigator.serviceWorker.addEventListener('controllerchange', function () { w.location.reload(); });
      navigator.serviceWorker.addEventListener('message', function (event) {
        var data = event.data || {};
        if (data.type === 'OPEN_SCREEN' && data.screen && typeof w.push === 'function') {
          try { w.push(String(data.screen)); } catch (e) {}
        }
      });
    } catch (e) {
      console.warn('RTC: service worker registration failed');
    }
  }

  w.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstall = event;
    exposeInstall(true);
  });
  w.addEventListener('appinstalled', function () {
    deferredInstall = null;
    exposeInstall(false);
    if (w.RTCUI) w.RTCUI.toast('تم تثبيت مسار RTC بنجاح', 'ok');
  });

  w.RTCPWA = { init: init, install: install, isStandalone: isStandalone, registration: function () { return registration; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
