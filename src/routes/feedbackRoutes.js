const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireManager } = require('../middleware/auth');
const {
  listFeedback,
  deleteFeedback,
  listSuggestions,
  deleteSuggestion,
} = require('../services/chatbot/feedbackStore');

const router = express.Router();

// Toàn bộ góp ý + feedback từ chatbot (chỉ Quản lý).
router.get(
  '/',
  requireManager,
  asyncHandler(async (_req, res) => {
    const [feedback, suggestions] = await Promise.all([
      listFeedback(),
      listSuggestions(),
    ]);
    res.json({ feedback, suggestions });
  }),
);

// Bấm "Xong" -> xoá 1 feedback.
router.delete(
  '/feedback/:id',
  requireManager,
  asyncHandler(async (req, res) => {
    await deleteFeedback(Number(req.params.id));
    res.json({ ok: true });
  }),
);

// Bấm "Xong" -> xoá 1 góp ý.
router.delete(
  '/suggestion/:id',
  requireManager,
  asyncHandler(async (req, res) => {
    await deleteSuggestion(Number(req.params.id));
    res.json({ ok: true });
  }),
);

module.exports = { feedbackRoutes: router };
