/**
 * Shared email utilities for ChinaWiFiGo backend.
 * Uses Nodemailer + QQ/Foxmail SMTP by default.
 */

import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.EMAIL_USER || process.env.SMTP_USER || 'sistian@foxmail.com';
const SMTP_PASS = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.QQ_AUTH_CODE;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.RECIPIENT_EMAIL || process.env.EMAIL_FROM || SMTP_USER || 'sistian@foxmail.com';
const BCC_EMAIL = process.env.BCC_EMAIL;
const SEND_CUSTOMER_COPY = process.env.SEND_CUSTOMER_COPY !== 'false';
const COMPANY_NAME = 'ChinaWiFiGo';
const WHATSAPP = '+86-155-2777-1775';
const WEBSITE = 'https://www.ChinaWiFiGo.com';

export function getEmailConfig() {
  return { smtpHost: SMTP_HOST, smtpPort: SMTP_PORT, smtpUser: SMTP_USER, adminEmail: ADMIN_EMAIL, sendCustomerCopy: SEND_CUSTOMER_COPY };
}

export function hasSMTPConfig() {
  return !!SMTP_PASS;
}

export function createTransporter() {
  if (!SMTP_PASS) throw new Error('SMTP password not configured');
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function mailBase() {
  const from = process.env.EMAIL_FROM || SMTP_USER;
  return {
    from: `${COMPANY_NAME} <${from}>`,
    replyTo: ADMIN_EMAIL
  };
}

export async function sendAdminContactEmail({ name, email, phone, subject, message, requestId }) {
  const transporter = createTransporter();
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:10px">📩 New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;width:160px">Request ID</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace">${requestId}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Name</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${name}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Email</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${email}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Phone</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${phone || '-'}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Subject</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${subject}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;vertical-align:top">Message</td><td style="padding:10px 12px;border:1px solid #e2e8f0;white-space:pre-wrap">${message}</td></tr>
      </table>
      <p style="margin-top:20px;color:#64748b;font-size:13px">
        📧 Reply to this email to contact the customer directly.<br>
        🔒 Sent by the ChinaWiFiGo backend.
      </p>
    </div>
  `;
  const mail = {
    ...mailBase(),
    to: ADMIN_EMAIL,
    subject: `【${COMPANY_NAME}】Contact: ${subject} — ${name}`,
    html,
    replyTo: email
  };
  if (BCC_EMAIL) mail.bcc = BCC_EMAIL;
  await transporter.sendMail(mail);
}

export async function sendCustomerContactEmail({ name, email, subject, message }) {
  const transporter = createTransporter();
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1">Thank you for contacting us, ${name}!</h2>
      <p>We have received your message and will reply within 24 hours.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;width:160px">Subject</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${subject}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;vertical-align:top">Your message</td><td style="padding:10px 12px;border:1px solid #e2e8f0;white-space:pre-wrap">${message}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:14px">
        <strong>WhatsApp:</strong> ${WHATSAPP}<br>
        <strong>Email:</strong> ${ADMIN_EMAIL}<br>
        <strong>Website:</strong> <a href="${WEBSITE}">${WEBSITE}</a>
      </p>
    </div>
  `;
  await transporter.sendMail({
    ...mailBase(),
    to: email,
    subject: `We received your message — ${COMPANY_NAME}`,
    html
  });
}

export async function sendAdminBookingEmail(order) {
  const transporter = createTransporter();
  const items = [
    ['Order ID', order.orderId],
    ['Customer', `${order.firstName || ''} ${order.lastName || ''}`.trim()],
    ['Email', order.email],
    ['Phone', order.phone || '-'],
    ['Country', order.country || '-'],
    ['City', order.city || '-'],
    ['Plan Type', order.planType || '-'],
    ['Devices', order.numDevices || '-'],
    ['Rental Dates', `${order.startDate || '-'} → ${order.endDate || '-'}`],
    ['Delivery / Hotel', order.deliveryAddress || '-'],
    ['Total Price', `${order.currency || 'USD'} ${order.totalPrice || 0}`],
    ['Payment Method', order.paymentMethod || '-'],
    ['Payment Status', order.paymentStatus || 'Pending'],
    ['Payment Intent', order.paymentIntentId || '-'],
    ['Notes', order.notes || 'None'],
    ['Submitted At', order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-']
  ];

  const rows = items.map(([label, value]) => {
    const bg = label === 'Total Price' ? 'background:#fff7ed' : '';
    return `<tr style="${bg}"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;width:160px">${label}</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${value}</td></tr>`;
  }).join('');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:10px">🛒 New WiFi Rental Booking</h2>
      <p style="color:#64748b">A new booking has been submitted on ${COMPANY_NAME}.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">${rows}</table>
      <p style="margin-top:20px;color:#64748b;font-size:13px">
        📧 Reply to this email to contact the customer directly.<br>
        🔒 Sent by the ${COMPANY_NAME} backend.
      </p>
    </div>
  `;
  const mail = {
    ...mailBase(),
    to: ADMIN_EMAIL,
    subject: `【${COMPANY_NAME}】New Booking ${order.orderId}`,
    html,
    replyTo: order.email
  };
  if (BCC_EMAIL) mail.bcc = BCC_EMAIL;
  await transporter.sendMail(mail);
}

export async function sendCustomerBookingEmail(order) {
  const transporter = createTransporter();
  const fullName = `${order.firstName || ''} ${order.lastName || ''}`.trim() || 'Traveler';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1">Your booking is confirmed, ${fullName}!</h2>
      <p>Thank you for choosing ${COMPANY_NAME}. We have received your WiFi rental order.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;width:160px">Order ID</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace">${order.orderId}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">City</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${order.city || '-'}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Plan</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${order.planType || '-'}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Rental Dates</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${order.startDate || '-'} → ${order.endDate || '-'}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Total Price</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#f97316;font-weight:bold">${order.currency || 'USD'} ${order.totalPrice || 0}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Payment Status</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${order.paymentStatus || 'Pending'}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:14px">
        <strong>WhatsApp support:</strong> ${WHATSAPP}<br>
        <strong>Email:</strong> ${ADMIN_EMAIL}<br>
        <strong>Website:</strong> <a href="${WEBSITE}">${WEBSITE}</a>
      </p>
      <p style="color:#64748b;font-size:13px;margin-top:20px">Please keep your Order ID for reference. Reply to this email if you have any questions.</p>
    </div>
  `;
  await transporter.sendMail({
    ...mailBase(),
    to: order.email,
    subject: `Your ${COMPANY_NAME} booking — ${order.orderId}`,
    html,
    replyTo: ADMIN_EMAIL
  });
}

export async function sendAdminQuoteEmail({ name, email, phone, destination, travelDates, numDevices, deliveryMethod, message, requestId }) {
  const transporter = createTransporter();
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:10px">📨 New Quote Request</h2>
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;width:160px">Request ID</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace">${requestId}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Name</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${name}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Email</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${email}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Phone</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${phone || '-'}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Destination</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${destination || '-'}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Travel Dates</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${travelDates || '-'}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Devices</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${numDevices || '-'}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold">Delivery</td><td style="padding:10px 12px;border:1px solid #e2e8f0">${deliveryMethod || '-'}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;vertical-align:top">Message</td><td style="padding:10px 12px;border:1px solid #e2e8f0;white-space:pre-wrap">${message || '-'}</td></tr>
      </table>
    </div>
  `;
  const mail = { ...mailBase(), to: ADMIN_EMAIL, subject: `【${COMPANY_NAME}】Quote Request — ${destination || 'General'}`, html, replyTo: email };
  if (BCC_EMAIL) mail.bcc = BCC_EMAIL;
  await transporter.sendMail(mail);
}

export async function sendCustomerQuoteEmail({ name, email, destination }) {
  const transporter = createTransporter();
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1">Thank you, ${name}!</h2>
      <p>We have received your quote request for ${destination || 'your trip'} and will send a customized offer within 24 hours.</p>
      <p style="margin-top:20px;font-size:14px">
        <strong>WhatsApp:</strong> ${WHATSAPP}<br>
        <strong>Email:</strong> ${ADMIN_EMAIL}
      </p>
    </div>
  `;
  await transporter.sendMail({
    ...mailBase(),
    to: email,
    subject: `We received your quote request — ${COMPANY_NAME}`,
    html
  });
}
