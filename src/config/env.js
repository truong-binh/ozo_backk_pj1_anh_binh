require('dotenv').config();

function parseList(value) {
  return String(value || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  // Chỉ cho phép email thuộc domain này đăng nhập (để trống = cho tất cả)
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase(),
  // Mã bí mật chung để PIC nâng quyền lên Quản lý (sửa tất cả)
  managerCode: (process.env.MANAGER_CODE || '').trim(),

  // Gửi OTP qua email (HTTP API — dùng cho deploy trên Render/Vercel vì SMTP bị chặn).
  brevoApiKey: (process.env.BREVO_API_KEY || '').trim(),
  sendgridApiKey: (process.env.SENDGRID_API_KEY || '').trim(),
  resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
  // SMTP — dùng cho local (nhiều PaaS chặn cổng SMTP).
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',
};
