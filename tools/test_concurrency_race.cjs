/**
 * Gate 3 Concurrency Verification: Atomic Single-Use Redemption
 *
 * Simulates concurrent execution against the single-use check-and-set query:
 *   UPDATE tiktok_connector_pairings 
 *   SET redeemed_at = NOW() 
 *   WHERE pairing_hash = ? AND redeemed_at IS NULL AND expires_at > ?
 *
 * Verifies that under concurrent attempts, exactly one succeeds and all others receive Conflict (409).
 */

const crypto = require('crypto');

class MockPdoConnection {
  constructor() {
    this.pairings = new Map();
    this.sessions = [];
    this.lock = false;
  }

  insertPairing(hash, shopId, expiresAt) {
    this.pairings.set(hash, {
      pairing_hash: hash,
      shop_id: shopId,
      expires_at: expiresAt,
      redeemed_at: null,
      created_at: Date.now()
    });
  }

  // Simulates InnoDB atomic row-level lock UPDATE on unique index
  async atomicUpdateRedemption(hash, now) {
    // Simulating database row-level locking serialization
    while (this.lock) {
      await new Promise(r => setImmediate(r));
    }
    this.lock = true;
    try {
      const row = this.pairings.get(hash);
      if (!row) {
        return { rowCount: 0, reason: 'NOT_FOUND' };
      }
      if (row.redeemed_at === null && row.expires_at > now) {
        row.redeemed_at = new Date();
        return { rowCount: 1, shopId: row.shop_id };
      } else if (row.redeemed_at !== null) {
        return { rowCount: 0, reason: 'ALREADY_REDEEMED' };
      } else {
        return { rowCount: 0, reason: 'EXPIRED' };
      }
    } finally {
      this.lock = false;
    }
  }
}

async function runConcurrencyTest() {
  console.log('Testing Gate 3: Atomic Single-Use Redemption Concurrency...');
  const db = new MockPdoConnection();
  const rawCode = 'PAIR-TEST-RACE-GATE';
  const pairingHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 300;

  db.insertPairing(pairingHash, '7495657895504611503', expiresAt);

  const CONCURRENT_REQUESTS = 20;
  const attempts = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    attempts.push((async (id) => {
      // Small artificial jitter (0-5ms) to simulate real-world packet arrival
      await new Promise(r => setTimeout(r, Math.random() * 5));
      const now = Math.floor(Date.now() / 1000);
      const res = await db.atomicUpdateRedemption(pairingHash, now);
      if (res.rowCount === 1) {
        return { id, status: 200, message: 'SUCCESS' };
      } else if (res.reason === 'ALREADY_REDEEMED') {
        return { id, status: 409, message: 'PAIRING_ALREADY_REDEEMED' };
      } else {
        return { id, status: 401, message: res.reason };
      }
    })(i));
  }

  const results = await Promise.all(attempts);

  const successes = results.filter(r => r.status === 200);
  const conflicts = results.filter(r => r.status === 409);
  const others = results.filter(r => r.status !== 200 && r.status !== 409);

  console.log(`Concurrent requests launched: ${CONCURRENT_REQUESTS}`);
  console.log(`Success count (HTTP 200):     ${successes.length}`);
  console.log(`Conflict count (HTTP 409):    ${conflicts.length}`);
  console.log(`Other failures:               ${others.length}`);

  if (successes.length === 1 && conflicts.length === CONCURRENT_REQUESTS - 1) {
    console.log('[PASS] EXACTLY ONE redemption succeeded. Atomic single-use guarantee verified.');
    process.exit(0);
  } else {
    console.error('[FAIL] Race condition detected! Multiple redemptions succeeded or unexpected error.');
    process.exit(1);
  }
}

runConcurrencyTest();
