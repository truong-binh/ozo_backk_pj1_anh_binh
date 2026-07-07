// Quét thành viên các nhóm Lark bot tham gia -> báo ai có/không có email.
require('dotenv').config();
const { listChats, listChatMembers, getUserDetail } = require('../src/services/lark/larkClient');

(async () => {
  const chats = (await listChats()).filter((c) => c.chat_mode === 'group');
  if (!chats.length) return console.log('Bot không ở nhóm nào (hoặc thiếu scope im:chat).');

  const seen = new Map(); // open_id -> {name, email, mobile}
  for (const chat of chats) {
    const members = await listChatMembers(chat.chat_id);
    for (const m of members) {
      const openId = m.member_id;
      if (!openId || seen.has(openId)) continue;
      const u = await getUserDetail(openId);
      if (!u) { seen.set(openId, { name: m.name || openId, email: '', mobile: '', unread: true }); continue; }
      const email = (u.email || u.enterprise_email || '').trim();
      const mobile = (u.mobile || '').trim();
      seen.set(openId, { name: u.name || m.name || openId, email, mobile });
    }
  }

  const all = [...seen.values()];
  const withMail = all.filter((u) => u.email);
  const noMail = all.filter((u) => !u.email && !u.unread);
  const unread = all.filter((u) => u.unread);

  console.log(`\nTỔNG: ${all.length} người | CÓ email: ${withMail.length} | KHÔNG email: ${noMail.length} | không đọc được: ${unread.length}\n`);
  console.log('--- KHÔNG có email (đây là nhóm sẽ hỏng nếu gửi theo email) ---');
  if (!noMail.length) console.log('  (không có ai — tất cả đều có email 🎉)');
  for (const u of noMail) console.log(`  - ${u.name}${u.mobile ? ' | SĐT: ' + u.mobile : ' | (không có cả SĐT hiển thị)'}`);
  console.log('\n--- CÓ email ---');
  for (const u of withMail) console.log(`  - ${u.name} | ${u.email}`);
  if (unread.length) {
    console.log('\n--- KHÔNG đọc được chi tiết (thiếu scope contact:user.email:readonly?) ---');
    for (const u of unread) console.log(`  - ${u.name}`);
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
