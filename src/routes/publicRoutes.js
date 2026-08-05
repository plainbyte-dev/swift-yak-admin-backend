import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { trackShipment } from '../controllers/publicController.js';

const router = Router();

// Blunts enumeration attacks against the relatively small CDK-XXXXX (5-digit) tracking-number space.
const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many tracking requests from this address. Please try again later.' },
});

router.get('/track/:trackingNumber', trackLimiter, trackShipment);

export default router;
