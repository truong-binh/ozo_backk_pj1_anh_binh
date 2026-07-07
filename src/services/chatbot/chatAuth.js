const { getMemberByEmail, leadDeptsOf } = require('../picMembersService');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Tra pic_members theo email -> { authed, email, picName, leadDepts }.
// Dùng để quyết định quyền GHI của người gửi Lark (PIC hoặc trưởng phòng).
async function resolvePicByEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { authed: false, email: '', picName: null, leadDepts: [] };

  const member = await getMemberByEmail(email);
  if (member && member.pic_name) {
    return { authed: true, email, picName: member.pic_name, leadDepts: leadDeptsOf(member) };
  }
  return { authed: false, email, picName: null, leadDepts: [] };
}

module.exports = { resolvePicByEmail, normalizeEmail };
