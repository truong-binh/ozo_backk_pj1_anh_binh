const { larkAppId, larkAppSecret, larkBaseUrl } = require('./env');

const isLarkConfigured = Boolean(larkAppId && larkAppSecret);

let cachedToken = null; // { token, expiresAt }

async function getTenantAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const res = await fetch(
    `${larkBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: larkAppId, app_secret: larkAppSecret }),
    },
  );
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark auth lỗi: ${data.code} ${data.msg}`);
  }
  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + data.expire * 1000,
  };
  return cachedToken.token;
}

// Gửi tin nhắn text tới user theo email (họ phải là thành viên tổ chức Lark).
async function sendTextByEmail(email, text) {
  const token = await getTenantAccessToken();
  const res = await fetch(
    `${larkBaseUrl}/open-apis/im/v1/messages?receive_id_type=email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: email,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    },
  );
  const data = await res.json();
  if (data.code !== 0) {
    // Thông báo dễ hiểu cho các lỗi hay gặp.
    if (data.code === 230002 || data.code === 230013) {
      throw new Error(
        'Không gửi được: email không thuộc tổ chức Lark hoặc ngoài phạm vi khả dụng của app.',
      );
    }
    throw new Error(`Lark gửi tin nhắn lỗi: ${data.code} ${data.msg}`);
  }
  return true;
}

// Gửi mã OTP tới người dùng qua Lark. Trả về true nếu đã gửi thật.
async function sendLoginCode(email, code) {
  const text =
    `🔐 Mã đăng nhập Feelex QLDA của bạn là: ${code}\n` +
    `Mã có hiệu lực trong ít phút. Không chia sẻ mã này cho bất kỳ ai.`;
  await sendTextByEmail(email, text);
  return true;
}

module.exports = { isLarkConfigured, sendLoginCode };
