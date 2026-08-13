/* Public certificate verification — no session and no unmasked PII. */
(function () {
  'use strict';
  var client = null;
  var input = document.getElementById('serial');
  var button = document.getElementById('go');
  var output = document.getElementById('out');
  var query = new URLSearchParams(location.search).get('s');
  if (query) input.value = query.slice(0, 80);

  function result(kind, lines) {
    output.replaceChildren();
    var box = document.createElement('div');
    box.className = 'result ' + kind;
    lines.forEach(function (line, index) {
      var el = index === 0 ? document.createElement('b') : document.createElement('div');
      el.textContent = line;
      box.appendChild(el);
    });
    output.appendChild(box);
  }

  async function run() {
    var code = String(input.value || '').trim().toUpperCase();
    if (!/^RTC-[A-Z0-9-]{6,76}$/.test(code)) {
      result('bad', ['أدخل رقمًا تسلسليًا صحيحًا يبدأ بـ RTC-']); return;
    }
    button.disabled = true;
    button.textContent = 'جارٍ التحقق…';
    output.textContent = '';
    try {
      if (!client) client = window.supabase.createClient(RTC_CONFIG.supabaseUrl, RTC_CONFIG.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      var response = await client.rpc('verify_certificate', { p_serial: code });
      if (response.error) throw response.error;
      if (response.data && response.data.length && response.data[0].is_valid) {
        var value = response.data[0];
        var date = new Date(value.issued_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        result('ok', ['شهادة موثّقة ✓', 'صاحب الشهادة: ' + value.student_name, 'الدورة: ' + value.course_title, 'تاريخ الإصدار: ' + date, 'الرقم: ' + value.serial]);
      } else result('bad', ['الشهادة غير موجودة', 'راجع الرقم كما هو مطبوع أو تواصل مع إدارة الفرع.']);
    } catch (error) {
      result('bad', ['تعذّر الاتصال بخدمة التحقق', 'تحقق من الإنترنت وحاول بعد قليل.']);
    } finally {
      button.disabled = false;
      button.textContent = 'تحقق الآن';
    }
  }

  button.addEventListener('click', run);
  input.addEventListener('keydown', function (event) { if (event.key === 'Enter') run(); });
  if (query) run();
})();
