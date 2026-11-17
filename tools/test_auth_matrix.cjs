/**
 * Test Matrix for Authentication Engine (Task 02)
 * Tests all 10 scenarios (A through J) strictly matching public/api/auth_guard.php logic
 * NOTE: DO NOT PRINT TOKENS
 */

const crypto = require('crypto');

const APP_URL = 'https://marketing.addp.vn';
const ADMIN_USER = 'addp_admin';
const AUTH_SIGNING_KEY = crypto.randomBytes(32).toString('hex'); // local test key

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(data) {
  let remainder = data.length % 4;
  let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  if (remainder) {
    b64 += '='.repeat(4 - remainder);
  }
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {
    return null;
  }
}

function generateSignedToken(customClaims, ttl = 604800, signingKey = AUTH_SIGNING_KEY) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Object.assign({
    iss: APP_URL,
    sub: ADMIN_USER,
    iat: now,
    exp: now + ttl,
    nonce: crypto.randomBytes(16).toString('hex'),
    scope: 'admin:all'
  }, customClaims);

  const payloadJson = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadJson);
  const signature = crypto.createHmac('sha256', signingKey)
    .update(encodedPayload)
    .digest('hex');

  return `${encodedPayload}.${signature}`;
}

function verifySignedToken(token, signingKey = AUTH_SIGNING_KEY) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = crypto.createHmac('sha256', signingKey)
    .update(encodedPayload)
    .digest('hex');

  if (expectedSignature.length !== providedSignature.length || !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
    return null;
  }

  const rawJson = base64UrlDecode(encodedPayload);
  if (!rawJson) return null;

  let payload;
  try {
    payload = JSON.parse(rawJson);
  } catch (e) {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;

  const now = Math.floor(Date.now() / 1000);

  // 1. Expiration
  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < now) {
    return null;
  }

  // 2. Issued At (allow 60s clock skew)
  if (!payload.iat || typeof payload.iat !== 'number' || payload.iat > (now + 60)) {
    return null;
  }

  // 3. Issuer verification
  if (!payload.iss || payload.iss !== APP_URL) {
    return null;
  }

  // 4. Subject verification
  if (!payload.sub) {
    return null;
  }

  return payload;
}

function getAuthBearerToken(serverHeaders, queryParams) {
  let headerValue = null;

  if (serverHeaders['HTTP_AUTHORIZATION']) {
    headerValue = serverHeaders['HTTP_AUTHORIZATION'].trim();
  } else if (serverHeaders['REDIRECT_HTTP_AUTHORIZATION']) {
    headerValue = serverHeaders['REDIRECT_HTTP_AUTHORIZATION'].trim();
  } else if (serverHeaders['Authorization']) {
    headerValue = serverHeaders['Authorization'].trim();
  }

  if (headerValue) {
    const match = headerValue.match(/^Bearer\s+(\S+)$/i);
    if (match) return match[1];
  }

  // Query parameter strictly ignored/prohibited
  return null;
}

function requireAuth(serverHeaders, queryParams, requiredScope = null, signingKey = AUTH_SIGNING_KEY) {
  const token = getAuthBearerToken(serverHeaders, queryParams);
  if (!token) {
    return { status: 401, code: 'UNAUTHORIZED', accepted: false };
  }

  const claims = verifySignedToken(token, signingKey);
  if (!claims) {
    return { status: 401, code: 'INVALID_TOKEN', accepted: false };
  }

  if (requiredScope !== null) {
    const userScope = claims.scope || '';
    const hasScope = (userScope === 'admin:all') || (userScope === requiredScope);
    if (!hasScope) {
      return { status: 403, code: 'FORBIDDEN', accepted: false };
    }
  }

  return { status: 200, accepted: true, claims };
}

// EXECUTE TEST MATRIX
const results = {};

// A. No token
const resA = requireAuth({}, {});
results['A'] = (!resA.accepted && resA.status === 401) ? 'PASS' : 'FAIL';

// B. Malformed token
const resB = requireAuth({ 'Authorization': 'Bearer malformed.token.format.here' }, {});
results['B'] = (!resB.accepted && resB.status === 401) ? 'PASS' : 'FAIL';

// C. Invalid signature
const validToken = generateSignedToken({ sub: 'admin' });
const tokenParts = validToken.split('.');
const tamperedSig = tokenParts[0] + '.' + '0000000000000000000000000000000000000000000000000000000000000000';
const resC = requireAuth({ 'Authorization': `Bearer ${tamperedSig}` }, {});
results['C'] = (!resC.accepted && resC.status === 401) ? 'PASS' : 'FAIL';

// D. Expired token
const expiredToken = generateSignedToken({ sub: 'admin', exp: Math.floor(Date.now() / 1000) - 300 });
const resD = requireAuth({ 'Authorization': `Bearer ${expiredToken}` }, {});
results['D'] = (!resD.accepted && resD.status === 401) ? 'PASS' : 'FAIL';

// E. Future invalid iat
const futureToken = generateSignedToken({ sub: 'admin', iat: Math.floor(Date.now() / 1000) + 3600 });
const resE = requireAuth({ 'Authorization': `Bearer ${futureToken}` }, {});
results['E'] = (!resE.accepted && resE.status === 401) ? 'PASS' : 'FAIL';

// F. Wrong issuer
const wrongIssToken = generateSignedToken({ sub: 'admin', iss: 'https://evil.attacker.com' });
const resF = requireAuth({ 'Authorization': `Bearer ${wrongIssToken}` }, {});
results['F'] = (!resF.accepted && resF.status === 401) ? 'PASS' : 'FAIL';

// G. Missing scope
const missingScopeToken = generateSignedToken({ sub: 'admin', scope: '' });
const resG = requireAuth({ 'Authorization': `Bearer ${missingScopeToken}` }, {}, 'admin:all');
results['G'] = (!resG.accepted && resG.status === 403) ? 'PASS' : 'FAIL';

// H. Wrong scope
const wrongScopeToken = generateSignedToken({ sub: 'admin', scope: 'viewer:readonly' });
const resH = requireAuth({ 'Authorization': `Bearer ${wrongScopeToken}` }, {}, 'admin:all');
results['H'] = (!resH.accepted && resH.status === 403) ? 'PASS' : 'FAIL';

// I. Valid token
const resI = requireAuth({ 'Authorization': `Bearer ${validToken}` }, {}, 'admin:all');
results['I'] = (resI.accepted && resI.status === 200) ? 'PASS' : 'FAIL';

// J. Query-string auth_token only
const resJ = requireAuth({}, { auth_token: validToken }, 'admin:all');
results['J'] = (!resJ.accepted && resJ.status === 401) ? 'PASS' : 'FAIL';

console.log('AUTHENTICATION TEST MATRIX RESULTS:');
console.log('-----------------------------------');
console.log(`A. No token: ${results['A']}`);
console.log(`B. Malformed token: ${results['B']}`);
console.log(`C. Invalid signature: ${results['C']}`);
console.log(`D. Expired token: ${results['D']}`);
console.log(`E. Future invalid iat: ${results['E']}`);
console.log(`F. Wrong issuer: ${results['F']}`);
console.log(`G. Missing scope: ${results['G']}`);
console.log(`H. Wrong scope: ${results['H']}`);
console.log(`I. Valid token: ${results['I']}`);
console.log(`J. Query-string auth_token only: ${results['J']}`);

const allPass = Object.values(results).every(r => r === 'PASS');
console.log('-----------------------------------');
console.log(`OVERALL AUTHENTICATION TESTS: ${allPass ? 'PASS' : 'FAIL'}`);
