// Security validation script testing HMAC Token generation & verification logic
const crypto = require('crypto');

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

function generateSignedToken(userId, role, signingKey, appUrl, ttlSeconds = 86400, scope = 'admin:all') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: appUrl,
    sub: userId,
    role: role,
    scope: scope,
    iat: now,
    exp: now + ttlSeconds,
    nonce: crypto.randomBytes(16).toString('hex')
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', signingKey)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function verifySignedToken(token, signingKey, requiredScope = null) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = crypto.createHmac('sha256', signingKey)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (e) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    return null; // Expired
  }

  if (requiredScope && payload.scope !== requiredScope && payload.scope !== 'admin:all') {
    return null; // Scope mismatch
  }

  return payload;
}

// RUN TESTS
const signingKey = crypto.randomBytes(32).toString('hex');
const appUrl = 'https://marketing.addp.vn';

console.log('[TEST 1] Generate token with claims...');
const token = generateSignedToken('addp_admin', 'admin', signingKey, appUrl, 3600, 'admin:all');
const parts = token.split('.');
console.log('Token generated with 3 parts. Header length:', parts[0].length, 'Payload length:', parts[1].length);

const claims = JSON.parse(base64UrlDecode(parts[1]));
console.log('Claims:', Object.keys(claims).join(', '));
if (!claims.iss || !claims.sub || !claims.iat || !claims.exp || !claims.nonce || !claims.scope) {
  throw new Error('Missing required claims in payload!');
}
console.log('✓ All 6 mandatory claims verified: iss, sub, iat, exp, nonce, scope');

console.log('\n[TEST 2] Verify valid token...');
const verified = verifySignedToken(token, signingKey, 'admin:all');
if (!verified || verified.sub !== 'addp_admin') {
  throw new Error('Valid token failed verification!');
}
console.log('✓ Valid token successfully verified');

console.log('\n[TEST 3] Verify token with tampered payload...');
const tamperedPayload = base64UrlEncode(JSON.stringify({ ...claims, role: 'superadmin' }));
const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
const verifiedTampered = verifySignedToken(tamperedToken, signingKey);
if (verifiedTampered !== null) {
  throw new Error('Tampered token should have failed verification!');
}
console.log('✓ Tampered payload rejected as expected');

console.log('\n[TEST 4] Verify token with wrong key...');
const verifiedWrongKey = verifySignedToken(token, 'wrong-key-00000000000000000000000000');
if (verifiedWrongKey !== null) {
  throw new Error('Token with wrong key should have failed verification!');
}
console.log('✓ Wrong signing key rejected as expected');

console.log('\n[TEST 5] Verify expired token...');
const expiredToken = generateSignedToken('addp_admin', 'admin', signingKey, appUrl, -10, 'admin:all');
const verifiedExpired = verifySignedToken(expiredToken, signingKey);
if (verifiedExpired !== null) {
  throw new Error('Expired token should have failed verification!');
}
console.log('✓ Expired token rejected as expected');

console.log('\n[TEST 6] Scope checking...');
const readOnlyToken = generateSignedToken('guest_user', 'guest', signingKey, appUrl, 3600, 'report:read');
const verifiedScopeFail = verifySignedToken(readOnlyToken, signingKey, 'admin:all');
if (verifiedScopeFail !== null) {
  throw new Error('Scope mismatch should have failed verification!');
}
console.log('✓ Scope mismatch correctly rejected');

console.log('\n======================================');
console.log('ALL 6 LOCAL SECURITY LOGIC TESTS PASSED!');
console.log('======================================');
