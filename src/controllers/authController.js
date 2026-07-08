const {
  requestLoginCode,
  verifyLoginCode,
  verifyLoginByBotCode,
  elevateToManager,
} = require('../services/authService');

async function postRequestCode(req, res) {
  const { email } = req.body || {};
  const result = await requestLoginCode(email);
  res.json(result);
}

async function postVerifyCode(req, res) {
  const { email, code } = req.body || {};
  const result = await verifyLoginCode(email, code);
  res.json(result);
}

// Đăng nhập qua bot Lark: web chỉ gửi mã OTP (không email).
async function postVerifyLarkCode(req, res) {
  const { code } = req.body || {};
  const result = await verifyLoginByBotCode(code);
  res.json(result);
}

async function postElevate(req, res) {
  const { code } = req.body || {};
  const result = elevateToManager(req.user, code);
  res.json(result);
}

async function getMe(req, res) {
  res.json({ user: req.user });
}

module.exports = { postRequestCode, postVerifyCode, postVerifyLarkCode, postElevate, getMe };
