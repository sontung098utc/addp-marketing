const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const toolsDir = __dirname;
const testFiles = fs.readdirSync(toolsDir)
  .filter(f => f.startsWith('test_') && f.endsWith('.cjs') && f !== 'run_all_tests.cjs')
  .sort();

console.log(`Discovered ${testFiles.length} test suites.`);
let passed = 0;
let failed = 0;
const failures = [];

for (const file of testFiles) {
  process.stdout.write(`Running ${file.padEnd(55)} ... `);
  const startTime = Date.now();
  try {
    const out = execSync(`node "${path.join(toolsDir, file)}"`, {
      cwd: path.resolve(toolsDir, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`PASS (${duration}s)`);
    passed++;
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`FAIL (${duration}s)`);
    failed++;
    const errMsg = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + err.message;
    failures.push({ file, err: errMsg.trim().slice(-500) });
  }
}

console.log('\n' + '='.repeat(60));
console.log(`SUMMARY: ${passed}/${testFiles.length} PASSED, ${failed} FAILED`);
console.log('='.repeat(60));
if (failures.length > 0) {
  console.log('\nFailures details:');
  for (const f of failures) {
    console.log(`\n--- ${f.file} ---`);
    console.log(f.err);
  }
  process.exit(1);
} else {
  console.log('ALL TEST SUITES PASSED CLEANLY! ✓✓✓');
  process.exit(0);
}
