/**
 * Builds tiktok_audit_extension.zip from public/extension/
 * Places identical zip in public/ and dist/
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const extDir = path.join(__dirname, '../public/extension');
const pubZip = path.join(__dirname, '../public/tiktok_audit_extension.zip');
const distZip = path.join(__dirname, '../dist/tiktok_audit_extension.zip');

if (fs.existsSync(pubZip)) fs.unlinkSync(pubZip);
if (fs.existsSync(distZip)) fs.unlinkSync(distZip);

// Verify manifest version
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
if (!['1.1.3', '1.2.0', '1.2.1', '1.3.0', '1.3.1', '1.4.0', '1.5.0', '1.5.1'].includes(manifest.version)) {
  console.error(`ERROR: Expected extension version 1.1.3-1.5.1 but found ${manifest.version}`);
  process.exit(1);
}

// Compress using PowerShell Compress-Archive
const psCmd = `Compress-Archive -Path '${extDir.replace(/\\/g, '\\\\')}\\*' -DestinationPath '${pubZip.replace(/\\/g, '\\\\')}' -Force`;
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { stdio: 'inherit' });

if (!fs.existsSync(pubZip)) {
  console.error('Failed to create extension zip at public/');
  process.exit(1);
}

// Copy to dist/
fs.copyFileSync(pubZip, distZip);

const buf = fs.readFileSync(pubZip);
const sha = crypto.createHash('sha256').update(buf).digest('hex');

console.log(`[PASS] Extension v${manifest.version} zipped successfully.`);
console.log(`  Size:   ${buf.length} bytes`);
console.log(`  SHA256: ${sha}`);
