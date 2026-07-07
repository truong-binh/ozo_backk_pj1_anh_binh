// Map TÊN phòng ban trên Lark -> MÃ phòng của app (BGĐ, NCC, PC, PC-DV, PP, RD, Sale, TK).
// BỔ SUNG theo cơ cấu Lark thực tế của bạn. Khớp không phân biệt hoa/thường và tiền tố "Phòng ".
const LARK_DEPT_MAP = {
  'Phòng RnD': 'RD',
  'RnD': 'RD',
  'BGĐ': 'BGĐ',
  'Phòng Kế Toán': 'KT',
  'Phòng Kho Vận': 'KV',
  'Phòng CSKH': 'CSKH',
  'Phòng Marketing': 'MKT',
  'Phòng Truyền thông': 'TT',
  'Trợ Lý AI': 'AI',
  // Ví dụ bổ sung (sửa theo tên phòng thật trên Lark):
  // 'Phòng Phát triển sản phẩm': 'PP',
  // 'Phòng Pháp chế - Dịch vụ': 'PC-DV',
  // 'Phòng Pháp chế': 'PC',
  // 'Phòng Thiết kế': 'TK',
  // 'Phòng Mua hàng': 'NCC',
  // 'Phòng Kinh doanh': 'Sale',
  // 'Ban Giám đốc': 'BGĐ',
};

function stripPrefix(s) {
  return String(s || '').trim().replace(/^phòng\s+/i, '').trim();
}

// Trả mã phòng app từ tên phòng Lark ('' nếu không map được).
function mapLarkDept(larkName) {
  const name = String(larkName || '').trim();
  if (!name) return '';
  if (LARK_DEPT_MAP[name]) return LARK_DEPT_MAP[name];
  const target = stripPrefix(name).toLowerCase();
  for (const [k, v] of Object.entries(LARK_DEPT_MAP)) {
    if (stripPrefix(k).toLowerCase() === target) return v;
  }
  return '';
}

module.exports = { LARK_DEPT_MAP, mapLarkDept };
