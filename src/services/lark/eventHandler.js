const { getUserEmail, sendText } = require('./larkClient');
const { resolvePicByEmail, resolvePicByOpenId } = require('../chatbot/chatAuth');
const { runAgent, provider: llmProvider } = require('../chatbot/agent');
const { loadHistory, saveHistory } = require('../chatbot/historyStore');
const { issueLoginCodeForOpenId } = require('../authService');

// Bỏ dấu tiếng Việt để nhận diện lệnh (đ->d).
function stripAccent(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Người dùng xin mã đăng nhập web? (đăng nhập / login / otp / lấy mã ...)
function isLoginRequest(text) {
  const t = stripAccent(text).toLowerCase().trim();
  return /^(dang nhap|dangnhap|login|otp|lay ma|xin ma|ma dang nhap|ma web)\b/.test(t);
}

// Cấp mã đăng nhập web cho đúng người nhắn (theo open_id), DM lại trong chat 1-1.
async function handleLoginRequest(chatId, openId, chatType) {
  if (chatType && chatType !== 'p2p') {
    await sendText(chatId, '🔐 Để lấy mã đăng nhập web, bạn hãy nhắn RIÊNG (1-1) cho mình chữ "đăng nhập" nhé.');
    return;
  }
  try {
    const res = await issueLoginCodeForOpenId(openId);
    if (!res.ok) {
      if (res.reason === 'not_pic') {
        await sendText(chatId, 'Tài khoản Lark của bạn chưa nằm trong danh sách PIC nên chưa đăng nhập web được. Vui lòng liên hệ quản lý để được thêm vào.');
      } else {
        await sendText(chatId, 'Chưa cấp được mã đăng nhập. Bạn thử lại sau nhé.');
      }
      return;
    }
    await sendText(
      chatId,
      `🔐 Mã đăng nhập Feelex QLDA của bạn: ${res.code}\n` +
        `Hiệu lực ${res.ttlMinutes} phút. Nhập mã này trên web để đăng nhập với tên "${res.picName}".\n` +
        '⚠️ Không chia sẻ mã này cho bất kỳ ai.',
    );
  } catch (err) {
    console.error('[login-otp] lỗi:', err.message);
    await sendText(chatId, '⚠️ Có lỗi khi cấp mã đăng nhập. Bạn thử lại sau nhé.');
  }
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

  // Xin mã đăng nhập web -> cấp OTP theo open_id, DM lại (không đưa vào AI agent).
  if (isLoginRequest(text)) {
    await handleLoginRequest(chatId, openId, message.chat_type);
    return;
  }

  try {
    // Xác thực quyền ghi. Ưu tiên open_id (luôn có, kể cả người không email trên
    // Lark); chỉ khi chưa khớp mới thử qua email (cho dữ liệu cũ chưa có open_id).
    let ctx = await resolvePicByOpenId(openId);
    if (!ctx.authed) {
      const email = await getUserEmail(openId);
      if (email) ctx = await resolvePicByEmail(email);
    }
    console.log('[LARK] open_id:', openId, '| authed:', ctx.authed, '| pic:', ctx.picName);

    const history = await loadHistory(chatId, llmProvider);
    const { text: reply, history: newHistory } = await runAgent(text, history, ctx);
    await saveHistory(chatId, llmProvider, newHistory);
    const sendRes = await sendText(chatId, reply);
    console.log('[LARK] đã gửi trả lời, Lark code:', sendRes?.code);
  } catch (err) {
    console.error('handleMessageEvent lỗi:', err);
    await sendText(chatId, '⚠️ Có lỗi khi xử lý. Bạn thử lại sau nhé.');
  }
}

module.exports = { handleMessageEvent };
