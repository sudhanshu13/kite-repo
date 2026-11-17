# Kite Sandbox — Real-Time Technical Analysis & Paper Trading Terminal

A Zerodha Kite-inspired web trading terminal built for **real-time market watch**, **live technical analysis**, and **simulated paper portfolio tracking** (CNC delivery, MIS intraday, and NFO NRML futures). No real orders are placed or real funds debited.

---

## 1. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8 | Modular SPA (`MarketWatch`, `DashboardView`, `OrdersView`, `HoldingsView`, `PositionsView`, `TechnicalsView`, `AdminView`, `FundsApiView`) |
| **Styling & UI** | Tailwind CSS v4 (`@tailwindcss/vite`), Lucide Icons, Open Sans (`tabular-nums`) | Authentic Zerodha Kite Light & Charcoal Dark themes |
| **Backend Server** | Node.js, Express 4 (`server.ts`) | REST API, session/RBAC middleware, order matching engine, Vite dev middleware / `dist/` static hosting |
| **Real-Time Streaming** | WebSockets (`ws`) + Server-Sent Events (`/api/stream` fallback) | 800ms live quote tick & signal broadcast, instant order execution and portfolio sync |
| **Live Market Feed** | Yahoo Finance Chart/Quote Feed (`server/liveFeed.ts`) + optional Kite Connect v3 read-only bridge | Real-time NSE/BSE spot & index quotes (`NIFTY 50`, `SENSEX`, equities) + derived NFO futures |
| **Technical Engine** | Pure TypeScript (`shared/technicals.ts`, `shared/portfolioMath.ts`) | RSI(14), MACD(12,26,9), Stoch %K, CCI(20), SMA/EMA (5–200), Pivot Points (Classic/Fibonacci/Camarilla), margin & M2M P&L |
| **Auth & Security** | Node `crypto` (`scrypt` salted hashes + `HMAC-SHA256` signed tokens) | `HttpOnly` cookie + `Bearer` token auth, 2FA 6-digit PIN, Admin/User RBAC |
| **Testing** | Node built-in test runner (`node:test`) via `tsx` | Unit tests for store/RBAC, live quote parsing, portfolio math, and technical indicators |

---

## 2. Server Requirements

### Minimum & Recommended Hardware
- **OS**: Linux (Ubuntu 22.04/24.04 LTS, Debian 12, Alpine/Docker) or macOS / Windows (WSL2)
- **CPU**: 1 vCPU minimum (2 vCPU recommended for concurrent WebSocket/SSE clients)
- **RAM**: 512 MB minimum (1 GB+ recommended; Node + Express + live market history cache uses ~150–250 MB)
- **Disk**: 500 MB for dependencies & build artifacts + persistent storage for `.data/store.json`

### Software & Runtime Requirements
- **Node.js**: **v22.14+** (or v20.x with `tsx` installed via `npm install`)
- **npm**: v10+ (or `bun` / `pnpm`)
- **Process Manager (Production)**: `pm2` or `systemd` (keeps the single stateful Node process alive)
- **Reverse Proxy (Production HTTPS)**: Nginx or Caddy (required for TLS termination and WebSocket `/ws` upgrade headers)

### Network & Firewall Requirements
- **Inbound**: Port `3000` (proxied behind ports `80`/`443` via Nginx/Caddy)
- **Outbound HTTPS (`443`)**:
  - `query1.finance.yahoo.com` / `query2.finance.yahoo.com` — live NSE/BSE quote & historical candle polling (every 6s during market hours, 25s off-hours; falls back cleanly to simulated ticks if offline).
  - `api.kite.trade` *(optional)* — only used if an Admin configures a read-only Kite Connect v3 API key & access token in **Funds & API**.

---

## 3. Database & Persistence Architecture

### Current Persistence Layer (Zero External DB Required)
Out of the box, the application runs **without requiring PostgreSQL, MongoDB, or Firebase**:
- **Storage Engine**: File-backed JSON store at **`.data/store.json`** (`server/store.ts`).
- **Write Safety**: Updates are persisted atomically (write to temporary file `.data/store.json.tmp` followed by `fs.renameSync`) to prevent file corruption on crashes.
- **Stored Entities**:
  - User accounts (`userId`, `userName`, `email`, `role`, `disabled`, `createdAt`)
  - Salted `scrypt` hashes for both **password** and **6-digit 2FA PIN**
  - Each user's virtual cash, used margin, realized P&L, 7 custom watchlists, orders, holdings, open/closed positions, Kite bridge mode metadata, and API logs
- **In-Memory Runtime State**:
  - Live OHLC history & tick quotes (`MarketEngine`)
  - Active WebSocket (`userSockets`) & SSE (`userSseClients`) connections
  - Transient Kite Connect API secrets (held only in memory per server session, never written to disk)

### Important Production Notes for `.data/store.json`
1. **Single-Process Architecture**: Because `.data/store.json` and `MarketEngine` live in local process memory/disk, run **1 Node instance** (do **not** run PM2 cluster mode with multiple workers sharing `.data/store.json`).
2. **Docker / Cloud Volume Persistence**: Mount `/app/.data` to a persistent volume so user accounts, created traders, balances, and orders survive container restarts or redeployments.
3. **Backups**: Back up `.data/store.json` on a cron schedule (e.g., daily copy to object storage or a backup directory).

### Scaling Beyond Single-Node (Optional External DB Migration)
If you later scale horizontally across multiple backend containers/instances:
- Replace `TradingStore` (`server/store.ts`) with **PostgreSQL** (tables: `users`, `portfolios`, `watchlists`, `orders`, `holdings`, `positions`, `api_logs`) using Drizzle ORM or Prisma.
- Add **Redis** Pub/Sub to fan out `ticks`, `order:executed`, and `portfolio:update` WebSocket/SSE frames across server replicas.

---

## 4. Environment Variables

Create a `.env` file in the project root (never commit secrets to version control):

```env
# Run in production mode to serve compiled /dist instead of Vite dev middleware
NODE_ENV=production

# Strong random secret used to sign HMAC-SHA256 session tokens & cookies
# Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=replace-with-a-long-random-hex-secret

# Optional: Public application URL (for reverse-proxy awareness)
APP_URL=https://your-domain.example.com
```

> **Note**: The server binds to `0.0.0.0:3000` by default (`PORT = 3000` in `server.ts`). If you change the port or put it behind Nginx/Cloud Run, map external port `80`/`443` to container/host port `3000`.

---

## 5. Server Setup & Deployment Guide

### A. Development / Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Start Express + Vite dev server + WebSocket engine on port 3000
npm run dev
```

Open `http://localhost:3000`.

---

### B. Production Build & Run on Linux Server (Ubuntu / Debian)

```bash
# 1. Install Node.js 22+ and build tools if not installed
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone or copy project files to /opt/kite-sandbox
cd /opt/kite-sandbox
npm ci

# 3. Build the frontend React/Tailwind bundle into /dist
npm run build

# 4. Verify TypeScript types & run unit tests
npm run lint
npx --yes tsx --test server/store.test.ts shared/liveQuoteParser.test.ts shared/technicals.test.ts shared/portfolioMath.test.ts

# 5. Start in production mode (serves static /dist + Express API + /ws)
NODE_ENV=production SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" npx tsx server.ts
```

> **Tip (`npm start`)**: `package.json` defines `"start": "node server.ts"`. Node.js v23.6+ executes `.ts` directly; on Node.js v20/v22, run with `npx tsx server.ts` or `node --import tsx server.ts`.

---

### C. Keep Alive with PM2 (Single Instance)

```bash
npm install -g pm2

NODE_ENV=production \
SESSION_SECRET="your-generated-64-char-secret" \
pm2 start npx --name kite-sandbox -- tsx server.ts

pm2 save
pm2 startup
```

---

### D. Nginx Reverse Proxy Configuration (HTTPS + WebSocket + SSE)

WebSocket (`/ws`) and Server-Sent Events (`/api/stream`) require upgrade headers and disabled proxy buffering:

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support (/ws)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded client headers (required for Secure cookies behind HTTPS)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for SSE (/api/stream) real-time delivery
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

Enable HTTPS with Certbot:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example.com
```

---

### E. Docker Deployment Example

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
VOLUME ["/app/.data"]
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
```

Run with persistent `.data` storage:
```bash
docker build -t kite-sandbox .
docker run -d \
  --name kite-sandbox \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET="your-generated-64-char-secret" \
  -v kite_data:/app/.data \
  kite-sandbox
```

---

## 6. Default Accounts & Role-Based Access Control (RBAC)

On first startup, `.data/store.json` is automatically seeded with two accounts:

| Role | Client ID | Password | 6-Digit PIN | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Trader (`user`)** | `KT8492` | `kitedemo` | `123456` | Watchlists, Dashboard, Orders, Holdings, Positions, Live Technicals. **Funds & API** and **Admin** are hidden and blocked (`403`). |
| **Admin (`admin`)** | `AD0001` | `kiteadmin` | `000000` | Full Trader features + **Funds & API** + **Admin Console** (create users, assign roles, add/deduct virtual capital, reset portfolios, suspend/activate accounts, reset password/PIN, delete users). |

> **Security Recommendation**: After deploying to a public server, log in as `AD0001`, change the default admin password and 6-digit PIN (or create a new admin account and manage credentials from the **Admin** tab), and set a strong `SESSION_SECRET`.

---

## 7. Verification & Tests

```bash
# TypeScript check
npm run lint

# Production frontend bundle check
npm run build

# Unit tests (store/RBAC, live quote parser, portfolio math, technical indicators)
npx --yes tsx --test \
  server/store.test.ts \
  shared/liveQuoteParser.test.ts \
  shared/technicals.test.ts \
  shared/portfolioMath.test.ts
```
