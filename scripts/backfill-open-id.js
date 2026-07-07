// Điền open_id cho các dòng pic_members hiện có (khớp theo TÊN với thành viên các
// nhóm Lark bot tham gia). Chạy 1 lần SAU khi đã chạy sql/open-id.sql.
//   node scripts/backfill-open-id.js
require('dotenv').config();
const { listChats, listChatMembers } = require('../src/services/lark/larkClient');
const { getSupabaseClient } = require('../src/config/supabaseClient');

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

(async () => {
  // Gom open_id theo tên từ mọi nhóm bot tham gia.
  const chats = (await listChats()).filter((c) => c.chat_mode === 'group');
  const byName = new Map(); // norm(name) -> open_id
  for (const c of chats) {
    for (const m of await listChatMembers(c.chat_id)) {
      if (m.member_id && m.name) byName.set(norm(m.name), m.member_id);
    }
  }
  console.log('Thành viên Lark quét được:', byName.size);

  const s = getSupabaseClient();
  const { data: rows, error } = await s.from('pic_members').select('id,pic_name,open_id,email');
  if (error) { console.error('Đọc pic_members lỗi (đã chạy open-id.sql chưa?):', error.message); process.exit(1); }

  let updated = 0;
  const missing = [];
  for (const r of rows) {
    if (r.open_id) continue; // đã có
    const oid = byName.get(norm(r.pic_name));
    if (!oid) { missing.push(r.pic_name); continue; }
    const { error: e } = await s.from('pic_members').update({ open_id: oid }).eq('id', r.id);
    if (e) { console.error('  update lỗi', r.pic_name, e.message); continue; }
    console.log('  +', r.pic_name, '->', oid);
    updated++;
  }
  console.log(`\nXong. Điền open_id: ${updated}. Không khớp tên (cần kiểm tra tay): ${missing.length ? missing.join(', ') : '(không có)'}`);
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
