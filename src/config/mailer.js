const nodemailer = require('nodemailer');
const {
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  mailFrom,
} = require('./env');

const isMailConfigured = Boolean(smtpHost && smtpUser && smtpPass);

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true cho cổng 465, false cho 587/25 (STARTTLS)
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  return transporter;
}

// Gửi mã OTP qua email. Trả về true nếu đã gửi thật.
async function sendLoginCode(email, code) {
  const from = mailFrom || smtpUser;
  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'Mã đăng nhập Feelex QLDA',
    text:
      `Mã đăng nhập Feelex QLDA của bạn là: ${code}\n` +
      `Mã có hiệu lực trong ít phút. Không chia sẻ mã này cho bất kỳ ai.`,
    html:
      `<p>Mã đăng nhập <b>Feelex QLDA</b> của bạn là:</p>` +
      `<p style="font-size:26px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p>` +
      `<p style="color:#64748b">Mã có hiệu lực trong ít phút. Không chia sẻ mã này cho bất kỳ ai.</p>`,
  });
  return true;
}

module.exports = { isMailConfigured, sendLoginCode };
