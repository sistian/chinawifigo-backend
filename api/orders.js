import {
  generateRequestId, setCORS, checkRateLimit, handlePreflight
} from '../lib/security.js';
import { listOrders, getOrder } from '../lib/orders.js';

function checkAuth(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return null;
}

export default async function handler(req, res) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-ID', requestId);
  setCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authError = checkAuth(req, res);
  if (authError) return authError;

  const rateLimited = checkRateLimit(req, res, requestId);
  if (rateLimited) return rateLimited;

  const { orderId } = req.query || {};
  if (orderId) {
    const order = getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found', requestId });
    }
    return res.status(200).json({ success: true, order, requestId });
  }

  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  return res.status(200).json({ success: true, orders: listOrders(limit), requestId });
}
