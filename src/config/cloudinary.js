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
// resource_type: ẢNH -> 'image' (xem/preview được); MỌI FILE KHÁC -> 'raw'.
// KHÔNG dùng 'auto': Cloudinary xếp PDF vào 'image', mà tài khoản mặc định BẬT
// luật chặn phát PDF/ZIP (Settings > Security) -> link trả HTTP 401. Đường 'raw'
// không dính luật đó nên PDF/Word/Excel tải về bình thường.
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
