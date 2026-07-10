const { larkVerifyToken } = require('../config/env');
const { parseEventBody } = require('../services/lark/larkCrypto');
const {
  handleMessageEvent,
  handleCardAction,
  handleBotMenuEvent,
} = require('../services/lark/eventHandler');
const { handleMemberAdded } = require('../services/lark/memberSync');

// Webhook nhận event từ Lark. Phải trả 200 nhanh (<3s) rồi xử lý nền.
async function larkWebhook(req, res) {
  console.log('[LARK] webhook hit:', JSON.stringify(req.body).slice(0, 200));
  let payload;
  try {
    payload = parseEventBody(req.body || {});
  } catch (err) {
    console.error('Lark decrypt lỗi:', err.message);
    return res.status(400).json({ error: 'bad payload' });
  }

  // 1) Xác minh URL khi cấu hình webhook lần đầu.
  if (payload.type === 'url_verification') {
    if (larkVerifyToken && payload.token && payload.token !== larkVerifyToken) {
      return res.status(401).json({ error: 'invalid token' });
    }
    return res.json({ challenge: payload.challenge });
  }

  // 2) Kiểm token event (v2 để trong header.token).
  const token = payload.header?.token || payload.token;
  if (larkVerifyToken && token && token !== larkVerifyToken) {
    return res.status(401).json({ error: 'invalid token' });
  }

  const eventType = payload.header?.event_type;

  // 2b) Người dùng bấm nút đánh giá trên thẻ -> phải trả TOAST/thẻ đồng bộ.
  //     Bắt cả event 2.0 (card.action.trigger) lẫn callback thẻ đời cũ (có .action).
  if (eventType === 'card.action.trigger' || payload.action) {
    try {
      const result = await handleCardAction(payload);
      return res.json(result || { code: 0 });
    } catch (err) {
      console.error('Lark card action lỗi:', err);
      return res.json({ toast: { type: 'error', content: 'Có lỗi, thử lại sau nhé.' } });
    }
  }

  // 3) Trả 200 ngay, xử lý message ở nền.
  res.json({ code: 0 });

  console.log('[LARK] event_type:', eventType || payload.type);
  if (eventType === 'im.message.receive_v1') {
    setImmediate(() => {
      handleMessageEvent(payload).catch((e) => console.error('Lark bg lỗi:', e));
    });
  } else if (eventType === 'im.chat.member.user.added_v1') {
    // Có người được add vào nhóm -> đồng bộ tên/email/phòng vào pic_members.
    setImmediate(() => {
      handleMemberAdded(payload).catch((e) => console.error('Lark member-add lỗi:', e));
    });
  } else if (eventType === 'application.bot.menu_v6') {
    // Người dùng bấm nút menu tuỳ chỉnh của bot (VD nút Góp ý).
    setImmediate(() => {
      handleBotMenuEvent(payload).catch((e) => console.error('Lark bot-menu lỗi:', e));
    });
  }
}

module.exports = { larkWebhook };
