import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, company } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error('An account with that email already exists');
  }

  const user = await User.create({ name, email, password, company });

  res.status(201).json({
    success: true,
    token: generateToken(user._id),
    user: user.toSafeObject(),
  });
});

// @desc    Log in and receive a JWT
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }

  user.lastLoginAt = new Date();          // ← add
  await user.save({ validateBeforeSave: false }); // ← add (skip full validation on a login-time save)

  const token = generateToken(user._id); // however you currently sign the JWT
  res.json({ token, user: user.toSafeObject() });
});

// @desc    Get the currently authenticated user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});
