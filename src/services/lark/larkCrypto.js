const crypto = require('node:crypto');
const { larkEncryptKey } = require('../../config/env');

// Giải mã event mã hóa của Lark (khi bật Encrypt Key).
// Thuật toán: key = sha256(encryptKey); AES-256-CBC; iv = 16 byte đầu.
function decryptEvent(encryptBase64) {
  const key = crypto.createHash('sha256').update(larkEncryptKey).digest();
  const data = Buffer.from(encryptBase64, 'base64');
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// Trả về object event thật, dù body có mã hóa hay không.
function parseEventBody(body) {
  if (body && typeof body.encrypt === 'string') {
    if (!larkEncryptKey) {
      throw new Error('Event được mã hóa nhưng thiếu LARK_ENCRYPT_KEY');
    }
    return JSON.parse(decryptEvent(body.encrypt));
  }
  return body;
}

module.exports = { parseEventBody, decryptEvent };
