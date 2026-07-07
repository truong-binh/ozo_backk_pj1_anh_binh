const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireManager } = require('../middleware/auth');
const { getSupabaseClient } = require('../config/supabaseClient');

const router = express.Router();

const SELECT_SPECS = [
  'email,pic_name,dept,is_leader,lead_depts',
  'email,pic_name,dept,is_leader',
  'email,pic_name,dept',
  'email,pic_name',
];

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}
function cleanDeptList(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return Array.from(new Set(arr.map((s) => String(s || '').trim()).filter(Boolean)));
}

// Danh sách PIC (mọi user đã đăng nhập dùng cho ô chọn/lọc).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const supabase = getSupabaseClient();
    for (const spec of SELECT_SPECS) {
      const { data, error } = await supabase
        .from('pic_members')
        .select(spec)
        .order('pic_name', { ascending: true });
      if (!error) return res.json(data || []);
    }
    return res.json([]);
  }),
);

// Tạo/sửa 1 PIC (Quản lý). Upsert theo email.
router.post(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const email = normEmail(b.email);
    const pic_name = String(b.pic_name || '').trim();
    if (!email || !pic_name) {
      return res.status(400).json({ error: 'Cần email và tên PIC' });
    }
    const dept = String(b.dept || '').trim() || null;
    const lead_depts = cleanDeptList(b.lead_depts);
    const supabase = getSupabaseClient();

    // Thử upsert đầy đủ -> tối giản dần (phòng khi DB thiếu cột mới).
    const attempts = [
      { email, pic_name, dept, lead_depts, is_leader: lead_depts.length > 0 },
      { email, pic_name, dept, is_leader: lead_depts.length > 0 },
      { email, pic_name, dept },
      { email, pic_name },
    ];
    for (const row of attempts) {
      const { data, error } = await supabase
        .from('pic_members')
        .upsert([row], { onConflict: 'email' })
        .select('*')
        .single();
      if (!error) return res.json(data);
    }
    return res.status(500).json({ error: 'Không lưu được PIC (kiểm tra cột dept/lead_depts trong DB)' });
  }),
);

// Xoá 1 PIC (Quản lý).
router.delete(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const email = normEmail(req.query.email || req.body?.email);
    if (!email) return res.status(400).json({ error: 'Thiếu email' });
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('pic_members').delete().eq('email', email);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

module.exports = { picMembersRoutes: router };
