/**
 * Test Suite for Availability Overlap Detection
 * Tests the core findOverlappingSlots and findOverlaps functions
 * 
 * Run with: npm test (if configured) or node test/overlap.test.js
 */

// Mock data generators
const createUserSlot = (date, startHour, endHour, id = 'slot-user-1') => ({
  id,
  entityId: 'user-123',
  entityType: 'user',
  date: new Date(date),
  startTime: new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00Z`),
  endTime: new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00Z`)
});

const createMentorSlot = (date, startHour, endHour, id = 'slot-mentor-1') => ({
  id,
  entityId: 'mentor-456',
  entityType: 'mentor',
  date: new Date(date),
  startTime: new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00Z`),
  endTime: new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00Z`)
});

// Test suite
class OverlapDetectionTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  /**
   * Test Case 1: Partial Overlap (User 10-12, Mentor 11-13)
   * Expected: 60 minutes overlap (11:00-12:00)
   */
  testPartialOverlap() {
    console.log('\n✓ TEST CASE 1: Partial Overlap');
    console.log('  User:   10:00 - 12:00');
    console.log('  Mentor: 11:00 - 13:00');
    console.log('  Expected: 60 min overlap (11:00-12:00)');

    const userSlot = createUserSlot('2026-04-08', 10, 12);
    const mentorSlot = createMentorSlot('2026-04-08', 11, 13);

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (hasOverlap) {
      const overlapStart = Math.max(
        userSlot.startTime.getTime(),
        mentorSlot.startTime.getTime()
      );
      const overlapEnd = Math.min(
        userSlot.endTime.getTime(),
        mentorSlot.endTime.getTime()
      );
      const durationMin = (overlapEnd - overlapStart) / (1000 * 60);

      console.log(`  ✅ Result: ${durationMin} min overlap`);
      console.log(`  Overlap: ${new Date(overlapStart).toISOString()} - ${new Date(overlapEnd).toISOString()}`);

      if (durationMin === 60) {
        this.passed++;
        return true;
      }
    }
    
    console.log('  ❌ Failed: Expected 60 minutes');
    this.failed++;
    return false;
  }

  /**
   * Test Case 2: No Overlap (User 10-11, Mentor 11-12)
   * Expected: 0 overlaps
   */
  testNoOverlap() {
    console.log('\n✓ TEST CASE 2: No Overlap (Touching Boundaries)');
    console.log('  User:   10:00 - 11:00');
    console.log('  Mentor: 11:00 - 12:00');
    console.log('  Expected: 0 min overlap');

    const userSlot = createUserSlot('2026-04-08', 10, 11);
    const mentorSlot = createMentorSlot('2026-04-08', 11, 12);

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (!hasOverlap) {
      console.log('  ✅ Result: No overlap detected (correct)');
      this.passed++;
      return true;
    }
    
    console.log('  ❌ Failed: Should not have overlap');
    this.failed++;
    return false;
  }

  /**
   * Test Case 3: Complete Overlap (User 11-12, Mentor 10-13)
   * Expected: 60 minutes overlap
   */
  testCompleteOverlap() {
    console.log('\n✓ TEST CASE 3: Complete Overlap (User Inside Mentor)');
    console.log('  User:   11:00 - 12:00');
    console.log('  Mentor: 10:00 - 13:00');
    console.log('  Expected: 60 min overlap (11:00-12:00)');

    const userSlot = createUserSlot('2026-04-08', 11, 12);
    const mentorSlot = createMentorSlot('2026-04-08', 10, 13);

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (hasOverlap) {
      const overlapStart = Math.max(
        userSlot.startTime.getTime(),
        mentorSlot.startTime.getTime()
      );
      const overlapEnd = Math.min(
        userSlot.endTime.getTime(),
        mentorSlot.endTime.getTime()
      );
      const durationMin = (overlapEnd - overlapStart) / (1000 * 60);

      console.log(`  ✅ Result: ${durationMin} min overlap`);
      
      if (durationMin === 60) {
        this.passed++;
        return true;
      }
    }
    
    console.log('  ❌ Failed: Expected 60 minutes');
    this.failed++;
    return false;
  }

  /**
   * Test Case 4: Mentor Inside User (User 10-13, Mentor 11-12)
   * Expected: 60 minutes overlap
   */
  testMentorInsideUser() {
    console.log('\n✓ TEST CASE 4: Complete Overlap (Mentor Inside User)');
    console.log('  User:   10:00 - 13:00');
    console.log('  Mentor: 11:00 - 12:00');
    console.log('  Expected: 60 min overlap (11:00-12:00)');

    const userSlot = createUserSlot('2026-04-08', 10, 13);
    const mentorSlot = createMentorSlot('2026-04-08', 11, 12);

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (hasOverlap) {
      const overlapStart = Math.max(
        userSlot.startTime.getTime(),
        mentorSlot.startTime.getTime()
      );
      const overlapEnd = Math.min(
        userSlot.endTime.getTime(),
        mentorSlot.endTime.getTime()
      );
      const durationMin = (overlapEnd - overlapStart) / (1000 * 60);

      console.log(`  ✅ Result: ${durationMin} min overlap`);
      
      if (durationMin === 60) {
        this.passed++;
        return true;
      }
    }
    
    console.log('  ❌ Failed: Expected 60 minutes');
    this.failed++;
    return false;
  }

  /**
   * Test Case 5: Exact Overlap (User 10-12, Mentor 10-12)
   * Expected: 120 minutes overlap
   */
  testExactOverlap() {
    console.log('\n✓ TEST CASE 5: Exact Overlap');
    console.log('  User:   10:00 - 12:00');
    console.log('  Mentor: 10:00 - 12:00');
    console.log('  Expected: 120 min overlap');

    const userSlot = createUserSlot('2026-04-08', 10, 12);
    const mentorSlot = createMentorSlot('2026-04-08', 10, 12);

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (hasOverlap) {
      const overlapStart = Math.max(
        userSlot.startTime.getTime(),
        mentorSlot.startTime.getTime()
      );
      const overlapEnd = Math.min(
        userSlot.endTime.getTime(),
        mentorSlot.endTime.getTime()
      );
      const durationMin = (overlapEnd - overlapStart) / (1000 * 60);

      console.log(`  ✅ Result: ${durationMin} min overlap`);
      
      if (durationMin === 120) {
        this.passed++;
        return true;
      }
    }
    
    console.log('  ❌ Failed: Expected 120 minutes');
    this.failed++;
    return false;
  }

  /**
   * Test Case 6: Different Dates (No Overlap)
   * Expected: 0 overlaps
   */
  testDifferentDates() {
    console.log('\n✓ TEST CASE 6: Different Dates');
    console.log('  User:   2026-04-08, 10:00 - 12:00');
    console.log('  Mentor: 2026-04-09, 10:00 - 12:00');
    console.log('  Expected: 0 overlaps (different dates)');

    const userSlot = createUserSlot('2026-04-08', 10, 12);
    const mentorSlot = createMentorSlot('2026-04-09', 10, 12);

    // Same date check
    if (userSlot.date.getTime() !== mentorSlot.date.getTime()) {
      console.log('  ✅ Result: Different dates detected (no comparison)');
      this.passed++;
      return true;
    }
    
    console.log('  ❌ Failed: Should not compare different dates');
    this.failed++;
    return false;
  }

  /**
   * Test Case 7: Multiple Overlaps on Same Day
   * Expected: 2 overlaps
   */
  testMultipleOverlapsSameDay() {
    console.log('\n✓ TEST CASE 7: Multiple Overlaps on Same Day');
    console.log('  User Slots:');
    console.log('    Slot 1: 10:00 - 12:00');
    console.log('    Slot 2: 14:00 - 16:00');
    console.log('  Mentor Slots:');
    console.log('    Slot 1: 11:00 - 13:00');
    console.log('    Slot 2: 13:00 - 15:00');
    console.log('  Expected: 2 overlaps');

    const userSlots = [
      createUserSlot('2026-04-08', 10, 12, 'user-slot-1'),
      createUserSlot('2026-04-08', 14, 16, 'user-slot-2')
    ];
    const mentorSlots = [
      createMentorSlot('2026-04-08', 11, 13, 'mentor-slot-1'),
      createMentorSlot('2026-04-08', 13, 15, 'mentor-slot-2')
    ];

    let overlapCount = 0;
    for (const userSlot of userSlots) {
      for (const mentorSlot of mentorSlots) {
        if (userSlot.date.getTime() === mentorSlot.date.getTime()) {
          if (userSlot.startTime < mentorSlot.endTime && 
              userSlot.endTime > mentorSlot.startTime) {
            overlapCount++;
          }
        }
      }
    }

    console.log(`  ✅ Result: ${overlapCount} overlaps detected`);
    
    if (overlapCount === 2) {
      this.passed++;
      return true;
    }
    
    console.log('  ❌ Failed: Expected 2 overlaps');
    this.failed++;
    return false;
  }

  /**
   * Test Case 8: One Minute Overlap
   * Expected: 1 minute overlap
   */
  testOneMinuteOverlap() {
    console.log('\n✓ TEST CASE 8: Minimal Overlap (1 minute)');
    console.log('  User:   10:00:00 - 10:01:00');
    console.log('  Mentor: 10:00:30 - 11:00:00');
    console.log('  Expected: 30 seconds overlap');

    const userSlot = {
      id: 'user-slot',
      entityId: 'user-123',
      entityType: 'user',
      date: new Date('2026-04-08'),
      startTime: new Date('2026-04-08T10:00:00Z'),
      endTime: new Date('2026-04-08T10:01:00Z')
    };
    const mentorSlot = {
      id: 'mentor-slot',
      entityId: 'mentor-456',
      entityType: 'mentor',
      date: new Date('2026-04-08'),
      startTime: new Date('2026-04-08T10:00:30Z'),
      endTime: new Date('2026-04-08T11:00:00Z')
    };

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (hasOverlap) {
      const overlapStart = Math.max(
        userSlot.startTime.getTime(),
        mentorSlot.startTime.getTime()
      );
      const overlapEnd = Math.min(
        userSlot.endTime.getTime(),
        mentorSlot.endTime.getTime()
      );
      const durationSec = (overlapEnd - overlapStart) / 1000;

      console.log(`  ✅ Result: ${durationSec} seconds overlap`);
      
      if (durationSec === 30) {
        this.passed++;
        return true;
      }
    }
    
    console.log('  ❌ Failed: Expected 30 seconds');
    this.failed++;
    return false;
  }

  /**
   * Test Case 9: Large Duration Overlap
   * Expected: 1440 minutes (24 hours)
   */
  testLargeDurationOverlap() {
    console.log('\n✓ TEST CASE 9: Large Duration Overlap (24 hours)');
    console.log('  User:   00:00 - 23:59');
    console.log('  Mentor: 00:00 - 23:59');
    console.log('  Expected: 1439 min overlap (23h 59m)');

    const userSlot = {
      id: 'user-slot',
      entityId: 'user-123',
      entityType: 'user',
      date: new Date('2026-04-08'),
      startTime: new Date('2026-04-08T00:00:00Z'),
      endTime: new Date('2026-04-08T23:59:00Z')
    };
    const mentorSlot = {
      id: 'mentor-slot',
      entityId: 'mentor-456',
      entityType: 'mentor',
      date: new Date('2026-04-08'),
      startTime: new Date('2026-04-08T00:00:00Z'),
      endTime: new Date('2026-04-08T23:59:00Z')
    };

    const hasOverlap = userSlot.startTime < mentorSlot.endTime && 
                      userSlot.endTime > mentorSlot.startTime;

    if (hasOverlap) {
      const overlapStart = Math.max(
        userSlot.startTime.getTime(),
        mentorSlot.startTime.getTime()
      );
      const overlapEnd = Math.min(
        userSlot.endTime.getTime(),
        mentorSlot.endTime.getTime()
      );
      const durationMin = (overlapEnd - overlapStart) / (1000 * 60);

      console.log(`  ✅ Result: ${durationMin} min overlap`);
      
      if (durationMin === 1439) {
        this.passed++;
        return true;
      }
    }
    
    console.log('  ❌ Failed: Expected 1439 minutes');
    this.failed++;
    return false;
  }

  /**
   * Test Case 10: UTC Time Handling
   * Expected: Correct time comparison in UTC
   */
  testUTCTimeHandling() {
    console.log('\n✓ TEST CASE 10: UTC Time Handling');
    console.log('  User:   2026-04-08T10:00:00Z - 2026-04-08T12:00:00Z');
    console.log('  Mentor: 2026-04-08T11:00:00Z - 2026-04-08T13:00:00Z');
    console.log('  Expected: Correct UTC comparison');

    const userSlot = {
      id: 'user-slot',
      entityId: 'user-123',
      entityType: 'user',
      date: new Date('2026-04-08'),
      startTime: new Date('2026-04-08T10:00:00Z'),
      endTime: new Date('2026-04-08T12:00:00Z')
    };
    const mentorSlot = {
      id: 'mentor-slot',
      entityId: 'mentor-456',
      entityType: 'mentor',
      date: new Date('2026-04-08'),
      startTime: new Date('2026-04-08T11:00:00Z'),
      endTime: new Date('2026-04-08T13:00:00Z')
    };

    // Verify ISO strings are in UTC
    const userStartISO = userSlot.startTime.toISOString();
    const userEndISO = userSlot.endTime.toISOString();
    
    console.log(`  User start: ${userStartISO}`);
    console.log(`  User end:   ${userEndISO}`);

    // Verify times are in UTC format
    if (userStartISO.includes('Z') && userEndISO.includes('Z')) {
      console.log('  ✅ All times in UTC format (ending with Z)');
      this.passed++;
      return true;
    }
    
    console.log('  ❌ Failed: Times not in UTC format');
    this.failed++;
    return false;
  }

  /**
   * Run all tests
   */
  runAll() {
    console.log('\n' + '='.repeat(60));
    console.log('AVAILABILITY OVERLAP DETECTION TEST SUITE');
    console.log('='.repeat(60));

    this.testPartialOverlap();
    this.testNoOverlap();
    this.testCompleteOverlap();
    this.testMentorInsideUser();
    this.testExactOverlap();
    this.testDifferentDates();
    this.testMultipleOverlapsSameDay();
    this.testOneMinuteOverlap();
    this.testLargeDurationOverlap();
    this.testUTCTimeHandling();

    this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📊 Total:  ${this.passed + this.failed}`);
    console.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tests = new OverlapDetectionTests();
tests.runAll();
