const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireManager } = require('../middleware/auth');
const { runReminders } = require('../services/reminders/reminderService');
const { sendDailyReport } = require('../services/reminders/reportService');

const router = express.Router();

// Chạy nhắc việc thủ công (Quản lý). ?dryRun=true để xem trước, không gửi.
router.post(
  '/run',
  requireManager,
  asyncHandler(async (req, res) => {
    const dryRun = String(req.query.dryRun ?? req.body?.dryRun ?? '') === 'true';
    const result = await runReminders({ dryRun });
    res.json(result);
  }),
);

// Gửi báo cáo tiến độ vào nhóm Lark (Quản lý). ?dryRun=true để xem trước.
router.post(
  '/report',
  requireManager,
  asyncHandler(async (req, res) => {
    const dryRun = String(req.query.dryRun ?? req.body?.dryRun ?? '') === 'true';
    const result = await sendDailyReport({ dryRun });
    res.json(result);
  }),
);

module.exports = { reminderRoutes: router };
