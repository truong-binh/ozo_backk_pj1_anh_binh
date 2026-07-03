const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const {
  postRequestCode,
  postVerifyCode,
  postElevate,
  getMe,
} = require('../controllers/authController');

const router = express.Router();

router.post('/request-code', asyncHandler(postRequestCode));
router.post('/verify', asyncHandler(postVerifyCode));
router.post('/elevate', requireAuth, asyncHandler(postElevate));
router.get('/me', requireAuth, asyncHandler(getMe));

module.exports = { authRoutes: router };
