import { Router } from 'express';
import {
  getShipments,
  getShipment,
  createShipment,
  updateShipment,
  assignCourier,
  updateShipmentStatus,
  deleteShipment,
  getShipmentEvents
} from '../controllers/shipmentController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.route('/').get(getShipments).post(requireRole('admin', 'dispatcher'), createShipment);

router
  .route('/:id')
  .get(getShipment)
  .patch(requireRole('admin', 'dispatcher'), updateShipment)
  .delete(requireRole('admin'), deleteShipment);

router.patch('/:id/assign', requireRole('admin', 'dispatcher'), assignCourier);
router.patch('/:id/status', requireRole('admin', 'dispatcher'), updateShipmentStatus);
router.get('/:id/events', protect, getShipmentEvents);
export default router;
