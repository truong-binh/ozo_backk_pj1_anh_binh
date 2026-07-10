const crypto = require('node:crypto');
const { getUserEmail, sendText, sendCard } = require('./larkClient');
const { resolvePicByEmail, resolvePicByOpenId } = require('../chatbot/chatAuth');
const { runAgent, provider: llmProvider } = require('../chatbot/agent');
const { loadHistory, saveHistory } = require('../chatbot/historyStore');
const { saveFeedback, saveSuggestion } = require('../chatbot/feedbackStore');
const { answerCard, ratedCard } = require('./larkCards');
const { issueLoginCodeForOpenId } = require('../authService');

// Giữ tạm câu hỏi + câu trả lời của mỗi thẻ theo token, CHỈ ghi DB khi người
// dùng bấm nút đánh giá. TTL 24h, dọn rác mỗi lần thêm. Lưu ý: bộ nhớ tiến
// trình — nếu server restart trước khi người dùng bấm thì token đó mất.
const pendingFeedback = new Map();
const PENDING_TTL = 24 * 60 * 60 * 1000;
function putPending(token, data) {
  const now = Date.now();
  for (const [k, v] of pendingFeedback) {
    if (now - v.at > PENDING_TTL) pendingFeedback.delete(k);
  }
  pendingFeedback.set(token, { ...data, at: now });
}

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

// Tin nhắn mang tính GÓP Ý / mong muốn sửa–cải thiện AI hoặc hệ thống web?
// Dò theo từ khoá (đã bỏ dấu) để lưu lại làm dữ liệu cải thiện.
function isSuggestion(text) {
  const t = stripAccent(text).toLowerCase();
  return /(cai thien|cai tien|gop y|de xuat|kien nghi|phan hoi|y kien|nen them|nen co|nen sua|nen bo sung|bo sung them|mong muon|sua loi|bi loi|loi he thong|khong hoat dong|khong dung|them tinh nang|tinh nang moi|toi nghi nen|bug|feedback)/.test(t);
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
        '⚠️ Không chia sẻ mã này cho bất kỳ ai. Truy cập: https://ozo-truong-binhs-projects.vercel.app',
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

    // Nếu là góp ý / mong muốn cải thiện AI–hệ thống -> lưu lại (vẫn trả lời tiếp).
    if (isSuggestion(text)) {
      await saveSuggestion({ chatId, openId, picName: ctx.picName, message: text });
      console.log('[LARK] đã lưu góp ý:', text.slice(0, 80));
    }

    const history = await loadHistory(chatId, llmProvider);
    const { text: reply, history: newHistory } = await runAgent(text, history, ctx);
    await saveHistory(chatId, llmProvider, newHistory);

    // Gửi thẻ kèm 2 nút đánh giá. CHƯA ghi DB — chỉ giữ tạm Q&A theo token,
    // khi người dùng bấm nút mới ghi vào chatbot_feedback.
    const token = crypto.randomUUID();
    putPending(token, {
      chatId,
      openId,
      picName: ctx.picName,
      question: text,
      answer: reply,
      provider: llmProvider,
    });
    const sendRes = await sendCard(chatId, answerCard(reply, token));
    console.log('[LARK] đã gửi trả lời, Lark code:', sendRes?.code);
  } catch (err) {
    console.error('handleMessageEvent lỗi:', err);
    await sendText(chatId, '⚠️ Có lỗi khi xử lý. Bạn thử lại sau nhé.');
  }
}

// Xử lý người dùng bấm nút đánh giá trên thẻ trả lời.
// Nhận cả 2 định dạng: event 2.0 `card.action.trigger` và callback thẻ đời cũ.
// Trả về object phản hồi cho Lark (toast + thẻ đã cập nhật) để nơi gọi res.json().
async function handleCardAction(payload) {
  // Định dạng mới (schema 2.0): value & operator nằm trong payload.event.
  // Định dạng cũ: nằm thẳng ở payload.action / payload.open_id.
  const action = payload.event?.action || payload.action || {};
  const rawValue = action.value || {};
  const value = typeof rawValue === 'string' ? safeJson(rawValue) : rawValue;
  const openId =
    payload.event?.operator?.open_id || payload.open_id || null;

  if (!value || value.action !== 'fb' || !value.id) {
    return { toast: { type: 'info', content: 'Không xác định được thao tác.' } };
  }

  const token = value.id;
  const pending = pendingFeedback.get(token);
  if (!pending) {
    // Token hết hạn hoặc server đã restart -> không còn Q&A để lưu.
    return {
      toast: { type: 'warning', content: 'Phiên đánh giá đã hết hạn, bạn hỏi lại nhé.' },
    };
  }

  const rating = value.r === 'improve' ? 'improve' : 'good';
  const ok = await saveFeedback({
    chatId: pending.chatId,
    openId: openId || pending.openId,
    picName: pending.picName,
    question: pending.question,
    answer: pending.answer,
    provider: pending.provider,
    rating,
  });
  if (!ok) {
    return { toast: { type: 'error', content: 'Chưa lưu được đánh giá, thử lại sau nhé.' } };
  }
  // Ghi xong -> bỏ token để không lưu trùng khi bấm lại.
  pendingFeedback.delete(token);
  console.log('[LARK] feedback saved', rating, '| open_id', openId);

  const toastContent =
    rating === 'good' ? 'Cảm ơn đánh giá của bạn!' : 'Đã ghi nhận để cải thiện. Cảm ơn bạn!';
  return {
    toast: { type: 'success', content: toastContent },
    card: { type: 'raw', data: ratedCard(pending.answer, rating) },
  };
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = { handleMessageEvent, handleCardAction };
