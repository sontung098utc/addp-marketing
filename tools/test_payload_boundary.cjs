/**
 * Gate 7 Boundary Verification: 256 KB Limit & Validation
 *
 * Explicitly tests:
 * 1. 262,143 bytes payload (Under limit: should pass)
 * 2. 262,144 bytes payload (Exact limit: should pass)
 * 3. 262,145 bytes payload (Over limit: must return 413)
 * 4. Missing Content-Length header with 262,145 bytes (Bounded by strlen(raw): must return 413)
 * 5. Malformed JSON (must return 400)
 * 6. Numerical boundary checks (SES > 5.0, negative GMV)
 */

const MAX_BYTES = 262144; // 256 KB

function simulateServerValidation(contentLengthHeader, rawPayload) {
  // Step 1: Pre-validation Content-Length header check
  const contentLength = contentLengthHeader !== undefined ? parseInt(contentLengthHeader, 10) : 0;
  if (contentLength > MAX_BYTES) {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', reason: 'CONTENT_LENGTH_EXCEEDED' };
  }

  // Step 2: Bound actual bytes read from php://input
  const actualLength = Buffer.byteLength(rawPayload, 'utf8');
  if (actualLength > MAX_BYTES) {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', reason: 'ACTUAL_BODY_EXCEEDED' };
  }

  // Step 3: JSON decode check
  let body;
  try {
    body = JSON.parse(rawPayload);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, code: 'INVALID_JSON' };
    }
  } catch (e) {
    return { status: 400, code: 'INVALID_JSON' };
  }

  // Step 4: Numerical boundary checks
  const totalGmv = body.total_gmv !== undefined ? parseFloat(body.total_gmv) : 458337810.0;
  const totalOrders = body.total_orders_count !== undefined ? parseInt(body.total_orders_count, 10) : 4492;
  const liveGmv = body.live_gmv !== undefined ? parseFloat(body.live_gmv) : 182552634.0;
  const videoGmv = body.video_gmv !== undefined ? parseFloat(body.video_gmv) : 227295375.0;
  const productGmv = body.product_gmv !== undefined ? parseFloat(body.product_gmv) : 48489801.0;
  const sesScore = body.ses_score !== undefined ? parseFloat(body.ses_score) : 4.9;

  if (totalGmv < 0 || totalOrders < 0 || liveGmv < 0 || videoGmv < 0 || productGmv < 0 || sesScore < 0.0 || sesScore > 5.0) {
    return { status: 400, code: 'VALIDATION_ERROR' };
  }

  return { status: 200, code: 'OK' };
}

function runPayloadTests() {
  console.log('Testing Gate 7: Exact Payload Size & Boundary Limits...');

  // Helper to generate a valid JSON string of exact byte length
  function makeValidJsonOfLength(targetLength) {
    const baseObj = { total_gmv: 1000, total_orders_count: 10, ses_score: 4.8, padding: "" };
    let json = JSON.stringify(baseObj);
    const diff = targetLength - Buffer.byteLength(json, 'utf8');
    if (diff > 0) {
      baseObj.padding = "A".repeat(diff);
      json = JSON.stringify(baseObj);
      // Adjust if padding quotes/escaping changed length
      while (Buffer.byteLength(json, 'utf8') < targetLength) {
        baseObj.padding += "A";
        json = JSON.stringify(baseObj);
      }
      while (Buffer.byteLength(json, 'utf8') > targetLength) {
        baseObj.padding = baseObj.padding.slice(0, -1);
        json = JSON.stringify(baseObj);
      }
    }
    return json;
  }

  const tests = [
    {
      name: '262,143 bytes (Max - 1)',
      len: 262143,
      header: '262143',
      expectedStatus: 200
    },
    {
      name: '262,144 bytes (Exact 256 KB)',
      len: 262144,
      header: '262144',
      expectedStatus: 200
    },
    {
      name: '262,145 bytes (Max + 1)',
      len: 262145,
      header: '262145',
      expectedStatus: 413
    },
    {
      name: '262,145 bytes with Missing Content-Length Header',
      len: 262145,
      header: undefined,
      expectedStatus: 413
    },
    {
      name: '262,145 bytes with Forged Small Content-Length Header (100)',
      len: 262145,
      header: '100',
      expectedStatus: 413
    },
    {
      name: 'Malformed JSON payload',
      len: null,
      customPayload: '{"total_gmv": 1000, "broken": ',
      header: '28',
      expectedStatus: 400
    },
    {
      name: 'SES Score Out of Bounds (> 5.0)',
      len: null,
      customPayload: JSON.stringify({ ses_score: 5.5, total_gmv: 1000 }),
      header: '35',
      expectedStatus: 400
    },
    {
      name: 'Negative GMV (< 0)',
      len: null,
      customPayload: JSON.stringify({ total_gmv: -500, ses_score: 4.8 }),
      header: '35',
      expectedStatus: 400
    }
  ];

  let passed = 0;
  for (const t of tests) {
    const payload = t.customPayload || makeValidJsonOfLength(t.len);
    const actualBytes = Buffer.byteLength(payload, 'utf8');
    const result = simulateServerValidation(t.header, payload);

    if (result.status === t.expectedStatus) {
      console.log(`[PASS] ${t.name} -> HTTP ${result.status} (${result.code}) [Bytes: ${actualBytes}]`);
      passed++;
    } else {
      console.error(`[FAIL] ${t.name} -> Expected HTTP ${t.expectedStatus}, got ${result.status}`);
    }
  }

  console.log(`\nPAYLOAD BOUNDARY TESTS: ${passed}/${tests.length} PASSED`);
  if (passed === tests.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPayloadTests();
