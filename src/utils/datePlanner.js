// Port của frontend/src/datePlanner.ts sang CommonJS để chatbot tính ngày.
// Làm việc trên shape { project, nodes } giống getProjectDetail trả về.

function isoLocal(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

// Hôm nay theo giờ VN dạng 'YYYY-MM-DD'. Server có thể chạy ở UTC (Render) nên
// không dùng giờ máy — dùng để tự điền NGÀY THỰC TẾ khi bước chuyển 'Đã xong'.
function todayIsoVN() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Ngày lễ VN (đồng bộ với frontend). Mở rộng khi cần.
const VN_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
  '2025-02-01', '2025-04-07', '2025-04-30', '2025-05-01', '2025-09-01', '2025-09-02',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-04-26', '2026-04-30', '2026-05-01', '2026-09-02', '2026-09-03',
  // 2027
  '2027-01-01', '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09',
  '2027-04-16', '2027-04-30', '2027-05-01', '2027-09-02',
  // 2028
  '2028-01-01', '2028-01-25', '2028-01-26', '2028-01-27', '2028-01-28', '2028-01-29',
  '2028-04-04', '2028-04-30', '2028-05-01', '2028-09-02',
]);

function isWorkingDay(d) {
  if (d.getDay() === 0) return false; // Chủ nhật
  if (VN_HOLIDAYS.has(isoLocal(d))) return false;
  return true;
}

function addWorkingDays(start, n) {
  const cur = new Date(start);
  if (n <= 0) return cur;
  let added = 0;
  while (added < n) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkingDay(cur)) added++;
  }
  return cur;
}

function parseLocalDate(s) {
  if (!s) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getDuration(node) {
  if (node.status === 'Bỏ qua') return 0;
  if (typeof node.duration === 'number' && node.duration >= 0) return node.duration;
  return 0;
}

// DAG planner: tính {start,due} cho từng node theo `after`, status, actual_date.
function computeAllDates(detail) {
  const nodeById = new Map(detail.nodes.map((n) => [n.node_id, n]));
  const cache = {};
  const visiting = {};
  const projectStart = parseLocalDate(detail.project.start_date) || new Date();

  function compute(nodeId) {
    if (cache[nodeId]) return cache[nodeId];
    if (visiting[nodeId]) {
      const d = new Date(projectStart);
      return { start: d, due: d };
    }
    const node = nodeById.get(nodeId);
    if (!node) {
      const d = new Date(projectStart);
      const out = { start: d, due: d };
      cache[nodeId] = out;
      return out;
    }
    visiting[nodeId] = true;
    const deps = (node.after || []).filter((d) => d !== nodeId && nodeById.has(d));
    let start;
    if (deps.length === 0) {
      start = new Date(projectStart);
    } else {
      const finishes = deps.map((depId) => {
        const depNode = nodeById.get(depId);
        const actual = parseLocalDate(depNode?.actual_date || null);
        const depDates = compute(depId);
        return (actual || depDates.due).getTime();
      });
      start = new Date(Math.max(...finishes));
    }
    const due = addWorkingDays(start, getDuration(node));
    visiting[nodeId] = false;
    const out = { start, due };
    cache[nodeId] = out;
    return out;
  }

  for (const n of detail.nodes) compute(n.node_id);
  return cache;
}

function lateDays(detail, nodeId, dates) {
  const node = detail.nodes.find((n) => n.node_id === nodeId);
  if (!node) return 0;
  if (node.status === 'Đã xong' || node.status === 'Bỏ qua') return 0;
  const due = dates[nodeId]?.due;
  if (!due) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.floor((today.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

module.exports = { computeAllDates, lateDays, parseLocalDate, isoLocal, todayIsoVN };
