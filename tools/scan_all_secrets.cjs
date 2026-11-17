const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Regex patterns to detect hardcoded sensitive credentials
const highEntropySecrets = [
  // Live Google Gemini API Key
  /(?:GEMINI_API_KEY|api_key)\s*[:=]\s*['"](AIza[0-9A-Za-z-_]{35})['"]/i,
  // Live TikTok App Secret or Ads Secret (typically 40 hex chars)
  /(?:TIKTOK_APP_SECRET|TIKTOK_ADS_SECRET)\s*[:=]\s*['"]([0-9a-f]{32,64})['"]/i,
  // Hardcoded DB Password (excluding empty or env access)
  /(?:DB_PASSWORD|DB_PASS)\s*[:=]\s*['"]([^'"\s]{8,})['"]/i,
  // Hardcoded signing key
  /(?:AUTH_SIGNING_KEY)\s*[:=]\s*['"]([0-9a-f]{32,})['"]/i,
  // RSA/EC Private Keys
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/
];

const scannedFiles = [];
const findings = [];

function scanFile(filePath) {
  scannedFiles.push(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  for (const pattern of highEntropySecrets) {
    const match = pattern.exec(content);
    if (match) {
      // Check if it's a documentation placeholder or comment
      const matchedStr = match[0];
      if (
        matchedStr.includes('<') || 
        matchedStr.includes('YOUR_') || 
        matchedStr.includes('RANDOM_64_HEX') ||
        matchedStr.includes('env(')
      ) {
        continue;
      }
      findings.push({
        file: filePath,
        pattern: pattern.toString(),
        matchSnippet: matchedStr.substring(0, 40) + '...'
      });
    }
  }
}

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    if (['node_modules', '.git', 'backups', 'scratch'].includes(item)) continue;
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else {
      // Check extensions
      const ext = path.extname(item).toLowerCase();
      if (['.php', '.js', '.jsx', '.json', '.sql', '.html', '.md', '.css', '.env'].includes(ext)) {
        scanFile(fullPath);
      }
    }
  }
}

console.log('====================================================');
console.log('STARTING EXHAUSTIVE TASK 02B SECRET SCAN');
console.log('====================================================');

// 1. Scan required directories
const targetDirs = [
  path.join(__dirname, '../public'),
  path.join(__dirname, '../src'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../database/migrations'),
  path.join(__dirname, '../docs')
];

for (const d of targetDirs) {
  scanDirectory(d);
}

// 2. Scan unzipped extension artifacts
const scratchExtDir = 'C:/Users/sontu/.gemini/antigravity/brain/50f2bc7b-3b6e-4cd1-84da-7cd9f1a2075b/scratch/unzipped_ext';
if (fs.existsSync(scratchExtDir)) {
  scanDirectory(scratchExtDir);
}

console.log(`Scanned Directories: ${targetDirs.map(d => path.basename(d)).join(', ')} + unzipped extension`);
console.log(`FILES_SCANNED = ${scannedFiles.length}`);
console.log(`FINDINGS      = ${findings.length}`);

if (findings.length > 0) {
  console.error('\nDETECTED SECRET LEAKS:');
  findings.forEach(f => {
    console.error(`- File: ${f.file}`);
    console.error(`  Snippet: ${f.matchSnippet}`);
  });
  console.log(`\nRESULT = FAIL`);
  process.exit(1);
} else {
  console.log(`RESULT        = PASS`);
  console.log('No plaintext passwords, API keys, or private secrets detected in any scanned artifacts.');
  process.exit(0);
}
