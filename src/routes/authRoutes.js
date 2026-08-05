import { Router } from 'express';
import { login, getMe,  uploadAvatarHandler,
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor, updateMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';

const router = Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.post('/avatar', protect, uploadAvatar, uploadAvatarHandler);
router.post('/2fa/setup', protect, setupTwoFactor);
router.post('/2fa/verify', protect, verifyTwoFactor);
router.post('/2fa/disable', protect, disableTwoFactor);
 
export default router;
