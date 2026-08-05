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

    // Structured shipper (sender) details — feeds the printable shipping
    // label and the manifest/invoice exports. Optional: shipments created
    // before this existed, or via a quick/manual flow, just leave it unset.
    sender: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      address1: { type: String, trim: true },
      address2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postcode: { type: String, trim: true },
      country: { type: String, trim: true },
      countryCode: { type: String, trim: true, uppercase: true },
    },

    // Structured consignee (receiver) details — same rationale as `sender`.
    consignee: {
      name: { type: String, trim: true },
      company: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      contact: { type: String, trim: true },
      address1: { type: String, trim: true },
      address2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postcode: { type: String, trim: true },
      country: { type: String, trim: true },
      countryCode: { type: String, trim: true, uppercase: true },
    },

    // Freight / customs manifest fields. houseBill is auto-generated at
    // creation (see generateHouseBill in shipmentController.js); everything
    // else here is optional and typically filled in once flight/consolidation
    // details are known.
    freight: {
      houseBill: { type: String, trim: true, unique: true, sparse: true },
      masterBill: { type: String, trim: true },
      flightNo: { type: String, trim: true },
      airlineCode: { type: String, trim: true, uppercase: true },
      iataLoadPort: { type: String, trim: true, uppercase: true },
      iataDestPort: { type: String, trim: true, uppercase: true },
      portDestination: { type: String, trim: true, uppercase: true },
      pieces: { type: Number, min: 1, default: 1 },
      volumetricWeightKg: { type: Number, min: 0 },
      declaredValueUsd: { type: Number, min: 0, default: 0 },
      currencyCode: { type: String, trim: true, uppercase: true, default: 'USD' },
      contentType: { type: String, trim: true },
      descriptionOfGoods: { type: String, trim: true },
      remarks: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

shipmentSchema.index({ recipient: 'text', trackingNumber: 'text' });

export default mongoose.model('Shipment', shipmentSchema);
