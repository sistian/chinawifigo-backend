import {
  generateRequestId, setCORS, checkHoneypot, checkRateLimit,
  missingFields, isValidEmail, sanitizeText, handlePreflight
} from '../lib/security.js';
import { hasSMTPConfig, sendAdminQuoteEmail, sendCustomerQuoteEmail } from '../lib/email.js';

export default async function handler(req, res) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-ID', requestId);
  setCORS(req, res);

  const blocked = handlePreflight(req, res);
  if (blocked) return blocked;

  const rateLimited = checkRateLimit(req, res, requestId);
  if (rateLimited) return rateLimited;

  const body = req.body || {};

  if (checkHoneypot(body)) {
    return res.status(400).json({ success: false, error: 'Invalid submission.', requestId });
  }

  const missing = missingFields(body, ['name', 'email', 'destination', 'travelDates', 'numDevices']);
  if (missing.length > 0) {
    return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}`, requestId });
  }

  if (!isValidEmail(body.email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address', requestId });
  }

  const data = {
    name: sanitizeText(body.name, 128),
    email: sanitizeText(body.email, 256).toLowerCase(),
    phone: sanitizeText(body.phone, 64),
    destination: sanitizeText(body.destination, 128),
    travelDates: sanitizeText(body.travelDates, 128),
    numDevices: sanitizeText(body.numDevices, 16),
    deliveryMethod: sanitizeText(body.deliveryMethod, 64),
    message: sanitizeText(body.message, 5000),
    requestId
  };

  if (!hasSMTPConfig()) {
    return res.status(500).json({ success: false, error: 'Server email not configured. Please set SMTP_PASS or QQ_AUTH_CODE.', requestId });
  }

  try {
    const tasks = [sendAdminQuoteEmail(data)];
    if (process.env.SEND_CUSTOMER_COPY !== 'false') {
      tasks.push(sendCustomerQuoteEmail(data));
    }
    await Promise.all(tasks);

    return res.status(200).json({ success: true, message: 'Quote request sent successfully.', requestId });
  } catch (error) {
    console.error(`[${requestId}] Quote email failed:`, error.message);
    return res.status(500).json({ success: false, error: 'Failed to send quote request.', requestId });
  }
}
