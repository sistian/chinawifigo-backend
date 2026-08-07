# ChinaWiFiGo 后端 — 联系表单 + 预订系统

技术栈：
- Vercel Serverless Functions
- Nodemailer（QQ/Foxmail SMTP）

**支付方式：** 继续使用 PayPal / 支付宝二维码转账，不走 Stripe。用户付款后点击 "I Have Paid"，系统创建 pending 订单并邮件通知管理员核实。

## 功能

1. **联系表单** `/api/contact`
   - 接收姓名、邮箱、电话、主题、留言
   - 发送通知邮件给管理员
   - 可选发送确认邮件给客户

2. **报价请求** `/api/quote`
   - 接收目的地、出行日期、设备数量、取货方式等
   - 发送报价请求给管理员

3. **预订提交** `/api/booking`
   - 接收完整的 WiFi 租赁订单信息
   - 创建订单记录并发送邮件通知

4. **订单查询** `/api/orders`（管理用）
   - 需要 `Authorization: Bearer ADMIN_TOKEN`
   - 查询参数 `?orderId=xxx` 查询单个订单
   - 查询参数 `?limit=50` 查询最近订单列表

## 文件结构

```
ChinaWiFiGo houduan 8.3/
├── api/
│   ├── contact.js           # 联系表单
│   ├── quote.js             # 报价请求
│   ├── booking.js           # 预订提交
│   └── orders.js            # 订单查询（管理）
├── lib/
│   ├── security.js          # CORS / 速率限制 / 校验 / 清理
│   ├── email.js             # 邮件模板和发送
│   └── orders.js            # 内存订单缓存
├── test/
│   └── test.js              # 本地 smoke tests
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

## 本地测试

```bash
cd "ChinaWiFiGo houduan 8.3"
npm install
npm test
npm run check
```

`npm test` 不需要真实 SMTP 账号即可运行。

## 部署到 Vercel

### 1. 环境变量

在 Vercel Dashboard → Environment Variables 设置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SMTP_HOST` | SMTP 服务器 | smtp.qq.com |
| `SMTP_PORT` | SMTP 端口 | 465 |
| `SMTP_USER` | 发件邮箱 | sistian@foxmail.com |
| `SMTP_PASS` | 邮箱 16 位授权码 | - |
| `ADMIN_EMAIL` | 接收通知 | sistian@foxmail.com |
| `BCC_EMAIL` | 可选备份邮箱 | - |
| `SEND_CUSTOMER_COPY` | 是否给客户发确认 | true |
| `FRONTEND_URL` | 限制 CORS 的域名 | * |
| `ADMIN_TOKEN` | 订单查询接口 Token | - |

### 2. 获取 Foxmail/QQ 授权码

1. 登录 mail.qq.com
2. 设置 → 账户 → 开启 IMAP/SMTP 服务
3. 按提示获取 16 位授权码

### 3. 部署

```bash
git init
git add .
git commit -m "init: cwg backend"
# 创建 GitHub 仓库并 push
# 在 Vercel 导入仓库并部署
```

## 前端接入

### 1. 联系表单示例

```html
<form id="contactForm">
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  <input type="tel" name="phone">
  <input type="text" name="subject" required>
  <textarea name="message" required></textarea>
  <!-- honeypot -->
  <input type="text" name="website_url" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off">
  <button type="submit">Send</button>
</form>

<script>
const API_URL = 'https://your-backend.vercel.app';

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const res = await fetch(`${API_URL}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (json.success) alert('Message sent!');
  else alert('Error: ' + json.error);
});
</script>
```

### 2. 预订提交流程（PayPal / 支付宝二维码）

1. 用户填写预订表单。
2. 选择 PayPal 或支付宝，扫码转账。
3. 用户点击 "I Have Paid"。
4. 前端调用 `POST /api/booking`，创建 `paymentStatus: 'pending'` 订单。
5. 后端发送邮件给管理员和客户。
6. 管理员核对转账后，手动确认或更新订单状态。

```javascript
const payload = {
  orderId,
  firstName, lastName, email, phone,
  city, planType, numDevices,
  startDate, endDate,
  deliveryAddress: hotel,
  currency: 'USD',
  totalPrice: total.toFixed(2),
  paymentMethod: selectedPaymentMethod === 'paypal' ? 'PayPal' : 'Alipay',
  paymentStatus: 'pending',
  notes: requests
};

const res = await fetch(`${API_URL}/api/booking`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

## 测试接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/contact` | POST | 联系表单 |
| `/api/quote` | POST | 报价请求 |
| `/api/booking` | POST | 预订提交 |
| `/api/orders` | GET | 订单查询（需 Bearer Token） |

## 注意事项

- 内存订单缓存会在 Vercel 函数冷启动时重置。如需持久化，迁移到 Vercel KV / Postgres / MongoDB Atlas。
- 生产环境请设置 `FRONTEND_URL` 限制 CORS。
- 支付采用人工对账模式：管理员收到邮件后，在 PayPal/Alipay 后台确认收款，再手动标记订单为已支付。
