import asyncHandler from 'express-async-handler';
import Shipment, { SHIPMENT_STATUSES, STATUS_TRANSITIONS } from '../models/Shipment.js';
import Courier from '../models/Courier.js';

function generateTrackingNumber() {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `CDK-${rand}`;
}

// @desc    List shipments — search, status filter, sort, paginate
//          (mirrors the search/filter/sort/pagination in RecentShipmentsTable.tsx)
// @route   GET /api/shipments?search=&status=&sortKey=&sortDir=&page=&perPage=
// @access  Private

// @desc    Get a shipment's status change history (audit trail), oldest first
//          Backed by the same statusHistory array already populated by
//          createShipment, assignCourier, and updateShipmentStatus.
// @route   GET /api/shipments/:id/events
// @access  Private
export const getShipmentEvents = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findById(req.params.id).select('statusHistory trackingNumber');

  if (!shipment) {
    res.status(404);
    throw new Error('Shipment not found');
  }

  const events = shipment.statusHistory.map((entry) => ({
    status: entry.status,
    // Falls back to the subdocument's Mongo-generated ObjectId timestamp if the
    // schema doesn't have an explicit changedAt/createdAt field — confirm your
    // actual statusHistory subdocument schema and simplify this if it already
    // has a dedicated timestamp field.
    changedAt: entry.changedAt || entry.createdAt || entry._id.getTimestamp(),
  }));

  res.json({ success: true, data: events });
});

export const getShipments = asyncHandler(async (req, res) => {
  const {
    search = '',
    status = 'all',
    sortKey = 'createdAt',
    sortDir = 'desc',
    page = 1,
    perPage = 6,
  } = req.query;

  const filter = {};
  if (status !== 'all') filter.status = status;
  if (search) {
    filter.$or = [
      { trackingNumber: { $regex: search, $options: 'i' } },
      { recipient: { $regex: search, $options: 'i' } },
    ];
  }

  const allowedSortKeys = ['trackingNumber', 'status', 'createdAt'];
  const sortField = allowedSortKeys.includes(sortKey) ? sortKey : 'createdAt';
  const sort = { [sortField]: sortDir === 'asc' ? 1 : -1 };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.max(1, parseInt(perPage, 10) || 6);

  const [total, shipments] = await Promise.all([
    Shipment.countDocuments(filter),
    Shipment.find(filter)
      .populate('courier', 'name vehicle status')
      .sort(sort)
      .skip((pageNum - 1) * perPageNum)
      .limit(perPageNum),
  ]);

  res.json({
    success: true,
    data: shipments,
    pagination: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum),
    },
  });
});

// @desc    Get a single shipment
// @route   GET /api/shipments/:id
// @access  Private
export const getShipment = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findById(req.params.id).populate('courier', 'name vehicle status');
  if (!shipment) {
    res.status(404);
    throw new Error('Shipment not found');
  }
  res.json({ success: true, data: shipment });
});
// @desc    Create a shipment
// @route   POST /api/shipments
// @access  Private (admin, dispatcher)
export const createShipment = asyncHandler(async (req, res) => {
  const { recipient, origin, destination, weightKg, phone, notes, eta } = req.body;

  if (!recipient || !origin || !destination || weightKg === undefined) {
    res.status(400);
    throw new Error('recipient, origin, destination, and weightKg are required');
  }

  let trackingNumber = generateTrackingNumber();
  // Guard against the (unlikely) random collision.
  while (await Shipment.exists({ trackingNumber })) {
    trackingNumber = generateTrackingNumber();
  }

  // Price is a snapshot computed at creation time — deliberately not
  // recalculated later, so historical revenue in /api/reports stays stable
  // even if these rates change down the line.
  const BASE_PRICE = 5;
  const PER_KG_RATE = 1.5;
  const price = BASE_PRICE + weightKg * PER_KG_RATE;

  const shipment = await Shipment.create({
    trackingNumber,
    recipient,
    origin,
    destination,
    weightKg,
    phone,
    notes,
    eta,
    price,
    createdBy: req.user._id,
    status: 'pending',
    statusHistory: [{ status: 'pending' }],
  });

  res.status(201).json({ success: true, data: shipment });
});

// @desc    Update editable shipment fields
// @route   PATCH /api/shipments/:id
// @access  Private (admin, dispatcher)
export const updateShipment = asyncHandler(async (req, res) => {
  const { recipient, origin, destination, weightKg, phone, notes, eta } = req.body;

  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) {
    res.status(404);
    throw new Error('Shipment not found');
  }

  if (recipient !== undefined) shipment.recipient = recipient;
  if (origin !== undefined) shipment.origin = origin;
  if (destination !== undefined) shipment.destination = destination;
  if (weightKg !== undefined) shipment.weightKg = weightKg;
  if (phone !== undefined) shipment.phone = phone;
  if (notes !== undefined) shipment.notes = notes;
  if (eta !== undefined) shipment.eta = eta;

  await shipment.save();
  res.json({ success: true, data: shipment });
});

// @desc    Assign (or reassign) a courier to a shipment.
//          A shipment still in "pending" moves to "assigned", matching
//          the frontend's handleAssign behavior.
// @route   PATCH /api/shipments/:id/assign
// @access  Private (admin, dispatcher)
export const assignCourier = asyncHandler(async (req, res) => {
  const { courierId } = req.body;

  if (!courierId) {
    res.status(400);
    throw new Error('courierId is required');
  }

  const [shipment, courier] = await Promise.all([
    Shipment.findById(req.params.id),
    Courier.findById(courierId),
  ]);

  if (!shipment) {
    res.status(404);
    throw new Error('Shipment not found');
  }
  if (!courier) {
    res.status(404);
    throw new Error('Courier not found');
  }

  shipment.courier = courier._id;
  if (shipment.status === 'pending') {
    shipment.status = 'assigned';
    shipment.statusHistory.push({ status: 'assigned' });
  }

  await shipment.save();
  await shipment.populate('courier', 'name vehicle status');

  res.json({ success: true, data: shipment });
});

// @desc    Transition a shipment's status, enforcing the same state
//          machine as STATUS_TRANSITIONS in RecentShipmentsTable.tsx
// @route   PATCH /api/shipments/:id/status
// @access  Private (admin, dispatcher)
export const updateShipmentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!SHIPMENT_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`status must be one of: ${SHIPMENT_STATUSES.join(', ')}`);
  }

  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) {
    res.status(404);
    throw new Error('Shipment not found');
  }

  const allowed = STATUS_TRANSITIONS[shipment.status] || [];
  if (!allowed.includes(status)) {
    res.status(409);
    throw new Error(
      `Cannot transition shipment from "${shipment.status}" to "${status}". Allowed: ${
        allowed.length ? allowed.join(', ') : 'none — this is a terminal state'
      }`
    );
  }

  shipment.status = status;
  shipment.statusHistory.push({ status });
  if (status === 'delivered') shipment.deliveredAt = new Date();

  await shipment.save();
  res.json({ success: true, data: shipment });
});

// @desc    Delete a shipment
// @route   DELETE /api/shipments/:id
// @access  Private (admin)
export const deleteShipment = asyncHandler(async (req, res) => {
  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) {
    res.status(404);
    throw new Error('Shipment not found');
  }
  await shipment.deleteOne();
  res.json({ success: true, data: {} });
});
