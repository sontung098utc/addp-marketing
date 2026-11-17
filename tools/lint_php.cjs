const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const phpBin = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';
const dir = path.join(__dirname, '..', 'public', 'api');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.php'));

let errorCount = 0;
for (const f of files) {
  const fullPath = path.join(dir, f);
  try {
    const out = execSync(`"${phpBin}" -l "${fullPath}"`, { encoding: 'utf8' });
    console.log(`[SYNTAX OK] ${f}`);
  } catch (err) {
    console.error(`[SYNTAX ERROR] ${f}:`, err.message);
    errorCount++;
  }
}

if (errorCount === 0) {
  console.log(`\nAll ${files.length} PHP files passed syntax check!`);
} else {
  process.exit(1);
}
