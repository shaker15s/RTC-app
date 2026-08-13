#!/usr/bin/env node
/*
 * Masar RTC v100 production builder.
 * - Compiles and purges Tailwind locally (no runtime CDN).
 * - Copies pinned fonts, icons and browser libraries from node_modules.
 * - Produces the exact web bundle consumed by PWA, Android and iOS.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const FILES = [
  'index.html', 'app.js', 'sw.js', 'manifest.json',
  'verify.html', 'privacy.html', 'terms.html',
  'rtc_app_logo.png', 'icon-192.png', 'icon-512.png',
  'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'robots.txt', '404.html'
];
const SOURCE_DIRS = ['js', 'icons', 'assets'];

function rm(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dest) { mkdir(path.dirname(dest)); fs.copyFileSync(src, dest); }
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDir(from, to);
    else { copyFile(from, to); count += 1; }
  }
  return count;
}
function fromNode(...parts) { return path.join(ROOT, 'node_modules', ...parts); }
function mustExist(p, label) {
  if (!fs.existsSync(p)) throw new Error(`Missing ${label || p}. Run npm install.`);
  return p;
}

function compileCss() {
  const bin = process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss';
  const cli = path.join(ROOT, 'node_modules', '.bin', bin);
  const out = path.join(DIST, 'css', 'app.css');
  mkdir(path.dirname(out));
  const run = spawnSync(cli, [
    '-c', path.join(ROOT, 'tailwind.config.js'),
    '-i', path.join(ROOT, 'styles', 'app.css'),
    '-o', out,
    '--minify'
  ], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, BROWSERSLIST_IGNORE_OLD_DATA: 'true' } });
  if (run.status !== 0) throw new Error('Tailwind compilation failed');
}

function buildFonts() {
  const outDir = path.join(DIST, 'assets', 'vendor', 'fonts');
  const fileDir = path.join(outDir, 'files');
  mkdir(fileDir);
  const chunks = [];
  const specs = [
    ['@fontsource/ibm-plex-sans-arabic', ['arabic-300.css', 'arabic-400.css', 'arabic-500.css', 'arabic-600.css', 'arabic-700.css']],
    ['@fontsource/inter', ['latin-600.css', 'latin-800.css']]
  ];
  for (const [name, cssFiles] of specs) {
    const base = fromNode(name);
    for (const css of cssFiles) chunks.push(fs.readFileSync(mustExist(path.join(base, css), `${name}/${css}`), 'utf8'));
    const fontFiles = path.join(base, 'files');
    const wanted = new Set();
    for (const css of chunks) {
      for (const match of css.matchAll(/\.\/files\/([^)'"\s]+)/g)) wanted.add(match[1]);
    }
    for (const file of wanted) {
      if (!file.endsWith('.woff2')) continue;
      const src = path.join(fontFiles, file);
      if (fs.existsSync(src)) copyFile(src, path.join(fileDir, file));
    }
  }
  fs.writeFileSync(path.join(outDir, 'fonts.css'), chunks.join('\n'));
}

function buildIcons() {
  const variants = ['regular', 'bold', 'fill', 'duotone'];
  for (const variant of variants) {
    const src = fromNode('@phosphor-icons', 'web', 'src', variant);
    const dest = path.join(DIST, 'assets', 'vendor', 'phosphor', variant);
    mkdir(dest);
    /* Every supported Android/iOS/WebView handles WOFF2; omit 11 MB of legacy TTF/SVG. */
    for (const file of ['style.css',
      variant === 'regular' ? 'Phosphor.woff2' : `Phosphor-${variant[0].toUpperCase()}${variant.slice(1)}.woff2`
    ]) copyFile(mustExist(path.join(src, file), `Phosphor ${variant}/${file}`), path.join(dest, file));
  }
}

function buildVendor() {
  const vendor = path.join(DIST, 'assets', 'vendor');
  mkdir(vendor);
  copyFile(mustExist(fromNode('@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), 'Supabase UMD'), path.join(vendor, 'supabase.js'));
  copyFile(mustExist(fromNode('jspdf', 'dist', 'jspdf.umd.min.js'), 'jsPDF UMD'), path.join(vendor, 'jspdf.umd.min.js'));
  esbuild.buildSync({
    entryPoints: [mustExist(fromNode('@aparajita', 'capacitor-secure-storage', 'dist', 'esm', 'index.js'), 'Secure Storage browser entry')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'RTCSecureStorage',
    platform: 'browser',
    target: ['es2019'],
    outfile: path.join(vendor, 'secure-storage.min.js'),
    legalComments: 'none'
  });
  esbuild.buildSync({
    entryPoints: [mustExist(fromNode('@capacitor', 'barcode-scanner', 'dist', 'esm', 'index.js'), 'Barcode Scanner entry')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'RTCBarcode',
    platform: 'browser',
    target: ['es2019'],
    outfile: path.join(vendor, 'barcode-scanner.min.js'),
    legalComments: 'none'
  });
  esbuild.buildSync({
    entryPoints: [mustExist(fromNode('qrcode', 'lib', 'browser.js'), 'QRCode browser entry')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'QRCode',
    platform: 'browser',
    target: ['es2019'],
    outfile: path.join(vendor, 'qrcode.min.js'),
    legalComments: 'none'
  });
  buildFonts();
  buildIcons();
}

function validate() {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const problems = [];
  const required = [
    'css/app.css', 'assets/vendor/supabase.js', 'assets/vendor/qrcode.min.js',
    'assets/vendor/jspdf.umd.min.js', 'assets/vendor/secure-storage.min.js', 'assets/vendor/barcode-scanner.min.js', 'js/native.js', 'js/security.js', 'app.js'
  ];
  for (const file of required) if (!fs.existsSync(path.join(DIST, file))) problems.push(`missing ${file}`);
  if (/cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|unpkg\.com\/@supabase|cdn\.jsdelivr\.net\/@supabase/.test(html)) {
    problems.push('production HTML still contains a runtime library CDN');
  }
  if (!html.includes(`?v=${VERSION}`)) problems.push(`cache tag ?v=${VERSION} is absent`);
  if (problems.length) throw new Error('Build validation failed:\n - ' + problems.join('\n - '));
}

function main() {
  console.log(`\n▶ Building Masar RTC v${VERSION} for Web + Android + iOS\n`);
  rm(DIST);
  mkdir(DIST);
  let count = 0;
  const optionalMissing = [];
  for (const file of FILES) {
    const src = path.join(ROOT, file);
    if (!fs.existsSync(src)) { optionalMissing.push(file); continue; }
    copyFile(src, path.join(DIST, file));
    count += 1;
  }
  for (const dir of SOURCE_DIRS) count += copyDir(path.join(ROOT, dir), path.join(DIST, dir));
  compileCss();
  buildVendor();
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  fs.writeFileSync(path.join(DIST, 'build-info.json'), JSON.stringify({
    name: pkg.name, version: VERSION, builtAt: new Date().toISOString(),
    targets: ['web', 'pwa', 'android', 'ios'], localAssets: true
  }, null, 2));
  validate();
  if (optionalMissing.length) console.log('  • Optional files not present: ' + optionalMissing.join(', '));
  console.log(`\n✓ Production bundle ready (${count}+ files) → dist/`);
  console.log('✓ Runtime libraries and fonts are local/offline-capable\n');
}

try { main(); } catch (error) { console.error('\n✗ ' + error.message + '\n'); process.exit(1); }
