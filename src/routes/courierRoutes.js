import { Router } from 'express';
import {
  getCouriers,
  getCourier,
  createCourier,
  updateCourier,
  updateCourierStatus,
  deleteCourier,
} from '../controllers/courierController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.route('/').get(getCouriers).post(requireRole('admin', 'dispatcher'), createCourier);

router
  .route('/:id')
  .get(getCourier)
  .patch(requireRole('admin', 'dispatcher'), updateCourier)
  .delete(requireRole('admin'), deleteCourier);

router.patch('/:id/status', requireRole('admin', 'dispatcher'), updateCourierStatus);

export default router;
