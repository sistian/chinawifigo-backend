/**
 * Local smoke tests for ChinaWiFiGo backend.
 * These tests do NOT send real emails.
 */

import contactHandler from '../api/contact.js';
import quoteHandler from '../api/quote.js';
import bookingHandler from '../api/booking.js';
import ordersHandler from '../api/orders.js';

let testCount = 0;
let passCount = 0;

function makeRes() {
  return {
    _headers: {},
    _status: null,
    _json: null,
    _end: false,
    status(n) { this._status = n; return this; },
    json(obj) { this._json = obj; return this; },
    end() { this._end = true; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; }
  };
}

function makeReq(method, body = {}, headers = {}, query = {}) {
  return {
    method,
    body,
    headers,
    query,
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function assert(condition, message) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✅ ${message}`);
  } else {
    console.log(`  ❌ ${message}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('\nRunning ChinaWiFiGo backend smoke tests...\n');

  // 1. OPTIONS preflight for contact
  {
    const req = makeReq('OPTIONS');
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._status === 200, 'contact OPTIONS returns 200');
    assert(res._end === true, 'contact OPTIONS ends response');
  }

  // 2. GET rejected
  {
    const req = makeReq('GET');
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._status === 405, 'contact GET returns 405');
  }

  // 3. Contact missing fields
  {
    const req = makeReq('POST', {});
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._status === 400, 'contact empty body returns 400');
  }

  // 4. Contact invalid email
  {
    const req = makeReq('POST', { name: 'A', email: 'bad', subject: 'T', message: 'M' });
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._status === 400, 'contact invalid email returns 400');
  }

  // 5. Contact honeypot
  {
    const req = makeReq('POST', { name: 'A', email: 'a@b.com', subject: 'T', message: 'M', website_url: 'bot' });
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._status === 400, 'contact honeypot returns 400');
  }

  // 6. Contact valid but SMTP not configured
  {
    const originalPass = process.env.SMTP_PASS;
    delete process.env.SMTP_PASS;
    delete process.env.QQ_AUTH_CODE;
    const req = makeReq('POST', { name: 'Alice', email: 'alice@example.com', subject: 'Hello', message: 'I need help.' });
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._status === 500, 'contact without SMTP returns 500');
    if (originalPass) process.env.SMTP_PASS = originalPass;
  }

  // 7. Quote missing fields
  {
    const req = makeReq('POST', { name: 'A', email: 'a@b.com' });
    const res = makeRes();
    await quoteHandler(req, res);
    assert(res._status === 400, 'quote missing fields returns 400');
  }

  // 8. Booking missing fields
  {
    const req = makeReq('POST', { firstName: 'A', email: 'a@b.com' });
    const res = makeRes();
    await bookingHandler(req, res);
    assert(res._status === 400, 'booking missing fields returns 400');
  }

  // 9. Booking without SMTP
  {
    const originalPass = process.env.SMTP_PASS;
    delete process.env.SMTP_PASS;
    delete process.env.QQ_AUTH_CODE;
    const req = makeReq('POST', {
      firstName: 'John', lastName: 'Smith', email: 'john@example.com', phone: '+123',
      city: 'beijing', planType: 'Standard', numDevices: '1',
      startDate: '2025-08-01', endDate: '2025-08-07', totalPrice: 49.99
    });
    const res = makeRes();
    await bookingHandler(req, res);
    assert(res._status === 500, 'booking without SMTP reaches email step');
    assert(res._json?.error?.includes('not configured'), 'booking reports SMTP not configured');
    if (originalPass) process.env.SMTP_PASS = originalPass;
  }

  // 10. Orders unauthorized without token
  {
    const req = makeReq('GET', {}, {});
    const res = makeRes();
    await ordersHandler(req, res);
    assert(res._status === 401, 'orders without token returns 401');
  }

  // 11. CORS headers present
  {
    const req = makeReq('POST', {});
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._headers['Access-Control-Allow-Origin'] || res._headers['access-control-allow-origin'], 'CORS header is set');
  }

  // 12. Request ID present
  {
    const req = makeReq('POST', {});
    const res = makeRes();
    await contactHandler(req, res);
    assert(res._headers['X-Request-ID'] || res._headers['x-request-id'], 'Request ID header is set');
  }

  console.log(`\nResults: ${passCount}/${testCount} tests passed.\n`);
  if (passCount !== testCount) process.exit(1);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
