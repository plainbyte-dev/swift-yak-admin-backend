import Shipment from '../models/Shipment.js';

export function generateTrackingNumber() {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `CDK-${rand}`;
}

// House bill numbers are plain 9-digit numerics (matches the format used on
// the paper/Excel manifest this mirrors), distinct from the CDK-XXXXX
// tracking number shown throughout the rest of the app.
export function generateHouseBill() {
  const rand = Math.floor(100000000 + Math.random() * 900000000);
  return String(rand);
}

export async function generateUniqueTrackingNumber() {
  let trackingNumber = generateTrackingNumber();
  while (await Shipment.exists({ trackingNumber })) {
    trackingNumber = generateTrackingNumber();
  }
  return trackingNumber;
}

export async function generateUniqueHouseBill() {
  let houseBill = generateHouseBill();
  while (await Shipment.exists({ 'freight.houseBill': houseBill })) {
    houseBill = generateHouseBill();
  }
  return houseBill;
}

// Price is a snapshot computed at creation time — deliberately not
// recalculated later, so historical revenue in /api/reports stays stable
// even if these rates change down the line.
const BASE_PRICE = 5;
const PER_KG_RATE = 1.5;

export function calculateShipmentPrice(weightKg) {
  return BASE_PRICE + weightKg * PER_KG_RATE;
}
