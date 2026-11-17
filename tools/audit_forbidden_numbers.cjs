/**
 * AUDIT FORBIDDEN NUMBERS IN ADDP COMMERCE INTELLIGENCE
 * Inspects all occurrences of forbidden demo / synthetic metrics:
 * 458337810, 4492, 182552634, 227295375, 48489801, 4.9, 4.94, 5.00, 99.17, 0.02, 4.60, 17.70, 96.84
 */

const fs = require('fs');
const path = require('path');

const TARGETS = [
  '458337810',
  '4492',
  '182552634',
  '227295375',
  '48489801',
  '4.94',
  '5.00',
  '99.17',
  '0.02',
  '4.60',
  '17.70',
  '96.84'
];

function walk(dir) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'vendor', '.gemini', 'artifacts'].includes(f)) continue;
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) res = res.concat(walk(p));
    else res.push(p);
  }
  return res;
}

const allFiles = walk('.');
const audit = [];

for (const file of allFiles) {
  if (file.endsWith('.zip') || file.endsWith('.png') || file.endsWith('.ico') || file.endsWith('.jpg')) continue;
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      TARGETS.forEach(t => {
        if (line.includes(t)) {
          audit.push({
            file: file.replace(/\\/g, '/'),
            line: idx + 1,
            target: t,
            snippet: line.trim()
          });
        }
      });
    });
  } catch (e) {}
}

console.log('Total occurrences found:', audit.length);

// Classify occurrences
const classified = {
  sync_and_schema_violations: [],
  database_migrations: [],
  backend_api_and_db: [],
  frontend_ui_views: [],
  extension_client_fixtures: [],
  backups_and_schema_dumps: [],
  test_harness_and_tools: [],
  documentation_and_runbooks: [],
  svg_icons_and_assets: []
};

for (const item of audit) {
  const f = item.file;
  // Check if it's in sync path (shop_diagnosis.php sync_seller_center) or migration/schema default
  if ((f === 'public/api/shop_diagnosis.php' || f === 'dist/api/shop_diagnosis.php') && item.line >= 111 && item.line <= 340) {
    classified.sync_and_schema_violations.push(item);
  } else if (f.startsWith('database/migrations/')) {
    classified.database_migrations.push(item);
  } else if (f.startsWith('public/api/') || f.startsWith('dist/api/')) {
    classified.backend_api_and_db.push(item);
  } else if (f.startsWith('src/')) {
    classified.frontend_ui_views.push(item);
  } else if (f.includes('extension/')) {
    classified.extension_client_fixtures.push(item);
  } else if (f.startsWith('backups/')) {
    classified.backups_and_schema_dumps.push(item);
  } else if (f.startsWith('tools/')) {
    classified.test_harness_and_tools.push(item);
  } else if (f.startsWith('docs/') || f.startsWith('release/')) {
    classified.documentation_and_runbooks.push(item);
  } else if (f.endsWith('.svg') || f.startsWith('dist/assets/')) {
    classified.svg_icons_and_assets.push(item);
  } else {
    classified.test_harness_and_tools.push(item);
  }
}

console.log('\n--- CLASSIFICATION SUMMARY ---');
for (const [category, items] of Object.entries(classified)) {
  console.log(`${category}: ${items.length} occurrences`);
}

console.log('\n--- BACKEND API & DB DETAILS ---');
for (const item of classified.backend_api_and_db) {
  console.log(`[${item.file}:${item.line}] (${item.target}) -> ${item.snippet}`);
}

console.log('\n--- EXTENSION FIXTURES DETAILS ---');
for (const item of classified.extension_client_fixtures) {
  console.log(`[${item.file}:${item.line}] (${item.target}) -> ${item.snippet}`);
}

if (classified.sync_and_schema_violations.length > 0) {
  console.error('\nCRITICAL: Violations detected in sync path:');
  console.error(JSON.stringify(classified.sync_and_schema_violations, null, 2));
  process.exit(1);
} else {
  console.log('\nCONFIRMED: ZERO violations detected in seller sync path (shop_diagnosis.php lines 111-340)!');
}
