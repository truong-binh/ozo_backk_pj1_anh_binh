const {
  larkAppId,
  larkAppSecret,
  larkDomain,
} = require('../../config/env');

const isLarkConfigured = Boolean(larkAppId && larkAppSecret);

let tokenCache = { value: null, expireAt: 0 };

// Lấy tenant_access_token (cache tới khi gần hết hạn).
async function getTenantAccessToken() {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expireAt) return tokenCache.value;

  const res = await fetch(`${larkDomain}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: larkAppId, app_secret: larkAppSecret }),
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark token lỗi: ${data.code} ${data.msg}`);
  }
  tokenCache = {
    value: data.tenant_access_token,
    // expire tính bằng giây; trừ 60s cho an toàn.
    expireAt: now + (data.expire - 60) * 1000,
  };
  return tokenCache.value;
}

// Gửi tin nhắn text vào 1 chat.
async function sendText(chatId, text) {
  const token = await getTenantAccessToken();
  const res = await fetch(
    `${larkDomain}/open-apis/im/v1/messages?receive_id_type=chat_id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    },
  );
  const data = await res.json();
  if (data.code !== 0) {
    console.error('Lark sendText lỗi:', data.code, data.msg);
  }
  return data;
}

// Liệt kê các nhóm/chat mà bot đang là thành viên. Trả về [{ chat_id, name, chat_mode, ... }].
async function listChats() {
  const token = await getTenantAccessToken();
  const res = await fetch(`${larkDomain}/open-apis/im/v1/chats?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.code !== 0) {
    console.error('Lark listChats lỗi:', data.code, data.msg);
    return [];
  }
  return data.data?.items || [];
}

// Gửi tin nhắn text trực tiếp cho 1 người theo email (DM). Cần user có tài khoản
// Lark với đúng email này trong tenant. Trả về data của Lark ({ code, msg, ... }).
async function sendTextByEmail(email, text) {
  const token = await getTenantAccessToken();
  const res = await fetch(
    `${larkDomain}/open-apis/im/v1/messages?receive_id_type=email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
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
    console.error('Lark sendTextByEmail lỗi:', email, data.code, data.msg);
  }
  return data;
}

// Lấy email của người gửi từ open_id (cần scope contact:user.email:readonly).
async function getUserEmail(openId) {
  if (!openId) return null;
  try {
    const token = await getTenantAccessToken();
    const res = await fetch(
      `${larkDomain}/open-apis/contact/v3/users/${openId}?user_id_type=open_id`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    if (data.code !== 0) {
      console.warn('Lark getUserEmail:', data.code, data.msg);
      return null;
    }
    const user = data.data?.user || {};
    return user.email || user.enterprise_email || null;
  } catch (err) {
    console.warn('Lark getUserEmail exception:', err.message);
    return null;
  }
}

module.exports = { isLarkConfigured, getTenantAccessToken, sendText, sendTextByEmail, listChats, getUserEmail };
