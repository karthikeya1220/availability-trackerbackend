# 🔐 Test Credentials for Login

Use these credentials to test the application:

---

## 👨‍💼 ADMIN User
**Email:** `admin@test.com`  
**Password:** `admin123456`  
**Role:** ADMIN  

**Permissions:**
- ✅ View all users and mentors
- ✅ Create new users
- ✅ View system recommendations
- ✅ Book calls for users and mentors
- ✅ View and delete calls
- ✅ Access admin scheduling endpoints

---

## 👨‍🏫 MENTOR User
**Email:** `mentor@test.com`  
**Password:** `mentor123456`  
**Role:** MENTOR  

**Profile:**
- Expertise: JavaScript, React, Node.js, System Design
- Company: Tech Company
- Years of Experience: 10
- Rating: 4.8/5
- Communication Score: 4.5/5

**Permissions:**
- ✅ View and manage own availability
- ✅ Receive booking requests
- ✅ Update mentor profile
- ✅ View recommendations

---

## 👨‍💻 REGULAR USER
**Email:** `user@test.com`  
**Password:** `user123456`  
**Role:** USER  

**Profile:**
- Interests: Web Development, Backend, Career Growth
- Goal: Become a senior engineer
- Domain: Software Engineering

**Permissions:**
- ✅ View and manage own availability
- ✅ Get mentor recommendations
- ✅ Book calls with mentors
- ✅ Update user profile
- ✅ View own bookings

---

## 🔗 API Login Endpoint

**POST** `/api/auth/login`

### Request Body:
```json
{
  "email": "admin@test.com",
  "password": "admin123456"
}
```

### Response:
```json
{
  "user": {
    "id": "uuid-here",
    "name": "Admin User",
    "email": "admin@test.com",
    "role": "ADMIN",
    "timezone": "UTC"
  },
  "token": "jwt-token-here"
}
```

---

## 🧪 Testing Workflow

### 1. Register New User
```bash
POST /api/auth/register
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123",
  "timezone": "UTC"
}
```

### 2. Login with Test Credentials
```bash
POST /api/auth/login
{
  "email": "user@test.com",
  "password": "user123456"
}
```

### 3. Get User Info
```bash
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

### 4. Get Mentor Recommendations
```bash
GET /api/recommendations?limit=5
Headers: Authorization: Bearer <token>
```

### 5. Book a Call (as ADMIN)
```bash
POST /api/admin/schedule/book
Headers: Authorization: Bearer <admin-token>
{
  "user_id": "user-uuid",
  "mentor_id": "mentor-uuid",
  "start_time": "2026-04-10T10:00:00Z",
  "end_time": "2026-04-10T11:00:00Z",
  "title": "Mentoring Session"
}
```

---

## 📱 Frontend Login Flow

1. Go to login page
2. Enter email: `admin@test.com`
3. Enter password: `admin123456`
4. Click "Login"
5. You'll receive a JWT token that's stored in localStorage
6. Use this token for all authenticated API requests

---

## 🔄 Regenerate Credentials

If you need to reset the test users, run:

```bash
# Delete and recreate
npx prisma migrate reset

# Then seed again
node src/scripts/seedTestUsers.js
```

⚠️ **WARNING:** This will delete ALL data in the database!

---

## 💡 Tips

- All passwords are simple for testing purposes
- Use different credentials for testing role-based features
- JWT tokens expire in 30 days (check `.env` for JWT_EXPIRES_IN)
- Keep these credentials for local development only
- Use strong passwords in production

---

**Created:** April 3, 2026  
**Database:** Neon PostgreSQL (us-east-1)  
**Status:** ✅ Ready for testing

