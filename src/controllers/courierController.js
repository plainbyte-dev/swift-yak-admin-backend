import asyncHandler from 'express-async-handler';
import Courier, { COURIER_STATUSES } from '../models/Courier.js';
import Shipment from '../models/Shipment.js';

// @desc    List couriers (optionally filter by status)
// @route   GET /api/couriers
// @access  Private
export const getCouriers = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const couriers = await Courier.find(filter).sort({ name: 1 });

  // Attach the shipment each courier is currently on, and how many
  // active (assigned/picked_up/in_transit) shipments remain for them.
  const enriched = await Promise.all(
    couriers.map(async (courier) => {
      const activeShipments = await Shipment.find({
        courier: courier._id,
        status: { $in: ['assigned', 'picked_up', 'in_transit'] },
      }).select('trackingNumber status');

      return {
        ...courier.toJSON(),
        currentShipment: activeShipments[0]?.trackingNumber ?? null,
        deliveriesLeft: activeShipments.length,
      };
    })
  );

  res.json({ success: true, count: enriched.length, data: enriched });
});

// @desc    Get a single courier by id
// @route   GET /api/couriers/:id
// @access  Private
export const getCourier = asyncHandler(async (req, res) => {
  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    res.status(404);
    throw new Error('Courier not found');
  }
  res.json({ success: true, data: courier });
});

// @desc    Create a courier
// @route   POST /api/couriers
// @access  Private (admin, dispatcher)
export const createCourier = asyncHandler(async (req, res) => {
  const { name, vehicle, location, phone } = req.body;

  if (!name || !vehicle) {
    res.status(400);
    throw new Error('name and vehicle are required');
  }

  const courier = await Courier.create({ name, vehicle, location, phone });
  res.status(201).json({ success: true, data: courier });
});

// @desc    Update a courier's editable fields
// @route   PATCH /api/couriers/:id
// @access  Private (admin, dispatcher)
export const updateCourier = asyncHandler(async (req, res) => {
  const { name, vehicle, location, phone } = req.body;

  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    res.status(404);
    throw new Error('Courier not found');
  }

  if (name !== undefined) courier.name = name;
  if (vehicle !== undefined) courier.vehicle = vehicle;
  if (location !== undefined) courier.location = location;
  if (phone !== undefined) courier.phone = phone;

  await courier.save();
  res.json({ success: true, data: courier });
});

// @desc    Update a courier's live status (available/busy/offline)
// @route   PATCH /api/couriers/:id/status
// @access  Private (admin, dispatcher)
export const updateCourierStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!COURIER_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`status must be one of: ${COURIER_STATUSES.join(', ')}`);
  }

  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    res.status(404);
    throw new Error('Courier not found');
  }

  courier.status = status;
  courier.lastPingAt = new Date();
  await courier.save();

  res.json({ success: true, data: courier });
});

// @desc    Delete a courier
// @route   DELETE /api/couriers/:id
// @access  Private (admin)
export const deleteCourier = asyncHandler(async (req, res) => {
  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    res.status(404);
    throw new Error('Courier not found');
  }

  const activeCount = await Shipment.countDocuments({
    courier: courier._id,
    status: { $in: ['assigned', 'picked_up', 'in_transit'] },
  });

  if (activeCount > 0) {
    res.status(409);
    throw new Error('Cannot delete a courier with active shipments — reassign them first');
  }

  await courier.deleteOne();
  res.json({ success: true, data: {} });
});
