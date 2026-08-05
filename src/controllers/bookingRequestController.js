import asyncHandler from 'express-async-handler';
import BookingRequest, { BOOKING_REQUEST_STATUSES } from '../models/BookingRequest.js';
import Shipment from '../models/Shipment.js';
import {
  generateUniqueTrackingNumber,
  generateUniqueHouseBill,
  calculateShipmentPrice,
} from '../utils/shipmentHelpers.js';

// @desc    Submit a booking request from the public landing page
// @route   POST /api/booking-requests
// @access  Public
export const createBookingRequest = asyncHandler(async (req, res) => {
  const {
    name, email, phone, origin, destination, isInternational, destCountry,
    weightKg, serviceType, notes, estimatedPrice,
  } = req.body;

  if (!name || !email || !phone || !origin || !destination || weightKg === undefined) {
    res.status(400);
    throw new Error('name, email, phone, origin, destination, and weightKg are required');
  }

  const bookingRequest = await BookingRequest.create({
    name, email, phone, origin, destination, isInternational, destCountry,
    weightKg, serviceType, notes, estimatedPrice,
    status: 'new',
  });

  res.status(201).json({ success: true, data: bookingRequest });
});

// @desc    List booking requests — search, status filter, paginate
// @route   GET /api/booking-requests?search=&status=&page=&perPage=
// @access  Private (admin, dispatcher)
export const getBookingRequests = asyncHandler(async (req, res) => {
  const { search = '', status = 'all', page = 1, perPage = 10 } = req.query;

  const filter = {};
  if (status !== 'all') filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { origin: { $regex: search, $options: 'i' } },
      { destination: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.max(1, parseInt(perPage, 10) || 10);

  const [total, bookingRequests] = await Promise.all([
    BookingRequest.countDocuments(filter),
    BookingRequest.find(filter)
      .populate('shipment', 'trackingNumber status')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPageNum)
      .limit(perPageNum),
  ]);

  res.json({
    success: true,
    data: bookingRequests,
    pagination: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum),
    },
  });
});

// @desc    Get a single booking request
// @route   GET /api/booking-requests/:id
// @access  Private (admin, dispatcher)
export const getBookingRequest = asyncHandler(async (req, res) => {
  const bookingRequest = await BookingRequest.findById(req.params.id).populate('shipment', 'trackingNumber status');
  if (!bookingRequest) {
    res.status(404);
    throw new Error('Booking request not found');
  }
  res.json({ success: true, data: bookingRequest });
});

// @desc    Mark a booking request contacted or rejected
// @route   PATCH /api/booking-requests/:id/status
// @access  Private (admin, dispatcher)
export const updateBookingRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['contacted', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error(`status must be one of: contacted, rejected`);
  }

  const bookingRequest = await BookingRequest.findById(req.params.id);
  if (!bookingRequest) {
    res.status(404);
    throw new Error('Booking request not found');
  }

  if (bookingRequest.status === 'converted') {
    res.status(409);
    throw new Error('This booking request has already been converted to a shipment');
  }

  bookingRequest.status = status;
  await bookingRequest.save();
  res.json({ success: true, data: bookingRequest });
});

// @desc    Convert a booking request into a real shipment
// @route   POST /api/booking-requests/:id/convert
// @access  Private (admin, dispatcher)
export const convertToShipment = asyncHandler(async (req, res) => {
  const bookingRequest = await BookingRequest.findById(req.params.id);
  if (!bookingRequest) {
    res.status(404);
    throw new Error('Booking request not found');
  }

  if (bookingRequest.status === 'converted') {
    res.status(409);
    throw new Error('This booking request has already been converted to a shipment');
  }

  const trackingNumber = await generateUniqueTrackingNumber();
  const houseBill = await generateUniqueHouseBill();
  const price = calculateShipmentPrice(bookingRequest.weightKg);

  const shipment = await Shipment.create({
    trackingNumber,
    recipient: bookingRequest.name,
    phone: bookingRequest.phone,
    origin: bookingRequest.origin,
    destination: bookingRequest.isInternational ? bookingRequest.destCountry : bookingRequest.destination,
    weightKg: bookingRequest.weightKg,
    notes: bookingRequest.notes,
    price,
    createdBy: req.user._id,
    status: 'pending',
    statusHistory: [{ status: 'pending' }],
    sender: { email: bookingRequest.email },
    freight: { houseBill },
  });

  bookingRequest.status = 'converted';
  bookingRequest.shipment = shipment._id;
  await bookingRequest.save();

  res.status(201).json({ success: true, data: shipment });
});

export { BOOKING_REQUEST_STATUSES };
