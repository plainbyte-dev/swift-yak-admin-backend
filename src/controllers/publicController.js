import asyncHandler from 'express-async-handler';
import Shipment from '../models/Shipment.js';

// @desc    Public shipment lookup by tracking number. Returns a sanitized
//          subset only — no recipient/sender/consignee/freight/price/notes,
//          those are internal/PII and not relevant to a consumer tracking page.
// @route   GET /api/public/track/:trackingNumber
// @access  Public
export const trackShipment = asyncHandler(async (req, res) => {
  const trackingNumber = req.params.trackingNumber.trim().toUpperCase();

  const shipment = await Shipment.findOne({ trackingNumber })
    .select('trackingNumber status statusHistory origin destination weightKg eta deliveredAt courier')
    .populate('courier', 'name vehicle');

  if (!shipment) {
    res.status(404);
    throw new Error('No shipment found for this tracking number');
  }

  res.json({
    success: true,
    data: {
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      statusHistory: shipment.statusHistory.map((entry) => ({
        status: entry.status,
        changedAt: entry.changedAt,
      })),
      origin: shipment.origin,
      destination: shipment.destination,
      weightKg: shipment.weightKg,
      eta: shipment.eta,
      deliveredAt: shipment.deliveredAt,
      courier: shipment.courier ? { name: shipment.courier.name, vehicle: shipment.courier.vehicle } : null,
    },
  });
});
