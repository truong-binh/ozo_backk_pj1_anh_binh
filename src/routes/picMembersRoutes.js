const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { getSupabaseClient } = require('../config/supabaseClient');

const router = express.Router();

// Danh sách PIC canonical (dùng cho mọi ô chọn/lọc/nhập PIC ở frontend).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const supabase = getSupabaseClient();
    // Ưu tiên lấy kèm dept; nếu cột dept chưa được tạo thì fallback không có dept
    // (để web vẫn chạy trước khi bạn ALTER TABLE thêm cột).
    let { data, error } = await supabase
      .from('pic_members')
      .select('email,pic_name,dept')
      .order('pic_name', { ascending: true });
    if (error) {
      ({ data, error } = await supabase
        .from('pic_members')
        .select('email,pic_name')
        .order('pic_name', { ascending: true }));
    }
    if (error) throw error;
    res.json(data || []);
  }),
);

module.exports = { picMembersRoutes: router };
