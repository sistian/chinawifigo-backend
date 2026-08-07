/**
 * Shared security utilities for ChinaWiFiGo backend APIs.
 * CORS, rate limiting, IP extraction, validation, sanitization, request IDs.
 */

const requestLog = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;        // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;            // max 10 submissions / minute / IP
const RATE_LIMIT_GLOBAL_MAX = 60;              // global safety cap per minute

export function getClientIP(req) {
  return (
    req.headers['x-vercel-forwarded-for'] ||
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).toString().split(',')[0].trim();
}

export function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  let ipCount = 0;
  let globalCount = 0;

  for (const [key, ts] of requestLog.entries()) {
    if (ts < windowStart) {
      requestLog.delete(key);
      continue;
    }
    globalCount++;
    if (key.startsWith(ip + '::')) ipCount++;
  }

  if (globalCount >= RATE_LIMIT_GLOBAL_MAX) return { limited: true, reason: 'global' };
  if (ipCount >= RATE_LIMIT_MAX_REQUESTS) return { limited: true, reason: 'ip' };
  return { limited: false };
}

export function recordRequest(ip) {
  requestLog.set(`${ip}::${Date.now()}`, Date.now());
}

export function setCORS(req, res) {
  const allowedOrigin = process.env.FRONTEND_URL || '*';
  const origin = req.headers.origin || '';
  const exposeHeaders = ['X-Request-ID'];

  if (allowedOrigin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && (allowedOrigin === origin || origin.endsWith(new URL(allowedOrigin).hostname))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', exposeHeaders.join(', '));
}

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function sanitizeText(input, maxLen = 5000) {
  if (input === null || input === undefined) return '';
  let s = String(input).trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  s = s
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/javascript:/gi, '[blocked:]');
  return s;
}

export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateOrderId() {
  return `CWG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function checkHoneypot(body) {
  return body?.website_url || body?.honeypot || body?.website || false;
}

export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  return null;
}

export function checkRateLimit(req, res, requestId) {
  const clientIP = getClientIP(req);
  const rate = isRateLimited(clientIP);
  if (rate.limited) {
    console.warn(`[${requestId}] Rate limit hit (${rate.reason}) from IP ${clientIP}`);
    return res.status(429).json({ success: false, error: 'Too many submissions. Please try again later.', requestId });
  }
  recordRequest(clientIP);
  return null;
}

export function missingFields(body, required) {
  return required.filter((key) => {
    const val = body?.[key];
    return val === undefined || val === null || String(val).trim() === '';
  });
}
