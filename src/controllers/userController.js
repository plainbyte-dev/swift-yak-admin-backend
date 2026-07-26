import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

const ALLOWED_ROLES = ['admin', 'dispatcher', 'viewer'];

// @desc    List users — search, role filter, paginate
// @route   GET /api/users?search=&role=&page=&perPage=
// @access  Private (admin only)
export const getUsers = asyncHandler(async (req, res) => {
  const { search = '', role = 'all', page = 1, perPage = 7 } = req.query;

  const filter = {};
  if (role !== 'all') filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.max(1, parseInt(perPage, 10) || 7);

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPageNum)
      .limit(perPageNum),
  ]);

  res.json({
    success: true,
    data: users.map((u) => u.toSafeObject()),
    pagination: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum),
    },
  });
});

// @desc    Get a single user
// @route   GET /api/users/:id
// @access  Private (admin only)
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ success: true, data: user.toSafeObject() });
});

// @desc    Update a user's role, company, or active status
// @route   PATCH /api/users/:id
// @access  Private (admin only)
export const updateUser = asyncHandler(async (req, res) => {
  const { name, role, company, isActive } = req.body;

  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    res.status(400);
    throw new Error(`role must be one of: ${ALLOWED_ROLES.join(', ')}`);
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Prevent an admin from locking themselves out by deactivating/demoting their own account.
  if (String(user._id) === String(req.user._id)) {
    if (isActive === false) {
      res.status(400);
      throw new Error('You cannot deactivate your own account');
    }
    if (role !== undefined && role !== 'admin') {
      res.status(400);
      throw new Error('You cannot change your own role');
    }
  }

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (company !== undefined) user.company = company;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();
  res.json({ success: true, data: user.toSafeObject() });
});

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private (admin only)
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  await user.deleteOne();
  res.json({ success: true, data: {} });
});