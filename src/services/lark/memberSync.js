// Khi có người được add vào nhóm Lark (event im.chat.member.user.added_v1),
// lấy tên/email/phòng ban/leader từ Lark rồi upsert vào pic_members.
const { getUserDetail, getDepartment } = require('./larkClient');
const { mapLarkDept } = require('./larkDeptMap');
const { getSupabaseClient } = require('../../config/supabaseClient');

// Ghi 1 dòng pic_members: update theo id nếu đã có, else insert. Graded fallback
// bỏ dần cột mới để không vỡ khi DB chưa chạy migration open-id.sql.
async function writeMember(supabase, existingId, full) {
  const drop = (obj, keys) => {
    const o = { ...obj };
    keys.forEach((k) => delete o[k]);
    return o;
  };
  const attempts = [
    full,
    drop(full, ['phone']),
    drop(full, ['phone', 'open_id']),
    drop(full, ['phone', 'open_id', 'lead_depts']),
    drop(full, ['phone', 'open_id', 'lead_depts', 'is_leader']),
    drop(full, ['phone', 'open_id', 'lead_depts', 'is_leader', 'dept']),
  ];
  for (const row of attempts) {
    const q = existingId
      ? supabase.from('pic_members').update(row).eq('id', existingId)
      : supabase.from('pic_members').insert([row]);
    const { error } = await q;
    if (!error) return true;
  }
  return false;
}

// Đồng bộ 1 người theo open_id. open_id + tên là đủ; email/SĐT tùy có.
async function syncOneMember(openId) {
  const user = await getUserDetail(openId);
  if (!user) {
    console.warn('[member-sync] không lấy được user', openId);
    return { ok: false, reason: 'no-user' };
  }
  const email = (user.email || user.enterprise_email || '').trim().toLowerCase() || null;
  const phone = (user.mobile || '').trim() || null;
  const name = (user.name || '').trim();
  if (!openId || !name) {
    console.warn('[member-sync] thiếu open_id/tên, bỏ qua', openId, { name });
    return { ok: false, reason: 'missing-openid-or-name' };
  }

  // Duyệt tất cả phòng ban của user: gom mã phòng + các phòng người này làm trưởng phòng.
  const depts = [];
  const leadDepts = [];
  const rawSeen = [];
  for (const did of user.department_ids || []) {
    const d = await getDepartment(did);
    if (!d) {
      console.warn('[member-sync] không đọc được phòng', did, '- kiểm scope contact:department.base:readonly');
      continue;
    }
    const rawName = (d.name || '').trim();
    if (rawName) rawSeen.push(rawName);
    // Map tên Lark -> mã app; nếu chưa có trong LARK_DEPT_MAP thì tạm dùng tên gốc.
    const code = mapLarkDept(rawName) || rawName;
    if (!code) continue;
    if (!depts.includes(code)) depts.push(code);
    if (d.leader_user_id && d.leader_user_id === openId && !leadDepts.includes(code)) {
      leadDepts.push(code);
    }
  }
  console.log('[member-sync] phòng Lark của', name, ':', rawSeen.join(' | ') || '(không có / không đọc được)');

  const supabase = getSupabaseClient();

  // Tìm dòng hiện có: ưu tiên open_id, rồi email (dữ liệu cũ chưa gắn open_id).
  let existingId = null;
  try {
    const { data } = await supabase.from('pic_members').select('id').eq('open_id', openId).maybeSingle();
    if (data) existingId = data.id;
  } catch (_e) { /* cột open_id chưa có -> bỏ qua */ }
  if (!existingId && email) {
    const { data } = await supabase.from('pic_members').select('id').eq('email', email).maybeSingle();
    if (data) existingId = data.id;
  }

  // Bộ giá trị ghi. Không map được phòng nào -> KHÔNG đụng dept/leader (giữ phần
  // quản lý set tay); chỉ cập nhật định danh (open_id/tên/email/SĐT).
  const full = { open_id: openId, pic_name: name };
  if (email) full.email = email;
  if (phone) full.phone = phone;
  if (depts.length > 0) {
    full.dept = depts[0];
    full.lead_depts = leadDepts;
    full.is_leader = leadDepts.length > 0;
  }

  const done = await writeMember(supabase, existingId, full);
  if (!done) {
    console.error('[member-sync] ghi lỗi cho', name, openId);
    return { ok: false, reason: 'write-failed' };
  }
  console.log('[member-sync] +', name, '|', email || '(no email)', '| open_id:', openId, '| depts:', depts.join(',') || '(none)', '| lead:', leadDepts.join(',') || '(none)');
  return { ok: true, email, name, openId, depts, leadDepts };
}

// Xử lý event add thành viên nhóm.
async function handleMemberAdded(evt) {
  const users = evt.event?.users || [];
  for (const u of users) {
    const openId = u.user_id?.open_id || u.open_id;
    if (openId) await syncOneMember(openId);
  }
}

module.exports = { handleMemberAdded, syncOneMember };
