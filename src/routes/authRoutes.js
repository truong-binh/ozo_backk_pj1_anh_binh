const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const {
  postRequestCode,
  postVerifyCode,
  postVerifyLarkCode,
  postGuest,
  postElevate,
  getMe,
} = require('../controllers/authController');

const router = express.Router();

router.post('/request-code', asyncHandler(postRequestCode));
router.post('/verify', asyncHandler(postVerifyCode));
router.post('/verify-lark', asyncHandler(postVerifyLarkCode));
router.post('/guest', asyncHandler(postGuest));
router.post('/elevate', requireAuth, asyncHandler(postElevate));
router.get('/me', requireAuth, asyncHandler(getMe));

module.exports = { authRoutes: router };
