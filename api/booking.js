import {
  generateRequestId, generateOrderId, setCORS, checkHoneypot, checkRateLimit,
  missingFields, isValidEmail, sanitizeText, handlePreflight
} from '../lib/security.js';
import { hasSMTPConfig, sendAdminBookingEmail, sendCustomerBookingEmail } from '../lib/email.js';
import { createOrder, updateOrder } from '../lib/orders.js';

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

  const required = ['firstName', 'lastName', 'email', 'phone', 'city', 'planType', 'numDevices', 'startDate', 'endDate', 'totalPrice'];
  const missing = missingFields(body, required);
  if (missing.length > 0) {
    return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}`, requestId });
  }

  if (!isValidEmail(body.email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address', requestId });
  }

  const orderId = body.orderId || generateOrderId();
  const totalPrice = Number(body.totalPrice) || 0;

  const order = createOrder({
    orderId: sanitizeText(orderId, 64),
    firstName: sanitizeText(body.firstName, 128),
    lastName: sanitizeText(body.lastName, 128),
    email: sanitizeText(body.email, 256).toLowerCase(),
    phone: sanitizeText(body.phone, 64),
    country: sanitizeText(body.country, 64),
    city: sanitizeText(body.city, 64),
    planType: sanitizeText(body.planType, 64),
    numDevices: sanitizeText(body.numDevices, 16),
    startDate: sanitizeText(body.startDate, 32),
    endDate: sanitizeText(body.endDate, 32),
    deliveryAddress: sanitizeText(body.deliveryAddress, 512),
    currency: sanitizeText(body.currency, 8) || 'USD',
    totalPrice,
    paymentMethod: sanitizeText(body.paymentMethod, 32) || 'stripe',
    paymentStatus: sanitizeText(body.paymentStatus, 32) || 'pending',
    paymentIntentId: sanitizeText(body.paymentIntentId, 128),
    notes: sanitizeText(body.notes, 5000),
    requestId
  });

  if (body.paymentStatus === 'paid' && body.paymentIntentId) {
    updateOrder(order.orderId, { paymentStatus: 'paid', paidAt: new Date().toISOString() });
  }

  if (!hasSMTPConfig()) {
    return res.status(500).json({ success: false, error: 'Server email not configured. Please set SMTP_PASS or QQ_AUTH_CODE.', requestId });
  }

  try {
    const tasks = [sendAdminBookingEmail(order)];
    if (process.env.SEND_CUSTOMER_COPY !== 'false') {
      tasks.push(sendCustomerBookingEmail(order));
    }
    await Promise.all(tasks);

    return res.status(200).json({
      success: true,
      message: 'Booking submitted successfully.',
      orderId: order.orderId,
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Booking email failed:`, error.message);
    return res.status(500).json({ success: false, error: 'Failed to send booking notification.', requestId });
  }
}
