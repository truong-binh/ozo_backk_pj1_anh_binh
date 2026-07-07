// Công cụ test. Chạy từ thư mục backend:
//   node scripts/reminders-test.js            -> preview nhắc PIC (dry-run), không gửi, không cần bảng
//   node scripts/reminders-test.js dm <email> -> gửi 1 Lark DM thử tới email
//   node scripts/reminders-test.js chats      -> liệt kê nhóm bot tham gia (lấy chat_id)
//   node scripts/reminders-test.js report     -> preview báo cáo nhóm (dry-run), không gửi
//   node scripts/reminders-test.js report send-> GỬI THẬT báo cáo vào nhóm Lark
//   node scripts/reminders-test.js run        -> CHẠY THẬT nhắc PIC (gửi + ghi bảng)
const mode = process.argv[2] || 'preview';

(async () => {
  if (mode === 'dm') {
    const email = process.argv[3];
    if (!email) { console.error('Thiếu email. Vd: node scripts/reminders-test.js dm rd@ozovn.com'); process.exit(1); }
    const { sendTextByEmail } = require('../src/services/lark/larkClient');
    const r = await sendTextByEmail(email, '✅ Test nhắc việc Feelex QLDA — nếu bạn thấy tin này là Lark DM đã chạy.');
    console.log(r.code === 0 ? '=> OK, kiểm tra Lark.' : `=> LỖI: ${r.code} ${r.msg}`);
    return;
  }

  if (mode === 'chats') {
    const { listChats } = require('../src/services/lark/larkClient');
    const chats = await listChats();
    if (!chats.length) { console.log('Bot chưa ở nhóm nào (hoặc thiếu quyền im:chat).'); return; }
    for (const c of chats) console.log(`${c.chat_mode}\t${c.chat_id}\t${c.name || '(không tên)'}`);
    return;
  }

  if (mode === 'report') {
    const { sendDailyReport } = require('../src/services/reminders/reportService');
    const send = process.argv[3] === 'send';
    // Gửi tay luôn force để không bị chặn bởi dedup "đã gửi hôm nay".
    const res = await sendDailyReport({ dryRun: !send, force: send });
    console.log('== BÁO CÁO ==', send ? '(GỬI THẬT)' : '(DRY-RUN)');
    console.log('counts:', JSON.stringify(res.counts), res.sentTo ? '| sentTo: ' + JSON.stringify(res.sentTo) : res.error ? '| ' + res.error : '');
    if (res.text) console.log('\n' + res.text);
    return;
  }

  const { runReminders } = require('../src/services/reminders/reminderService');
  const dryRun = mode !== 'run';
  const res = await runReminders({ dryRun });
  console.log('== NHẮC PIC ==', dryRun ? '(DRY-RUN)' : '(CHẠY THẬT)');
  console.log(JSON.stringify({ ...res, preview: undefined }, null, 2));
  for (const p of res.preview || []) {
    console.log('\n----- gửi tới:', p.email, `(${p.count} việc) -----`);
    console.log(p.text || `(lỗi: ${p.err})`);
  }
})().catch((e) => { console.error('ERROR:', e.stack || e.message); process.exit(1); });
