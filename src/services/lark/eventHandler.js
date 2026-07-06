const { getUserEmail, sendText } = require('./larkClient');
const { resolvePicByEmail } = require('../chatbot/chatAuth');
const { runAgent } = require('../chatbot/agent');

// --- Bộ nhớ hội thoại theo chat_id (RAM, đủ cho 1 instance) ---
const MAX_HISTORY_PARTS = 40; // ~20 lượt
const conversations = new Map();

function getHistory(chatId) {
  return conversations.get(chatId) || [];
}
function saveHistory(chatId, history) {
  const trimmed = history.slice(-MAX_HISTORY_PARTS);
  conversations.set(chatId, trimmed);
}

// --- Chống xử lý trùng event (Lark hay retry) ---
const seenEvents = new Map();
const SEEN_TTL = 5 * 60 * 1000;
function alreadyHandled(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [k, t] of seenEvents) {
    if (now - t > SEEN_TTL) seenEvents.delete(k);
  }
  if (seenEvents.has(id)) return true;
  seenEvents.set(id, now);
  return false;
}

function extractText(message) {
  if (message.message_type !== 'text') return null;
  try {
    const parsed = JSON.parse(message.content || '{}');
    // Bỏ placeholder mention "@_user_1" khi bot bị tag trong group.
    return String(parsed.text || '').replace(/@_user_\d+/g, '').trim();
  } catch {
    return null;
  }
}

// Xử lý 1 event message (đã giải mã). Chạy nền, tự gửi trả lời về Lark.
async function handleMessageEvent(evt) {
  const eventId = evt.header?.event_id;
  if (alreadyHandled(eventId)) return;

  const message = evt.event?.message;
  const sender = evt.event?.sender;
  if (!message || !sender) return;

  const chatId = message.chat_id;
  const openId = sender.sender_id?.open_id;
  const text = extractText(message);
  console.log('[LARK] msg từ', openId, '| chat', chatId, '| type', message.message_type, '| text:', text);

  if (!text) {
    if (message.message_type !== 'text') {
      await sendText(chatId, 'Hiện mình chỉ đọc được tin nhắn văn bản. Bạn gõ câu hỏi giúp mình nhé.');
    }
    return;
  }

  try {
    // Xác thực quyền ghi: email Lark -> pic_members.
    const email = await getUserEmail(openId);
    const ctx = await resolvePicByEmail(email);
    console.log('[LARK] email:', email, '| authed:', ctx.authed, '| pic:', ctx.picName);

    const history = getHistory(chatId);
    const { text: reply, history: newHistory } = await runAgent(text, history, ctx);
    saveHistory(chatId, newHistory);
    const sendRes = await sendText(chatId, reply);
    console.log('[LARK] đã gửi trả lời, Lark code:', sendRes?.code);
  } catch (err) {
    console.error('handleMessageEvent lỗi:', err);
    await sendText(chatId, '⚠️ Có lỗi khi xử lý. Bạn thử lại sau nhé.');
  }
}

module.exports = { handleMessageEvent };
