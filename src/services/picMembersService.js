// Truy vấn pic_members dùng chung cho auth, chatbot, tạo dự án, đồng bộ Lark.
// Resilient: nếu cột dept/is_leader chưa được tạo thì tự fallback (không vỡ).
const { getSupabaseClient } = require('../config/supabaseClient');

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// Nhãn PIC mặc định theo vai trò trưởng phòng (không phải tên người cụ thể).
const LEADER_LABEL_PREFIX = 'Trưởng phòng ';
function leaderLabel(dept) {
  const d = String(dept || '').trim();
  return d ? `${LEADER_LABEL_PREFIX}${d}` : '';
}
function isLeaderLabel(pic) {
  return String(pic || '').trim().startsWith(LEADER_LABEL_PREFIX);
}
// Lấy mã phòng từ nhãn "Trưởng phòng RD" -> "RD" ('' nếu không phải nhãn).
function deptFromLeaderLabel(pic) {
  const s = String(pic || '').trim();
  return s.startsWith(LEADER_LABEL_PREFIX) ? s.slice(LEADER_LABEL_PREFIX.length).trim() : '';
}

// Cột đọc theo bậc: mới nhất -> cũ dần (để không vỡ khi DB thiếu cột).
const SELECT_SPECS = [
  'pic_name,email,open_id,dept,is_leader,lead_depts',
  'pic_name,email,dept,is_leader,lead_depts',
  'pic_name,dept,is_leader,lead_depts',
  'pic_name,dept,is_leader',
  'pic_name,dept',
  'pic_name',
];

function normalizeRow(data) {
  if (!data) return null;
  return {
    pic_name: data.pic_name || null,
    email: (data.email || '').trim() || null,
    open_id: (data.open_id || '').trim() || null,
    dept: (data.dept || '').trim() || null,
    is_leader: !!data.is_leader,
    lead_depts: Array.isArray(data.lead_depts) ? data.lead_depts : [],
  };
}

// Lấy thông tin 1 PIC theo email -> { pic_name, dept, is_leader, lead_depts } | null.
async function getMemberByEmail(email) {
  const supabase = getSupabaseClient();
  const e = norm(email);
  if (!e) return null;
  for (const spec of SELECT_SPECS) {
    const { data, error } = await supabase
      .from('pic_members')
      .select(spec)
      .eq('email', e)
      .maybeSingle();
    if (!error) return normalizeRow(data);
  }
  return null;
}

// Lấy 1 PIC theo open_id (Lark) -> { pic_name, email, open_id, dept, ... } | null.
// Dùng cho chatbot & nhắc việc: open_id luôn có, kể cả người không email.
async function getMemberByOpenId(openId) {
  const supabase = getSupabaseClient();
  const oid = String(openId || '').trim();
  if (!oid) return null;
  for (const spec of SELECT_SPECS) {
    if (!spec.includes('open_id')) break; // cột chưa tồn tại -> khỏi tra
    const { data, error } = await supabase
      .from('pic_members')
      .select(spec)
      .eq('open_id', oid)
      .maybeSingle();
    if (!error) return normalizeRow(data);
  }
  return null;
}

// Đọc tất cả pic_members (graded fallback theo cột).
async function listAllMembers() {
  const supabase = getSupabaseClient();
  for (const spec of SELECT_SPECS) {
    const { data, error } = await supabase.from('pic_members').select(spec);
    if (!error) return (data || []).map(normalizeRow).filter(Boolean);
  }
  return [];
}

function nameMatches(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

// Tìm 1 PIC theo tên (khớp gần đúng, bỏ dấu) -> member | null.
async function findMemberByName(name) {
  if (!norm(name)) return null;
  const all = await listAllMembers();
  return all.find((m) => nameMatches(m.pic_name, name)) || null;
}

// Các phòng 1 người làm TRƯỞNG PHÒNG. Ưu tiên lead_depts (mảng, hỗ trợ nhiều phòng);
// fallback cờ is_leader + dept (model cũ 1 phòng).
function leadDeptsOf(member) {
  if (!member) return [];
  if (Array.isArray(member.lead_depts) && member.lead_depts.length) {
    return member.lead_depts.map((d) => String(d || '').trim()).filter(Boolean);
  }
  if (member.is_leader && member.dept) return [member.dept];
  return [];
}

// Map mã phòng -> tên PIC trưởng phòng (set PIC mặc định khi tạo dự án).
// 1 phòng nhiều leader thì lấy người đầu tiên làm mặc định.
async function getDeptLeaderMap() {
  const supabase = getSupabaseClient();
  let rows = null;
  for (const spec of ['pic_name,dept,is_leader,lead_depts', 'pic_name,dept,is_leader']) {
    const { data, error } = await supabase.from('pic_members').select(spec);
    if (!error) { rows = data; break; }
  }
  if (!rows) return {};
  const map = {};
  for (const r of rows) {
    for (const d of leadDeptsOf(normalizeRow(r))) {
      if (d && r.pic_name && !map[d]) map[d] = r.pic_name;
    }
  }
  return map;
}

module.exports = {
  getMemberByEmail,
  getMemberByOpenId,
  findMemberByName,
  listAllMembers,
  leadDeptsOf,
  getDeptLeaderMap,
  norm,
  leaderLabel,
  isLeaderLabel,
  deptFromLeaderLabel,
  LEADER_LABEL_PREFIX,
};
