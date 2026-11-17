const fs = require('fs');
const path = require('path');

const patterns = [
  /password\s*=\s*['"][^'"]+['"]/i,
  /secret\s*=\s*['"][0-9a-f]{20,}['"]/i,
  /AIza[0-9A-Za-z-_]{35}/,
  /ey[A-Za-z0-9_-]{20,}\.ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/
];

let leaks = 0;
const scannedFiles = [];

function scan(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'backups', 'dist', 'scratch'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scan(full);
    } else if (/\.(php|js|jsx|json|sql|md|html)$/.test(item)) {
      scannedFiles.push(full);
      const content = fs.readFileSync(full, 'utf8');
      for (const p of patterns) {
        if (p.test(content)) {
          console.error(`[SECRET_DETECTED] ${full} matched pattern: ${p}`);
          leaks++;
        }
      }
    }
  }
}

scan('c:\\AdsTiktok');
console.log(`======================================`);
console.log(`SECRET SCAN SUMMARY`);
console.log(`FILES_SCANNED = ${scannedFiles.length}`);
console.log(`SECRETS_FOUND = ${leaks}`);
console.log(`STATUS        = ${leaks === 0 ? 'PASS' : 'FAIL'}`);
console.log(`======================================`);

process.exit(leaks > 0 ? 1 : 0);
