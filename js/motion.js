/* ═══════════════════════════════════════════════════════════════════
   RTC v100 — Motion layer
   ───────────────────────────────────────────────────────────────────
   حركة بمستوى التطبيقات الأصلية: ضغطة + ripple، أزرار بحالة عمل،
   طيران الكارت بعد الانضمام، ظهور متتابع للقوائم، تلميحات أول مرة،
   وسحب للتحديث. كل شيء يحترم prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  var D = document;
  var PRESSABLE = '.btn, .icon-btn, .chip, .nav-btn, .roster-chk, .c-card, .row-item, .pick-c, .feat-item';

  function reduced() {
    try { return w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function tap(style) {
    try {
      if (w.RTCNative && w.RTCNative.haptic) { w.RTCNative.haptic(style || 'light'); return; }
    } catch (e) {}
    try { if (w.navigator && w.navigator.vibrate) w.navigator.vibrate(9); } catch (e2) {}
  }

  function buzz(type) {
    try {
      if (w.RTCNative && w.RTCNative.notify) { w.RTCNative.notify(type || 'SUCCESS'); return; }
    } catch (e) {}
    try { if (w.navigator && w.navigator.vibrate) w.navigator.vibrate([20, 55, 20]); } catch (e2) {}
  }

  /* ═══════════ 1) Press + ripple ═══════════ */
  function ripple(el, x, y) {
    if (reduced()) return;
    if (el.getAttribute('data-no-ripple') === '1') return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var size = Math.max(r.width, r.height) * 1.15;
    var span = D.createElement('span');
    span.className = 'rtc-ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = ((x - r.left) - size / 2) + 'px';
    span.style.top = ((y - r.top) - size / 2) + 'px';
    var cs = w.getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    if (cs.overflow === 'visible') el.style.overflow = 'hidden';
    el.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 620);
  }

  var _bound = false;
  function bindPress() {
    if (_bound) return;
    _bound = true;

    D.addEventListener('pointerdown', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest(PRESSABLE) : null;
      if (!el || el.disabled) return;
      el.classList.add('is-pressed');
      ripple(el, ev.clientX, ev.clientY);
      tap(el.classList.contains('nav-btn') ? 'light' : 'light');
    }, { passive: true });

    var clear = function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest(PRESSABLE) : null;
      if (el) el.classList.remove('is-pressed');
      D.querySelectorAll('.is-pressed').forEach(function (n) { n.classList.remove('is-pressed'); });
    };
    D.addEventListener('pointerup', clear, { passive: true });
    D.addEventListener('pointercancel', clear, { passive: true });
    D.addEventListener('pointerleave', clear, { passive: true });
  }

  /* ═══════════ 2) withButton ═══════════ */
  /* يحوّل الزر إلى: سبينر أثناء العمل → علامة ✓ عند النجاح
     → اهتزاز خطأ + رجوع للحالة الأصلية عند الفشل. */
  function withButton(el, fn, okLabel) {
    var btn = typeof el === 'string' ? D.getElementById(el) : el;
    var run = function () { return Promise.resolve(typeof fn === 'function' ? fn() : undefined); };
    if (!btn) return run();
    if (btn.getAttribute('data-busy') === '1') return Promise.resolve();

    var original = btn.innerHTML;
    var wasDisabled = !!btn.disabled;
    btn.setAttribute('data-busy', '1');
    btn.disabled = true;
    btn.classList.add('is-busy');
    btn.innerHTML = '<i class="ph-duotone ph-spinner spin"></i><span>' + (btn.getAttribute('data-busy-label') || 'جارٍ التنفيذ…') + '</span>';

    var restore = function () {
      btn.innerHTML = original;
      btn.disabled = wasDisabled;
      btn.classList.remove('is-busy', 'is-ok', 'is-err');
      btn.removeAttribute('data-busy');
    };

    return run().then(function (res) {
      if (res === false) { restore(); return res; }
      btn.classList.remove('is-busy');
      btn.classList.add('is-ok');
      btn.innerHTML = '<i class="ph-bold ph-check"></i><span>' + (okLabel || 'تم') + '</span>';
      buzz('SUCCESS');
      setTimeout(function () {
        if (!D.body.contains(btn)) return;
        if (btn.getAttribute('data-keep-ok') === '1') { btn.disabled = true; btn.removeAttribute('data-busy'); return; }
        restore();
      }, 1400);
      return res;
    }).catch(function (err) {
      btn.classList.remove('is-busy');
      btn.classList.add('is-err');
      btn.innerHTML = original;
      btn.disabled = wasDisabled;
      btn.removeAttribute('data-busy');
      buzz('ERROR');
      setTimeout(function () { btn.classList.remove('is-err'); }, 520);
      throw err;
    });
  }

  /* ═══════════ 3) flyOut ═══════════ */
  /* الكارت يطير بعد الانضمام الناجح ثم يُزال من الـ DOM. */
  function flyOut(el, done) {
    var node = typeof el === 'string' ? D.getElementById(el) : el;
    var finish = function () { if (typeof done === 'function') done(); };
    if (!node || !node.parentNode) { finish(); return; }
    if (reduced()) { node.remove(); finish(); return; }
    var h = node.offsetHeight;
    node.style.height = h + 'px';
    node.classList.add('fly-out');
    setTimeout(function () {
      node.style.height = '0px';
      node.style.marginTop = '0px';
      node.style.marginBottom = '0px';
      node.style.paddingTop = '0px';
      node.style.paddingBottom = '0px';
    }, 260);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
      finish();
    }, 640);
  }

  /* ═══════════ 4) stagger ═══════════ */
  function stagger(container, selector) {
    var host = typeof container === 'string' ? D.getElementById(container) : container;
    if (!host) return;
    if (reduced()) return;
    var items = selector ? host.querySelectorAll(selector) : host.children;
    var n = Math.min(items.length, 14);
    for (var i = 0; i < n; i++) {
      var it = items[i];
      it.classList.add('stagger-in');
      it.style.animationDelay = (i * 42) + 'ms';
      /* eslint-disable no-loop-func */
      (function (node) {
        setTimeout(function () {
          node.classList.remove('stagger-in');
          node.style.animationDelay = '';
        }, 900 + n * 42);
      })(it);
    }
  }

  /* ═══════════ 5) hint (مرة واحدة) ═══════════ */
  var HINT_KEY = 'rtc_hints_v100';

  function seenHints() {
    try { return JSON.parse(w.localStorage.getItem(HINT_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function markHint(id) {
    try {
      var s = seenHints(); s[id] = 1;
      w.localStorage.setItem(HINT_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function resetHints() {
    try { w.localStorage.removeItem(HINT_KEY); } catch (e) {}
  }

  function hint(id, message, opts) {
    if (!id || !message) return false;
    opts = opts || {};
    if (seenHints()[id]) return false;
    markHint(id);

    var host = D.getElementById('hint-ct');
    if (!host) {
      host = D.createElement('div');
      host.id = 'hint-ct';
      (D.getElementById('app') || D.body).appendChild(host);
    }
    var el = D.createElement('div');
    el.className = 'rtc-hint';
    el.innerHTML =
      '<i class="ph-fill ' + (opts.icon || 'ph-lightbulb') + '"></i>' +
      '<span>' + message + '</span>' +
      '<button class="rtc-hint-x" aria-label="إغلاق"><i class="ph-bold ph-x"></i></button>';
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });

    var kill = function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    };
    el.querySelector('.rtc-hint-x').addEventListener('click', kill);
    setTimeout(kill, opts.duration || 5200);
    return true;
  }

  /* ═══════════ 6) bindPTR — سحب للتحديث ═══════════ */
  function bindPTR(scroller, onRefresh) {
    var host = typeof scroller === 'string' ? D.getElementById(scroller) : scroller;
    if (!host || typeof onRefresh !== 'function') return;
    if (host.getAttribute('data-ptr') === '1') return;
    host.setAttribute('data-ptr', '1');

    var TRIGGER = 76, MAX = 118;
    var startY = 0, dy = 0, dragging = false, busy = false;

    var ind = D.createElement('div');
    ind.className = 'ptr-ind';
    ind.innerHTML = '<i class="ph-bold ph-arrow-clockwise"></i>';
    host.insertBefore(ind, host.firstChild);

    function setPull(v) {
      ind.style.transform = 'translateY(' + v + 'px) rotate(' + (v * 3) + 'deg)';
      ind.style.opacity = String(Math.min(1, v / TRIGGER));
      ind.classList.toggle('ready', v >= TRIGGER);
    }
    function reset() {
      ind.style.transition = 'transform .28s cubic-bezier(.16,1,.3,1), opacity .28s';
      setPull(0);
      setTimeout(function () { ind.style.transition = ''; ind.classList.remove('spinning', 'ready'); }, 300);
    }

    host.addEventListener('touchstart', function (ev) {
      if (busy || host.scrollTop > 2 || ev.touches.length !== 1) { dragging = false; return; }
      startY = ev.touches[0].clientY; dy = 0; dragging = true;
    }, { passive: true });

    host.addEventListener('touchmove', function (ev) {
      if (!dragging || busy) return;
      dy = ev.touches[0].clientY - startY;
      if (dy <= 0) { setPull(0); return; }
      if (host.scrollTop > 2) { dragging = false; setPull(0); return; }
      var pull = Math.min(MAX, dy * 0.55);
      setPull(pull);
      if (pull >= TRIGGER && !ind.getAttribute('data-hit')) {
        ind.setAttribute('data-hit', '1');
        tap('medium');
      }
    }, { passive: true });

    host.addEventListener('touchend', function () {
      if (!dragging || busy) { dragging = false; return; }
      dragging = false;
      ind.removeAttribute('data-hit');
      var pull = Math.min(MAX, dy * 0.55);
      if (pull < TRIGGER) { reset(); return; }
      busy = true;
      ind.classList.add('spinning');
      setPull(TRIGGER);
      Promise.resolve()
        .then(function () { return onRefresh(); })
        .catch(function () {})
        .then(function () {
          busy = false;
          reset();
        });
    }, { passive: true });
  }

  /* ═══════════ 7) delegation: data-act ═══════════ */
  /* بديل onclick داخل CSP — الزر يحمل data-act="funcName" و data-arg* */
  function initActions() {
    D.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!el) return;
      var name = el.getAttribute('data-act');
      var fn = w[name];
      if (typeof fn !== 'function') return;
      ev.preventDefault();
      var args = [];
      for (var i = 1; i <= 4; i++) {
        var v = el.getAttribute('data-arg' + i);
        if (v === null) break;
        args.push(v);
      }
      if (!args.length && el.getAttribute('data-arg') !== null) args.push(el.getAttribute('data-arg'));
      try { fn.apply(null, args.concat([el])); } catch (e) { console.warn(e); }
    });
  }

  /* ═══════════ boot ═══════════ */
  function init() {
    bindPress();
    initActions();
  }

  w.RTCMotion = {
    bindPress: bindPress,
    withButton: withButton,
    flyOut: flyOut,
    stagger: stagger,
    hint: hint,
    resetHints: resetHints,
    bindPTR: bindPTR,
    ripple: ripple,
    reduced: reduced
  };

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
