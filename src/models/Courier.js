import mongoose from 'mongoose';

export const COURIER_STATUSES = ['available', 'busy', 'offline'];
export const VEHICLE_TYPES = ['Motorcycle', 'Van', 'Bicycle', 'Car', 'Truck'];

const courierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Courier name is required'],
      trim: true,
    },
    vehicle: {
      type: String,
      enum: VEHICLE_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: COURIER_STATUSES,
      default: 'available',
      index: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    lastPingAt: {
      type: Date,
      default: Date.now,
    },
    phone: {
      type: String,
      trim: true,
    },
    rating: {
  type: Number,
  min: 0,
  max: 5,
  default: 5,
},
  },
  { timestamps: true }
);

courierSchema.virtual('initials').get(function getInitials() {
  return this.name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
});

courierSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Courier', courierSchema);
