const express = require('express');
const cors = require('cors');
const { nodeEnv } = require('./config/env');
const { isConfigured } = require('./config/supabaseClient');
const { projectRoutes } = require('./routes/projectRoutes');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    env: nodeEnv,
    supabaseConfigured: isConfigured,
  });
});

app.use('/api/projects', projectRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

module.exports = { app };

