const { v2: cloudinary } = require('cloudinary');
const {
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
} = require('./env');

const isCloudinaryConfigured = Boolean(
  cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudinaryCloudName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret,
    secure: true,
  });
}

// Upload buffer lên Cloudinary, trả về URL công khai (secure_url).
// resource_type: ẢNH -> 'image' (xem/preview được); MỌI FILE KHÁC -> 'raw' để
// giữ nguyên đuôi & tên file khi tải về (Word/Excel/CSV/txt chạy tốt).
// LƯU Ý: Cloudinary chặn phát PDF/ZIP theo ĐUÔI FILE (Settings > Security >
// Restricted media types), không theo resource_type — nên PDF vẫn trả HTTP 401
// (x-cld-error: deny or ACL failure) cho tới khi bỏ tick PDF trong mục đó.
// Không có cách né từ code: đổi sang đuôi lạ thì Cloudinary chặn ngay lúc upload.
function uploadBuffer(buffer, filename, mimetype) {
  const isImage = String(mimetype || '').startsWith('image/');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'feelex-attachments',
        resource_type: isImage ? 'image' : 'raw',
        use_filename: true,
        unique_filename: true,
        filename_override: filename || undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

module.exports = { isCloudinaryConfigured, uploadBuffer };
