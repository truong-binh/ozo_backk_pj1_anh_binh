const { verifyToken } = require('../services/authService');

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

// Yêu cầu đã đăng nhập. Gắn req.user = { id, email, role, picName }.
function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      picName: payload.picName || null,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
}

// Yêu cầu quyền Quản lý (sửa tất cả). Dùng SAU requireAuth.
function requireManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Chỉ Quản lý mới có quyền này' });
  }
  next();
}

module.exports = { requireAuth, requireManager };
