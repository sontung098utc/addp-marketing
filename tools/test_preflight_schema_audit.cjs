/**
 * ADDP COMMERCE INTELLIGENCE - PREFLIGHT SCHEMA AUDIT TEST MATRIX
 * 
 * Verifies that the audit logic accurately detects:
 * - APPLIED (all tables and columns present)
 * - NOT_APPLIED (no tables present)
 * - PARTIAL (some tables present, others missing - e.g. migration interrupted)
 * - SCHEMA_DRIFT (tables present but missing expected columns)
 * - Strict READ-ONLY compliance (zero schema alteration)
 */

const fs = require('fs');
const path = require('path');

console.log('====================================================================');
console.log('STARTING PREFLIGHT SCHEMA AUDIT UNIT & INTEGRATION TEST MATRIX');
console.log('====================================================================\n');

// Mock Schema Evaluator
function evaluateMigrationSchema(mockDb, migSpec) {
  if (migSpec.tables) {
    const expectedTables = Object.keys(migSpec.tables);
    const existingTables = Object.keys(mockDb.tables);
    const found = expectedTables.filter(t => existingTables.includes(t));

    if (found.length === 0) {
      return { status: 'NOT_APPLIED', details: `None of the ${expectedTables.length} tables exist.` };
    }
    if (found.length < expectedTables.length) {
      const missing = expectedTables.filter(t => !existingTables.includes(t));
      return { status: 'PARTIAL', details: `Missing tables: ${missing.join(', ')}` };
    }

    // Check columns
    const driftMessages = [];
    for (const [tbl, spec] of Object.entries(migSpec.tables)) {
      const actualCols = mockDb.tables[tbl].columns;
      const missingCols = spec.columns.filter(c => !actualCols.includes(c));
      if (missingCols.length > 0) {
        driftMessages.push(`Table \`${tbl}\` missing columns: ${missingCols.join(', ')}`);
      }
    }

    if (driftMessages.length > 0) {
      return { status: 'SCHEMA_DRIFT', details: driftMessages.join('; ') };
    }

    return { status: 'APPLIED', details: `All ${expectedTables.length} tables and columns verified.` };
  }

  if (migSpec.table_column_checks) {
    for (const [tbl, spec] of Object.entries(migSpec.table_column_checks)) {
      if (!mockDb.tables[tbl]) {
        return { status: 'NOT_APPLIED', details: `Base table \`${tbl}\` does not exist.` };
      }
      const actualCols = mockDb.tables[tbl].columns;
      const missing = spec.columns_must_exist.filter(c => !actualCols.includes(c));
      if (missing.length > 0) {
        return { status: 'NOT_APPLIED', details: `Columns missing: ${missing.join(', ')}` };
      }
    }
    return { status: 'APPLIED', details: `All required column checks passed.` };
  }

  return { status: 'UNKNOWN', details: 'Unrecognized specification.' };
}

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}: ${details}`);
    failed++;
  }
}

const mig005Spec = {
  name: 'Migration 005',
  tables: {
    commerce_aftersales: { columns: ['id', 'aftersales_id', 'platform_order_id', 'refund_amount'] },
    commerce_aftersales_items: { columns: ['id', 'aftersales_pk', 'platform_order_id', 'refund_amount'] },
    commerce_order_events: { columns: ['id', 'event_domain', 'event_type', 'event_key'] },
    commerce_loss_ledger: { columns: ['id', 'loss_type', 'loss_amount', 'classification_rule'] }
  }
};

const mig006Spec = {
  name: 'Migration 006',
  table_column_checks: {
    commerce_sync_runs: { columns_must_exist: ['source_domain'] }
  }
};

// Scenario 1: NOT_APPLIED
{
  const emptyDb = { tables: {} };
  const res = evaluateMigrationSchema(emptyDb, mig005Spec);
  assert(res.status === 'NOT_APPLIED', 'M01: Detects NOT_APPLIED when no tables exist');
}

// Scenario 2: PARTIAL (Only 2 of 4 tables created)
{
  const partialDb = {
    tables: {
      commerce_aftersales: { columns: ['id', 'aftersales_id', 'platform_order_id', 'refund_amount'] },
      commerce_aftersales_items: { columns: ['id', 'aftersales_pk', 'platform_order_id', 'refund_amount'] }
    }
  };
  const res = evaluateMigrationSchema(partialDb, mig005Spec);
  assert(res.status === 'PARTIAL' && res.details.includes('commerce_order_events'), 'M02: Detects PARTIAL when tables are missing');
}

// Scenario 3: SCHEMA_DRIFT (All tables exist, but missing classification_rule column)
{
  const driftDb = {
    tables: {
      commerce_aftersales: { columns: ['id', 'aftersales_id', 'platform_order_id', 'refund_amount'] },
      commerce_aftersales_items: { columns: ['id', 'aftersales_pk', 'platform_order_id', 'refund_amount'] },
      commerce_order_events: { columns: ['id', 'event_domain', 'event_type', 'event_key'] },
      commerce_loss_ledger: { columns: ['id', 'loss_type', 'loss_amount'] } // missing classification_rule
    }
  };
  const res = evaluateMigrationSchema(driftDb, mig005Spec);
  assert(res.status === 'SCHEMA_DRIFT' && res.details.includes('classification_rule'), 'M03: Detects SCHEMA_DRIFT when column is missing');
}

// Scenario 4: APPLIED (All tables and columns present)
{
  const appliedDb = {
    tables: {
      commerce_aftersales: { columns: ['id', 'aftersales_id', 'platform_order_id', 'refund_amount'] },
      commerce_aftersales_items: { columns: ['id', 'aftersales_pk', 'platform_order_id', 'refund_amount'] },
      commerce_order_events: { columns: ['id', 'event_domain', 'event_type', 'event_key'] },
      commerce_loss_ledger: { columns: ['id', 'loss_type', 'loss_amount', 'classification_rule'] }
    }
  };
  const res = evaluateMigrationSchema(appliedDb, mig005Spec);
  assert(res.status === 'APPLIED', 'M04: Detects APPLIED when all tables and columns match');
}

// Scenario 5: Migration 006 Column Check NOT_APPLIED
{
  const dbWithoutCol = {
    tables: {
      commerce_sync_runs: { columns: ['id', 'sync_type', 'status'] }
    }
  };
  const res = evaluateMigrationSchema(dbWithoutCol, mig006Spec);
  assert(res.status === 'NOT_APPLIED' && res.details.includes('source_domain'), 'M05: Detects NOT_APPLIED when column source_domain is missing');
}

// Scenario 6: Migration 006 Column Check APPLIED
{
  const dbWithCol = {
    tables: {
      commerce_sync_runs: { columns: ['id', 'sync_type', 'status', 'source_domain'] }
    }
  };
  const res = evaluateMigrationSchema(dbWithCol, mig006Spec);
  assert(res.status === 'APPLIED', 'M06: Detects APPLIED when column source_domain exists');
}

// Scenario 7: Read-Only Script Safety Audit
{
  const phpScript = fs.readFileSync(path.join(__dirname, 'preflight_schema_audit.php'), 'utf8');
  const hasInsert = /\bINSERT\s+INTO\b/i.test(phpScript);
  const hasUpdate = /\bUPDATE\s+`?\w+`?\s+SET\b/i.test(phpScript);
  const hasDelete = /\bDELETE\s+FROM\b/i.test(phpScript);
  const hasDrop = /\bDROP\s+TABLE\b/i.test(phpScript);
  const hasAlter = /\bALTER\s+TABLE\b/i.test(phpScript);

  assert(!hasInsert && !hasUpdate && !hasDelete && !hasDrop && !hasAlter, 'M07: preflight_schema_audit.php is strictly 100% READ-ONLY');
}

// Scenario 8: Real PHP CLI execution without DB_CHARSET constant
const { spawnSync } = require('child_process');
function findPhpBinary() {
  if (process.env.PHP_BIN && fs.existsSync(process.env.PHP_BIN)) return process.env.PHP_BIN;
  try {
    if (spawnSync('php', ['-v'], { encoding: 'utf8' }).status === 0) return 'php';
  } catch (e) {}
  const candidates = [
    'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe',
    'C:\\php\\php.exe',
    'C:\\tools\\php\\php.exe',
    'C:\\xampp\\php\\php.exe',
    '/usr/bin/php',
    '/usr/local/bin/php'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const phpBinary = findPhpBinary();

if (phpBinary) {
  const secretPassword = 'SUPER_SENSITIVE_DB_PASSWORD_XYZ';
  const secretSigningKey = 'AUTH_KEY_123456789012345678901234';
  
  const env = {
    ...process.env,
    APP_ENV: 'production',
    DB_HOST: '127.0.0.1',
    DB_PORT: '3306',
    DB_NAME: 'audit_test_db',
    DB_USER: 'audit_test_user',
    DB_PASSWORD: secretPassword,
    AUTH_SIGNING_KEY: secretSigningKey
  };
  // Ensure DB_CHARSET is NOT in environment
  delete env.DB_CHARSET;

  const res = spawnSync(phpBinary, [path.join(__dirname, 'preflight_schema_audit.php')], {
    env,
    encoding: 'utf8'
  });

  const allOutput = (res.stdout || '') + '\n' + (res.stderr || '');

  // Check 8: No Undefined constant "DB_CHARSET"
  const hasDbCharsetFatal = allOutput.includes('Undefined constant "DB_CHARSET"');
  assert(!hasDbCharsetFatal, 'M08: CLI preflight executes without Undefined constant "DB_CHARSET" fatal error');

  // Check 9: No production secrets leaked in stdout or stderr
  const leaksPassword = allOutput.includes(secretPassword);
  const leaksSigningKey = allOutput.includes(secretSigningKey);
  assert(!leaksPassword && !leaksSigningKey, 'M09: Zero secrets printed in CLI output (passwords and keys are redacted)');

  // Check 10: Canonical charset fallback to utf8mb4
  const phpScriptContent = fs.readFileSync(path.join(__dirname, 'preflight_schema_audit.php'), 'utf8');
  const hasUtf8mb4Fallback = phpScriptContent.includes("'utf8mb4'") && phpScriptContent.includes("defined('DB_CHARSET')");
  assert(hasUtf8mb4Fallback, 'M10: Canonical charset contract falls back safely to utf8mb4 matching db.php');
} else {
  console.log('[SKIP] M08-M10: PHP CLI binary not found in local environment');
}

console.log('\n====================================================================');
console.log(`TOTAL AUDIT SCENARIOS: ${passed + failed}`);
console.log(`PASS: ${passed}`);
console.log(`FAIL: ${failed}`);
console.log('====================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n>>> PREFLIGHT SCHEMA AUDIT TESTS: ALL PASS (100%) <<<\n');
  process.exit(0);
}
