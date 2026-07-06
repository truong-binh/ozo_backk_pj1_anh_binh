const { getSupabaseClient } = require('../../config/supabaseClient');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Tra pic_members theo email -> { authed, email, picName }.
// Dùng để quyết định quyền GHI của người gửi Lark.
async function resolvePicByEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { authed: false, email: '', picName: null };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pic_members')
    .select('pic_name')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;

  if (data && data.pic_name) {
    return { authed: true, email, picName: data.pic_name };
  }
  return { authed: false, email, picName: null };
}

module.exports = { resolvePicByEmail, normalizeEmail };
