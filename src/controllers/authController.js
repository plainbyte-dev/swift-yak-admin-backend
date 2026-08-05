import asyncHandler from 'express-async-handler';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

// @desc    Log in and receive a JWT
// @route   POST /api/auth/login
// @access  Public

export const login = asyncHandler(async (req, res) => {
  const { email, password, code } = req.body;
 
  const user = await User.findOne({ email }).select('+password +twoFactorSecret');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }
 
  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }
 
  if (user.twoFactorEnabled) {
    if (!code) {
      // Password was correct, but a TOTP code is still required.
      // No token is issued at this stage.
      return res.json({ success: true, requiresTwoFactor: true });
    }
    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      res.status(401);
      throw new Error('Invalid verification code');
    }
  }
 
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
 
  const token = generateToken(user._id);
  res.json({ token, user: user.toSafeObject() });
});
 

// @desc    Get the currently authenticated user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const {
    name, phone, company, timezone, language, dateFormat, timeFormat, theme, notifications,
  } = req.body;
 
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
 
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (company !== undefined) user.company = company;
  if (timezone !== undefined) user.timezone = timezone;
  if (language !== undefined) user.language = language;
  if (dateFormat !== undefined) user.dateFormat = dateFormat;
  if (timeFormat !== undefined) user.timeFormat = timeFormat;
  if (theme !== undefined) user.theme = theme;
  if (notifications !== undefined) {
    // Merge rather than replace, so toggling one notification doesn't
    // wipe out the others if the client only sends a partial object.
    user.notifications = { ...user.notifications.toObject(), ...notifications };
  }
 
  await user.save();
  res.json({ success: true, user: user.toSafeObject() });
});
 
// @desc    Change the current user's password
// @route   PATCH /api/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
 
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('currentPassword and newPassword are required');
  }
  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('New password must be at least 8 characters');
  }
 
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }
 
  user.password = newPassword; // pre('save') hook re-hashes this
  await user.save();
 
  res.json({ success: true, message: 'Password updated' });
});
 
export const uploadAvatarHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, {
    public_id: `${user._id}-${Date.now()}`,
  });

  user.avatarUrl = result.secure_url;
  await user.save();

  res.json({ success: true, user: user.toSafeObject() });
});

// @desc    Generate a TOTP secret + QR code for the user to scan
// @route   POST /api/auth/2fa/setup
// @access  Private
export const setupTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.twoFactorEnabled) {
    res.status(400);
    throw new Error('Two-factor authentication is already enabled');
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'CourierDesk', secret);
  const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

  // Store the secret, but don't flip twoFactorEnabled until it's verified
  user.twoFactorSecret = secret;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, secret, qrCode: qrCodeDataUrl });
});

// @desc    Verify a TOTP code and turn 2FA on
// @route   POST /api/auth/2fa/verify
// @access  Private
export const verifyTwoFactor = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400);
    throw new Error('A verification code is required');
  }

  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user || !user.twoFactorSecret) {
    res.status(400);
    throw new Error('Two-factor setup has not been started');
  }

  const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
  if (!isValid) {
    res.status(401);
    throw new Error('Invalid verification code');
  }

  user.twoFactorEnabled = true;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Two-factor authentication enabled' });
});

// @desc    Disable 2FA (requires current password to confirm identity)
// @route   POST /api/auth/2fa/disable
// @access  Private
export const disableTwoFactor = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    res.status(400);
    throw new Error('Password is required to disable two-factor authentication');
  }

  const user = await User.findById(req.user._id).select('+password +twoFactorSecret');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Incorrect password');
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Two-factor authentication disabled' });
});