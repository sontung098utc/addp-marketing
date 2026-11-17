const { execSync } = require('child_process');
const fs = require('fs');

const BROWSER_GLOBALS = new Set([
  'window', 'document', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'alert', 'console', 'URL', 'Blob', 'FormData', 'sessionStorage', 'localStorage', 'navigator',
  'Event', 'CustomEvent', 'FileReader', 'AbortController', 'Headers', 'Request', 'Response',
  'confirm', 'prompt', 'location', 'history', 'open', 'close', 'URLSearchParams', 'IntersectionObserver',
  'ResizeObserver', 'MutationObserver', 'performance', 'Math', 'Date', 'JSON', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'Error', 'TypeError', 'RangeError'
]);

try {
  const output = execSync('npx oxlint --format json -D no-undef src/App.jsx src/CommerceDashboardView.jsx src/CommerceReportView.jsx src/ShopDiagnosisView.jsx src/CommerceSyncManagementView.jsx', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('No oxlint errors found.');
} catch (err) {
  const jsonStr = err.stdout;
  try {
    const data = JSON.parse(jsonStr);
    const diagnostics = data.diagnostics || data || [];
    const realUndefs = [];

    for (const d of diagnostics) {
      if (d.code === 'no-undef' || d.ruleId === 'no-undef' || (d.message && d.message.includes('is not defined'))) {
        const match = d.message.match(/'([^']+)' is not defined/);
        const varName = match ? match[1] : null;
        if (varName && !BROWSER_GLOBALS.has(varName)) {
          realUndefs.push({
            file: d.filename || d.file,
            line: d.line || (d.labels && d.labels[0] ? d.labels[0].span : '?'),
            variable: varName,
            message: d.message
          });
        }
      }
    }

    console.log(`REAL UNDECLARED VARIABLES: ${realUndefs.length}`);
    if (realUndefs.length > 0) {
      console.log(JSON.stringify(realUndefs, null, 2));
      process.exit(1);
    } else {
      console.log('ALL FRONTEND FILES HAVE ZERO UNDECLARED VARIABLES! (All non-globals resolved)');
      process.exit(0);
    }
  } catch (parseErr) {
    console.error('Failed to parse oxlint output:', parseErr);
    console.log(err.stdout || err.stderr);
    process.exit(1);
  }
}
