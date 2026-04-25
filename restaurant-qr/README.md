# 🌶️ Restaurant QR Ordering System

A full-stack, real-time restaurant ordering platform. Customers scan a QR code at their table, browse the menu, and place orders. The kitchen sees orders instantly and updates status — customers see live updates on their phones.

---

## 📁 Project Structure

```
restaurant-qr/
├── backend/               # Node.js + Express + Socket.IO API
│   ├── src/
│   │   ├── index.js       # Server entry point
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── migrate.js    # Run once to create tables
│   │   │   └── seed.js       # Run once to add sample data
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── menu.js
│   │   │   ├── orders.js
│   │   │   └── tables.js
│   │   ├── socket/
│   │   │   └── socketHandler.js  # Real-time WebSocket events
│   │   └── middleware/
│   │       └── auth.js
│   └── package.json
│
├── customer-app/          # React app (mobile) — opened via QR code
│   ├── src/
│   │   ├── pages/
│   │   │   └── TablePage.jsx  # Main ordering page at /table/:tableId
│   │   ├── components/
│   │   │   ├── MenuTab.jsx    # Browse & add items
│   │   │   ├── CartTab.jsx    # Review & place order
│   │   │   └── OrderStatusTab.jsx  # Live tracking
│   │   ├── context/
│   │   │   └── CartContext.jsx
│   │   └── hooks/
│   │       ├── useSocket.js
│   │       └── useApi.js
│   └── package.json
│
├── kitchen-app/           # React app (desktop) — kitchen/staff dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── components/
│   │   │   ├── OrderCard.jsx     # Individual order with action buttons
│   │   │   ├── StatsBar.jsx      # Live order counts
│   │   │   ├── MenuManager.jsx   # Toggle item availability
│   │   │   └── QRManager.jsx     # Generate & download QR codes
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── hooks/
│   │       ├── useKitchenSocket.js
│   │       └── useApi.js
│   └── package.json
│
└── docker-compose.yml
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Set Up the Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE restaurant_qr;"

# Or using createdb
createdb restaurant_qr
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and secrets
npm install
npm run db:migrate    # Creates all tables
npm run db:seed       # Adds sample menu & staff
npm run dev           # Start on http://localhost:5000
```

### 3. Start Customer App

```bash
cd customer-app
npm install
npm start             # Starts on http://localhost:3000
```
Customer ordering page: `http://localhost:3000/table/1` (for Table 1)

### 4. Start Kitchen App

```bash
cd kitchen-app
npm install
npm start             # Starts on http://localhost:3001
```
Kitchen login: `http://localhost:3001`
- Email: `kitchen@restaurant.com`
- Password: `kitchen123`

---

## 🐳 Docker Deployment (One Command)

```bash
docker-compose up --build
```

Services:
| Service         | URL                        |
|----------------|----------------------------|
| Customer App   | http://localhost:3000       |
| Kitchen App    | http://localhost:3001       |
| Backend API    | http://localhost:5000       |
| PostgreSQL     | localhost:5432              |

---

## 📡 API Reference

### Public Endpoints (no auth needed)
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | /api/menu                   | Full menu with categories|
| POST   | /api/orders                 | Place a new order        |
| GET    | /api/orders/:id             | Get single order         |
| GET    | /api/orders/table/:tableId  | Orders for a table       |

### Kitchen Endpoints (JWT required)
| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| POST   | /api/auth/login                 | Kitchen staff login      |
| GET    | /api/orders                     | All active orders        |
| PATCH  | /api/orders/:id/status          | Update order status      |
| GET    | /api/tables                     | All tables               |
| GET    | /api/tables/:id/qr              | Generate QR code         |
| PATCH  | /api/menu/:id/availability      | Toggle item availability |

---

## ⚡ Real-Time Events (Socket.IO)

### Customer → Server
| Event         | Payload               | Description              |
|---------------|-----------------------|--------------------------|
| join_table    | { tableId }           | Join table room          |

### Server → Customer
| Event                  | Payload                              |
|------------------------|--------------------------------------|
| order_status_update    | { orderId, status, estimatedTime }   |
| time_updated           | { orderId, estimatedMinutes }        |
| menu_updated           | { itemId, isAvailable }              |

### Kitchen → Server
| Event               | Payload                 |
|---------------------|-------------------------|
| join_kitchen        | { staffId }             |
| update_order_status | { orderId, newStatus, tableId } |

### Server → Kitchen
| Event               | Payload              |
|---------------------|----------------------|
| new_order           | { order }            |
| order_updated       | { orderId, status }  |
| kitchen_notification| { type, message }    |

---

## 🗄️ Database Schema

```
tables          — Restaurant tables (with QR code URL)
categories      — Menu categories (Starters, Mains, etc.)
menu_items      — Food items with pricing, prep time, availability
orders          — Customer orders (pending → cooking → ready → served)
order_items     — Items within each order
staff           — Kitchen/admin users
order_status_history — Audit log of all status changes
```

---

## 🔄 Order Flow

```
Customer scans QR → Opens /table/7
       ↓
Customer browses menu → Adds to cart → Places order
       ↓
POST /api/orders → Saved to DB
       ↓
Socket.IO emits 'new_order' → Kitchen sees it instantly
       ↓
Kitchen: Confirm → Cooking → Ready → Served
       ↓ (each step)
Socket.IO emits 'order_status_update' → Customer's phone updates live
```

---

## 🌍 Production Deployment

### Recommended Stack
- **Frontend**: Vercel or Netlify (free tier works)
- **Backend**: Railway, Render, or Fly.io
- **Database**: Supabase (free PostgreSQL) or Railway
- **WebSockets**: Included in backend — no extra service needed

### Environment Variables for Production
```env
# Backend
NODE_ENV=production
JWT_SECRET=<64-char random string>
DB_HOST=<your-db-host>
CUSTOMER_APP_URL=https://yourdomain.com
KITCHEN_APP_URL=https://kitchen.yourdomain.com
QR_BASE_URL=https://yourdomain.com

# Frontend apps
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_SOCKET_URL=https://api.yourdomain.com
```

---

## 📱 QR Code Setup

1. Log into the Kitchen Dashboard at `/`
2. Go to **QR Codes** tab
3. Click **Generate QR Code** for each table
4. Click **Download PNG** — print and laminate for the table
5. When a customer scans, they land on `https://yourdomain.com/table/7`

---

## ✅ Features

- **Real-time orders** — Socket.IO, sub-second updates
- **Live wait time** — progress bar + countdown on customer's phone
- **Menu availability** — kitchen can disable sold-out items instantly
- **QR generation** — download printable QR per table
- **Order history** — full audit trail with timestamps
- **JWT auth** — secure kitchen/admin access
- **Mobile-first customer UI** — works perfectly on any smartphone
- **Dark-themed kitchen dashboard** — easy to read in busy kitchens
- **Docker ready** — one command to run everything
