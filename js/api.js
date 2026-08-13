/* All network I/O. Sensitive writes go through RPCs. */
(function (w) {
  function sb() { return w.supabaseClient; }

  async function sbReady() {
    if (w.supabaseClient) return w.supabaseClient;
    if (w.RTCSupabase && typeof w.RTCSupabase.ensure === 'function') {
      return w.RTCSupabase.ensure();
    }
    return null;
  }

  function unwrap(res, fallback) {
    if (!res) return fallback;
    if (res.error) throw res.error;
    return res.data;
  }

  async function rpc(name, args) {
    var client = await sbReady();
    if (!client) throw new Error('تعذر الاتصال بقاعدة البيانات');
    var res = await client.rpc(name, args || {});
    return unwrap(res);
  }

  var cache = { courses: null, batches: null, branches: null, ts: 0 };
  function invalidate() { cache.courses = cache.batches = cache.branches = null; cache.ts = 0; }

  async function getSession() {
    var client = await sbReady();
    if (!client) return null;
    var res = await client.auth.getSession();
    return res.data && res.data.session;
  }

  function authRedirectUrl() {
    /* داخل التطبيق الأصلي: نرجع الـ scheme؛ على الويب: أصل الصفحة الحالي */
    if (w.RTCNative && typeof w.RTCNative.oauthRedirect === 'function') {
      var u = w.RTCNative.oauthRedirect();
      if (u) return u;
    }
    var origin = String(w.location.origin || '').replace(/\/$/, '');
    var path = w.location.pathname || '/';
    if (!path || path === '/') return origin + '/';
    return origin + path;
  }

  async function recoverHashSession() {
    var client = await sbReady();
    if (!client) return null;
    var raw = String(w.location.hash || '').replace(/^#/, '');
    if (!raw || raw.indexOf('access_token=') === -1) return null;
    var params = new URLSearchParams(raw);
    var access = params.get('access_token');
    var refresh = params.get('refresh_token') || '';
    if (!access) return null;
    var res = await client.auth.setSession({ access_token: access, refresh_token: refresh });
    try { w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) {}
    if (res.error) throw res.error;
    return res.data && res.data.session;
  }

  async function signInGoogle() {
    var client = await sbReady();
    if (!client) throw new Error('تعذّر تحميل مكتبة الدخول. تأكد من الإنترنت وجرّب تاني.');
    var redirect = authRedirectUrl();
    var res = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirect,
        skipBrowserRedirect: false,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (res.error) throw res.error;
  }

  async function signOut() {
    if (sb()) await sb().auth.signOut();
  }

  async function fetchMyProfile() {
    var session = await getSession();
    if (!session || !session.user) return null;
    var res = await sb().from('profiles')
      .select('*, branches(id, slug, name_ar, name_en, city, address, facebook_url, whatsapp, hotline)')
      .eq('id', session.user.id)
      .maybeSingle();
    if (res.error) throw res.error;
    var p = res.data;
    if (!p) return null;
    var badges = await sb().from('student_badges').select('badge_id').eq('student_id', session.user.id);
    p.badge_ids = (badges.data || []).map(function (b) { return b.badge_id; });
    p.branch_name = (p.branches && (p.branches.name_ar || p.branches.name_en)) || '';
    p.via_google = true;
    return p;
  }

  async function updateMyProfile(patch) {
    var session = await getSession();
    if (!session) throw new Error('auth required');
    var allowed = {
      full_name: patch.full_name,
      phone: patch.phone,
      branch_id: patch.branch_id,
      avatar_url: patch.avatar_url,
      lang: patch.lang,
      dark_mode: patch.dark_mode
    };
    Object.keys(allowed).forEach(function (k) { if (allowed[k] === undefined) delete allowed[k]; });
    var res = await sb().from('profiles').update(allowed).eq('id', session.user.id).select('*, branches(id, slug, name_ar, facebook_url, whatsapp, hotline, address, city)').single();
    return unwrap(res);
  }

  async function fetchBranches(force) {
    if (cache.branches && !force) return cache.branches;
    var res = await sb().from('branches').select('*').eq('is_active', true).order('sort_order');
    cache.branches = unwrap(res, []) || [];
    return cache.branches;
  }

  async function fetchCourses(force, branchId) {
    var q = sb().from('courses').select('*, branches(name_ar, slug)').eq('is_active', true).order('created_at');
    if (branchId) q = q.eq('branch_id', branchId);
    var res = await q;
    var list = unwrap(res, []) || [];
    if (!branchId) cache.courses = list;
    return list;
  }

  async function fetchBatches(force, branchId) {
    var q = sb().from('batches')
      .select('*, courses(id, title, category, icon, color, sessions_count, max_students, description, start_date, interview_date, level), branches(name_ar, slug), profiles!instructor_id(full_name)')
      .eq('is_active', true)
      .order('created_at');
    if (branchId) q = q.eq('branch_id', branchId);
    var res = await q;
    var list = unwrap(res, []) || [];
    if (!branchId) cache.batches = list;
    return list;
  }

  async function fetchMyEnrollments() {
    var session = await getSession();
    if (!session) return [];
    var res = await sb().from('enrollments')
      .select('*, batches(id, name, schedule, branch_id, sessions_done, courses(id, title, category, icon, color, sessions_count, description), branches(name_ar))')
      .eq('student_id', session.user.id)
      .order('joined_at', { ascending: false });
    return unwrap(res, []) || [];
  }

  async function fetchMyBatches() {
    var session = await getSession();
    if (!session) return [];
    var res = await sb().from('batches')
      .select('*, courses(id, title, category, icon, color, sessions_count, max_students), branches(name_ar)')
      .eq('instructor_id', session.user.id)
      .eq('is_active', true);
    return unwrap(res, []) || [];
  }

  async function fetchBatchStudents(batchId) {
    var rows = await rpc('batch_roster', { p_batch_id: batchId }) || [];
    return rows.map(function (r) {
      return {
        id: r.enrollment_id,
        student_id: r.student_id,
        sessions_done: r.sessions_done,
        profiles: {
          id: r.student_id,
          full_name: r.full_name,
          avatar_url: r.avatar_url,
          phone: r.phone,
          points: r.points,
          streak: r.streak,
          attendance_pct: r.attendance_pct
        }
      };
    });
  }

  async function fetchAllProfiles() {
    var res = await sb().from('profiles')
      .select('id, full_name, role, status, email, phone, points, branch_id, avatar_url, created_at, branches(name_ar)')
      .order('created_at', { ascending: false });
    return unwrap(res, []) || [];
  }

  async function fetchNotifications() {
    var session = await getSession();
    if (!session) return [];
    var res = await sb().from('notifications')
      .select('*').eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(50);
    return unwrap(res, []) || [];
  }

  async function markNotifRead(id) {
    await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  async function unreadCount() {
    var session = await getSession();
    if (!session) return 0;
    var res = await sb().from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id).is('read_at', null);
    return res.count || 0;
  }

  async function fetchCerts(mineOnly) {
    var q = sb().from('certs').select('*, courses(title, icon, color), profiles!student_id(full_name)').order('issued_at', { ascending: false }).limit(80);
    if (mineOnly) {
      var session = await getSession();
      if (!session) return [];
      q = q.eq('student_id', session.user.id);
    }
    return unwrap(await q, []) || [];
  }

  async function fetchLedger() {
    var session = await getSession();
    if (!session) return [];
    var res = await sb().from('points_ledger')
      .select('*, points_rules(code, title)')
      .eq('student_id', session.user.id)
      .order('created_at', { ascending: false }).limit(40);
    return unwrap(res, []) || [];
  }

  async function fetchCourseDetail(courseId) {
    var course = unwrap(await sb().from('courses').select('*, branches(name_ar, slug)').eq('id', courseId).single());
    var batches = unwrap(await sb().from('batches').select('*, profiles!instructor_id(full_name), branches(name_ar)').eq('course_id', courseId).eq('is_active', true), []) || [];
    var ratings = unwrap(await sb().from('course_ratings').select('rating, comment, created_at').eq('course_id', courseId).order('created_at', { ascending: false }).limit(8), []) || [];
    return { course: course, batches: batches, ratings: ratings };
  }

  async function fetchExcuses(asStaff) {
    var session = await getSession();
    if (!session) return [];
    var q = sb().from('excuses').select('*, batches(name), sessions(title, session_date), profiles!student_id(full_name)').order('created_at', { ascending: false });
    if (!asStaff) q = q.eq('student_id', session.user.id);
    return unwrap(await q, []) || [];
  }

  async function fetchAnalyticsBundle() {
    var client = sb();
    var pack = await Promise.all([
      client.from('profiles').select('id, full_name, role, branch_id, points, created_at, email, status'),
      client.from('courses').select('id, title, is_active').eq('is_active', true),
      client.from('batches').select('id, name, branch_id, sessions_done, schedule, is_active').eq('is_active', true),
      client.from('certs').select('id'),
      client.from('attendance').select('id, status, created_at'),
      client.from('enrollments').select('id')
    ]);
    return {
      profs: pack[0].data || [],
      courses: pack[1].data || [],
      batches: pack[2].data || [],
      certs: pack[3].data || [],
      att: pack[4].data || [],
      enroll: pack[5].data || []
    };
  }

  /* ═══ عدّاد المقاعد (بدون أي بيانات شخصية) ═══ */
  var _seatCache = {};
  async function seatCounts(batchIds) {
    var ids = (batchIds || []).filter(Boolean);
    if (!ids.length) return {};
    var out = {};
    try {
      var rows = await rpc('batch_seat_counts', { p_batch_ids: ids });
      (rows || []).forEach(function (r) {
        out[r.batch_id] = { enrolled: Number(r.enrolled) || 0, capacity: Number(r.capacity) || 0 };
      });
      _seatCache = out;
      return out;
    } catch (e) {
      /* fallback: عدّ مباشر من enrollments لو الـ RPC مش منشور بعد */
      try {
        if (!sb()) return _seatCache || {};
        var res = await sb().from('enrollments').select('batch_id').in('batch_id', ids);
        if (res.error) throw res.error;
        var counts = {};
        (res.data || []).forEach(function (r) { counts[r.batch_id] = (counts[r.batch_id] || 0) + 1; });
        ids.forEach(function (id) { out[id] = { enrolled: counts[id] || 0, capacity: 0 }; });
        return out;
      } catch (e2) { return _seatCache || {}; }
    }
  }

  async function uploadAvatar(file) {
    var session = await getSession();
    if (!session) throw new Error('auth required');
    if (!file || file.size > 1024 * 1024) throw new Error('الصورة يجب أن تكون أقل من 1 ميجا');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('صيغة الصورة غير مدعومة');
    var blob = await compressImage(file, 256);
    var path = session.user.id + '/avatar.webp';
    var up = await sb().storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/webp' });
    if (up.error) throw up.error;
    var pub = sb().storage.from('avatars').getPublicUrl(path);
    return pub.data.publicUrl + '?t=' + Date.now();
  }

  async function uploadExcuseFile(file) {
    var session = await getSession();
    if (!session) throw new Error('auth required');
    if (!file || file.size > 4 * 1024 * 1024) throw new Error('الملف أكبر من 4 ميجا');
    var ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    var path = session.user.id + '/' + Date.now() + '.' + ext;
    var up = await sb().storage.from('excuses').upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    return path;
  }

  function compressImage(file, size) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var ctx = c.getContext('2d');
        var s = Math.min(img.width, img.height);
        var sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (b) resolve(b); else reject(new Error('تعذر ضغط الصورة'));
        }, 'image/webp', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('تعذر قراءة الصورة')); };
      img.src = url;
    });
  }

  async function createCourse(payload) {
    var res = await sb().from('courses').insert(payload).select().single();
    invalidate();
    return unwrap(res);
  }

  async function updateCourse(id, payload) {
    var res = await sb().from('courses').update(payload).eq('id', id);
    if (res.error) throw res.error;
    invalidate();
  }

  async function softDeleteCourse(id) {
    var res = await sb().from('courses').update({ is_active: false }).eq('id', id);
    if (res.error) throw res.error;
    invalidate();
  }

  async function createBatch(payload) {
    var res = await sb().from('batches').insert(payload).select().single();
    invalidate();
    return unwrap(res);
  }

  async function updateBranch(id, payload) {
    if (!w.CURRENT_PROFILE || w.CURRENT_PROFILE.role !== 'admin') throw new Error('للمشرف فقط');
    // branches have SELECT for all; updates go through a privileged path —
    // admin uses the table only if we add a policy. Safer: keep facebook/whatsapp
    // edits as a dedicated RPC later. For now admin UPDATE is not granted.
    throw new Error('تعديل الفروع يتم من لوحة Supabase حالياً');
  }

  w.RTCApi = {
    rpc: rpc, invalidate: invalidate, getSession: getSession,
    signInGoogle: signInGoogle, signOut: signOut,
    recoverHashSession: recoverHashSession, authRedirectUrl: authRedirectUrl,
    seatCounts: seatCounts,
    fetchMyProfile: fetchMyProfile, updateMyProfile: updateMyProfile,
    fetchBranches: fetchBranches, fetchCourses: fetchCourses, fetchBatches: fetchBatches,
    fetchMyEnrollments: fetchMyEnrollments, fetchMyBatches: fetchMyBatches,
    fetchBatchStudents: fetchBatchStudents, fetchAllProfiles: fetchAllProfiles,
    fetchNotifications: fetchNotifications, markNotifRead: markNotifRead, unreadCount: unreadCount,
    fetchCerts: fetchCerts, fetchLedger: fetchLedger, fetchCourseDetail: fetchCourseDetail,
    fetchExcuses: fetchExcuses, fetchAnalyticsBundle: fetchAnalyticsBundle,
    uploadAvatar: uploadAvatar, uploadExcuseFile: uploadExcuseFile,
    createCourse: createCourse, updateCourse: updateCourse, softDeleteCourse: softDeleteCourse,
    createBatch: createBatch, updateBranch: updateBranch,
    joinBatch: function (id) { return rpc('join_batch', { p_batch_id: id }); },
    startSession: function (id, title) { return rpc('start_session', { p_batch_id: id, p_title: title || null }); },
    checkIn: function (code) { return rpc('student_check_in', { p_code: code }); },
    saveAttendance: function (sid, records) { return rpc('record_session_attendance', { p_session_id: sid, p_records: records }); },
    closeSession: function (sid) { return rpc('close_session', { p_session_id: sid }); },
    issueCerts: function (bid) { return rpc('issue_certificates', { p_batch_id: bid }); },
    changeRole: function (uid, role) { return rpc('change_user_role', { p_user_id: uid, p_role: role }); },
    setStatus: function (uid, status) { return rpc('set_user_status', { p_user_id: uid, p_status: status }); },
    assignInstructor: function (bid, iid) { return rpc('assign_instructor', { p_batch_id: bid, p_instructor_id: iid }); },
    verifyCert: function (serial) { return rpc('verify_certificate', { p_serial: serial }); },
    leaderboard: function () { return rpc('get_leaderboard'); },
    submitExcuse: function (a) { return rpc('submit_excuse', a); },
    reviewExcuse: function (id, status, note) { return rpc('review_excuse', { p_excuse_id: id, p_status: status, p_note: note || '' }); },
    submitReport: function (sid, summary, und, eng) { return rpc('submit_session_report', { p_session_id: sid, p_summary: summary, p_und: und, p_eng: eng }); },
    rateCourse: function (cid, rating, comment) { return rpc('submit_course_rating', { p_course_id: cid, p_rating: rating, p_comment: comment || '' }); },
    broadcast: function (scope, scopeId, type, title, message) {
      return rpc('broadcast_notice', { p_scope: scope, p_scope_id: scopeId || null, p_type: type, p_title: title, p_message: message });
    },
    addNote: function (sid, body) { return rpc('add_private_note', { p_student_id: sid, p_body: body }); },
    claimSocial: function () { return rpc('claim_social_badge'); }
  };
})(window);
