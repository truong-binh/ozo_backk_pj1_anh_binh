const { getMemberByEmail, getMemberByOpenId, leadDeptsOf } = require('../picMembersService');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Tra pic_members theo open_id (Lark) -> { authed, openId, email, picName, leadDepts }.
// Ưu tiên cách này vì open_id luôn có, kể cả người đăng ký Lark bằng SĐT/ẩn mail.
async function resolvePicByOpenId(openId) {
  const oid = String(openId || '').trim();
  if (!oid) return { authed: false, openId: '', email: '', picName: null, leadDepts: [] };

  const member = await getMemberByOpenId(oid);
  if (member && member.pic_name) {
    return {
      authed: true,
      openId: oid,
      email: member.email || '',
      picName: member.pic_name,
      dept: member.dept || null,
      leadDepts: leadDeptsOf(member),
    };
  }
  return { authed: false, openId: oid, email: '', picName: null, dept: null, leadDepts: [] };
}

// Tra pic_members theo email -> { authed, email, picName, leadDepts }.
// Dùng để quyết định quyền GHI của người gửi Lark (PIC hoặc trưởng phòng).
async function resolvePicByEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { authed: false, email: '', picName: null, dept: null, leadDepts: [] };

  const member = await getMemberByEmail(email);
  if (member && member.pic_name) {
    return {
      authed: true,
      email,
      picName: member.pic_name,
      dept: member.dept || null,
      leadDepts: leadDeptsOf(member),
    };
  }
  return { authed: false, email, picName: null, dept: null, leadDepts: [] };
}

module.exports = { resolvePicByEmail, resolvePicByOpenId, normalizeEmail };
