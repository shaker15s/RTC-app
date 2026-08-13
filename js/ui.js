/* Shared UI primitives */
(function (w) {
  var esc = w.RTCSec.esc;
  var safeColor = w.RTCSec.safeColor;
  var safeIcon = w.RTCSec.safeIcon;
  var haptic = w.RTCSec.haptic;
  var t = function (k) { return w.RTCi18n ? w.RTCi18n.t(k) : k; };

  function toast(msg, type, icon) {
    type = type || 'info';
    var ct = document.getElementById('toast-ct');
    if (!ct) return;
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    var ic = icon || (type === 'ok' ? 'ph-check-circle' : type === 'err' ? 'ph-x-circle' : type === 'warn' ? 'ph-warning' : 'ph-info');
    el.innerHTML = '<i class="ph-fill ' + esc(ic) + '"></i><span>' + esc(msg) + '</span>';
    ct.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .35s, transform .35s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(function () { el.remove(); }, 350);
    }, 3400);
  }

  function activateDialog(bg, close, label) {
    var sheet = bg.querySelector('.modal-sheet');
    var previous = document.activeElement;
    if (sheet) {
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      if (label) sheet.setAttribute('aria-label', label);
      sheet.setAttribute('tabindex', '-1');
    }
    function focusables() {
      return Array.prototype.slice.call(bg.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(function (el) { return !el.disabled && !el.classList.contains('hidden'); });
    }
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) { event.preventDefault(); if (sheet) sheet.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    bg.addEventListener('keydown', keydown);
    requestAnimationFrame(function () {
      var items = focusables();
      if (items[0]) items[0].focus(); else if (sheet) sheet.focus();
    });
    return function restoreFocus() {
      bg.removeEventListener('keydown', keydown);
      if (previous && document.body.contains(previous) && previous.focus) previous.focus();
    };
  }

  function showConfirm(title, msg, onYes, opts) {
    opts = opts || {};
    var old = document.getElementById('dyn-confirm');
    if (old) old.remove();
    var bg = document.createElement('div');
    bg.id = 'dyn-confirm';
    bg.className = 'modal-bg';
    bg.innerHTML =
      '<div class="modal-sheet" style="text-align:center;padding-top:6px">' +
        '<div class="modal-handle"></div>' +
        '<div class="sheet-icon-warn"><i class="ph-fill ph-warning"></i></div>' +
        '<h3 class="text-base font-extrabold mb-1.5">' + esc(title) + '</h3>' +
        '<p class="text-xs text-muted mb-5 leading-relaxed">' + esc(msg) + '</p>' +
        '<div class="flex gap-2.5">' +
          '<button class="btn btn-soft btn-mid" style="flex:1" id="dc-cancel">' + esc(opts.noLabel || t('cancel')) + '</button>' +
          '<button class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + ' btn-mid" style="flex:1" id="dc-yes">' + esc(opts.yesLabel || t('confirm')) + '</button>' +
        '</div></div>';
    document.getElementById('app').appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('open'); });
    var restore = function () {};
    var close = function () {
      bg.classList.remove('open');
      restore();
      setTimeout(function () { bg.remove(); }, 280);
    };
    restore = activateDialog(bg, close, title);
    bg.querySelector('#dc-cancel').onclick = close;
    bg.querySelector('#dc-yes').onclick = function () { close(); haptic(18); if (onYes) onYes(); };
    bg.onclick = function (e) { if (e.target === bg) close(); };
  }

  function openSheet(html, id) {
    id = id || 'dyn-sheet';
    var old = document.getElementById(id);
    if (old) old.remove();
    var bg = document.createElement('div');
    bg.id = id;
    bg.className = 'modal-bg';
    bg.innerHTML = html;
    document.getElementById('app').appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('open'); });
    var restore = function () {};
    var close = function () {
      bg.classList.remove('open');
      restore();
      setTimeout(function () { bg.remove(); }, 280);
    };
    var heading = bg.querySelector('h1, h2, h3');
    restore = activateDialog(bg, close, heading ? heading.textContent : 'نافذة');
    bg.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
    bg.onclick = function (e) { if (e.target === bg) close(); };
    return { bg: bg, close: close };
  }

  function openPicker(opts) {
    var items = opts.items || [];
    var html =
      '<div class="modal-sheet" style="max-height:85vh;display:flex;flex-direction:column;padding-top:10px">' +
        '<div class="modal-handle"></div>' +
        '<div class="flex items-center justify-between mb-2 pb-2 border-b border-line">' +
          '<div><h3 class="text-base font-bold flex items-center gap-2"><i class="ph-duotone ph-list-dashes text-primary text-xl"></i><span>' + esc(opts.title) + '</span></h3>' +
          (opts.subtitle ? '<p class="text-xs text-muted mt-0.5">' + esc(opts.subtitle) + '</p>' : '') + '</div>' +
          '<button class="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center" data-close><i class="ph-bold ph-x"></i></button>' +
        '</div>' +
        (items.length > 5 ? '<div class="relative my-2"><i class="ph-bold ph-magnifying-glass absolute right-3 top-3 text-muted text-sm"></i><input type="text" id="csp-search" placeholder="…" class="inp pr-9 text-xs py-2 w-full"></div>' : '') +
        '<div class="overflow-y-auto flex-1 space-y-2 py-2" id="csp-list">' +
          items.map(function (item) {
            var on = item.value === opts.currentVal;
            return '<div class="csp-item p-3.5 rounded-xl border border-line bg-card flex items-center justify-between ' + (on ? 'border-primary' : '') + '" data-value="' + esc(item.value) + '" data-label="' + esc(item.label) + '">' +
              '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl ' + (on ? 'bg-primary text-white' : 'bg-primary/10 text-primary') + ' flex items-center justify-center text-lg"><i class="ph-duotone ' + esc(item.icon || 'ph-map-pin') + '"></i></div>' +
              '<div><div class="text-sm font-bold">' + esc(item.label) + (item.badge ? ' <span class="badge-mini">' + esc(item.badge) + '</span>' : '') + '</div>' +
              (item.sub ? '<div class="text-xs text-muted mt-0.5">' + esc(item.sub) + '</div>' : '') + '</div></div>' +
              (on ? '<i class="ph-fill ph-check-circle text-primary text-xl"></i>' : '<i class="ph-bold ph-caret-left text-muted"></i>') +
            '</div>';
          }).join('') +
        '</div></div>';
    var sheet = openSheet(html, 'custom-select-picker');
    var search = sheet.bg.querySelector('#csp-search');
    if (search) {
      search.oninput = function () {
        var q = search.value.trim().toLowerCase();
        sheet.bg.querySelectorAll('.csp-item').forEach(function (el) {
          el.style.display = el.textContent.toLowerCase().indexOf(q) !== -1 ? 'flex' : 'none';
        });
      };
    }
    sheet.bg.querySelectorAll('.csp-item').forEach(function (el) {
      el.onclick = function () {
        haptic(10);
        if (opts.onSelect) opts.onSelect(el.getAttribute('data-value'), el.getAttribute('data-label'));
        sheet.close();
      };
    });
  }

  function emptyState(icon, title, sub, btnLabel, btnFnName) {
    return '<div class="empty-wrap">' +
      '<i class="ph-duotone ' + esc(icon) + '" style="font-size:46px;color:var(--mut)"></i>' +
      '<div class="font-bold text-sm">' + esc(title) + '</div>' +
      '<div class="text-xs" style="color:var(--mut)">' + esc(sub || '') + '</div>' +
      (btnLabel ? '<button class="btn btn-primary btn-sm mt-2" onclick="' + esc(btnFnName) + '">' + esc(btnLabel) + '</button>' : '') +
    '</div>';
  }

  function skeleton(n) {
    n = n || 3;
    var row = '<div class="card p-4 mb-2 skel-card"><div class="skel skel-av"></div><div class="flex-1"><div class="skel skel-l"></div><div class="skel skel-s"></div></div></div>';
    return Array.from({ length: n }, function () { return row; }).join('');
  }

  function initialsOf(name) {
    if (!name) return '؟';
    return String(name).trim().split(/\s+/)[0].charAt(0) || '؟';
  }

  function avatarHTML(profile) {
    if (profile && profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)) {
      return '<img src="' + esc(profile.avatar_url) + '" alt="" onerror="this.remove()">';
    }
    return esc(initialsOf(profile && profile.full_name));
  }

  function fireConfetti(count) {
    if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    count = count || 56;
    var canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    var ctx = canvas.getContext('2d');
    canvas.width = w.innerWidth;
    canvas.height = w.innerHeight;
    var clrs = ['#00288e', '#00554e', '#89f5e7', '#d4af37', '#ba1a1a', '#7a30d8'];
    var particles = Array.from({ length: count }, function () {
      return {
        x: canvas.width / 2, y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.7) * 14,
        size: Math.random() * 8 + 4, color: clrs[Math.floor(Math.random() * clrs.length)],
        rotation: Math.random() * 360, rSpeed: (Math.random() - 0.5) * 8, alpha: 1
      };
    });
    var t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var alive = false;
      particles.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rotation += p.rSpeed; p.alpha -= 0.015;
        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });
      if (alive && now - t0 < 2200) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
    })(t0);
  }

  function setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val == null ? '' : String(val);
  }

  function humanError(e) {
    var m = (e && (e.message || e.error_description || e.hint)) || String(e || '');
    var code = String((e && e.code) || '');
    if (/^23505$/.test(code) || /duplicate key/i.test(m)) {
      if (/phone|موبايل|هاتف/i.test(m)) return 'رقم الموبايل ده مربوط بحساب تاني. سجّل دخولك بحساب Google الأصلي أو تواصل مع المشرف.';
      return 'البيانات دي مسجلة من قبل — راجع المدخلات وحاول تاني.';
    }
    if (/^PGRST116$/i.test(code) || /multiple \(or no\) rows/i.test(m) || /profile-missing/i.test(m)) {
      return 'تعذّر تحديث ملفك — جرّب مرة أخرى، ولو استمرت المشكلة امسح التخزين من شاشة الدخول وسجّل من جديد.';
    }
    if (/account inactive/i.test(m)) return 'تم إيقاف الحساب. تواصل مع المشرف.';
    if (/auth required|JWT/i.test(m)) return t('needLogin');
    if (/permission|policy|row-level|غير مسموح|صلاحية/i.test(m)) return 'ليست لديك صلاحية لهذا الإجراء';
    if (/network|Failed to fetch|Load failed/i.test(m)) return 'تعذّر الاتصال. تحقق من الإنترنت.';
    return m || 'حدث خطأ غير متوقع';
  }

  w.RTCUI = {
    toast: toast, showConfirm: showConfirm, openSheet: openSheet, openPicker: openPicker,
    emptyState: emptyState, skeleton: skeleton, avatarHTML: avatarHTML, initialsOf: initialsOf,
    fireConfetti: fireConfetti, setEl: setEl, humanError: humanError, esc: esc,
    safeColor: safeColor, safeIcon: safeIcon
  };
})(window);
