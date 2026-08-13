/*
 * Public RTC content and offline-safe fallbacks.
 * Operational records still come from Supabase; these values prevent a blank
 * first experience and document the source/status of every public claim.
 */
(function (w) {
  'use strict';

  var official = {
    nameAr: 'مراكز رسالة للتدريب',
    nameEn: 'Resala Training Centers',
    shortName: 'RTC',
    founded: 2000,
    mission: 'تنمية شرائح المجتمع من خلال تدريب مجاني عالي الجودة وفرص تطوع تبني خبرة عملية مؤسسية.',
    serviceModel: 'جميع الخدمات التدريبية والثقافية قائمة على متطوعين مدرّبين.',
    officialBranchCount: 17,
    officialHours: 'يوميًا من ٢ ظهرًا إلى ٦ مساءً',
    hotline: '19450',
    website: 'https://rtc-kohl.vercel.app/',
    facebook: 'https://www.facebook.com/RTCPage/',
    instagram: 'https://www.instagram.com/resala_training_center/',
    linkedin: 'https://eg.linkedin.com/company/resala-training-centers',
    sourceCheckedAt: '2026-08-13',
    sourceNote: 'موقع RTC الرسمي هو مرجع التعريف بالمركز؛ مواعيد كل فرع تُراجع من صفحة الفرع قبل الزيارة.'
  };

  var tracks = [
    { id: 'technology', title: 'الكمبيوتر والتكنولوجيا', icon: 'ph-code', color: '#00288e' },
    { id: 'languages', title: 'اللغات والتواصل', icon: 'ph-translate', color: '#00554e' },
    { id: 'human-development', title: 'التنمية البشرية', icon: 'ph-brain', color: '#7a30d8' },
    { id: 'management', title: 'التنمية الإدارية', icon: 'ph-chart-line-up', color: '#b7791f' },
    { id: 'kids', title: 'الأشبال والناشئة', icon: 'ph-student', color: '#ba1a1a' }
  ];

  /* Only links found in RTC/branch public profiles are marked verified. */
  var branchFallback = [
    { slug: 'faisal', name_ar: 'فرع فيصل — الجيزة', city: 'الجيزة', facebook_url: 'https://www.facebook.com/RTCFaisal/', hotline: '19450', data_status: 'verified' },
    { slug: 'giza', name_ar: 'فرع الجيزة — الهرم', city: 'الجيزة', facebook_url: 'https://www.facebook.com/RTCHaram/', hotline: '19450', data_status: 'verified' },
    { slug: 'nasr-city', name_ar: 'فرع مدينة نصر', city: 'القاهرة', facebook_url: 'https://www.facebook.com/RTC.Nasrcity/', hotline: '19450', data_status: 'verified' },
    { slug: 'heliopolis', name_ar: 'فرع مصر الجديدة', city: 'القاهرة', facebook_url: 'https://www.facebook.com/RTCHeliopolis/', hotline: '19450', data_status: 'verified' },
    { slug: 'maadi', name_ar: 'فرع المعادي', city: 'القاهرة', facebook_url: 'https://www.facebook.com/RTCMaadi/', hotline: '19450', data_status: 'verified' },
    { slug: 'october', name_ar: 'فرع 6 أكتوبر', city: 'الجيزة', facebook_url: 'https://www.facebook.com/rtcoctobercity/', hotline: '19450', data_status: 'verified' },
    { slug: 'helwan', name_ar: 'فرع حلوان', city: 'القاهرة', facebook_url: 'https://www.facebook.com/RTC.Helwan.RTC/', hotline: '19450', data_status: 'verified' }
  ];

  var volunteerTracks = [
    { slug: 'organization', name_ar: 'التنظيم', icon: 'ph-calendar-check', roles: ['تنظيم مواعيد الكورسات', 'متابعة الحضور والمجموعات', 'مساعدة المدربين'] },
    { slug: 'training', name_ar: 'التدريب', icon: 'ph-chalkboard-teacher', roles: ['كمبيوتر', 'لغات', 'تنمية بشرية', 'تدريب أونلاين'] },
    { slug: 'marketing', name_ar: 'التسويق', icon: 'ph-megaphone', roles: ['تصميم', 'كتابة محتوى', 'إدارة ومتابعة الصفحات'] },
    { slug: 'reception', name_ar: 'الاستقبال', icon: 'ph-handshake', roles: ['استقبال المستفيدين', 'شرح المجالات والإجراءات'] },
    { slug: 'people', name_ar: 'الموارد البشرية', icon: 'ph-users-three', roles: ['اختيار وتوجيه المتطوعين', 'التدريب والمتابعة'] }
  ];

  w.RTCContent = {
    official: official,
    tracks: tracks,
    volunteerTracks: volunteerTracks,
    branchFallback: branchFallback,
    research: {
      officialPage: official.website,
      centralFacebook: official.facebook,
      volunteerSecondarySource: 'https://egyincs.com/opportunities/resala-training-centre-rtc-volunteer/',
      caveat: 'لا تُعرض أي بيانات تشغيلية كـ«مؤكدة» دون مصدر وتاريخ مراجعة؛ قاعدة البيانات هي مصدر الحقيقة القابل للتحديث.'
    }
  };
})(window);
