import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/metricsController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', protect, getDashboardMetrics);

export default router;
