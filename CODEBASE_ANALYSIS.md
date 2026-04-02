# Availability Tracker Backend - Codebase Analysis

## 1. Routes Overview

### Authentication Routes (`/api/auth`)
- **POST `/api/auth/register`** - Register new user with name, email, password, role (USER/MENTOR), timezone
- **POST `/api/auth/login`** - Login with email and password
- **GET `/api/auth/me`** - Get current authenticated user info
- **GET `/api/auth/google`** - Initiate Google OAuth (requires JWT + ADMIN role)
- **GET `/api/auth/google/callback`** - Google OAuth callback (no auth required, redirects from Google)
- **POST `/api/auth/google/disconnect`** - Disconnect Google account (requires JWT + ADMIN role)

### Availability Routes (`/api/availability`) - All protected with JWT
- **GET `/api/availability/weekly`** - Get weekly availability slots
  - Query params: `userId`, `mentorId`, `weekStart`
  - Returns availability organized by date
- **POST `/api/availability/batch`** - Save/update/delete multiple availability slots
  - Body: `{ slots: [{ date, startTime, endTime, enabled, userId?, mentorId? }] }`

### Meeting Routes (`/api/meetings`) - All protected with JWT
- **GET `/api/meetings`** - List all meetings
  - Query params: `adminId`, `from`, `to`
- **DELETE `/api/meetings/:id`** - Delete meeting (requires ADMIN role)

### Admin Routes (`/api/admin`) - All protected with JWT + ADMIN role
- **GET `/api/admin/users`** - List all users
- **GET `/api/admin/mentors`** - List all mentors
- **POST `/api/admin/create-user`** - Create new user (admin only)
- **GET `/api/admin/availability/:userId`** - Get availability for specific user
  - Query params: `weekStart`
- **GET `/api/admin/availability/:userId/overlap`** - Get overlapping availability slots
  - Query params: `startTime`, `endTime`
- **POST `/api/admin/meetings`** - Schedule new meeting
  - Body: `{ title, startTime?, endTime?, date?, timezone?, participantEmails }`

### Google Routes (`/api/google`) - Legacy/Unused
- **GET `/api/google/auth`** - Redirect to Google OAuth
- **GET `/api/google/callback`** - Exchange code for tokens (stores in memory)

---

## 2. Authentication & Login Flow

### OAuth Implementation

#### **Google OAuth 2.0 (3-legged OAuth for Admin Users)**
1. **Flow Initiation:**
   - Admin calls `GET /api/auth/google` with Bearer token (JWT)
   - Backend generates Google consent URL with scopes and returns `{ url }` to frontend
   - Frontend opens URL in browser

2. **Scopes Requested:**
   ```javascript
   - "https://www.googleapis.com/auth/calendar.events"
   - "https://www.googleapis.com/auth/calendar"
   - "https://www.googleapis.com/auth/userinfo.email"
   - "https://www.googleapis.com/auth/userinfo.profile"
   ```

3. **Callback & Token Storage:**
   - Google redirects to `GET /api/auth/google/callback?code=...&state=...`
   - Backend exchanges authorization code for tokens
   - **Refresh token is saved to `User.googleRefreshToken`** (persistent)
   - Frontend is redirected to settings page with success/error message

4. **Token Management:**
   - **Refresh token** stored in database (`User.googleRefreshToken`)
   - Used later to create/update Google Calendar events
   - Admin can disconnect OAuth via `POST /api/auth/google/disconnect`

#### **JWT-based Session Management**
1. **Register & Login:**
   - Users register with email/password (password hashed with bcryptjs)
   - Login returns JWT token + user info
   - Token payload: `{ userId, role, email }`
   - Expires in: 30 days (configurable via `JWT_EXPIRES_IN`)

2. **Dual JWT Secret Support (SSO Integration):**
   - Primary: `JWT_SECRET` (local auth)
   - Secondary: `MAIN_SITE_JWT_SECRET` (SSO from main Mentorque platform)
   - Backend tries to verify with both secrets:
     - If token has platform shape (`{ id }` instead of `{ userId }`), try MAIN_SITE_JWT_SECRET first
     - Falls back to JWT_SECRET if primary fails
   - This allows seamless login from main platform and local auth

3. **Token in Requests:**
   - Send as: `Authorization: Bearer <token>`
   - Middleware extracts and verifies token
   - Attaches `req.userId` and `req.userRole` to request

---

## 3. Availability Storage & Management

### Database Schema

```
Availability {
  id                String (UUID) @primary
  userId            String? (FK to User, onDelete: Cascade)
  mentorId          String? (FK to User, onDelete: Cascade)
  role              Role (USER | MENTOR)
  date              DateTime (Date only, UTC)
  startTime         DateTime (Full timestamp, UTC)
  endTime           DateTime (Full timestamp, UTC)
  createdAt         DateTime @default(now())
  
  Unique Constraints:
  - (userId, date, startTime)
  - (mentorId, date, startTime)
}
```

### Storage Logic

1. **Save Multiple Slots (Batch Operation):**
   - Endpoint: `POST /api/availability/batch`
   - Input: Array of slots with `enabled` flag
   - **If `enabled=true`:** `UPSERT` (create or update)
   - **If `enabled=false`:** `DELETE`
   - Uses unique constraint to prevent duplicates
   - All times normalized (rounded to slot boundaries)

2. **Slot Structure:**
   ```javascript
   {
     date: "2026-04-15",           // Date string (will be parsed as UTC)
     startTime: "2026-04-15T09:00:00Z",  // Full ISO datetime
     endTime: "2026-04-15T10:00:00Z",
     enabled: true,
     userId?: "user-id",           // Optional (sent by admin for other users)
     mentorId?: "mentor-id"        // Optional (sent by admin for mentors)
   }
   ```

3. **Authorization Rules:**
   - **USER Role:** Can only modify their own slots
   - **MENTOR Role:** Can only modify their own slots
   - **ADMIN Role:** Can modify slots for any user or mentor

4. **Time Validation:**
   - Cannot set availability in the past
   - Slots are normalized (precise timing with start/end)
   - Stores in UTC in database
   - Timezone info: Only stored in `User.timezone` (not per-slot)

5. **Retrieval (GET `/api/availability/weekly`):**
   - Query by `userId` OR `mentorId` (not both)
   - If neither specified: returns caller's availability
   - Returns JSON organized by date:
   ```javascript
   {
     weekStart: "2026-04-14",
     dates: ["2026-04-14", "2026-04-15", ...],
     availability: {
       "2026-04-14": [
         { id, startTime: ISO, endTime: ISO },
         ...
       ],
       ...
     }
   }
   ```

---

## 4. API Mismatches & Issues

### 🔴 **Critical Issues**

#### 1. **Dual Google OAuth Routes (Unused Legacy Code)**
- **Problem:** Two different Google OAuth implementations
  - Route 1: `/api/auth/google` + `/api/auth/google/callback` (in `googleAuth.js`) - **CORRECT**
    - Uses 3-legged OAuth with state parameter
    - Saves refresh token to database
    - Requires JWT authentication
  - Route 2: `/api/google/auth` + `/api/google/callback` (in `google.routes.js`) - **OBSOLETE**
    - Stores tokens in memory (lost on server restart)
    - No state parameter (vulnerable to CSRF)
    - No JWT authentication required
- **Impact:** Confusion, security risk, unused code
- **Fix:** Remove legacy routes in `src/routes/google.routes.js`

#### 2. **Google Calendar Integration Inconsistency**
- **Problem:** 
  - `scheduleMeeting` calls `createCalendarEventWithMeet()` with `timezone` parameter
  - Admin specifies timezone when scheduling
  - But `User.timezone` is never used/synchronized
  - No validation that meeting times respect participant timezones
- **Impact:** Meetings could be scheduled at wrong times for different timezones
- **Fix:** 
  - Use `User.timezone` when querying availability
  - Validate meeting times don't overlap with any participant's availability (in their TZ)

#### 3. **Meeting Participant Storage Issue**
- **Problem:** 
  - `MeetingParticipant` table only stores email addresses
  - No link to actual `User` model
  - No foreign key to `User` table
  - Email might not match any user in system
- **Impact:** 
  - Can't track which users are invited to which meetings
  - No cascade delete if user is removed
  - No validation that emails are registered users
- **Fix:** Add optional `userId` FK to `MeetingParticipant`, or add validation

#### 4. **Availability Querying Has Wrong Logic**
- **Problem:** In `adminController.js`, `getAvailabilityForUser()`:
  ```javascript
  OR: [
    { userId, role: "USER" },
    { mentorId: userId, role: "MENTOR" }
  ]
  ```
  - This is OR, but the same `userId` cannot have both `userId` AND `mentorId` set
  - Should query based on what role the person has, not arbitrary OR
- **Impact:** Queries might return unexpected results
- **Fix:** First look up user's role, then query with correct field

#### 5. **Overlapping Slots Detection is Incomplete**
- **Problem:** `getOverlappingSlots()` in admin controller:
  - Query params expect ISO timestamps: `startTime` and `endTime`
  - But filters entire availability without date constraint
  - No consideration of timezone in overlap calculation
- **Impact:** 
  - Could be slow with large datasets
  - Timezone mismatches when checking overlaps
- **Fix:** Add date range filtering, handle timezone conversion

### 🟡 **Moderate Issues**

#### 6. **No Rate Limiting**
- **Problem:** No rate limiting on auth endpoints
- **Impact:** Vulnerable to brute force attacks
- **Fix:** Add rate limiter middleware

#### 7. **Error Messages Leak Information**
- **Problem:** Auth endpoint returns "Invalid email or password" (doesn't say which is wrong)
- **Good:** Already implemented (no email enumeration vulnerability)
- **But:** Other endpoints might leak sensitive data

#### 8. **Meeting Time Validation Not Complete**
- **Problem:** `scheduleMeeting()` accepts both:
  - Format 1: `startTime`, `endTime` as ISO strings
  - Format 2: `date`, `startTime`, `endTime` as strings + `timezone`
  - Inconsistent parameter handling
- **Impact:** Confusing API, hard to maintain
- **Fix:** Standardize on one format

#### 9. **Admin User Seeding**
- **Problem:** Script `seedAdmin.js` exists but not in package.json scripts
- **Impact:** Can't easily initialize admin account
- **Fix:** Add `npm run seed:admin` script

### 🟢 **Minor Issues**

#### 10. **Missing Indexes**
- **Good:** Database has indexes on common query fields
- **But:** No index on `Meeting.adminId` for faster queries by admin
- **Fix:** Add `@@index([adminId])`

#### 11. **Debug Token Endpoint Left in Production**
- **Problem:** `POST /debug-token` endpoint allows anyone to decode and inspect JWTs
- **Impact:** Information disclosure
- **Fix:** Remove or gate behind ADMIN check

#### 12. **Timezone Handling Inconsistent**
- **Problem:** 
  - User has timezone (IST or UTC only)
  - Meeting can have different timezone
  - Availability is always UTC
  - No timezone-aware comparison when checking availability
- **Impact:** Availability might appear available when actually in different TZ
- **Fix:** Store and handle all times in user's preferred timezone, convert for storage

---

## 5. Summary Table

| Aspect | Status | Notes |
|--------|--------|-------|
| **OAuth** | ✅ Working but Redundant | Two implementations; remove legacy |
| **JWT Auth** | ✅ Good | Supports SSO via MAIN_SITE_JWT_SECRET |
| **Availability Storage** | ⚠️ Mostly Good | Batch upsert works; queries could be better |
| **Timezone Handling** | ❌ Broken | Inconsistent TZ handling across features |
| **Security** | ⚠️ Moderate | Missing rate limiting; debug endpoint exposed |
| **Data Consistency** | ⚠️ Risky | MeetingParticipant not linked to User; could have invalid emails |
| **API Design** | ⚠️ Confusing | Meeting endpoint accepts multiple parameter formats |

---

## 6. Recommended Priority Fixes

1. **High:** Remove legacy `/api/google/*` routes
2. **High:** Fix `MeetingParticipant` to link to `User` (add FK)
3. **High:** Standardize meeting scheduling parameter format
4. **Medium:** Implement rate limiting on auth endpoints
5. **Medium:** Fix timezone handling in availability queries
6. **Low:** Remove or gate `POST /debug-token` endpoint
7. **Low:** Fix `getAvailabilityForUser()` query logic
8. **Low:** Add database indexes for Meeting queries
