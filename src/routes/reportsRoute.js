import { Router } from 'express';
import {
  getReportsSummary,
  getVolumeTrend,
  getCompanyPerformance,
  getCourierLeaderboard,
} from '../controllers/reportsController.js';
import { protect } from '../middleware/auth.js';
 
const router = Router();
 
router.get('/summary', protect, getReportsSummary);
router.get('/volume', protect, getVolumeTrend);
router.get('/companies', protect, getCompanyPerformance);
router.get('/couriers', protect, getCourierLeaderboard);
 
export default router;
 