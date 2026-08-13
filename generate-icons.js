/* ═══════════════════════════════════════════════════════════════
   مسار RTC v10 — توليد الأيقونات من الشعار الحقيقي rtc_app_logo.png
   (لم يعد يرسم حرف "R" — المصدر هو ملف الشعار نفسه)
   الاستخدام: npm run icons
   ═══════════════════════════════════════════════════════════════ */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE = path.join(ROOT, 'rtc_app_logo.png');
const BRAND_BG = { r: 0, g: 40, b: 142, alpha: 1 };   // #00288e

const androidSizes = [48, 72, 96, 144, 192];
const iosSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];

function ensure(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function density(size) {
  if (size <= 48) return 'mdpi';
  if (size <= 72) return 'hdpi';
  if (size <= 96) return 'xhdpi';
  if (size <= 144) return 'xxhdpi';
  return 'xxxhdpi';
}

/* أيقونة مصمتة: الشعار فوق خلفية العلامة (المتاجر ترفض الشفافية في iOS) */
function opaque(size) {
  return sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: BRAND_BG })
    .flatten({ background: BRAND_BG })
    .png()
    .toBuffer();
}

/* أيقونة شفافة (PWA any) */
function transparent(size) {
  return sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/* maskable: الشعار داخل منطقة آمنة 80% فوق خلفية العلامة */
async function maskable(size) {
  const inner = Math.round(size * 0.78);
  const logo = await sharp(SOURCE).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const off = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .composite([{ input: logo, top: off, left: off }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('✗ لم يتم العثور على الشعار: rtc_app_logo.png');
    process.exit(1);
  }
  const meta = await sharp(SOURCE).metadata();
  console.log(`\n▶ توليد الأيقونات من rtc_app_logo.png (${meta.width}×${meta.height})\n`);

  /* ── PWA ── */
  fs.writeFileSync(path.join(ROOT, 'icon-192.png'), await transparent(192));
  fs.writeFileSync(path.join(ROOT, 'icon-512.png'), await transparent(512));
  fs.writeFileSync(path.join(ROOT, 'icon-maskable-192.png'), await maskable(192));
  fs.writeFileSync(path.join(ROOT, 'icon-maskable-512.png'), await maskable(512));
  fs.writeFileSync(path.join(ROOT, 'apple-touch-icon.png'), await opaque(180));
  console.log('  ✓ أيقونات PWA (192 / 512 / maskable / apple-touch)');

  /* ── أندرويد ── */
  const resDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(path.join(ROOT, 'android'))) {
    for (const size of androidSizes) {
      const dir = path.join(resDir, `mipmap-${density(size)}`);
      ensure(dir);
      const png = await opaque(size);
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png);
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png);
      fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await maskable(size * 2));
    }
    console.log('  ✓ أيقونات أندرويد (mdpi → xxxhdpi)');
  } else {
    console.log('  • أندرويد غير مضاف (npx cap add android) — تم التخطي');
  }

  /* ── iOS ── */
  const iosDir = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (fs.existsSync(path.join(ROOT, 'ios'))) {
    ensure(iosDir);
    for (const size of iosSizes) {
      fs.writeFileSync(path.join(iosDir, `icon-${size}.png`), await opaque(size));
    }
    const contents = {
      images: [
        { idiom: 'iphone', size: '20x20', scale: '2x', filename: 'icon-40.png' },
        { idiom: 'iphone', size: '20x20', scale: '3x', filename: 'icon-60.png' },
        { idiom: 'iphone', size: '29x29', scale: '2x', filename: 'icon-58.png' },
        { idiom: 'iphone', size: '29x29', scale: '3x', filename: 'icon-87.png' },
        { idiom: 'iphone', size: '40x40', scale: '2x', filename: 'icon-80.png' },
        { idiom: 'iphone', size: '40x40', scale: '3x', filename: 'icon-120.png' },
        { idiom: 'iphone', size: '60x60', scale: '2x', filename: 'icon-120.png' },
        { idiom: 'iphone', size: '60x60', scale: '3x', filename: 'icon-180.png' },
        { idiom: 'ipad', size: '20x20', scale: '1x', filename: 'icon-20.png' },
        { idiom: 'ipad', size: '20x20', scale: '2x', filename: 'icon-40.png' },
        { idiom: 'ipad', size: '29x29', scale: '1x', filename: 'icon-29.png' },
        { idiom: 'ipad', size: '29x29', scale: '2x', filename: 'icon-58.png' },
        { idiom: 'ipad', size: '40x40', scale: '1x', filename: 'icon-40.png' },
        { idiom: 'ipad', size: '40x40', scale: '2x', filename: 'icon-80.png' },
        { idiom: 'ipad', size: '76x76', scale: '1x', filename: 'icon-76.png' },
        { idiom: 'ipad', size: '76x76', scale: '2x', filename: 'icon-152.png' },
        { idiom: 'ipad', size: '83.5x83.5', scale: '2x', filename: 'icon-167.png' },
        { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: 'icon-1024.png' }
      ],
      info: { version: 1, author: 'xcode' }
    };
    fs.writeFileSync(path.join(iosDir, 'Contents.json'), JSON.stringify(contents, null, 2));
    console.log('  ✓ أيقونات iOS + Contents.json');
  } else {
    console.log('  • iOS غير مضاف (npx cap add ios) — تم التخطي');
  }

  /* ── أصول المتجر ── */
  const storeDir = path.join(ROOT, 'store-assets');
  ensure(storeDir);
  fs.writeFileSync(path.join(storeDir, 'play-icon-512.png'), await opaque(512));
  fs.writeFileSync(path.join(storeDir, 'appstore-icon-1024.png'), await opaque(1024));
  console.log('  ✓ أصول المتجر (store-assets/)');

  console.log('\n✓ تم توليد كل الأيقونات من الشعار الحقيقي\n');
}

main().catch(function (e) { console.error(e); process.exit(1); });
