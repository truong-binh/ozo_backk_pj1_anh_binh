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
function uploadBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'feelex-attachments',
        resource_type: 'auto', // nhận ảnh, pdf, file khác
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
