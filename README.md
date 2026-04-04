# 🛡️ MentorQue: Scheduling Infrastructure (Backend)

The high-performance API powering the MentorQue mentorship ecosystem. Features a custom recommendation engine, relational availability tracking, and role-based access control.

## 🏗️ Technical Architecture
*   **Engine**: Node.js / Express
*   **Database**: PostgreSQL
*   **ORM**: Prisma
*   **Authentication**: JWT-based with Role-Based Access Control (RBAC)
*   **Logic Layer**: Proprietary recommendation engine weighting Domain Expertise (40%), Skill Tags (30%), and Communication Scores (20%).

## 🚀 Quick Start (Local Setup)

### 1. Prerequisite Sync
Ensure you are in the root of the backend repository.
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file or use the pre-filled template below.
```env
DATABASE_URL="postgresql://postgres.gukqstnhkbsuldzkbfcj:darshan2005iiitdm@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.gukqstnhkbsuldzkbfcj:darshan2005iiitdm@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="1dbaf9fa929cfd7ca4b1d78180673a9dd391770413c99cdff3801e77fcee0a20"
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3. Database Initialization
```bash
# Push the relational schema to your database
npx prisma db push

# Generate the Prisma Client
npx prisma generate

# Seed the identity layers and availability slots
node src/scripts/seed.js
```

### 4. Launch the Engine
```bash
npm run dev
```

## 🔐 Master Demo Identities
| Access Tier | Identifier | Security Key |
| :--- | :--- | :--- |
| **Administrator** | `admin@mentorque.com` | `admin123456` |
| **Mentor** | `arjun.sharma@mentorque.com` | `mentor123` |
| **Candidate** | `aditya.kumar@example.com` | `user123456` |

## 📐 API Endpoints (Core)
*   **POST** `/api/auth/login`: Identity verification
*   **GET** `/api/admin/users`: Unified user list
*   **POST** `/api/admin/recommend`: AI Mentor Matching Engine
*   **POST** `/api/admin/schedule`: Execute booking protocol
*   **GET** `/api/availability/mentor/:id`: Real-time slot analysis

## 🌲 Project Structure
```text
src/
├── controllers/    # Neural logic layer
├── middlewares/    # RBAC & Identity guards
├── routes/         # Endpoint definitions
├── scripts/        # Seeding & DB snapshots
├── services/       # External engine integrations
└── index.js        # Main orchestration unit
```

---
**Institutional Access Only.** Engineered by the MentorQue Development Unit.
