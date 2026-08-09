const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [48, 72, 96, 144, 192, 512];
const inputSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00288e"/>
      <stop offset="100%" style="stop-color:#003c36"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#grad)"/>
  <text x="256" y="340" font-family="Inter, sans-serif" font-weight="800" font-size="280" fill="white" text-anchor="middle" letter-spacing="-10">R</text>
</svg>
`;

async function generateIcons() {
  const outDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
  const iosOutDir = path.join(__dirname, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

  // Create directories
  sizes.forEach(s => {
    const dir = path.join(outDir, `mipmap-${getDensity(s)}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  if (!fs.existsSync(iosOutDir)) fs.mkdirSync(iosOutDir, { recursive: true });

  const buffer = Buffer.from(inputSvg);

  for (const size of sizes) {
    const png = await sharp(buffer)
      .resize(size, size)
      .png()
      .toBuffer();

    // Android
    const androidDir = path.join(outDir, `mipmap-${getDensity(size)}`);
    fs.writeFileSync(path.join(androidDir, 'ic_launcher.png'), png);
    fs.writeFileSync(path.join(androidDir, 'ic_launcher_round.png'), png);

    // iOS - generate all required sizes
    const iosSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
    for (const iosSize of iosSizes) {
      const iosPng = await sharp(buffer)
        .resize(iosSize, iosSize)
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(iosOutDir, `icon-${iosSize}.png`), iosPng);
    }
  }

  // Generate PWA icons
  const pwa192 = await sharp(buffer).resize(192, 192).png().toBuffer();
  const pwa512 = await sharp(buffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(__dirname, 'icon-192.png'), pwa192);
  fs.writeFileSync(path.join(__dirname, 'icon-512.png'), pwa512);

  // Generate Contents.json for iOS
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
  fs.writeFileSync(path.join(iosOutDir, 'Contents.json'), JSON.stringify(contents, null, 2));

  console.log('✅ Icons generated for Android, iOS, and PWA');
}

function getDensity(size) {
  if (size <= 48) return 'mdpi';
  if (size <= 72) return 'hdpi';
  if (size <= 96) return 'xhdpi';
  if (size <= 144) return 'xxhdpi';
  return 'xxxhdpi';
}

generateIcons().catch(console.error);