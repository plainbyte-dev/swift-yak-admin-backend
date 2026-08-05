import mongoose from 'mongoose';

export const BOOKING_REQUEST_STATUSES = ['new', 'contacted', 'converted', 'rejected'];

// Submitted publicly from the landing page's quote/booking flow. Not a
// Shipment yet — staff review these in the admin dashboard and convert
// approved ones into a real Shipment via convertToShipment.
const bookingRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
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
    isInternational: {
      type: Boolean,
      default: false,
    },
    destCountry: {
      type: String,
      trim: true,
    },
    weightKg: {
      type: Number,
      required: [true, 'Weight (kg) is required'],
      min: 0,
    },
    serviceType: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    // Informational snapshot of what the marketing quote calculator showed —
    // not authoritative pricing. The real price is set on conversion via
    // calculateShipmentPrice, same as any other shipment.
    estimatedPrice: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: BOOKING_REQUEST_STATUSES,
      default: 'new',
      index: true,
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('BookingRequest', bookingRequestSchema);
