const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireManager } = require('../middleware/auth');
const { getSupabaseClient } = require('../config/supabaseClient');

const router = express.Router();

const SELECT_SPECS = [
  'open_id,email,pic_name,dept,is_leader,lead_depts',
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

// Sửa phòng/leader/tên 1 PIC (Quản lý). Thành viên do Lark đồng bộ về -> khóa
// theo open_id (người đăng ký bằng SĐT/ẩn mail không có email để khóa). Không
// tạo mới ở đây: quản lý chỉ phân phòng + leader.
router.post(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const open_id = String(b.open_id || '').trim();
    const email = normEmail(b.email);
    const pic_name = String(b.pic_name || '').trim();
    if (!open_id && !email) {
      return res.status(400).json({ error: 'Thiếu open_id (không xác định được thành viên)' });
    }
    if (!pic_name) return res.status(400).json({ error: 'Tên PIC không được trống' });

    const dept = String(b.dept || '').trim() || null;
    const lead_depts = cleanDeptList(b.lead_depts);
    const supabase = getSupabaseClient();

    // Chỉ cập nhật dòng đã có (không insert). Khóa open_id nếu có, else email.
    const match = (q) => (open_id ? q.eq('open_id', open_id) : q.eq('email', email));

    // Thử update đầy đủ -> tối giản dần (phòng khi DB thiếu cột mới).
    const attempts = [
      { pic_name, dept, lead_depts, is_leader: lead_depts.length > 0 },
      { pic_name, dept, is_leader: lead_depts.length > 0 },
      { pic_name, dept },
      { pic_name },
    ];
    for (const patch of attempts) {
      const { data, error } = await match(
        supabase.from('pic_members').update(patch),
      ).select('*').maybeSingle();
      if (!error) {
        if (!data) return res.status(404).json({ error: 'Không tìm thấy thành viên để sửa' });
        return res.json(data);
      }
    }
    return res.status(500).json({ error: 'Không lưu được PIC (kiểm tra cột dept/lead_depts trong DB)' });
  }),
);

// Xoá 1 PIC (Quản lý). Khóa open_id nếu có, else email.
router.delete(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const open_id = String(req.query.open_id || req.body?.open_id || '').trim();
    const email = normEmail(req.query.email || req.body?.email);
    if (!open_id && !email) return res.status(400).json({ error: 'Thiếu open_id/email' });
    const supabase = getSupabaseClient();
    let q = supabase.from('pic_members').delete();
    q = open_id ? q.eq('open_id', open_id) : q.eq('email', email);
    const { error } = await q;
    if (error) throw error;
    res.json({ ok: true });
  }),
);

module.exports = { picMembersRoutes: router };
