const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/asyncHandler');
const { isCloudinaryConfigured, uploadBuffer } = require('../config/cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // tối đa 25MB / file
});

const router = express.Router();

router.post(
  '/',
  upload.single('file'),
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
