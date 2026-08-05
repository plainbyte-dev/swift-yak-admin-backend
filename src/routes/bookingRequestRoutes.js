import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createBookingRequest,
  getBookingRequests,
  getBookingRequest,
  updateBookingRequestStatus,
  convertToShipment,
} from '../controllers/bookingRequestController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

// Unauthenticated write endpoint — tighter limit than the global /api limiter.
const createBookingRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking requests from this address. Please try again later.' },
});

router.post('/', createBookingRequestLimiter, createBookingRequest);

router.use(protect);
router.get('/', requireRole('admin', 'dispatcher'), getBookingRequests);
router.get('/:id', requireRole('admin', 'dispatcher'), getBookingRequest);
router.patch('/:id/status', requireRole('admin', 'dispatcher'), updateBookingRequestStatus);
router.post('/:id/convert', requireRole('admin', 'dispatcher'), convertToShipment);

export default router;
