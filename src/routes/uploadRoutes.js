const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/asyncHandler');
const { isCloudinaryConfigured, uploadBuffer } = require('../config/cloudinary');

const MAX_UPLOAD_MB = 25;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 }, // tối đa 25MB / file
});

// Nhận mọi loại file (ảnh, PDF, Word, Excel…) nhưng đổi lỗi multer thành thông
// báo tiếng Việt rõ ràng thay vì 500 "File too large".
function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(413)
        .json({ error: `File quá nặng — tối đa ${MAX_UPLOAD_MB}MB mỗi file.` });
    }
    return res.status(400).json({ error: err.message || 'Không đọc được file tải lên' });
  });
}

// Tên file trong multipart bị busboy đọc theo latin1 -> tên tiếng Việt hiện sai
// (mojibake). Thấy dấu hiệu đó thì giải mã lại sang UTF-8, rồi chuẩn hoá NFC để
// hiển thị đúng ("Học phần...").
const MOJIBAKE = /[\u00C0-\u00FF][\u0080-\u00BF]/;
function displayName(raw) {
  let name = String(raw || 'file');
  if (MOJIBAKE.test(name)) {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (!decoded.includes('�')) name = decoded;
  }
  return name.normalize('NFC');
}

// public_id trên Cloudinary: bỏ dấu & ký tự lạ để URL sạch, không vỡ khi tải về.
function asciiName(name) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^\w.\- ]+/g, '_')
      .trim() || 'file'
  );
}

const router = express.Router();

router.post(
  '/',
  uploadSingle,
  asyncHandler(async (req, res) => {
    if (req.user?.role === 'viewer') {
      return res.status(403).json({ error: 'Bạn không có quyền tải file' });
    }
    if (!isCloudinaryConfigured) {
      return res.status(500).json({ error: 'Máy chủ chưa cấu hình Cloudinary' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Thiếu file tải lên' });
    }

    const name = displayName(req.file.originalname);
    const result = await uploadBuffer(req.file.buffer, asciiName(name), req.file.mimetype);
    res.json({ name, url: result.secure_url });
  }),
);

module.exports = { uploadRoutes: router };
