# Mentor Recommendation Engine

## Overview

A deterministic, explainable mentor recommendation system that matches users with suitable mentors based on skills, interests, domain knowledge, and communication preferences. The system requires no external AI APIs and provides transparent scoring breakdowns.

## Features

✅ **Transparent Scoring**: Every recommendation includes detailed reasoning
✅ **Context-Aware**: Call-type specific boosters (resume_revamp, job_market_guidance, mock_interview)
✅ **Deterministic**: Same inputs always produce same outputs
✅ **No External Dependencies**: Pure algorithmic matching
✅ **Profile-Based**: Uses structured mentor and user profiles
✅ **Big Tech Recognition**: Bonus for resume review from big tech companies
✅ **Communication Awareness**: Factors in mentor communication scores

## Scoring Algorithm

### Base Scoring Components

1. **Tag Matching** (+2 points per match)
   - Compares user interests with mentor expertise
   - Case-insensitive, partial word matching
   - Example: User "React" matches Mentor "React.js"

2. **Keyword Matching** (+1.5 points per match)
   - Extracts keywords from descriptions (3+ characters)
   - Matches user background/goals against mentor description
   - Identifies experience alignment beyond explicit tags

3. **Domain Matching** (+5 points for match, -3 for mismatch)
   - Strong boost when user domain appears in mentor expertise
   - Penalty only applied when clear domain mismatch exists
   - Prevents non-technical mentors for engineers, etc.

4. **Communication Score** (+0.5 per point above 3.0)
   - Uses mentor's communication_score (1-5 scale)
   - Baseline of 3.0, so scale is -1.5 to +1.0

5. **Rating Boost** (+0.3 per star above 3.0)
   - Uses mentor rating (1-5 scale)
   - Similar to communication score scaling

6. **Years of Experience** (up to +1.5 points)
   - 0.1 points per year, capped at 1.5
   - Senior mentors get boost

### Call-Type Specific Boosters

#### resume_revamp (+3.0 bonus)
- Triggers when `callType="resume_revamp"`
- Applied if mentor works at Big Tech company
- Companies include: Google, Meta, Amazon, Apple, Microsoft, Netflix, Stripe, Uber, etc.
- Rationale: Resume review more valuable from recognized companies

#### job_market_guidance (+2.0 bonus)
- Triggers when `callType="job_market_guidance"`
- Applied if mentor has high communication score (≥ 4)
- Rationale: Job market guidance requires clear explanation ability

#### mock_interview (+2.0 bonus)
- Triggers when `callType="mock_interview"`
- Applied if mentor has domain expertise matching user
- Rationale: Interview prep needs domain-specific guidance

## Data Models

### MentorProfile

```javascript
{
  id: String,
  mentorId: String,           // FK to User
  expertise: String[],        // Skills/tags (e.g., ["React", "Node.js"])
  description: String,        // Bio/background
  company: String,            // Current company
  companySize: String,        // Company size (e.g., "50000+")
  communicationScore: Float,  // 1-5 scale
  rating: Float,              // 1-5 star rating
  yearsOfExperience: Int,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### UserProfile

```javascript
{
  id: String,
  userId: String,             // FK to User
  interests: String[],        // Learning interests/tags
  goal: String,               // Primary learning goal
  domain: String,             // Career domain (e.g., "Backend Development")
  description: String,        // Background/context
  createdAt: DateTime,
  updatedAt: DateTime
}
```

## API Endpoints

### Get Recommendations

```
GET /api/recommendations?userId=xxx&limit=5&callType=resume_revamp
```

**Query Parameters:**
- `userId` (optional): Get recommendations for specific user (defaults to authenticated user)
- `limit` (optional): Max recommendations to return, 1-20 (default: 5)
- `callType` (optional): Call context for boosters
  - `resume_revamp`
  - `job_market_guidance`
  - `mock_interview`
  - `general` (default)

**Response:**
```json
{
  "recommendations": [
    {
      "mentorId": "uuid",
      "mentorName": "Dr. Sarah Chen",
      "mentorEmail": "sarah@example.com",
      "company": "Google",
      "expertise": ["React", "Node.js", "System Design"],
      "communicationScore": 4.2,
      "rating": 4.8,
      "yearsOfExperience": 12,
      "score": 18.5,
      "matchPercentage": 92,
      "reasoning": [
        "2 skill match(es): React, Node.js",
        "Domain match: Web Development",
        "Big Tech bonus (Google): valuable for resume revamp"
      ]
    }
  ],
  "requestedCallType": "resume_revamp"
}
```

### Get Detailed Report

```
GET /api/recommendations/report?userId=xxx&callType=resume_revamp
```

**Response includes:**
```json
{
  "userProfile": {
    "interests": ["React", "Node.js"],
    "goal": "Transition to tech from finance",
    "domain": "Web Development"
  },
  "callType": "resume_revamp",
  "recommendations": [
    {
      "mentorId": "uuid",
      "mentorName": "Dr. Sarah Chen",
      "company": "Google",
      "expertise": ["React", "Node.js"],
      "score": 18.5,
      "matchPercentage": 92,
      "reasoning": [...],
      "breakdown": {
        "tagMatching": 4.0,
        "domainMatch": 5.0,
        "bigTechBonus": 3.0,
        "communicationScore": 0.6,
        "rating": 1.2,
        "experience": 1.2
      }
    }
  ],
  "scoringWeights": {
    "tagMatch": 2.0,
    "keywordMatch": 1.5,
    "domainMatch": 5.0,
    "domainMismatch": -3.0,
    "communicationBoost": 0.5,
    "ratingBoost": 0.3
  }
}
```

### Update User Profile

```
PUT /api/recommendations/profile/user
```

**Request Body:**
```json
{
  "interests": ["React", "Node.js", "TypeScript"],
  "goal": "Become full-stack engineer",
  "domain": "Web Development",
  "description": "Transitioning from finance to tech"
}
```

### Update Mentor Profile

```
PUT /api/recommendations/profile/mentor
```

**Request Body:**
```json
{
  "expertise": ["React", "Node.js", "System Design"],
  "description": "Senior engineer at Google with 12+ years experience",
  "company": "Google",
  "companySize": "50000+",
  "communicationScore": 4.2,
  "rating": 4.8,
  "yearsOfExperience": 12
}
```

### Get User Profile

```
GET /api/recommendations/profile/user
```

### Get Mentor Profile

```
GET /api/recommendations/profile/mentor
```

## Usage Examples

### Example 1: Resume Review Recommendation

**User Profile:**
```javascript
{
  interests: ["React", "JavaScript", "Full Stack"],
  goal: "Improve resume for tech jobs",
  domain: "Web Development"
}
```

**Scoring a Google Engineer Mentor:**
```
Tag matches: 2 (React, JavaScript) → 4.0 points
Keyword matches: 1 → 1.5 points
Domain match → 5.0 points
Big Tech bonus (resume_revamp) → 3.0 points
Communication score (4.2) → 0.6 points
Rating (4.8) → 1.5 points
Experience (10 years) → 1.0 points
─────────────────────────────────
Total Score: 16.6 points → 83% match
```

**Reasoning Generated:**
- "2 skill match(es): React, JavaScript"
- "Domain match: Web Development"
- "Big Tech bonus (Google): valuable for resume revamp"

### Example 2: Job Market Guidance Recommendation

**User Profile:**
```javascript
{
  interests: ["Product Management", "Analytics"],
  goal: "Transition to PM role",
  domain: "Product"
}
```

**Scoring a High-Communication PM Mentor:**
```
Tag matches: 1 (Product Management) → 2.0 points
Communication score (4.8) → 0.9 points
High communication bonus (job_market_guidance) → 2.0 points
Rating (4.7) → 1.4 points
─────────────────────────────────
Total Score: 6.3 points → 32% match
```

**Reasoning Generated:**
- "1 skill match(es): Product Management"
- "High communication score: great for guidance"

### Example 3: Mock Interview Recommendation

**User Profile:**
```javascript
{
  interests: ["System Design", "Backend", "Database"],
  goal: "Prepare for senior engineering interviews",
  domain: "Backend Development"
}
```

**Scoring a System Design Expert Mentor:**
```
Tag matches: 1 (System Design) → 2.0 points
Domain match (Backend) → 5.0 points
Mock interview bonus → 2.0 points
Rating (4.8) → 1.5 points
Experience (8 years) → 0.8 points
─────────────────────────────────
Total Score: 11.3 points → 57% match
```

**Reasoning Generated:**
- "1 skill match(es): System Design"
- "Domain match: Backend Development"
- "Domain expertise match for mock interview"

## Implementation Details

### Normalization

All text comparisons use case-insensitive, alphanumeric-only normalization:
```javascript
normalize(text) → text.toLowerCase().replace(/[^\w\s]/g, "").trim()
```

This ensures "React.js" matches "React" and "nodejs" matches "Node.js"

### Keyword Extraction

Keywords are extracted from descriptions as words 3+ characters:
```javascript
extractKeywords("Build AI/ML systems") → ["build", "systems"]
```

Matching is bidirectional: keyword can contain input or vice versa

### Big Tech Companies

Recognized companies for resume_revamp boost:
```javascript
Google, Meta, Facebook, Amazon, Apple, Microsoft, Netflix, Stripe,
Uber, Airbnb, Twitter, LinkedIn, Slack, Shopify, Square, Figma
```

### Match Percentage

Calculated as: `matchPercentage = Math.max(0, Math.min(100, score * 5))`

- Score 0 → 0%
- Score 10 → 50%
- Score 20 → 100%

## Transparency & Debugging

Every recommendation includes:

1. **Reasoning Array**: Human-readable explanation of matches
2. **Breakdown Object**: Point-by-point score breakdown
3. **Match Percentage**: Easy-to-understand match quality (0-100)

This makes recommendations explainable to end users and debuggable by engineers.

## Future Enhancements

- [ ] Learning goals taxonomy (e.g., "Resume Optimization", "Interview Prep")
- [ ] Recency bonus for recently active mentors
- [ ] Availability-based filtering (mentor has available slots)
- [ ] User feedback loop (like/dislike recommendations)
- [ ] Machine-learned scoring weights (after collecting usage data)
- [ ] Mentor specialization badges
- [ ] Industry/company size preferences from users

## Testing

```bash
# Run recommendations on seeded data
npm run seed

# Then test API endpoints
curl http://localhost:5000/api/recommendations?limit=5&callType=resume_revamp
```

All users and mentors are seeded with realistic profiles including:
- Expertise tags
- Learning goals
- Company information
- Communication scores and ratings
