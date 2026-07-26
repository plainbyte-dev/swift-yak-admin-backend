import { Router } from 'express';
import {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  updateCompanyStatus,
  deleteCompany,
} from '../controllers/companyController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.route('/')
  .get(getCompanies)
  .post(requireRole('admin', 'dispatcher'), createCompany);

router
  .route('/:id')
  .get(getCompany)
  .patch(requireRole('admin', 'dispatcher'), updateCompany)
  .delete(requireRole('admin'), deleteCompany);

router.patch('/:id/status', requireRole('admin', 'dispatcher'), updateCompanyStatus);

export default router;