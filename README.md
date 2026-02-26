# Bitespeed Identity Reconciliation Service

> A production-grade backend service that reconciles customer identities across multiple purchases using email and phone number matching — ensuring every customer maps to a single, unified primary identity.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-NeonDB-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

- [Live API](#-live-api)
- [Problem Overview](#-problem-overview)
- [Identity Resolution Rules](#-identity-resolution-rules)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Running Locally](#-running-locally)
- [Database Design](#-database-design)
- [Production Considerations](#-production-considerations)
- [Deployment](#-deployment)

---

## 🚀 Live API

| Method | Endpoint |
|--------|----------|
| `POST` | `https://your-render-url.onrender.com/identify` |

> **Note:** Replace the URL above with your actual deployed endpoint before submission.

---

## 📌 Problem Overview

FluxKart customers frequently place orders using different email addresses or phone numbers. Without identity reconciliation, the same customer appears as multiple distinct records — making personalization and loyalty programs impossible.

This service solves that by:

- Detecting contacts that share an email **or** phone number
- Merging them under a single **primary identity**
- Linking all related contacts as **secondary identities** via a `linkedId`
- Ensuring the **oldest contact always remains primary** for deterministic resolution
- Handling all edge cases idempotently — repeated requests return consistent results

---

## 🧠 Identity Resolution Rules

| Rule | Behavior |
|------|----------|
| New contact | Creates a new primary contact |
| Exact match exists | Returns existing identity, no duplicates created |
| Partial match (email OR phone) | Links new contact as secondary under existing primary |
| Two primaries found to be related | Older one retains primary status; newer one is demoted to secondary |
| Both fields null | Returns `400 Bad Request` |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Express.js |
| Database | PostgreSQL via NeonDB (serverless) |
| ORM | Prisma |
| Package Manager | Bun |
| Security | Helmet, CORS |
| Hosting | Render |

---

## 🏗 Architecture

The service follows a clean, layered architecture with strict separation of concerns:

```
HTTP Request
     │
     ▼
┌─────────────┐
│  Controller │  — validates request shape, returns HTTP responses
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │  — core identity reconciliation business logic
└──────┬──────┘
       │
       ▼
┌──────────────┐
│  Repository  │  — all database interactions abstracted here
└──────┬───────┘
       │
       ▼
┌─────────────┐
│    Prisma   │  — type-safe ORM with transaction support
└──────┬──────┘
       │
       ▼
┌──────────────┐
│  PostgreSQL  │  — NeonDB serverless instance
└──────────────┘
```

---

## 📡 API Reference

### `POST /identify`

Resolves and consolidates a customer's identity based on the provided email and/or phone number.

#### Request Body

```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

| Field | Type | Required |
|-------|------|----------|
| `email` | `string` | At least one of the two |
| `phoneNumber` | `string` | At least one of the two |

#### Response — `200 OK`

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": [
      "user@example.com",
      "alt@example.com"
    ],
    "phoneNumbers": [
      "1234567890"
    ],
    "secondaryContactIds": [2, 3]
  }
}
```

| Field | Description |
|-------|-------------|
| `primaryContactId` | ID of the oldest (primary) contact |
| `emails` | All emails linked to this identity (primary first) |
| `phoneNumbers` | All phone numbers linked to this identity (primary first) |
| `secondaryContactIds` | IDs of all secondary contacts under this identity |

#### Error Responses

| Status | Reason |
|--------|--------|
| `400` | Both `email` and `phoneNumber` are missing or null |
| `500` | Internal server error |

#### Quick Test

```bash
curl -X POST https://your-render-url.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "doc@fluxkart.com", "phoneNumber": "123456"}'
```

---

## ⚙️ Running Locally

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Bun](https://bun.sh/)
- PostgreSQL database (local or [NeonDB](https://neon.tech/) free tier)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/bitespeed-identity.git
cd bitespeed-identity
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

Create a `.env` file at the root:

```env
# Primary connection (used by Prisma for queries)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Direct connection (used for migrations — required for NeonDB)
DIRECT_DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

PORT=3000
```

> For NeonDB, both URLs can be found in the **Connection Details** panel of your project dashboard.

### 4. Run database migrations

```bash
npx prisma migrate deploy
```

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Start the development server

```bash
bun run dev
```

The server will be available at `http://localhost:3000`.

---

## 🗄 Database Design

Contacts are stored in a single self-referencing table:

```sql
Contact {
  id              Int       @id @default(autoincrement())
  phoneNumber     String?
  email           String?
  linkedId        Int?      -- references Contact.id (the primary contact)
  linkPrecedence  Enum      -- "primary" | "secondary"
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? -- soft delete support
}
```

**Relationships:**

```
Primary Contact  (linkPrecedence = "primary", linkedId = null)
       │
       ├── Secondary Contact A  (linkedId = Primary.id)
       ├── Secondary Contact B  (linkedId = Primary.id)
       └── Secondary Contact C  (linkedId = Primary.id)
```

---

## 🔒 Production Considerations

- **Transaction-safe merging** — All identity reconciliation operations run inside Prisma transactions to prevent race conditions and partial updates
- **Idempotent API** — Repeated identical requests always return the same response without creating duplicate records
- **Indexed queries** — `email`, `phoneNumber`, and `linkedId` fields are indexed for O(log n) lookup performance
- **Soft deletes** — `deletedAt` field supports future data recovery without permanent data loss
- **Input validation** — Requests missing both identifying fields are rejected at the controller layer before touching the database
- **Helmet + CORS** — Security headers and cross-origin policies applied at the middleware level

---

## 🚢 Deployment

### Render (API Server)

1. Push code to GitHub
2. Connect your repository in [Render](https://render.com/)
3. Set **Build Command:** `bun install && npx prisma generate`
4. Set **Start Command:** `bun run start`
5. Add environment variables (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `PORT`)

### NeonDB (Database)

1. Create a free project at [neon.tech](https://neon.tech/)
2. Copy the **pooled connection string** → `DATABASE_URL`
3. Copy the **direct connection string** → `DIRECT_DATABASE_URL`
4. Run migrations after deploy: `npx prisma migrate deploy`

---

## 👨‍💻 Author

**Rohit**

Built as part of the Bitespeed Backend Task — Identity Reconciliation.
