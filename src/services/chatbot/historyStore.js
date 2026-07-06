const { getSupabaseClient } = require('../../config/supabaseClient');

// Số message tối đa giữ lại cho mỗi chat (cắt bớt để prompt gọn).
const MAX_MESSAGES = 30;

// Cắt bớt nhưng luôn bắt đầu ở message role 'user' để không làm mồ côi
// cặp tool_call/tool (OpenAI) — tránh lỗi API.
function trimMessages(messages) {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= MAX_MESSAGES) return messages;
  let start = messages.length - MAX_MESSAGES;
  while (start < messages.length && messages[start].role !== 'user') start++;
  return messages.slice(start);
}

// Đọc history của 1 chat. Nếu provider đã đổi (format khác) -> trả rỗng.
async function loadHistory(chatId, provider) {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('chat_history')
      .select('provider,messages')
      .eq('chat_id', chatId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return [];
    if (data.provider !== provider) return []; // format cũ khác provider -> bỏ
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (err) {
    console.warn('[history] load lỗi:', err.message);
    return [];
  }
}

// Ghi đè history của 1 chat.
async function saveHistory(chatId, provider, messages) {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('chat_history').upsert(
      {
        chat_id: chatId,
        provider,
        messages: trimMessages(messages),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chat_id' },
    );
    if (error) throw error;
  } catch (err) {
    console.warn('[history] save lỗi:', err.message);
  }
}

module.exports = { loadHistory, saveHistory };
