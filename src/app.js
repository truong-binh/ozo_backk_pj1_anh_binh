const express = require('express');
const cors = require('cors');
const { nodeEnv } = require('./config/env');
const { isConfigured } = require('./config/supabaseClient');
const { isMailConfigured } = require('./config/mailer');
const { isCloudinaryConfigured } = require('./config/cloudinary');
const { projectRoutes } = require('./routes/projectRoutes');
const { authRoutes } = require('./routes/authRoutes');
const { uploadRoutes } = require('./routes/uploadRoutes');
const { larkRoutes } = require('./routes/larkRoutes');
const { reminderRoutes } = require('./routes/reminderRoutes');
const { picMembersRoutes } = require('./routes/picMembersRoutes');
const { feedbackRoutes } = require('./routes/feedbackRoutes');
const { isLarkConfigured } = require('./services/lark/larkClient');
const { isLlmConfigured, provider: llmProviderName } = require('./services/chatbot/agent');
const { requireAuth, restrictGuest, denyGuest } = require('./middleware/auth');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    env: nodeEnv,
    supabaseConfigured: isConfigured,
    mailConfigured: isMailConfigured,
    cloudinaryConfigured: isCloudinaryConfigured,
    larkConfigured: isLarkConfigured,
    llmProvider: llmProviderName,
    llmConfigured: isLlmConfigured,
  });
});

app.get('/test', (req, res) => {
  res.status(200).json({ message: 'ok' });
});

app.use('/api/auth', authRoutes);
// Webhook Lark: Lark gọi trực tiếp, không qua requireAuth (tự verify bằng token).
app.use('/api/lark', larkRoutes);
app.use('/api/uploads', requireAuth, denyGuest, uploadRoutes);
// Tất cả API dự án đều yêu cầu đăng nhập; quyền sửa (PIC) kiểm trong route.
// Khách 'chỉ xem' chỉ qua được GET /with-nodes (bảng Ngày hàng về) — xem restrictGuest.
app.use('/api/projects', requireAuth, restrictGuest, projectRoutes);
app.use('/api/reminders', requireAuth, denyGuest, reminderRoutes);
app.use('/api/pic-members', requireAuth, denyGuest, picMembersRoutes);
// Góp ý & feedback chatbot: xem/xoá — chỉ Quản lý (kiểm trong route).
app.use('/api/feedback', requireAuth, denyGuest, feedbackRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Internal server error' });
});

module.exports = { app };
