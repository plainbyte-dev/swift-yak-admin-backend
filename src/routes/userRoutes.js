import { Router } from 'express';
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { protect, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.use(requireRole('admin'));

router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);

export default router;