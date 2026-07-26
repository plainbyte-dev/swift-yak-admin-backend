import asyncHandler from 'express-async-handler';
import Shipment from '../models/Shipment.js';
import Courier from '../models/Courier.js';
import User from '../models/User.js';

// ─── Period helpers ─────────────────────────────────────────────────────────
// 'week' / 'month' / 'quarter' / 'year' each map to a trailing window, plus
// the immediately preceding window of equal length for the delta comparisons
// used across the summary KPIs (mirrors the shipmentsToday/Yesterday pattern
// already used in metricsController.js, just generalized to arbitrary windows).

const PERIOD_DAYS = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

function getPeriodRange(period) {
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.week;
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
  const prevEnd = start;
  return { start, end: now, prevStart, prevEnd, days };
}

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─── GET /api/reports/summary ───────────────────────────────────────────────
// @access Private
export const getReportsSummary = asyncHandler(async (req, res) => {
  const { start, end, prevStart, prevEnd } = getPeriodRange(req.query.period);

  const [
    totalShipments,
    prevTotalShipments,
    delivered,
    prevDelivered,
    failedOrCancelled,
    prevFailedOrCancelled,
    activeCouriers,
    prevActiveCouriers,
    partnerCompanies,
    onTimeAgg,
    prevOnTimeAgg,
  ] = await Promise.all([
    Shipment.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Shipment.countDocuments({ createdAt: { $gte: prevStart, $lt: prevEnd } }),
    Shipment.countDocuments({ status: 'delivered', deliveredAt: { $gte: start, $lte: end } }),
    Shipment.countDocuments({ status: 'delivered', deliveredAt: { $gte: prevStart, $lt: prevEnd } }),
    Shipment.countDocuments({ status: { $in: ['failed', 'cancelled'] }, updatedAt: { $gte: start, $lte: end } }),
    Shipment.countDocuments({ status: { $in: ['failed', 'cancelled'] }, updatedAt: { $gte: prevStart, $lt: prevEnd } }),
    Courier.countDocuments({ status: { $in: ['available', 'busy'] } }),
    Courier.countDocuments({ status: { $in: ['available', 'busy'] }, createdAt: { $lt: prevEnd } }),
    User.distinct('company', { company: { $ne: null, $ne: '' } }),
    Shipment.aggregate([
      { $match: { status: 'delivered', deliveredAt: { $gte: start, $lte: end }, eta: { $ne: null } } },
      { $project: { onTime: { $lte: ['$deliveredAt', '$eta'] } } },
      { $group: { _id: null, total: { $sum: 1 }, onTime: { $sum: { $cond: ['$onTime', 1, 0] } } } },
    ]),
    Shipment.aggregate([
      { $match: { status: 'delivered', deliveredAt: { $gte: prevStart, $lt: prevEnd }, eta: { $ne: null } } },
      { $project: { onTime: { $lte: ['$deliveredAt', '$eta'] } } },
      { $group: { _id: null, total: { $sum: 1 }, onTime: { $sum: { $cond: ['$onTime', 1, 0] } } } },
    ]),
  ]);

  const onTimeRate = onTimeAgg[0]?.total ? Math.round((onTimeAgg[0].onTime / onTimeAgg[0].total) * 1000) / 10 : 0;
  const prevOnTimeRate = prevOnTimeAgg[0]?.total ? Math.round((prevOnTimeAgg[0].onTime / prevOnTimeAgg[0].total) * 1000) / 10 : 0;

  res.json({
    success: true,
    data: {
      totalShipments,
      totalShipmentsChangePct: pctChange(totalShipments, prevTotalShipments),
      delivered,
      deliveredChangePct: pctChange(delivered, prevDelivered),
      onTimeRate,
      onTimeRateChangePct: Math.round((onTimeRate - prevOnTimeRate) * 10) / 10,
      failedOrCancelled,
      failedChangePct: pctChange(failedOrCancelled, prevFailedOrCancelled),
      activeCouriers,
      activeCouriersChange: activeCouriers - prevActiveCouriers,
      partnerCompanies: partnerCompanies.length,
      partnerCompaniesChange: 0, // company count history isn't tracked yet; revisit if this matters
    },
  });
});

// ─── GET /api/reports/volume ─────────────────────────────────────────────────
// Buckets shipments by day for week/month, by ISO week for quarter, by month for year.
// @access Private
export const getVolumeTrend = asyncHandler(async (req, res) => {
  const period = req.query.period || 'week';
  const { start, end } = getPeriodRange(period);

  const dateFormat = period === 'year' ? '%Y-%m' : period === 'quarter' ? '%G-W%V' : '%Y-%m-%d';

  const rows = await Shipment.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        shipments: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const data = rows.map((r) => ({
    day: r._id,
    shipments: r.shipments,
    delivered: r.delivered,
    failed: r.failed,
  }));

  res.json({ success: true, data });
});

// ─── GET /api/reports/companies ──────────────────────────────────────────────
// Shipments are attributed to a company via the User who created them
// (Shipment.createdBy -> User.company). Revenue sums the stored `price`
// snapshot on each shipment, not a live formula.
// @access Private
export const getCompanyPerformance = asyncHandler(async (req, res) => {
  const { start, end } = getPeriodRange(req.query.period);

  const rows = await Shipment.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'creator',
      },
    },
    { $unwind: '$creator' },
    { $match: { 'creator.company': { $ne: null, $ne: '' } } },
    {
      $group: {
        _id: '$creator.company',
        shipments: { $sum: 1 },
        revenue: { $sum: { $ifNull: ['$price', 0] } },
        deliveredOnTime: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'delivered'] }, { $ne: ['$eta', null] }, { $lte: ['$deliveredAt', '$eta'] }] },
              1,
              0,
            ],
          },
        },
        deliveredTotal: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
        },
      },
    },
    { $sort: { shipments: -1 } },
  ]);

  const data = rows.map((r) => ({
    companyId: r._id,
    company: r._id,
    shipments: r.shipments,
    onTime: r.deliveredTotal ? Math.round((r.deliveredOnTime / r.deliveredTotal) * 1000) / 10 : 0,
    revenue: Math.round(r.revenue),
  }));

  res.json({ success: true, data });
});

// ─── GET /api/reports/couriers ────────────────────────────────────────────────
// @access Private
export const getCourierLeaderboard = asyncHandler(async (req, res) => {
  const { start, end } = getPeriodRange(req.query.period);

  const rows = await Shipment.aggregate([
    {
      $match: {
        status: 'delivered',
        deliveredAt: { $gte: start, $lte: end },
        courier: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$courier',
        deliveries: { $sum: 1 },
        onTimeCount: {
          $sum: { $cond: [{ $and: [{ $ne: ['$eta', null] }, { $lte: ['$deliveredAt', '$eta'] }] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'couriers',
        localField: '_id',
        foreignField: '_id',
        as: 'courierDoc',
      },
    },
    { $unwind: '$courierDoc' },
    { $sort: { deliveries: -1 } },
  ]);

  const data = rows.map((r) => ({
    courierId: r._id.toString(),
    name: r.courierDoc.name,
    deliveries: r.deliveries,
    onTime: r.deliveries ? Math.round((r.onTimeCount / r.deliveries) * 1000) / 10 : 0,
    rating: r.courierDoc.rating ?? null,
  }));

  res.json({ success: true, data });
});