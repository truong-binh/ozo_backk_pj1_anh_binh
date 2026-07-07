// Chẩn đoán đồng bộ Lark: xem Lark trả gì cho từng thành viên nhóm.
const { listChats, listChatMembers, getUserDetail, getDepartment } = require('../src/services/lark/larkClient');
const { mapLarkDept } = require('../src/services/lark/larkDeptMap');

(async () => {
  const chats = (await listChats()).filter((c) => c.chat_mode === 'group');
  if (!chats.length) return console.log('Bot không ở nhóm nào (hoặc thiếu scope im:chat).');

  for (const chat of chats) {
    console.log(`\n===== NHÓM: ${chat.name} (${chat.chat_id}) =====`);
    const members = await listChatMembers(chat.chat_id);
    if (!members.length) console.log('  (không liệt kê được thành viên — thiếu scope im:chat.members?)');
    for (const m of members) {
      const openId = m.member_id;
      const u = await getUserDetail(openId);
      if (!u) { console.log(`  - ${m.name || openId}: KHÔNG đọc được user (thiếu scope contact:user.base:readonly?)`); continue; }
      const email = u.email || u.enterprise_email || '(none)';
      const deptIds = u.department_ids || [];
      console.log(`  - ${u.name} | ${email} | department_ids: ${JSON.stringify(deptIds)}`);
      if (!deptIds.length) console.log('      (user không có department_ids — kiểm field/scope contact)');
      for (const did of deptIds) {
        const d = await getDepartment(did);
        if (!d) { console.log(`      dept ${did}: KHÔNG đọc được (thiếu scope contact:department.base:readonly?)`); continue; }
        const isLeader = d.leader_user_id && d.leader_user_id === openId;
        console.log(`      dept: "${d.name}" -> map: ${mapLarkDept(d.name) || '(chưa map)'} | leader_user_id=${d.leader_user_id || '-'} | LÀ LEADER: ${isLeader}`);
      }
    }
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
