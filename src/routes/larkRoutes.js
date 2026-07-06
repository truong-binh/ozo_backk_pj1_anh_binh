const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { larkWebhook } = require('../controllers/larkController');

const router = express.Router();

// Webhook Lark — KHÔNG qua requireAuth (Lark gọi trực tiếp, tự verify bằng token).
router.post('/webhook', asyncHandler(larkWebhook));

module.exports = { larkRoutes: router };
