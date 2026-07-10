// Các thẻ (interactive card) dùng cho chatbot Lark.

// Thẻ trả lời của AI kèm 2 nút đánh giá. `id` là id bản ghi chatbot_feedback,
// đặt trong value của nút để callback biết cập nhật bản ghi nào.
function answerCard(replyText, id) {
  return {
    config: { wide_screen_mode: true, update_multi: true },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: replyText } },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '👍 Tốt' },
            type: 'primary',
            value: { action: 'fb', id, r: 'good' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '👎 Cần cải thiện' },
            type: 'danger',
            value: { action: 'fb', id, r: 'improve' },
          },
        ],
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: 'Đánh giá giúp trợ lý học và cải thiện câu trả lời.',
          },
        ],
      },
    ],
  };
}

// Thẻ sau khi đã đánh giá: giữ nguyên câu trả lời, thay cụm nút bằng dòng ghi nhận.
function ratedCard(replyText, rating) {
  const note =
    rating === 'good'
      ? '✅ Cảm ơn! Bạn đã đánh giá câu trả lời này là **Tốt**.'
      : '📝 Đã ghi nhận **Cần cải thiện** — câu trả lời được lưu lại để cải thiện trợ lý. Cảm ơn bạn!';
  return {
    config: { wide_screen_mode: true, update_multi: true },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: replyText } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: note } },
    ],
  };
}

module.exports = { answerCard, ratedCard };
