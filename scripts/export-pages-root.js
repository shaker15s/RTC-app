#!/usr/bin/env node
/* Mirror generated runtime assets for the repository's legacy root-based Pages deploy. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const cssSource = path.join(ROOT, 'dist', 'css', 'app.css');
const vendorSource = path.join(ROOT, 'dist', 'assets', 'vendor');
if (!fs.existsSync(cssSource) || !fs.existsSync(vendorSource)) {
  console.error('Run npm run build before exporting Pages assets.');
  process.exit(1);
}
fs.mkdirSync(path.join(ROOT, 'css'), { recursive: true });
fs.copyFileSync(cssSource, path.join(ROOT, 'css', 'app.css'));
fs.rmSync(path.join(ROOT, 'assets', 'vendor'), { recursive: true, force: true });
copyDir(vendorSource, path.join(ROOT, 'assets', 'vendor'));
console.log('✓ Root Pages runtime assets updated from dist/');
