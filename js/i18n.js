/* Bilingual engine — Arabic default, English on demand. */
(function (w) {
  var STR = {
    ar: {
      appName: 'مسار RTC',
      tagline: 'نتابع رحلتك خطوة بخطوة',
      org: 'جمعية رسالة — مركز التدريب والتطوير',
      googleCta: 'تسجيل الدخول باستخدام Google',
      googleHint: 'اضغط الزر لتسجيل الدخول بحساب Google',
      completeProfile: 'أكمل بياناتك للتواصل',
      fullName: 'الاسم الثلاثي / الرباعي',
      phone: 'رقم الموبايل',
      branch: 'الفرع الأقرب لك',
      saveStart: 'حفظ وبدء الاستخدام',
      home: 'الرئيسية',
      myCourses: 'كورساتي',
      points: 'النقاط',
      certs: 'شهاداتي',
      account: 'حسابي',
      groups: 'المجموعات',
      courses: 'الكورسات',
      analytics: 'التحليلات',
      users: 'المستخدمين',
      logout: 'تسجيل الخروج',
      dark: 'الوضع الليلي',
      light: 'الوضع النهاري',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      save: 'حفظ',
      loading: 'جارٍ التحميل...',
      retry: 'حاول مرة أخرى',
      offline: 'انقطع الاتصال — تعمل في وضع القراءة',
      online: 'تم استعادة الاتصال',
      noPermission: 'ليست لديك صلاحية لهذه الصفحة',
      studentOnly: 'تم تسجيلك كطالب. المشرف يمكنه ترقيتك لمتطوع عند الحاجة.',
      welcomeBack: 'أهلاً بعودتك',
      joinOk: 'تم الانضمام للمجموعة',
      waitlisted: 'المجموعة مكتملة — أُضفت لقائمة الانتظار',
      alreadyIn: 'أنت منضم بالفعل',
      attendanceSaved: 'تم تسجيل الحضور',
      certIssued: 'تم إصدار الشهادات',
      roleChanged: 'تم تحديث الدور',
      needLogin: 'يلزم تسجيل الدخول',
      invalidPhone: 'رقم غير صحيح — يبدأ بـ 010/011/012/015',
      invalidName: 'الاسم يجب أن يكون ثلاثياً على الأقل',
      explore: 'استكشف',
      checkin: 'تسجيل حضوري',
      excuse: 'طلب عذر',
      support: 'المساعدة',
      leaderboard: 'لوحة الصدارة',
      notifications: 'الإشعارات',
      verifyCert: 'تحقق من شهادة',
      broadcast: 'بث تنبيه',
      branches: 'الفروع',
      settings: 'الإعدادات',
      language: 'اللغة',
      present: 'حاضر',
      late: 'متأخر',
      absent: 'غائب',
      excused: 'معذور',
      volunteer: 'متطوع',
      student: 'طالب',
      admin: 'مشرف',
      active: 'نشط',
      inactive: 'غير نشط'
    },
    en: {
      appName: 'Masar RTC',
      tagline: 'We follow your journey, step by step',
      org: 'Resala — Training & Development Center',
      googleCta: 'Continue with Google',
      googleHint: 'Tap to sign in with your Google account',
      completeProfile: 'Complete your contact details',
      fullName: 'Full name (three parts)',
      phone: 'Mobile number',
      branch: 'Nearest branch',
      saveStart: 'Save and start',
      home: 'Home',
      myCourses: 'My courses',
      points: 'Points',
      certs: 'Certificates',
      account: 'Account',
      groups: 'Groups',
      courses: 'Courses',
      analytics: 'Analytics',
      users: 'People',
      logout: 'Sign out',
      dark: 'Dark mode',
      light: 'Light mode',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      loading: 'Loading...',
      retry: 'Try again',
      offline: 'You are offline — reading cached data',
      online: 'Back online',
      noPermission: 'You cannot open this screen',
      studentOnly: 'Every new account is a student. An admin can promote you to volunteer.',
      welcomeBack: 'Welcome back',
      joinOk: 'Joined the group',
      waitlisted: 'Group is full — you are on the waitlist',
      alreadyIn: 'Already enrolled',
      attendanceSaved: 'Attendance saved',
      certIssued: 'Certificates issued',
      roleChanged: 'Role updated',
      needLogin: 'Please sign in',
      invalidPhone: 'Use a valid Egyptian mobile (010/011/012/015)',
      invalidName: 'Enter at least a three-part name',
      explore: 'Explore',
      checkin: 'Check in',
      excuse: 'Absence excuse',
      support: 'Support',
      leaderboard: 'Leaderboard',
      notifications: 'Notifications',
      verifyCert: 'Verify a certificate',
      broadcast: 'Broadcast',
      branches: 'Branches',
      settings: 'Settings',
      language: 'Language',
      present: 'Present',
      late: 'Late',
      absent: 'Absent',
      excused: 'Excused',
      volunteer: 'Volunteer',
      student: 'Student',
      admin: 'Admin',
      active: 'Active',
      inactive: 'Inactive'
    }
  };

  /* v100 ships a complete Arabic product surface. Keep direction consistent until
     every operational/admin string has a reviewed English translation. */
  var lang = 'ar';

  function t(key) {
    return (STR[lang] && STR[lang][key]) || (STR.ar[key]) || key;
  }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'ar';
    try { localStorage.setItem('rtc_pref_lang', JSON.stringify(lang)); } catch (e) {}
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    if (typeof w.applyI18nNav === 'function') w.applyI18nNav();
  }

  function current() { return lang; }

  setLang(lang);
  w.RTCi18n = { t: t, setLang: setLang, current: current, STR: STR };
})(window);
