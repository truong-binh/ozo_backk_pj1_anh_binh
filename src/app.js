const express = require('express');
const cors = require('cors');
const { nodeEnv } = require('./config/env');
const { isConfigured } = require('./config/supabaseClient');
const { isMailConfigured } = require('./config/mailer');
const { isCloudinaryConfigured } = require('./config/cloudinary');
const { projectRoutes } = require('./routes/projectRoutes');
const { authRoutes } = require('./routes/authRoutes');
const { uploadRoutes } = require('./routes/uploadRoutes');
const { requireAuth } = require('./middleware/auth');

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
  });
});

app.get('/test', (req, res) => {
  res.status(200).json({ message: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/uploads', requireAuth, uploadRoutes);
// Tất cả API dự án đều yêu cầu đăng nhập; quyền sửa (PIC) kiểm trong route.
app.use('/api/projects', requireAuth, projectRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Internal server error' });
});

module.exports = { app };
