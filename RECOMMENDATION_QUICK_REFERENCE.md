# Mentor Recommendation Engine - Quick Reference

## Quick Start

### 1. Setup Complete ✅
Database, API, and seed data are all set up. Just run:

```bash
npm run seed
```

### 2. Test It
```bash
node test-recommendations.js
```

### 3. Call the API

**Get recommendations for current user:**
```bash
curl http://localhost:5000/api/recommendations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Get recommendations for resume review:**
```bash
curl "http://localhost:5000/api/recommendations?limit=5&callType=resume_revamp" \
  -H "Authorization: Bearer <token>"
```

**Get detailed report:**
```bash
curl "http://localhost:5000/api/recommendations/report?callType=job_market_guidance" \
  -H "Authorization: Bearer <token>"
```

## Scoring Breakdown

Every recommendation includes points breakdown:

```
tagMatching: 4.0         ← Skill matches (2 pts each)
keywordMatching: 1.5     ← Bio/description alignment
domainMatch: 5.0         ← Domain expertise match
communicationScore: 0.6  ← Mentor communication ability
rating: 0.54             ← Mentor rating
experience: 1.2          ← Years of experience
bigTechBonus: 3.0        ← Resume review from big company
────────────────
Total: 15.84 points (79% match)
```

## Scoring Weights

| Component | Points | When Applied |
|-----------|--------|--------------|
| Tag Match | +2 | Per skill match |
| Keyword Match | +1.5 | Per description match |
| Domain Match | +5 | User domain in mentor expertise |
| Domain Mismatch | -3 | Clear domain incompatibility |
| Communication | +0.5 | Per point above 3.0 (1-5 scale) |
| Rating | +0.3 | Per star above 3.0 (1-5 scale) |
| Experience | +0.1 | Per year (max +1.5) |
| Big Tech Bonus | +3.0 | Resume review from known company |
| High Communication Bonus | +2.0 | Job guidance from communicative mentor |
| Mock Interview Bonus | +2.0 | Domain expert for interview prep |

## Call Types & Boosters

### `resume_revamp`
- Favors Big Tech mentors
- Benefits: +3.0 for Google, Meta, Amazon, etc.
- Best for: Career-changing professionals

### `job_market_guidance`
- Favors communicative mentors
- Benefits: +2.0 if communication score ≥ 4
- Best for: Job search strategy

### `mock_interview`
- Favors domain experts
- Benefits: +2.0 if domain expertise matches
- Best for: Interview preparation

### `general`
- No type-specific bonuses
- Best for: Initial mentor discovery

## Profile Fields

### Mentor Profile
```javascript
{
  expertise: ["React", "Node.js"],      // Skill tags
  description: "Senior engineer...",    // Bio
  company: "Google",                    // Current company
  companySize: "50000+",                // Organization size
  communicationScore: 4.2,              // 1-5 scale
  rating: 4.8,                          // 1-5 stars
  yearsOfExperience: 12
}
```

### User Profile
```javascript
{
  interests: ["React", "JavaScript"],   // Learning interests
  goal: "Get first tech job",           // Primary goal
  domain: "Web Development",            // Career domain
  description: "Bootcamp graduate..."   // Background
}
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/recommendations` | Get ranked recommendations |
| GET | `/api/recommendations/report` | Detailed scoring breakdown |
| GET | `/api/recommendations/profile/user` | View user profile |
| PUT | `/api/recommendations/profile/user` | Update user profile |
| GET | `/api/recommendations/profile/mentor` | View mentor profile |
| PUT | `/api/recommendations/profile/mentor` | Update mentor profile |

## Example Responses

### Top Recommendation
```json
{
  "mentorId": "uuid-1",
  "mentorName": "Dr. Sarah Chen",
  "company": "Google",
  "expertise": ["React", "Node.js", "System Design"],
  "score": 15.84,
  "matchPercentage": 79,
  "reasoning": [
    "2 skill match(es): React, Node.js",
    "Domain match: Web Development",
    "Big Tech bonus (Google): valuable for resume revamp"
  ]
}
```

## Testing Data

After `npm run seed`:

**Mentors:**
- Dr. Sarah Chen @ Google (React, Node.js, System Design)
- James Wilson @ TechFlow AI (Product Management)
- Priya Sharma @ JPMorgan (Data Science, Python, ML)
- Marcus Johnson @ Founder Institute (Business, Entrepreneurship)
- Elena Rodriguez @ Stripe (UX Design, Figma)

**Users:**
- Alex Kumar (Web Development interest)
- Jordan Taylor (Backend/System Design)
- Casey O'Brien (Full Stack)
- Morgan Lee (Product Management)
- Riley Chen (Machine Learning)
- And 5 more...

## Big Tech Companies Recognized

Trigger `resume_revamp` bonus if mentor works at:

Google · Meta · Facebook · Amazon · Apple · Microsoft · Netflix · Stripe · Uber · Airbnb · Twitter · LinkedIn · Slack · Shopify · Square · Figma

## Key Features

✅ **Deterministic** - Same input = same output (no randomness)
✅ **Explainable** - Full breakdown of why each recommendation
✅ **Fast** - ~1ms per mentor scored
✅ **Scalable** - Linear complexity O(n)
✅ **No ML** - Pure algorithmic scoring
✅ **Transparent** - All scoring weights publicly documented

## Debugging

Check individual mentor scores:
```bash
node test-recommendations.js
```

Look for:
- **Score too low?** Check tag/keyword matches
- **Wrong order?** Check communication score and rating
- **Missing bonus?** Verify call type is correct
- **Domain mismatch penalty?** Ensure domain/expertise overlap

## Tweaking Weights

To adjust scoring, edit `src/services/mentorRecommendation.js`:

```javascript
const SCORING = {
  TAG_MATCH: 2.0,              // Increase for more weight on skills
  KEYWORD_MATCH: 1.5,          // Adjust for bio matching
  DOMAIN_MATCH: 5.0,           // Strong signal, usually good
  DOMAIN_MISMATCH: -3.0,       // Prevent bad matches
  COMMUNICATION_BOOST: 0.5,    // Communication value
  RATING_BOOST: 0.3,           // Rating weight
  BIG_TECH_BONUS: 3.0,         // Resume revamp boost
  HIGH_COMMUNICATION_BONUS: 2.0,
};
```

## Common Issues

**Q: Mentor gets low score despite match**
- A: Check domain field. Mismatches give -3 penalty

**Q: Recommendations change unexpectedly**
- A: Check seed data is complete. Profiles must exist for scoring

**Q: API returns empty list**
- A: Verify user and mentor profiles are populated in database

**Q: Different scores than documentation example**
- A: Ensure you're using same test data as examples

## Next Steps

1. ✅ Implement user feedback (like/dislike)
2. ✅ Add availability filtering
3. ✅ Track recommendation success rates
4. ✅ Fine-tune weights based on user feedback
5. ✅ Add mentor specialization badges

## Support

Documentation: `MENTOR_RECOMMENDATION_ENGINE.md`
Implementation: `MENTOR_RECOMMENDATION_IMPLEMENTATION.md`
Test: `test-recommendations.js`
Source: `src/services/mentorRecommendation.js`
