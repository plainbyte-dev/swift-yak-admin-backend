# CourierDesk Backend

Express + MongoDB API for the [CourierDesk](https://github.com/plainbyte-dev/swift-yak-admin) partner delivery
management dashboard. Covers auth, shipments, couriers, and the metrics that power the dashboard's bento grid.

## Stack

- Node.js + Express (ESM)
- MongoDB via Mongoose
- JWT auth (bcrypt-hashed passwords)
- helmet, cors, morgan, express-rate-limit

## Setup

```bash
npm install
cp .env.example .env   # then edit MONGO_URI / JWT_SECRET / CORS_ORIGIN
npm run seed            # optional: loads sample couriers + shipments + an admin user
npm run dev              # nodemon, http://localhost:4000
```

Seeded admin login: `admin@courierdesk.dev` / `ChangeMe123!` — change this password immediately in any
real deployment.

## Project layout

```
src/
  config/db.js          Mongoose connection
  models/                User, Courier, Shipment schemas
  controllers/            Route handlers
  routes/                 Express routers
  middleware/auth.js     JWT protect + role guard
  middleware/errorHandler.js
  utils/generateToken.js
  utils/seed.js           Sample data loader
  app.js                  Express app (no listen — for testing)
  server.js               Entry point (connects DB, then listens)
```

## Auth

All routes except `/api/auth/register` and `/api/auth/login` require:

```
Authorization: Bearer <token>
```

Roles: `admin`, `dispatcher`, `viewer`. Mutating endpoints require `admin` or `dispatcher`; deletes require `admin`.

## API reference

### Auth
| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Private |

### Shipments
| Method | Path | Notes |
|---|---|---|
| GET | `/api/shipments` | Query: `search`, `status`, `sortKey` (`trackingNumber`\|`status`\|`createdAt`), `sortDir` (`asc`\|`desc`), `page`, `perPage` — mirrors the frontend table's filter/sort/pagination |
| GET | `/api/shipments/:id` | |
| POST | `/api/shipments` | Body: `recipient`, `origin`, `destination`, `weightKg`, `phone?`, `notes?`, `eta?` — auto-generates `trackingNumber` |
| PATCH | `/api/shipments/:id` | Update editable fields |
| PATCH | `/api/shipments/:id/assign` | Body: `courierId` — auto-transitions `pending` → `assigned` |
| PATCH | `/api/shipments/:id/status` | Body: `status` — enforces the same state machine as the frontend (`pending → assigned → picked_up → in_transit → delivered`, plus `failed`/`cancelled` branches) |
| DELETE | `/api/shipments/:id` | admin only |

### Couriers
| Method | Path | Notes |
|---|---|---|
| GET | `/api/couriers` | Query: `status` — response includes computed `currentShipment` + `deliveriesLeft` |
| GET | `/api/couriers/:id` | |
| POST | `/api/couriers` | Body: `name`, `vehicle`, `location?`, `phone?` |
| PATCH | `/api/couriers/:id` | Update editable fields |
| PATCH | `/api/couriers/:id/status` | Body: `status` (`available`\|`busy`\|`offline`) |
| DELETE | `/api/couriers/:id` | admin only; blocked if the courier has active shipments |

### Metrics
| Method | Path | Notes |
|---|---|---|
| GET | `/api/metrics/dashboard` | Powers the 7 MetricsBentoGrid cards: on-time rate (trailing 7 days), shipments today/delta, active couriers, avg delivery time, in-transit count, failed deliveries today/delta, pending assignment + oldest pending age |

## Wiring up the frontend

In `swift-yak-admin`, point fetches at this API's base URL (e.g. `NEXT_PUBLIC_API_URL=http://localhost:4000/api`)
and replace the hardcoded arrays in `MetricsBentoGrid.tsx`, `RecentShipmentsTable.tsx`, and
`CourierStatusPanel.tsx` with calls to `/shipments`, `/couriers`, and `/metrics/dashboard`. Happy to write
that data-fetching layer next if useful.
