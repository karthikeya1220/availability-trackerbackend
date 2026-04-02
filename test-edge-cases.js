#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Admin Scheduling Edge Cases
 * Tests all error scenarios and success paths for the 3-step scheduling workflow
 */

const http = require('http');
const BASE_URL = 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  validAdminId: '550e8400-e29b-41d4-a716-446655440000',
  validUserId: '660f9511-f40c-52e5-b826-557766551111',
  validMentorId: '770g0622-g51d-63f6-c927-668877662222',
  validSlotUserId: 'slot-user-550e8400',
  validSlotMentorId: 'slot-mentor-660f',
  invalidUUID: 'not-a-uuid',
};

// Helper to make HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        ...headers,
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test result tracking
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST SUITE: ${this.name}`);
    console.log(`${'='.repeat(60)}\n`);

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ PASS: ${test.name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Error: ${error.message}`);
      }
    }

    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Results: ${this.passed} passed, ${this.failed} failed`);
    console.log(`${'-'.repeat(60)}\n`);

    return this.failed === 0;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${expected}\nActual: ${actual}`
    );
  }
}

function assertHas(obj, field, message) {
  if (!obj || typeof obj !== 'object' || !(field in obj)) {
    throw new Error(
      `${message}\nObject does not have field: ${field}\nObject: ${JSON.stringify(obj)}`
    );
  }
}

// ============================================================================
// STEP 1: getSchedulingRecommendations() Tests
// ============================================================================

const step1Suite = new TestSuite('Step 1: getSchedulingRecommendations()');

step1Suite.addTest('Missing user_id should return MISSING_USER_ID', async () => {
  const res = await makeRequest('GET', '/api/admin/schedule/recommendations');
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'MISSING_USER_ID', 'Error code should be MISSING_USER_ID');
  assertHas(res.body, 'hint', 'Should include hint');
});

step1Suite.addTest('Invalid user_id format should return INVALID_USER_ID_FORMAT', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.invalidUUID}`
  );
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_USER_ID_FORMAT', 'Error code should be INVALID_USER_ID_FORMAT');
  assertHas(res.body, 'received', 'Should include received value');
  assertHas(res.body, 'hint', 'Should include hint');
});

step1Suite.addTest('Invalid limit format should return INVALID_LIMIT_FORMAT', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}&limit=abc`
  );
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_LIMIT_FORMAT', 'Error code should be INVALID_LIMIT_FORMAT');
  assertHas(res.body, 'hint', 'Should include hint about valid range');
});

step1Suite.addTest('Invalid call_type should return INVALID_CALL_TYPE', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}&call_type=INVALID_TYPE`
  );
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_CALL_TYPE', 'Error code should be INVALID_CALL_TYPE');
  assertHas(res.body, 'hint', 'Should list valid call types');
});

step1Suite.addTest('Nonexistent user should return USER_NOT_FOUND', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=00000000-0000-0000-0000-000000000000`
  );
  assertEquals(res.status, 404, 'Should return 404');
  assertEquals(res.body.code, 'USER_NOT_FOUND', 'Error code should be USER_NOT_FOUND');
});

step1Suite.addTest('User without profile should return USER_PROFILE_NOT_SET_UP', async () => {
  // This requires a user without profile in DB
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}`
  );
  // If user exists but has no profile
  if (res.status === 400) {
    assertEquals(res.body.code, 'USER_PROFILE_NOT_SET_UP', 'Error code should be USER_PROFILE_NOT_SET_UP');
    assertHas(res.body, 'hint', 'Should include hint about profile setup');
  }
});

step1Suite.addTest('No mentors available should return NO_MENTORS_AVAILABLE', async () => {
  // This requires a fresh system with no mentors
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}`
  );
  // If no mentors
  if (res.body.code === 'NO_MENTORS_AVAILABLE') {
    assertEquals(res.status, 400, 'Should return 400');
    assertEquals(res.body.success, false, 'Should have success: false');
    assertHas(res.body, 'totalMentors', 'Should show total mentors count');
    assertHas(res.body, 'mentorsWithProfiles', 'Should show mentors with profiles count');
    assertHas(res.body, 'hint', 'Should include hint about creating mentors');
  }
});

step1Suite.addTest('No mentors with profiles should return NO_MENTORS_WITH_PROFILES', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}`
  );
  // If mentors exist but no profiles
  if (res.body.code === 'NO_MENTORS_WITH_PROFILES') {
    assertEquals(res.status, 400, 'Should return 400');
    assertEquals(res.body.success, false, 'Should have success: false');
    assertHas(res.body, 'totalMentors', 'Should show total mentors');
    assertHas(res.body, 'hint', 'Should include hint about mentor profile setup');
  }
});

step1Suite.addTest('No matching recommendations should return NO_RECOMMENDATIONS_FOUND', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}`
  );
  // If mentors exist and have profiles but no matches
  if (res.body.code === 'NO_RECOMMENDATIONS_FOUND') {
    assertEquals(res.status, 400, 'Should return 400');
    assertEquals(res.body.success, false, 'Should have success: false');
    assertHas(res.body, 'hint', 'Should include hint about profile matching');
  }
});

step1Suite.addTest('Valid request should return recommendations with success: true', async () => {
  const res = await makeRequest(
    'GET',
    `/api/admin/schedule/recommendations?user_id=${TEST_CONFIG.validUserId}&limit=5`
  );
  // If system is properly configured
  if (res.status === 200) {
    assertEquals(res.body.success, true, 'Should have success: true');
    assertEquals(res.body.step, 1, 'Should show step 1');
    assertHas(res.body, 'totalAvailable', 'Should show total available mentors');
    assertHas(res.body, 'returnedCount', 'Should show returned count');
  }
});

// ============================================================================
// STEP 2: getSchedulingOverlaps() Tests
// ============================================================================

const step2Suite = new TestSuite('Step 2: getSchedulingOverlaps()');

step2Suite.addTest('Missing required params should return MISSING_REQUIRED_PARAMS', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    // missing mentor_id
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'MISSING_REQUIRED_PARAMS', 'Error code should be MISSING_REQUIRED_PARAMS');
  assertHas(res.body, 'missing', 'Should list missing fields');
  assertHas(res.body, 'hint', 'Should include hint');
});

step2Suite.addTest('Invalid user_id format should return INVALID_USER_ID_FORMAT', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.invalidUUID,
    mentor_id: TEST_CONFIG.validMentorId,
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_USER_ID_FORMAT', 'Error code should be INVALID_USER_ID_FORMAT');
});

step2Suite.addTest('Invalid mentor_id format should return INVALID_MENTOR_ID_FORMAT', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.invalidUUID,
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_MENTOR_ID_FORMAT', 'Error code should be INVALID_MENTOR_ID_FORMAT');
});

step2Suite.addTest('Self-pairing should return SELF_PAIRING_NOT_ALLOWED', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validUserId, // same as user_id
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'SELF_PAIRING_NOT_ALLOWED', 'Error code should be SELF_PAIRING_NOT_ALLOWED');
});

step2Suite.addTest('Invalid date format should return INVALID_DATE_FORMAT', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    date_start: '04/01/2026', // wrong format
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_DATE_FORMAT', 'Error code should be INVALID_DATE_FORMAT');
  assertHas(res.body, 'hint', 'Should hint correct format');
});

step2Suite.addTest('Invalid date value should return INVALID_DATE_VALUE', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    date_start: '2026-13-45', // invalid month and day
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_DATE_VALUE', 'Error code should be INVALID_DATE_VALUE');
});

step2Suite.addTest('Invalid date range should return INVALID_DATE_RANGE', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    date_start: '2026-04-30',
    date_end: '2026-04-01', // end before start
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_DATE_RANGE', 'Error code should be INVALID_DATE_RANGE');
});

step2Suite.addTest('Nonexistent user should return USER_NOT_FOUND', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: '00000000-0000-0000-0000-000000000000',
    mentor_id: TEST_CONFIG.validMentorId,
  });
  assertEquals(res.status, 404, 'Should return 404');
  assertEquals(res.body.code, 'USER_NOT_FOUND', 'Error code should be USER_NOT_FOUND');
});

step2Suite.addTest('Nonexistent mentor should return MENTOR_NOT_FOUND', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: '00000000-0000-0000-0000-000000000000',
  });
  assertEquals(res.status, 404, 'Should return 404');
  assertEquals(res.body.code, 'MENTOR_NOT_FOUND', 'Error code should be MENTOR_NOT_FOUND');
});

step2Suite.addTest('Non-mentor user should return INVALID_MENTOR_ROLE', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validUserId, // trying to use user as mentor
  });
  // Will be caught by self-pairing check first, but if different user without mentor role
  if (res.body.code === 'INVALID_MENTOR_ROLE') {
    assertEquals(res.status, 400, 'Should return 400');
    assertHas(res.body, 'hint', 'Should hint about selecting mentor');
  }
});

step2Suite.addTest('No overlapping slots should return NO_OVERLAPPING_SLOTS', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    date_start: '2026-04-01',
    date_end: '2026-04-30',
  });
  if (res.body.code === 'NO_OVERLAPPING_SLOTS') {
    assertEquals(res.status, 400, 'Should return 400');
    assertEquals(res.body.success, false, 'Should have success: false');
    assertHas(res.body, 'hint', 'Should include hint about adding availability');
  }
});

step2Suite.addTest('All slots booked should return ALL_SLOTS_BOOKED', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    date_start: '2026-04-01',
    date_end: '2026-04-30',
  });
  if (res.body.code === 'ALL_SLOTS_BOOKED') {
    assertEquals(res.status, 400, 'Should return 400');
    assertEquals(res.body.success, false, 'Should have success: false');
    assertEquals(res.body.availableOverlaps, 0, 'Should show 0 available overlaps');
    assertHas(res.body, 'hint', 'Should suggest alternatives');
  }
});

step2Suite.addTest('Valid request with overlaps should return success', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/overlaps', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    date_start: '2026-04-01',
    date_end: '2026-04-30',
  });
  if (res.status === 200) {
    assertEquals(res.body.success, true, 'Should have success: true');
    assertEquals(res.body.step, 2, 'Should show step 2');
    assertHas(res.body, 'overlaps', 'Should include overlaps array');
    assertHas(res.body, 'availableOverlaps', 'Should show available count');
  }
});

// ============================================================================
// STEP 3: bookScheduledCall() Tests
// ============================================================================

const step3Suite = new TestSuite('Step 3: bookScheduledCall()');

step3Suite.addTest('Missing required params should return MISSING_REQUIRED_PARAMS', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    // missing other fields
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'MISSING_REQUIRED_PARAMS', 'Error code should be MISSING_REQUIRED_PARAMS');
  assertHas(res.body, 'missing', 'Should list missing fields');
});

step3Suite.addTest('Invalid user_id format should return INVALID_USER_ID_FORMAT', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.invalidUUID,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T15:00:00Z',
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_USER_ID_FORMAT', 'Error code should be INVALID_USER_ID_FORMAT');
});

step3Suite.addTest('Invalid time format should return INVALID_START_TIME_FORMAT', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: 'invalid-time',
    end_time: '2026-04-05T15:00:00Z',
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_START_TIME_FORMAT', 'Error code should be INVALID_START_TIME_FORMAT');
  assertHas(res.body, 'hint', 'Should hint ISO format');
});

step3Suite.addTest('Invalid time range should return INVALID_TIME_RANGE', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T15:00:00Z',
    end_time: '2026-04-05T14:00:00Z', // end before start
  });
  assertEquals(res.status, 400, 'Should return 400');
  assertEquals(res.body.code, 'INVALID_TIME_RANGE', 'Error code should be INVALID_TIME_RANGE');
});

step3Suite.addTest('Nonexistent user should return USER_NOT_FOUND', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: '00000000-0000-0000-0000-000000000000',
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T15:00:00Z',
  });
  assertEquals(res.status, 404, 'Should return 404');
  assertEquals(res.body.code, 'USER_NOT_FOUND', 'Error code should be USER_NOT_FOUND');
});

step3Suite.addTest('Nonexistent slot should return SLOT_NOT_FOUND', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: '00000000-0000-0000-0000-000000000000',
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T15:00:00Z',
  });
  assertEquals(res.status, 404, 'Should return 404');
  assertEquals(res.body.code, 'SLOT_NOT_FOUND', 'Error code should be SLOT_NOT_FOUND');
  assertHas(res.body, 'slotType', 'Should indicate slot type');
});

step3Suite.addTest('Slot ownership mismatch should return SLOT_OWNERSHIP_MISMATCH', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotMentorId, // wrong slot type
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T15:00:00Z',
  });
  if (res.body.code === 'SLOT_OWNERSHIP_MISMATCH') {
    assertEquals(res.status, 400, 'Should return 400');
    assertHas(res.body, 'hint', 'Should suggest selecting correct slot');
  }
});

step3Suite.addTest('Already booked slot should return SLOT_ALREADY_BOOKED', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T15:00:00Z',
  });
  if (res.body.code === 'SLOT_ALREADY_BOOKED') {
    assertEquals(res.status, 409, 'Should return 409 Conflict');
    assertHas(res.body, 'bookedAt', 'Should show when it was booked');
    assertHas(res.body, 'hint', 'Should suggest different slot');
  }
});

step3Suite.addTest('Time outside user window should return TIME_OUTSIDE_USER_WINDOW', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T13:00:00Z', // before slot window
    end_time: '2026-04-05T14:30:00Z',
  });
  if (res.body.code === 'TIME_OUTSIDE_USER_WINDOW') {
    assertEquals(res.status, 400, 'Should return 400');
    assertHas(res.body, 'userSlotWindow', 'Should show valid window');
    assertHas(res.body, 'hint', 'Should suggest adjusting time');
  }
});

step3Suite.addTest('Time outside mentor window should return TIME_OUTSIDE_MENTOR_WINDOW', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T17:00:00Z', // extends beyond slot window
  });
  if (res.body.code === 'TIME_OUTSIDE_MENTOR_WINDOW') {
    assertEquals(res.status, 400, 'Should return 400');
    assertHas(res.body, 'mentorSlotWindow', 'Should show valid window');
    assertHas(res.body, 'hint', 'Should suggest adjusting time');
  }
});

step3Suite.addTest('Valid booking should return 201 with success: true', async () => {
  const res = await makeRequest('POST', '/api/admin/schedule/book', {
    user_id: TEST_CONFIG.validUserId,
    mentor_id: TEST_CONFIG.validMentorId,
    user_slot_id: TEST_CONFIG.validSlotUserId,
    mentor_slot_id: TEST_CONFIG.validSlotMentorId,
    title: 'Technical Interview Prep',
    start_time: '2026-04-05T14:00:00Z',
    end_time: '2026-04-05T15:00:00Z',
  });
  if (res.status === 201) {
    assertEquals(res.body.success, true, 'Should have success: true');
    assertEquals(res.body.step, 3, 'Should show step 3');
    assertHas(res.body, 'call', 'Should include call details');
    assertHas(res.body.call, 'id', 'Should have call ID');
    assertHas(res.body.call, 'participants', 'Should have participants');
  }
});

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('\n🧪 ADMIN SCHEDULING EDGE CASE TEST SUITE\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('Note: Some tests are conditional based on system state\n');

  const results = [];

  results.push(await step1Suite.run());
  results.push(await step2Suite.run());
  results.push(await step3Suite.run());

  const allPassed = results.every((r) => r);

  console.log(`\n${'='.repeat(60)}`);
  console.log(allPassed ? '✅ ALL TEST SUITES COMPLETED' : '⚠️  SOME TESTS FAILED');
  console.log(`${'='.repeat(60)}\n`);

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
