import asyncHandler from 'express-async-handler';
import Shipment from '../models/Shipment.js';
import Courier from '../models/Courier.js';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// @desc    Aggregate dashboard metrics — backs the seven MetricsBentoGrid cards
//          (on-time rate, shipments today, active couriers, avg delivery time,
//          in-transit, failed deliveries, pending assignment)
// @route   GET /api/metrics/dashboard
// @access  Private
export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const today = startOfDay();
  const yesterday = startOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const [
    shipmentsToday,
    shipmentsYesterday,
    inTransitCount,
    failedToday,
    failedYesterday,
    pendingCount,
    oldestPending,
    courierCounts,
    deliveredWithTimes,
  ] = await Promise.all([
    Shipment.countDocuments({ createdAt: { $gte: today } }),
    Shipment.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
    Shipment.countDocuments({ status: 'in_transit' }),
    Shipment.countDocuments({ status: 'failed', updatedAt: { $gte: today } }),
    Shipment.countDocuments({ status: 'failed', updatedAt: { $gte: yesterday, $lt: today } }),
    Shipment.countDocuments({ status: 'pending' }),
    Shipment.findOne({ status: 'pending' }).sort({ createdAt: 1 }).select('createdAt'),
    Courier.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Shipment.find({ status: 'delivered', deliveredAt: { $ne: null } })
      .select('createdAt deliveredAt')
      .limit(500),
  ]);

  // On-time delivery rate over the trailing 7 days. Comparing two fields
  // (deliveredAt vs eta) requires an aggregation rather than a plain filter.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const onTimeAgg = await Shipment.aggregate([
    {
      $match: {
        status: 'delivered',
        deliveredAt: { $gte: sevenDaysAgo, $ne: null },
        eta: { $ne: null },
      },
    },
    {
      $project: {
        onTime: { $lte: ['$deliveredAt', '$eta'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        onTime: { $sum: { $cond: ['$onTime', 1, 0] } },
      },
    },
  ]);

  const onTimeRate = onTimeAgg[0]?.total
    ? Math.round((onTimeAgg[0].onTime / onTimeAgg[0].total) * 1000) / 10
    : null;

  const avgDeliveryMs =
    deliveredWithTimes.length > 0
      ? deliveredWithTimes.reduce(
          (sum, s) => sum + (new Date(s.deliveredAt) - new Date(s.createdAt)),
          0
        ) / deliveredWithTimes.length
      : null;

  const courierMap = Object.fromEntries(courierCounts.map((c) => [c._id, c.count]));
  const activeCouriers = (courierMap.available || 0) + (courierMap.busy || 0);

  res.json({
    success: true,
    data: {
      onTimeDeliveryRate: onTimeRate, // percent, or null if no data yet
      shipmentsToday,
      shipmentsTodayDelta: shipmentsToday - shipmentsYesterday,
      activeCouriers,
      couriersAvailable: courierMap.available || 0,
      couriersBusy: courierMap.busy || 0,
      couriersOffline: courierMap.offline || 0,
      avgDeliveryTimeMinutes: avgDeliveryMs !== null ? Math.round(avgDeliveryMs / 60000) : null,
      inTransitNow: inTransitCount,
      failedDeliveriesToday: failedToday,
      failedDeliveriesDelta: failedToday - failedYesterday,
      pendingAssignment: pendingCount,
      oldestPendingMinutes: oldestPending
        ? Math.round((Date.now() - new Date(oldestPending.createdAt)) / 60000)
        : null,
    },
  });
});
