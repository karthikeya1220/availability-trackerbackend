# Admin Scheduling Flow - Complete Integration Guide

## Overview

The admin scheduling flow provides a seamless three-step process for admins to book calls between users and mentors:

1. **Step 1: Get Recommendations** - Fetch ranked mentor recommendations for a user
2. **Step 2: Find Overlaps** - Identify overlapping availability between selected user and mentor
3. **Step 3: Book Call** - Book a call on the selected overlapping slot

All endpoints require admin authentication and perform comprehensive validation.

---

## API Endpoints

### Step 1: Get Mentor Recommendations

**Endpoint:** `GET /api/admin/schedule/recommendations`

**Authorization:** Admin only

**Purpose:** Fetch ranked mentor recommendations for a specific user based on the recommendation scoring algorithm.

#### Request

```bash
curl -X GET "http://localhost:5001/api/admin/schedule/recommendations?user_id=<uuid>&call_type=resume_revamp&limit=5" \
  -H "Authorization: Bearer <admin_token>"
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | UUID | ✅ | ID of the user to get recommendations for |
| `call_type` | string | ❌ | Type of call: `resume_revamp`, `job_market_guidance`, `mock_interview`, or `general` (default: `general`) |
| `limit` | integer | ❌ | Max number of recommendations to return (1-20, default: 5) |

#### Response (Success - 200)

```json
{
  "step": 1,
  "userId": "user-uuid-123",
  "userName": "Alex Kumar",
  "userProfile": {
    "interests": ["React", "Node.js", "Web Development"],
    "goal": "Career transition to startup",
    "domain": "Web Development"
  },
  "callType": "resume_revamp",
  "requestedLimit": 5,
  "returnedCount": 3,
  "recommendations": [
    {
      "mentorId": "mentor-uuid-456",
      "mentorName": "Dr. Sarah Chen",
      "mentorEmail": "sarah@example.com",
      "company": "Google",
      "expertise": ["React", "Node.js", "System Design"],
      "communicationScore": 4.5,
      "rating": 4.8,
      "yearsOfExperience": 8,
      "score": 15.84,
      "matchPercentage": 79,
      "reasoning": [
        "2 skill matches (React, Node.js)",
        "Domain match (Web Development)",
        "Big Tech company bonus (+3.0)"
      ]
    },
    {
      "mentorId": "mentor-uuid-789",
      "mentorName": "Priya Sharma",
      "mentorEmail": "priya@example.com",
      "company": "JPMorgan",
      "expertise": ["JavaScript", "Architecture", "TypeScript"],
      "communicationScore": 4.2,
      "rating": 4.6,
      "yearsOfExperience": 10,
      "score": 12.45,
      "matchPercentage": 68,
      "reasoning": [
        "1 skill match (JavaScript)",
        "High communication score bonus (+2.1)"
      ]
    }
  ],
  "nextStep": "POST /api/admin/schedule/overlaps to find available slots"
}
```

#### Error Responses

**400 Bad Request** - Missing user_id

```json
{
  "error": "user_id query parameter is required"
}
```

**403 Forbidden** - Non-admin user

```json
{
  "error": "Only admins can access this endpoint"
}
```

**404 Not Found** - User not found

```json
{
  "error": "User with ID \"user-uuid-123\" not found"
}
```

**400 Bad Request** - User has no profile

```json
{
  "error": "User \"Alex Kumar\" does not have a profile set up",
  "userId": "user-uuid-123",
  "userName": "Alex Kumar"
}
```

---

### Step 2: Find Overlapping Availability

**Endpoint:** `POST /api/admin/schedule/overlaps`

**Authorization:** Admin only

**Purpose:** Find all overlapping availability slots between a selected user and mentor, excluding already-booked slots.

#### Request

```bash
curl -X POST "http://localhost:5001/api/admin/schedule/overlaps" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid-123",
    "mentor_id": "mentor-uuid-456",
    "date_start": "2026-04-05",
    "date_end": "2026-04-12"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | UUID | ✅ | ID of the user |
| `mentor_id` | UUID | ✅ | ID of the mentor |
| `date_start` | string | ❌ | Start date in YYYY-MM-DD format (optional date range filter) |
| `date_end` | string | ❌ | End date in YYYY-MM-DD format (optional date range filter) |

#### Response (Success - 200)

```json
{
  "step": 2,
  "userId": "user-uuid-123",
  "userName": "Alex Kumar",
  "mentorId": "mentor-uuid-456",
  "mentorName": "Dr. Sarah Chen",
  "dateRange": {
    "startDate": "2026-04-05",
    "endDate": "2026-04-12"
  },
  "totalOverlaps": 5,
  "bookedOverlaps": 1,
  "availableOverlaps": 4,
  "overlaps": [
    {
      "overlapId": "user-slot-123-mentor-slot-456",
      "date": "2026-04-05",
      "userSlot": {
        "id": "user-slot-123",
        "startTime": "2026-04-05T09:00:00.000Z",
        "endTime": "2026-04-05T11:00:00.000Z"
      },
      "mentorSlot": {
        "id": "mentor-slot-456",
        "startTime": "2026-04-05T08:30:00.000Z",
        "endTime": "2026-04-05T12:00:00.000Z"
      },
      "overlapPeriod": {
        "startTime": "2026-04-05T09:00:00.000Z",
        "endTime": "2026-04-05T11:00:00.000Z",
        "durationMinutes": 120
      }
    },
    {
      "overlapId": "user-slot-124-mentor-slot-457",
      "date": "2026-04-06",
      "userSlot": {
        "id": "user-slot-124",
        "startTime": "2026-04-06T14:00:00.000Z",
        "endTime": "2026-04-06T16:00:00.000Z"
      },
      "mentorSlot": {
        "id": "mentor-slot-457",
        "startTime": "2026-04-06T14:30:00.000Z",
        "endTime": "2026-04-06T17:00:00.000Z"
      },
      "overlapPeriod": {
        "startTime": "2026-04-06T14:30:00.000Z",
        "endTime": "2026-04-06T16:00:00.000Z",
        "durationMinutes": 90
      }
    }
  ],
  "nextStep": "POST /api/admin/schedule/book to book a call on selected slot"
}
```

#### Error Responses

**400 Bad Request** - Missing required fields

```json
{
  "error": "user_id and mentor_id are required"
}
```

**403 Forbidden** - Non-admin user

```json
{
  "error": "Only admins can access this endpoint"
}
```

**404 Not Found** - User or mentor not found

```json
{
  "error": "User with ID \"user-uuid-123\" not found"
}
```

**400 Bad Request** - Mentor selected is not a mentor

```json
{
  "error": "User \"John Smith\" is not a mentor (role: USER)"
}
```

**400 Bad Request** - Invalid date format

```json
{
  "error": "date_start must be valid ISO date (YYYY-MM-DD)"
}
```

**200 OK** - No overlaps found (still successful)

```json
{
  "step": 2,
  "userId": "user-uuid-123",
  "userName": "Alex Kumar",
  "mentorId": "mentor-uuid-456",
  "mentorName": "Dr. Sarah Chen",
  "dateRange": {
    "startDate": "2026-04-05",
    "endDate": "2026-04-12"
  },
  "totalOverlaps": 0,
  "bookedOverlaps": 0,
  "availableOverlaps": 0,
  "overlaps": [],
  "nextStep": "POST /api/admin/schedule/book to book a call on selected slot"
}
```

---

### Step 3: Book a Call

**Endpoint:** `POST /api/admin/schedule/book`

**Authorization:** Admin only

**Purpose:** Book a call between user and mentor on selected overlapping slot(s), marking availability slots as booked.

#### Request

```bash
curl -X POST "http://localhost:5001/api/admin/schedule/book" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid-123",
    "mentor_id": "mentor-uuid-456",
    "user_slot_id": "user-slot-123",
    "mentor_slot_id": "mentor-slot-456",
    "title": "Resume Review Session",
    "start_time": "2026-04-05T09:00:00Z",
    "end_time": "2026-04-05T10:00:00Z"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | UUID | ✅ | ID of the user |
| `mentor_id` | UUID | ✅ | ID of the mentor |
| `user_slot_id` | UUID | ✅ | Availability slot ID for the user |
| `mentor_slot_id` | UUID | ✅ | Availability slot ID for the mentor |
| `title` | string | ❌ | Title for the call (auto-generated if not provided) |
| `start_time` | ISO datetime | ✅ | Call start time (must be within both availability slots) |
| `end_time` | ISO datetime | ✅ | Call end time (must be within both availability slots) |

#### Response (Success - 201 Created)

```json
{
  "step": 3,
  "success": true,
  "message": "Call booked successfully",
  "call": {
    "id": "call-uuid-789",
    "title": "Resume Review Session",
    "startTime": "2026-04-05T09:00:00.000Z",
    "endTime": "2026-04-05T10:00:00.000Z",
    "durationMinutes": 60,
    "admin": {
      "id": "admin-uuid-001",
      "role": "ADMIN"
    },
    "participants": [
      {
        "id": "user-uuid-123",
        "name": "Alex Kumar",
        "email": "alex@example.com",
        "role": "USER"
      },
      {
        "id": "mentor-uuid-456",
        "name": "Dr. Sarah Chen",
        "email": "sarah@example.com",
        "role": "MENTOR"
      }
    ]
  },
  "bookingDetails": {
    "userSlot": {
      "id": "user-slot-123",
      "availability": {
        "startTime": "2026-04-05T09:00:00.000Z",
        "endTime": "2026-04-05T11:00:00.000Z"
      },
      "marked": "BOOKED"
    },
    "mentorSlot": {
      "id": "mentor-slot-456",
      "availability": {
        "startTime": "2026-04-05T08:30:00.000Z",
        "endTime": "2026-04-05T12:00:00.000Z"
      },
      "marked": "BOOKED"
    }
  },
  "workflow": {
    "step1": "✅ Recommendations fetched",
    "step2": "✅ Overlapping slots identified",
    "step3": "✅ Call booked"
  }
}
```

#### Error Responses

**400 Bad Request** - Missing required fields

```json
{
  "error": "user_id, mentor_id, user_slot_id, mentor_slot_id, start_time, and end_time are required"
}
```

**403 Forbidden** - Non-admin user

```json
{
  "error": "Only admins can access this endpoint"
}
```

**404 Not Found** - User or mentor not found

```json
{
  "error": "User with ID \"user-uuid-123\" not found"
}
```

**404 Not Found** - Availability slot not found

```json
{
  "error": "User availability slot \"user-slot-123\" not found"
}
```

**400 Bad Request** - Slot does not belong to user

```json
{
  "error": "Slot \"user-slot-123\" does not belong to user \"user-uuid-123\""
}
```

**409 Conflict** - Slot already booked

```json
{
  "error": "User availability slot \"user-slot-123\" is already booked"
}
```

**400 Bad Request** - Call time outside availability window

```json
{
  "error": "Call time must be within both user and mentor availability slots",
  "userSlotWindow": {
    "startTime": "2026-04-05T09:00:00.000Z",
    "endTime": "2026-04-05T11:00:00.000Z"
  },
  "mentorSlotWindow": {
    "startTime": "2026-04-05T08:30:00.000Z",
    "endTime": "2026-04-05T12:00:00.000Z"
  },
  "requestedCallTime": {
    "startTime": "2026-04-05T11:30:00.000Z",
    "endTime": "2026-04-05T12:30:00.000Z"
  }
}
```

**400 Bad Request** - Invalid date format

```json
{
  "error": "start_time and end_time must be valid ISO dates"
}
```

**400 Bad Request** - Start time after end time

```json
{
  "error": "start_time must be before end_time"
}
```

---

## Complete Workflow Example

### Scenario: Admin books call between Alex and Dr. Chen

#### Step 1: Get Recommendations

```bash
# Admin fetches top 5 mentors recommended for Alex
curl -X GET "http://localhost:5001/api/admin/schedule/recommendations?user_id=alex-id&limit=5" \
  -H "Authorization: Bearer admin-token"

# Response includes Dr. Sarah Chen with 79% match
```

#### Step 2: Check Availability

```bash
# Admin sees Dr. Chen is recommended, now finds overlapping slots
curl -X POST "http://localhost:5001/api/admin/schedule/overlaps" \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alex-id",
    "mentor_id": "chen-id",
    "date_start": "2026-04-05",
    "date_end": "2026-04-12"
  }'

# Response shows 4 available overlapping slots for the week
```

#### Step 3: Book Call

```bash
# Admin selects the first overlap (Saturday 9am-11am slot)
# and books a 1-hour call
curl -X POST "http://localhost:5001/api/admin/schedule/book" \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alex-id",
    "mentor_id": "chen-id",
    "user_slot_id": "alex-saturday-slot",
    "mentor_slot_id": "chen-saturday-slot",
    "title": "Resume Review & Career Chat",
    "start_time": "2026-04-05T09:00:00Z",
    "end_time": "2026-04-05T10:00:00Z"
  }'

# Response confirms call is booked and both slots are marked as unavailable
```

---

## Data Validation & Safety

### Comprehensive Validation

1. **Authorization**
   - All endpoints enforce admin-only access
   - Non-admin requests rejected with 403 Forbidden

2. **Entity Validation**
   - User exists and has profile
   - Mentor exists and has valid MENTOR role
   - All slot IDs are valid

3. **Slot Ownership Validation**
   - User slot belongs to user (entityId + entityType check)
   - Mentor slot belongs to mentor (entityId + entityType check)

4. **Booking Status Validation**
   - Slots are not already booked (isBooked = false)
   - Cannot double-book availability

5. **Time Validation**
   - Requested call time is within both availability slots
   - Start time before end time
   - Valid ISO datetime format

6. **Transaction Safety**
   - Call creation, participant addition, and slot marking happen in single transaction
   - All-or-nothing: if booking fails, nothing is persisted

---

## Integration Points

### 1. Recommendations Service
- Uses `recommendMentors()` from `mentorRecommendation.js`
- Applies scoring algorithm (tag matching, domain alignment, call-type boosters)
- Returns ranked list with match percentages

### 2. Availability Overlap Detection
- Uses `findOverlappingSlots()` from `availabilityController.js`
- Checks same-date time overlaps
- Validates slots are not booked

### 3. Meeting/Call Creation
- Creates `Call` record with admin context
- Adds `CallParticipant` entries for user and mentor
- Marks availability slots as booked with timestamp

---

## Response Structure Pattern

All endpoints follow consistent structure:

```json
{
  "step": 1-3,                    // Workflow step
  "success": true/false,          // Success indicator
  "userId": "...",                // Primary entity
  "mentorId": "...",              // Secondary entity (if applicable)
  "[resource]": {...},            // Primary response data
  "nextStep": "...",              // Hint for next endpoint
  "workflow": {...}               // Progress tracking
}
```

---

## Rate Limiting & Performance

- All endpoints authenticated (via middleware)
- Database queries indexed on frequently-used fields
- Transaction-based booking prevents race conditions
- Recommend caching recommendations for same user/call_type

---

## Frontend Integration Example

### React Hook Implementation

```javascript
const useAdminScheduling = () => {
  const [recommendations, setRecommendations] = useState(null);
  const [overlaps, setOverlaps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getRecommendations = async (userId, callType = 'general', limit = 5) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/schedule/recommendations?user_id=${userId}&call_type=${callType}&limit=${limit}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      setRecommendations(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const findOverlaps = async (userId, mentorId, dateStart, dateEnd) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/schedule/overlaps', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          mentor_id: mentorId,
          date_start: dateStart,
          date_end: dateEnd,
        }),
      });
      const data = await res.json();
      setOverlaps(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const bookCall = async (userId, mentorId, userSlotId, mentorSlotId, startTime, endTime, title) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/schedule/book', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          mentor_id: mentorId,
          user_slot_id: userSlotId,
          mentor_slot_id: mentorSlotId,
          title,
          start_time: startTime,
          end_time: endTime,
        }),
      });
      const data = await res.json();
      setError(null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
    setLoading(false);
  };

  return {
    recommendations,
    overlaps,
    loading,
    error,
    getRecommendations,
    findOverlaps,
    bookCall,
  };
};
```

---

## Troubleshooting

### Issue: "Only admins can access this endpoint"
- **Cause:** Non-admin user attempting to access endpoint
- **Solution:** Ensure request includes valid admin authentication token

### Issue: "User does not have a profile set up"
- **Cause:** User exists but UserProfile not created
- **Solution:** Admin must first set up user profile via profile endpoints or seed script

### Issue: "No overlaps found"
- **Cause:** User and mentor availability don't overlap
- **Solution:** Check mentor availability for overlapping date ranges, or request adjustment

### Issue: "Call time must be within both user and mentor availability slots"
- **Cause:** Requested call time extends beyond availability window
- **Solution:** Select call time within the overlapPeriod returned from Step 2

### Issue: "Slot already booked"
- **Cause:** Attempting to book on already-reserved slot
- **Solution:** Fetch fresh overlaps to get current availability status

---

## Security Considerations

1. **Admin-Only Enforcement**
   - All three endpoints strictly enforce ADMIN role
   - Prevents users from booking calls directly

2. **Slot Ownership Validation**
   - Confirms user slot belongs to user, mentor slot belongs to mentor
   - Prevents cross-assignment of slots

3. **Transaction Safety**
   - Atomic transaction ensures consistency
   - Prevents partial booking states

4. **Rate Limiting** (recommended to implement)
   - Consider rate limiting booking endpoint
   - Prevent rapid-fire bookings

5. **Audit Trail** (recommended)
   - Log all bookings with admin ID
   - Track call creation by admin user
