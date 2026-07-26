import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'dispatcher', 'viewer'],
      default: 'dispatcher',
    },
    company: {
      type: String,
      default: 'Meridian Logistics Co.',
      trim: true,
    },
     phone: {
      type: String,
      trim: true,
      default: '',
    },
    timezone: {
      type: String,
      default: 'America/New_York',
    },
    language: {
      type: String,
      default: 'English (US)',
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY',
    },
    timeFormat: {
      type: String,
      default: '12-hour (AM/PM)',
    },
     theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false, // don't return by default, same treatment as password
    },
    notifications: {
      newShipment: { type: Boolean, default: true },
      statusUpdate: { type: Boolean, default: true },
      courierAlert: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: false },
      smsAlerts: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    company: this.company,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    phone: this.phone,
    timezone: this.timezone,
    language: this.language,
    dateFormat: this.dateFormat,
    timeFormat: this.timeFormat,
    theme: this.theme,
    avatarUrl: this.avatarUrl,
    twoFactorEnabled: this.twoFactorEnabled,
    notifications: this.notifications,
  };
};
export default mongoose.model('User', userSchema);
