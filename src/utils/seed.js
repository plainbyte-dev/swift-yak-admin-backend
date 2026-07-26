import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db.js';
import Courier from '../models/Courier.js';
import Shipment from '../models/Shipment.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const COURIERS = [
  { name: 'Jamal Okafor', vehicle: 'Motorcycle', status: 'busy', location: 'Midtown East, NY' },
  { name: 'Fatima Al-Hassan', vehicle: 'Van', status: 'busy', location: 'Upper West Side, NY' },
  { name: 'Priya Sharma', vehicle: 'Bicycle', status: 'available', location: 'Brooklyn Heights, NY' },
  { name: 'Tomás Rivera', vehicle: 'Car', status: 'busy', location: 'Lower Manhattan, NY' },
  { name: 'Wei Chen', vehicle: 'Motorcycle', status: 'offline', location: 'Bronx, NY' },
  { name: 'Aisha Nwosu', vehicle: 'Van', status: 'available', location: 'Queens, NY' },
];

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

async function run() {
  await connectDB();

  console.log('Clearing existing data...');
  await Promise.all([Shipment.deleteMany({}), Courier.deleteMany({}), User.deleteMany({})]);

  console.log('Seeding admin user...');
  await User.create({
    name: 'Admin User',
    email: 'admin@courierdesk.dev',
    password: 'ChangeMe123!',
    role: 'admin',
  });

  console.log('Seeding couriers...');
  const couriers = await Courier.insertMany(COURIERS);
  const byName = Object.fromEntries(couriers.map((c) => [c.name, c]));

  console.log('Seeding shipments...');
  const shipments = [
    { trackingNumber: 'CDK-20847', recipient: 'Northgate Retail Ltd.', origin: '245 W 34th St, NY', destination: '88 Canal St, NY', courier: 'Jamal Okafor', status: 'in_transit', weightKg: 3.2, eta: hoursFromNow(1), phone: '+1 212-555-0101', notes: 'Leave at reception desk if no answer.' },
    { trackingNumber: 'CDK-20848', recipient: 'Sunrise Pharmacy', origin: '12 Park Ave, NY', destination: '500 7th Ave, NY', courier: 'Fatima Al-Hassan', status: 'picked_up', weightKg: 0.8, eta: hoursFromNow(1.5), phone: '+1 212-555-0202', notes: 'Fragile — handle with care.' },
    { trackingNumber: 'CDK-20849', recipient: 'Harborview Clinic', origin: '78 Broad St, NY', destination: '320 E 42nd St, NY', courier: null, status: 'pending', weightKg: 5.1, eta: null, phone: '+1 212-555-0303', notes: 'Medical supplies — priority delivery.' },
    { trackingNumber: 'CDK-20850', recipient: 'Apex Consulting', origin: '1 Liberty Plaza, NY', destination: '200 Park Ave, NY', courier: 'Priya Sharma', status: 'assigned', weightKg: 1.4, eta: hoursFromNow(2), phone: '+1 212-555-0404', notes: '' },
    { trackingNumber: 'CDK-20851', recipient: 'Greenfield Foods', origin: '45 Fulton St, NY', destination: '900 3rd Ave, NY', courier: 'Tomás Rivera', status: 'in_transit', weightKg: 12.6, eta: hoursFromNow(1.8), phone: '+1 212-555-0505', notes: 'Keep refrigerated.' },
    { trackingNumber: 'CDK-20839', recipient: 'Metro Office Supplies', origin: '55 Water St, NY', destination: '1251 6th Ave, NY', courier: 'Fatima Al-Hassan', status: 'in_transit', weightKg: 8.3, eta: hoursFromNow(0.5), phone: '+1 212-555-0606', notes: '' },
    { trackingNumber: 'CDK-20832', recipient: 'Lakeview Medical', origin: '30 Rockefeller Plz, NY', destination: '445 Park Ave, NY', courier: 'Jamal Okafor', status: 'delivered', weightKg: 2.0, eta: hoursFromNow(-1), deliveredAt: hoursFromNow(-1.2), phone: '+1 212-555-0707', notes: '' },
    { trackingNumber: 'CDK-20821', recipient: 'Pacific Imports Co.', origin: '100 Broadway, NY', destination: '411 W 35th St, NY', courier: 'Wei Chen', status: 'failed', weightKg: 4.7, eta: hoursFromNow(-2), phone: '+1 212-555-0808', notes: 'Recipient not available. Retry required.' },
  ].map((s) => ({
    ...s,
    courier: s.courier ? byName[s.courier]._id : null,
    statusHistory: [{ status: s.status }],
  }));

  await Shipment.insertMany(shipments);

  console.log('Done. Seeded 1 admin user, 6 couriers, 8 shipments.');
  console.log('Admin login -> email: admin@courierdesk.dev / password: ChangeMe123!');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
