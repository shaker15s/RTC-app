#!/usr/bin/env node
/* Validate Android Firebase config without printing API keys or project secrets. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'android', 'app', 'google-services.json');
const EXPECTED_PACKAGE = 'org.resala.rtc.masar';
const optional = process.argv.includes('--optional');

function fail(message, code = 1) {
  console.error(`✗ Firebase Android: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(FILE)) {
  if (optional) {
    console.log('• Firebase Android: google-services.json is not present; native FCM build is skipped until it is added.');
    process.exit(0);
  }
  fail('ضع الملف في android/app/google-services.json');
}

let config;
try { config = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
catch (error) { fail('google-services.json is not valid JSON'); }

const clients = Array.isArray(config.client) ? config.client : [];
const match = clients.find((client) => client?.client_info?.android_client_info?.package_name === EXPECTED_PACKAGE);
if (!match) {
  const found = clients.map((client) => client?.client_info?.android_client_info?.package_name).filter(Boolean);
  fail(`package name must be ${EXPECTED_PACKAGE}; found: ${found.join(', ') || 'none'}`);
}
if (!config.project_info?.project_number || !config.project_info?.project_id) fail('project_info is incomplete');
if (!match.client_info?.mobilesdk_app_id) fail('mobilesdk_app_id is missing');
if (!Array.isArray(match.api_key) || !match.api_key.some((item) => item.current_key)) fail('Android API key is missing');

console.log('✓ Firebase Android configuration is valid');
console.log(`  package: ${EXPECTED_PACKAGE}`);
console.log(`  project: ${config.project_info.project_id}`);
console.log('  API keys were detected but intentionally not printed.');
