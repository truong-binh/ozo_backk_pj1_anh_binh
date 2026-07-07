// Nhắc việc cho PIC qua Lark DM. Ba loại nhắc:
//   - assigned : việc mới được giao (node có PIC) -> nhắc 1 lần cho mỗi PIC/node
//   - due_soon : trước hạn ~24h (hạn = ngày mai theo giờ VN) -> nhắc 1 lần cho mỗi mốc hạn
//   - overdue  : quá hạn -> nhắc MỖI NGÀY 1 lần cho tới khi 'Đã xong'/'Bỏ qua'
// Chống gửi trùng bằng bảng public.sent_reminders (dedup theo project/node/kind/dedup_key).
// Hạn (due) tính động bằng computeAllDates — không lưu sẵn trong DB.

const { listProjectsWithNodes } = require('../projectService');
const { getSupabaseClient } = require('../../config/supabaseClient');
const { computeAllDates } = require('../../utils/datePlanner');
const { sendTextByEmail } = require('../lark/larkClient');

const TZ = 'Asia/Ho_Chi_Minh';
const DONE = new Set(['Đã xong', 'Bỏ qua']);

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// Ngày hôm nay theo giờ VN, kèm mốc UTC-midnight để trừ ngày an toàn.
function vnToday() {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, iso, utc: Date.UTC(y, m - 1, d) };
}

function fmtDMY(y, m, d) {
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Map pic_name (chuẩn hoá) -> email, lấy từ pic_members.
async function loadPicEmailMap() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('pic_members').select('email,pic_name');
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    if (row.pic_name && row.email) map.set(norm(row.pic_name), row.email);
  }
  return map;
}

// Duyệt tất cả dự án -> danh sách nhắc ứng viên (chưa dedupe, chưa gắn email).
async function computeReminderItems() {
  const today = vnToday();
  const projects = await listProjectsWithNodes();
  const items = [];

  for (const { project, nodes } of projects) {
    const dates = computeAllDates({ project, nodes });
    for (const node of nodes) {
      if (!node.pic || !String(node.pic).trim()) continue;
      if (DONE.has(node.status)) continue;

      const due = dates[node.node_id]?.due;
      if (!due) continue;

      const dy = due.getFullYear();
      const dm = due.getMonth() + 1;
      const dd = due.getDate();
      const dueUtc = Date.UTC(dy, dm - 1, dd);
      const dueIso = `${dy}-${String(dm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      const diffDays = Math.round((dueUtc - today.utc) / 86400000);

      const base = {
        project,
        node,
        pic: node.pic,
        dueLabel: fmtDMY(dy, dm, dd),
      };

      // Việc mới giao: ứng viên mọi lần chạy, dedup theo PIC -> chỉ gửi 1 lần/PIC/node.
      items.push({ ...base, kind: 'assigned', dedup_key: norm(node.pic) });

      // Trước hạn ~24h: hạn rơi đúng vào ngày mai.
      if (diffDays === 1) {
        items.push({ ...base, kind: 'due_soon', dedup_key: dueIso });
      }

      // Quá hạn: nhắc mỗi ngày (dedup theo ngày hôm nay).
      if (diffDays < 0) {
        items.push({ ...base, kind: 'overdue', dedup_key: today.iso, lateDays: -diffDays });
      }
    }
  }
  return { items, today };
}

// Bỏ các item đã gửi rồi (đọc toàn bộ sent_reminders — bảng nhỏ theo quy mô đội).
async function filterUnsent(items) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sent_reminders')
    .select('project_id,node_id,kind,dedup_key');
  if (error) {
    const e = new Error(
      'Không đọc được bảng sent_reminders (đã chạy sql/reminders.sql chưa?): ' + error.message,
    );
    e.code = 'NO_TABLE';
    throw e;
  }
  const seen = new Set(
    (data || []).map((r) => `${r.project_id}|${r.node_id}|${r.kind}|${r.dedup_key}`),
  );
  // "Lần đầu" chỉ tính theo dòng của nhắc-PIC, KHÔNG tính dòng báo cáo nhóm
  // (daily_report) — nếu không, sau khi báo cáo chạy 1 lần sẽ hiểu nhầm là đã
  // qua lần đầu và gửi ồ ạt "việc mới giao" cho mọi việc cũ.
  const PIC_KINDS = new Set(['assigned', 'due_soon', 'overdue']);
  const firstRun = (data || []).filter((r) => PIC_KINDS.has(r.kind)).length === 0;
  const remaining = items.filter(
    (it) => !seen.has(`${it.project.id}|${it.node.node_id}|${it.kind}|${it.dedup_key}`),
  );
  return { remaining, firstRun };
}

async function recordSent(items) {
  if (!items.length) return;
  const supabase = getSupabaseClient();
  const rows = items.map((it) => ({
    project_id: it.project.id,
    node_id: it.node.node_id,
    kind: it.kind,
    dedup_key: it.dedup_key,
    pic: it.pic,
    email: it.email || null,
  }));
  const { error } = await supabase
    .from('sent_reminders')
    .upsert(rows, { onConflict: 'project_id,node_id,kind,dedup_key', ignoreDuplicates: true });
  if (error) throw error;
}

function composeMessage(list) {
  const byKind = { assigned: [], due_soon: [], overdue: [] };
  for (const it of list) byKind[it.kind].push(it);

  const line = (it) => `• [${it.project.code}] ${it.node.node_id} – ${it.node.node_name || ''} (hạn ${it.dueLabel})`;
  const out = ['📋 Nhắc việc – Feelex QLDA', ''];

  if (byKind.assigned.length) {
    out.push('🔔 Việc mới được giao:');
    byKind.assigned.forEach((it) => out.push(line(it)));
    out.push('');
  }
  if (byKind.due_soon.length) {
    out.push('⏰ Sắp đến hạn (trong 24h):');
    byKind.due_soon.forEach((it) => out.push(line(it)));
    out.push('');
  }
  if (byKind.overdue.length) {
    out.push('⚠️ Việc quá hạn:');
    byKind.overdue.forEach((it) =>
      out.push(`• [${it.project.code}] ${it.node.node_id} – ${it.node.node_name || ''} (quá hạn ${it.lateDays} ngày, hạn ${it.dueLabel})`),
    );
    out.push('');
  }
  out.push('Nhắn cập nhật cho tôi lúc xong hoặc cập nhật tiến độ trên Feelex QLDA - https://ozo-truong-binhs-projects.vercel.app. Cảm ơn bạn!');
  return out.join('\n');
}

// Chạy 1 lượt nhắc. options:
//   dryRun=true -> chỉ tính & trả nội dung, KHÔNG gửi, KHÔNG ghi DB.
async function runReminders({ dryRun = false } = {}) {
  const picEmail = await loadPicEmailMap();
  const { items } = await computeReminderItems();

  let remaining = items;
  let firstRun = false;
  try {
    const filtered = await filterUnsent(items);
    remaining = filtered.remaining;
    firstRun = filtered.firstRun;
  } catch (err) {
    if (err.code === 'NO_TABLE') {
      // dryRun vẫn xem trước được dù chưa tạo bảng; chạy thật thì dừng có báo lỗi.
      if (!dryRun) return { ok: false, error: err.message };
    } else {
      throw err;
    }
  }

  // Gắn email cho từng item; tách nhóm gửi được / thiếu email.
  for (const it of remaining) it.email = picEmail.get(norm(it.pic)) || null;
  const sendable = remaining.filter((it) => it.email);
  const noEmail = remaining.filter((it) => !it.email);
  const missingPics = [...new Set(noEmail.map((it) => it.pic))];

  // Lần chạy ĐẦU TIÊN (bảng rỗng): ghi nhận hiện trạng, KHÔNG gửi để tránh spam
  // hàng loạt việc cũ. Từ lần sau chỉ những thay đổi mới mới được gửi.
  if (firstRun && !dryRun) {
    await recordSent(sendable);
    return {
      ok: true,
      firstRun: true,
      backfilled: sendable.length,
      sent: 0,
      noEmailItems: noEmail.length,
      missingPics,
      note: 'Lần đầu: đã ghi nhận hiện trạng, chưa gửi tin nào.',
    };
  }

  // Gộp theo email -> 1 tin/người.
  const byEmail = new Map();
  for (const it of sendable) {
    if (!byEmail.has(it.email)) byEmail.set(it.email, []);
    byEmail.get(it.email).push(it);
  }

  const preview = [];
  const sentItems = [];
  for (const [email, list] of byEmail) {
    const text = composeMessage(list);
    if (dryRun) {
      preview.push({ email, count: list.length, text });
      continue;
    }
    const res = await sendTextByEmail(email, text);
    if (res && res.code === 0) sentItems.push(...list);
    else preview.push({ email, count: list.length, ok: false, err: res?.msg });
  }

  if (!dryRun) await recordSent(sentItems);

  return {
    ok: true,
    dryRun,
    people: byEmail.size,
    sent: dryRun ? 0 : sentItems.length,
    noEmailItems: noEmail.length,
    missingPics,
    preview: dryRun ? preview : preview.length ? preview : undefined,
  };
}

module.exports = { runReminders };
