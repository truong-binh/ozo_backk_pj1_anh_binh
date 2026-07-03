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

  // Lark (Feishu) custom app
  larkAppId: process.env.LARK_APP_ID || '',
  larkAppSecret: process.env.LARK_APP_SECRET || '',
  // open.larksuite.com cho Lark quốc tế; open.feishu.cn cho Feishu (TQ)
  larkBaseUrl: process.env.LARK_BASE_URL || 'https://open.larksuite.com',
};
