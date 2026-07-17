// Chuẩn hoá trường PIC của 1 bước. Từ khi hỗ trợ NHIỀU người/1 bước, cột
// project_nodes.pic là text[] (mảng tên). Các hàm dưới quy mọi kiểu (mảng /
// chuỗi cũ / null) về mảng tên sạch, và ngược lại để hiển thị.

function toPicArray(value) {
  if (Array.isArray(value)) {
    return value.map((s) => String(s || '').trim()).filter(Boolean);
  }
  const s = String(value || '').trim();
  return s ? [s] : [];
}

// Ghép danh sách PIC để hiển thị / log ('' nếu chưa gán).
function picText(value, sep = ', ') {
  return toPicArray(value).join(sep);
}

// PIC đầu tiên (dùng khi cần 1 đại diện, vd phòng mặc định).
function firstPic(value) {
  return toPicArray(value)[0] || '';
}

module.exports = { toPicArray, picText, firstPic };
