// Khi có người được add vào nhóm Lark (event im.chat.member.user.added_v1),
// lấy tên/email/phòng ban/leader từ Lark rồi upsert vào pic_members.
const { getUserDetail, getDepartment } = require('./larkClient');
const { mapLarkDept } = require('./larkDeptMap');
const { getSupabaseClient } = require('../../config/supabaseClient');

// Đồng bộ 1 người theo open_id.
async function syncOneMember(openId) {
  const user = await getUserDetail(openId);
  if (!user) {
    console.warn('[member-sync] không lấy được user', openId);
    return { ok: false, reason: 'no-user' };
  }
  const email = (user.email || user.enterprise_email || '').trim().toLowerCase();
  const name = (user.name || '').trim();
  if (!email || !name) {
    console.warn('[member-sync] thiếu email/tên, bỏ qua', openId, { email, name });
    return { ok: false, reason: 'missing-email-or-name' };
  }

  // Duyệt tất cả phòng ban của user: gom mã phòng + các phòng người này làm trưởng phòng.
  const depts = [];
  const leadDepts = [];
  for (const did of user.department_ids || []) {
    const d = await getDepartment(did);
    if (!d) continue;
    const code = mapLarkDept(d.name);
    if (!code) continue;
    if (!depts.includes(code)) depts.push(code);
    if (d.leader_user_id && d.leader_user_id === openId && !leadDepts.includes(code)) {
      leadDepts.push(code);
    }
  }

  const supabase = getSupabaseClient();
  const base = { email, pic_name: name };
  // Không map được phòng nào -> chỉ cập nhật tên, KHÔNG ghi đè dept/leader đã set tay.
  // Có phòng -> thử upsert đầy đủ rồi tối giản dần (phòng khi DB thiếu cột mới).
  const attempts =
    depts.length > 0
      ? [
          { ...base, is_leader: leadDepts.length > 0, dept: depts[0], lead_depts: leadDepts },
          { ...base, is_leader: leadDepts.length > 0, dept: depts[0] },
          base,
        ]
      : [base];
  let done = false;
  for (const row of attempts) {
    const { error } = await supabase.from('pic_members').upsert([row], { onConflict: 'email' });
    if (!error) { done = true; break; }
  }
  if (!done) {
    console.error('[member-sync] upsert lỗi cho', email);
    return { ok: false, reason: 'upsert-failed' };
  }
  console.log('[member-sync] +', name, '|', email, '| depts:', depts.join(',') || '(none)', '| lead:', leadDepts.join(',') || '(none)');
  return { ok: true, email, name, depts, leadDepts };
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
