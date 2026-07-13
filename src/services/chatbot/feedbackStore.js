const { getSupabaseClient } = require('../../config/supabaseClient');

// Lưu 1 phản hồi (chỉ gọi khi người dùng đã bấm nút đánh giá) — ghi cả câu hỏi
// lẫn câu trả lời và rating ('good' | 'improve'). Trả về true/false.
async function saveFeedback({ chatId, openId, picName, question, answer, provider, rating }) {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('chatbot_feedback').insert({
      chat_id: chatId,
      open_id: openId || null,
      pic_name: picName || null,
      question,
      answer,
      provider: provider || null,
      rating,
      rated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[feedback] save lỗi:', err.message);
    return false;
  }
}

// Lưu 1 tin nhắn mang tính góp ý/cải thiện về AI hoặc hệ thống web.
async function saveSuggestion({ chatId, openId, picName, message }) {
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from('chatbot_suggestions').insert({
      chat_id: chatId,
      open_id: openId || null,
      pic_name: picName || null,
      message,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[suggestion] save lỗi:', err.message);
    return false;
  }
}

// ----- Quản lý: xem & xử lý (xoá) góp ý / feedback -----

async function listFeedback() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('chatbot_feedback')
    .select('id,chat_id,pic_name,question,answer,rating,provider,created_at,rated_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

async function deleteFeedback(id) {
  const sb = getSupabaseClient();
  const { error } = await sb.from('chatbot_feedback').delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function listSuggestions() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('chatbot_suggestions')
    .select('id,chat_id,pic_name,message,handled,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

async function deleteSuggestion(id) {
  const sb = getSupabaseClient();
  const { error } = await sb.from('chatbot_suggestions').delete().eq('id', id);
  if (error) throw error;
  return true;
}

module.exports = {
  saveFeedback,
  saveSuggestion,
  listFeedback,
  deleteFeedback,
  listSuggestions,
  deleteSuggestion,
};
