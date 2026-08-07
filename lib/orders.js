/**
 * In-memory order store for ChinaWiFiGo backend.
 * Vercel Serverless Functions are stateless, so this is a runtime cache only.
 * For production persistence, migrate to Vercel KV / Postgres / MongoDB Atlas.
 */

const orders = new Map();

export function createOrder(data) {
  const order = {
    ...data,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  orders.set(order.orderId, order);
  return order;
}

export function getOrder(orderId) {
  return orders.get(orderId) || null;
}

export function updateOrder(orderId, updates) {
  const order = orders.get(orderId);
  if (!order) return null;
  const updated = { ...order, ...updates, updatedAt: new Date().toISOString() };
  orders.set(orderId, updated);
  return updated;
}

export function listOrders(limit = 100) {
  return Array.from(orders.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}
