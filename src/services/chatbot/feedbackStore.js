const { getSupabaseClient } = require('../../config/supabaseClient');

// Lưu 1 lượt hỏi–đáp của bot vào chatbot_feedback (rating để trống, chờ người
// dùng bấm nút đánh giá). Trả về id bản ghi, hoặc null nếu lỗi (để nơi gọi
// vẫn gửi câu trả lời được kể cả khi chưa tạo bảng).
async function createFeedback({ chatId, openId, picName, question, answer, provider }) {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('chatbot_feedback')
      .insert({
        chat_id: chatId,
        open_id: openId || null,
        pic_name: picName || null,
        question,
        answer,
        provider: provider || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (err) {
    console.warn('[feedback] create lỗi:', err.message);
    return null;
  }
}

// Ghi nhận đánh giá của người dùng ('good' | 'improve') cho 1 bản ghi.
// Trả về { ok, answer } (answer để dựng lại thẻ sau khi đánh giá).
async function setFeedbackRating(id, rating, openId) {
  try {
    const sb = getSupabaseClient();
    const patch = { rating, rated_at: new Date().toISOString() };
    if (openId) patch.open_id = openId;
    const { data, error } = await sb
      .from('chatbot_feedback')
      .update(patch)
      .eq('id', id)
      .select('answer')
      .single();
    if (error) throw error;
    return { ok: true, answer: data?.answer || '' };
  } catch (err) {
    console.warn('[feedback] setRating lỗi:', err.message);
    return { ok: false, answer: '' };
  }
}

module.exports = { createFeedback, setFeedbackRating };
