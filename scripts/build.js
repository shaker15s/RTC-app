#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   مسار RTC v10 — بناء مجلد dist/ للنشر و Capacitor
   يجمع كل الأصول الثابتة في مجلد واحد يستخدمه webDir.
   الاستخدام: npm run build
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const FILES = [
  'index.html',
  'app.js',
  'sw.js',
  'manifest.json',
  'verify.html',
  'privacy.html',
  'terms.html',
  'rtc_app_logo.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon.ico',
  'robots.txt',
  '404.html'
];

const DIRS = ['js', 'icons', 'assets'];

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) n += copyDir(s, d);
    else { copyFile(s, d); n++; }
  }
  return n;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  console.log(`\n▶ بناء مسار RTC v${pkg.version} → dist/\n`);

  rimraf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  let count = 0;
  const missing = [];
  for (const f of FILES) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { missing.push(f); continue; }
    copyFile(src, path.join(DIST, f));
    count++;
    console.log('  ✓ ' + f);
  }
  for (const d of DIRS) {
    const n = copyDir(path.join(ROOT, d), path.join(DIST, d));
    if (n) { count += n; console.log(`  ✓ ${d}/ (${n} ملف)`); }
  }

  // .nojekyll حتى لا تتجاهل GitHub Pages مجلدات تبدأ بشرطة سفلية
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  // بصمة البناء للتشخيص
  fs.writeFileSync(
    path.join(DIST, 'build-info.json'),
    JSON.stringify({ version: pkg.version, builtAt: new Date().toISOString() }, null, 2)
  );

  // فحوصات سلامة سريعة
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const problems = [];
  ['js/native.js', 'js/motion.js', 'app.js'].forEach((f) => {
    if (html.indexOf(f) === -1) problems.push(`index.html لا يشير إلى ${f}`);
  });
  const verTag = `?v=${pkg.version}`;
  if (html.indexOf(verTag) === -1) problems.push(`index.html لا يستخدم وسم الكاش ${verTag}`);
  ['js/native.js', 'js/motion.js', 'js/api.js', 'js/config.js'].forEach((f) => {
    if (!fs.existsSync(path.join(DIST, f))) problems.push(`ملف ناقص في dist: ${f}`);
  });

  if (missing.length) console.log('\n  ⚠ ملفات اختيارية غير موجودة: ' + missing.join(', '));
  if (problems.length) {
    console.error('\n✗ فشل البناء:\n' + problems.map((p) => '   - ' + p).join('\n') + '\n');
    process.exit(1);
  }

  console.log(`\n✓ تم البناء: ${count} ملف في dist/  (النسخة ${pkg.version})`);
  console.log('  التالي: npm run cap:sync ثم npm run cap:patch\n');
}

main();
