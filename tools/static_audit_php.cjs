const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'public', 'api');
const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.php'));

console.log(`Auditing ${files.length} PHP files in ${apiDir}...\n`);

let errors = 0;

for (const file of files) {
  const filePath = path.join(apiDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check balanced braces and parenthesis
  let openBraces = 0;
  let openParens = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const prev = i > 0 ? content[i - 1] : '';
    const next = i < content.length - 1 ? content[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === stringChar && prev !== '\\') {
        inString = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '#' && prev !== '?' && prev !== '&') {
      inLineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      inComment = true;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '(') openParens++;
    if (ch === ')') openParens--;

    if (openBraces < 0) {
      console.error(`[FAIL] ${file}: Unmatched closing brace '}' at position ${i}`);
      errors++;
      break;
    }
    if (openParens < 0) {
      console.error(`[FAIL] ${file}: Unmatched closing paren ')' at position ${i}`);
      errors++;
      break;
    }
  }

  if (openBraces !== 0) {
    console.error(`[FAIL] ${file}: Unbalanced braces! openCount=${openBraces}`);
    errors++;
  } else if (openParens !== 0) {
    console.error(`[FAIL] ${file}: Unbalanced parens! openCount=${openParens}`);
    errors++;
  } else {
    console.log(`[PASS] ${file}: Balanced braces and parens (0 unbalanced)`);
  }

  // Check for forbidden query param usage in code
  if (content.includes("['auth_token']") || content.includes('["auth_token"]')) {
    console.error(`[SECURITY ALERT] ${file} accesses auth_token via query/input array`);
    errors++;
  }
}

console.log('\n======================================');
if (errors === 0) {
  console.log(`AUDIT SUCCESS: All ${files.length} PHP files passed static check!`);
} else {
  console.error(`AUDIT FAILED: ${errors} errors detected.`);
  process.exit(1);
}
console.log('======================================');
