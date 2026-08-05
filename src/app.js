import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import courierRoutes from './routes/courierRoutes.js';
import shipmentRoutes from './routes/shipmentRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reportsRoutes from './routes/reportsRoute.js';
import bookingRequestRoutes from './routes/bookingRequestRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...corsOrigins],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(express.json());

app.get('/',(req, res) => {
    res.json({
      message: "Api is working...."
    })
})

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : '*',
    credentials: true,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Basic protection against brute-force / abuse on the API.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'courierdesk-backend', status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/booking-requests', bookingRequestRoutes);
app.use('/api/public', publicRoutes);
app.use(notFound);
app.use(errorHandler);
app.use('/uploads', express.static('uploads'));

export default app;
