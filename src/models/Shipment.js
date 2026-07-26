import mongoose from 'mongoose';

export const SHIPMENT_STATUSES = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
  'cancelled',
];

// Mirrors STATUS_TRANSITIONS in the frontend's RecentShipmentsTable.tsx —
// keep these two in sync if the workflow changes.
export const STATUS_TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  failed: ['pending'],
  cancelled: [],
};

const shipmentSchema = new mongoose.Schema(
  {
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    recipient: {
      type: String,
      required: [true, 'Recipient is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    origin: {
      type: String,
      required: [true, 'Origin is required'],
      trim: true,
    },
    destination: {
      type: String,
      required: [true, 'Destination is required'],
      trim: true,
    },
    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Courier',
      default: null,
    },
    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    weightKg: {
      type: Number,
      required: [true, 'Weight (kg) is required'],
      min: 0,
    },
    eta: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    statusHistory: [
      {
        status: { type: String, enum: SHIPMENT_STATUSES },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
},
price: {
  type: Number,
  required: true,
  min: 0,
},
  },
  { timestamps: true }
);

shipmentSchema.index({ recipient: 'text', trackingNumber: 'text' });

export default mongoose.model('Shipment', shipmentSchema);
