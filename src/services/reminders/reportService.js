// Báo cáo tiến độ tổng gửi vào NHÓM Lark mỗi 9h sáng (giờ VN).
// Gộp toàn bộ dự án: quá hạn, tới hạn hôm nay, sắp tới hạn (≤2 ngày) + chi tiết từng bước.
// Hạn (due) tính động bằng computeAllDates.

const { listProjectsWithNodes } = require('../projectService');
const { computeAllDates } = require('../../utils/datePlanner');
const { sendText, listChats } = require('../lark/larkClient');
const { larkReportChatId, appUrl } = require('../../config/env');

const TZ = 'Asia/Ho_Chi_Minh';
const DONE = new Set(['Đã xong', 'Bỏ qua']);

function vnToday() {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, utc: Date.UTC(y, m - 1, d) };
}

function fmtDMY(y, m, d) {
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

async function computeReport() {
  const today = vnToday();
  const projects = await listProjectsWithNodes();
  const overdue = [];
  const dueToday = [];
  const dueSoon = [];

  for (const { project, nodes } of projects) {
    const dates = computeAllDates({ project, nodes });
    for (const node of nodes) {
      if (DONE.has(node.status)) continue;
      const due = dates[node.node_id]?.due;
      if (!due) continue;
      const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
      const diff = Math.round((dueUtc - today.utc) / 86400000);
      const rec = {
        project,
        node,
        pic: node.pic && String(node.pic).trim() ? node.pic : '—',
        dueLabel: fmtDMY(due.getFullYear(), due.getMonth() + 1, due.getDate()),
        diff,
      };
      if (diff < 0) overdue.push({ ...rec, lateDays: -diff });
      else if (diff === 0) dueToday.push(rec);
      else if (diff <= 2) dueSoon.push(rec);
    }
  }

  overdue.sort((a, b) => b.lateDays - a.lateDays);
  dueSoon.sort((a, b) => a.diff - b.diff);
  return { today, overdue, dueToday, dueSoon };
}

function line(r) {
  return `• [${r.project.code}] ${r.node.node_id} ${r.node.node_name || ''} — PIC: ${r.pic} (hạn ${r.dueLabel})`;
}

function formatReport(rep) {
  const L = [];
  L.push('📊 BÁO CÁO TIẾN ĐỘ DỰ ÁN');
  L.push(`🗓️ Ngày cập nhật: ${fmtDMY(rep.today.y, rep.today.m, rep.today.d)}`);
  L.push('');

  L.push(`⚠️ Quá hạn: ${rep.overdue.length} bước`);
  rep.overdue.forEach((r) =>
    L.push(`• [${r.project.code}] ${r.node.node_id} ${r.node.node_name || ''} — PIC: ${r.pic} (quá ${r.lateDays} ngày, hạn ${r.dueLabel})`),
  );
  L.push('');

  L.push(`🔴 Tới hạn hôm nay: ${rep.dueToday.length} bước`);
  rep.dueToday.forEach((r) => L.push(line(r)));
  L.push('');

  L.push(`🟡 Sắp tới hạn (≤2 ngày): ${rep.dueSoon.length} bước`);
  rep.dueSoon.forEach((r) => L.push(line(r)));
  L.push('');

  L.push(`💬 PIC Nhắn tin với bot để cập nhật công việc, hoặc truy cập ${appUrl}`);
  return L.join('\n');
}

// Xác định danh sách chat_id nhóm nhận báo cáo.
async function resolveChatIds() {
  if (larkReportChatId) {
    return larkReportChatId.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const chats = await listChats();
  return chats.filter((c) => c.chat_mode === 'group').map((c) => c.chat_id);
}

// Gửi báo cáo. dryRun=true -> chỉ trả nội dung, không gửi.
async function sendDailyReport({ dryRun = false } = {}) {
  const rep = await computeReport();
  const text = formatReport(rep);
  const counts = {
    overdue: rep.overdue.length,
    dueToday: rep.dueToday.length,
    dueSoon: rep.dueSoon.length,
  };

  if (dryRun) return { ok: true, dryRun: true, counts, text };

  const chatIds = await resolveChatIds();
  if (!chatIds.length) {
    return { ok: false, error: 'Không tìm thấy nhóm nào (bot đã được add vào nhóm chưa? hoặc set LARK_REPORT_CHAT_ID).', counts };
  }
  const sentTo = [];
  for (const cid of chatIds) {
    const r = await sendText(cid, text);
    sentTo.push({ chat_id: cid, ok: r?.code === 0, msg: r?.msg });
  }
  return { ok: true, counts, sentTo };
}

module.exports = { computeReport, formatReport, sendDailyReport };
