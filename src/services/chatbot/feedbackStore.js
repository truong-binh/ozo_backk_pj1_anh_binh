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

module.exports = { saveFeedback };
