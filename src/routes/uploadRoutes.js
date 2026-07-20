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

    const result = await uploadBuffer(req.file.buffer, req.file.originalname);
    res.json({ name: req.file.originalname, url: result.secure_url });
  }),
);

module.exports = { uploadRoutes: router };
