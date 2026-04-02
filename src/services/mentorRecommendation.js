/**
 * Mentor Recommendation Engine
 * 
 * Deterministic, explainable recommendation system based on:
 * 1. Tag/skill matching
 * 2. Keyword matching in descriptions
 * 3. Domain alignment
 * 4. Call-type specific boosts
 * 5. Communication score and rating
 * 
 * No external APIs - all scoring is local and transparent.
 */

/**
 * Scoring configuration
 */
const SCORING = {
  TAG_MATCH: 2.0, // Points per matched tag
  KEYWORD_MATCH: 1.5, // Points per keyword match in description
  DOMAIN_MATCH: 5.0, // Boost for domain match
  DOMAIN_MISMATCH: -3.0, // Penalty for domain mismatch
  COMMUNICATION_BOOST: 0.5, // Per point on 1-5 scale
  RATING_BOOST: 0.3, // Per star on 1-5 scale
  BIG_TECH_BONUS: 3.0, // For resume_revamp
  HIGH_COMMUNICATION_BONUS: 2.0, // For job_market_guidance
};

const BIG_TECH_COMPANIES = [
  "google",
  "meta",
  "facebook",
  "amazon",
  "apple",
  "microsoft",
  "netflix",
  "stripe",
  "uber",
  "airbnb",
  "twitter",
  "linkedin",
  "slack",
  "shopify",
  "square",
  "figma",
];

/**
 * Normalize text for comparison
 */
function normalize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  if (!text) return [];
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

/**
 * Check if company is big tech
 */
function isBigTech(company) {
  if (!company) return false;
  const normalized = normalize(company);
  return BIG_TECH_COMPANIES.some((tech) => normalized.includes(tech));
}

/**
 * Count tag matches between two arrays
 */
function countTagMatches(userTags, mentorTags) {
  if (!userTags || !mentorTags) return 0;
  const normalizedUser = userTags.map(normalize);
  const normalizedMentor = mentorTags.map(normalize);
  return normalizedUser.filter((tag) =>
    normalizedMentor.some((mTag) => mTag.includes(tag) || tag.includes(mTag))
  ).length;
}

/**
 * Count keyword matches in descriptions
 */
function countKeywordMatches(userKeywords, mentorDescription) {
  if (!userKeywords || !mentorDescription) return 0;
  const mentorKeywords = extractKeywords(mentorDescription);
  return userKeywords.filter((keyword) =>
    mentorKeywords.some(
      (mKeyword) => mKeyword.includes(keyword) || keyword.includes(mKeyword)
    )
  ).length;
}

/**
 * Score a single mentor against a user profile
 * 
 * @param {Object} user - User profile with interests, goal, domain, description
 * @param {Object} mentor - Mentor profile with expertise, description, company, etc.
 * @param {String} callType - Type of call (resume_revamp, job_market_guidance, mock_interview)
 * @returns {Object} Score breakdown with total and reasoning
 */
export function scoreMentor(user, mentor, callType = null) {
  if (!user || !mentor) {
    return {
      score: 0,
      matchPercentage: 0,
      reasoning: ["Invalid user or mentor profile"],
    };
  }

  let totalScore = 0;
  const reasons = [];
  const breakdown = {};

  // 1. TAG MATCHING (expertise vs interests)
  const tagMatches = countTagMatches(user.interests, mentor.expertise);
  if (tagMatches > 0) {
    const tagScore = tagMatches * SCORING.TAG_MATCH;
    breakdown.tagMatching = tagScore;
    totalScore += tagScore;
    reasons.push(
      `${tagMatches} skill match(es): ${user.interests
        .filter((tag) =>
          mentor.expertise.some(
            (eMentor) =>
              normalize(eMentor).includes(normalize(tag)) ||
              normalize(tag).includes(normalize(eMentor))
          )
        )
        .join(", ")}`
    );
  }

  // 2. KEYWORD MATCHING IN DESCRIPTION
  const userKeywords = extractKeywords(
    `${user.description || ""} ${user.goal || ""}`
  );
  const descriptionMatches = countKeywordMatches(
    userKeywords,
    mentor.description
  );
  if (descriptionMatches > 0) {
    const keywordScore = descriptionMatches * SCORING.KEYWORD_MATCH;
    breakdown.keywordMatching = keywordScore;
    totalScore += keywordScore;
    reasons.push(`${descriptionMatches} background keyword match(es)`);
  }

  // 3. DOMAIN MATCHING
  if (user.domain && mentor.expertise) {
    const userDomainNorm = normalize(user.domain);
    const mentorHasDomain = mentor.expertise.some((exp) =>
      normalize(exp).includes(userDomainNorm)
    );

    if (mentorHasDomain) {
      breakdown.domainMatch = SCORING.DOMAIN_MATCH;
      totalScore += SCORING.DOMAIN_MATCH;
      reasons.push(`Domain match: ${user.domain}`);
    } else if (userDomainNorm.length > 0) {
      // Check for domain mismatch (only if it seems like a real mismatch)
      const userMentorIntersection = mentor.expertise.filter((exp) =>
        userKeywords.some(
          (kw) =>
            normalize(exp).includes(kw) || normalize(kw).includes(normalize(exp))
        )
      );
      if (userMentorIntersection.length === 0) {
        breakdown.domainMismatch = SCORING.DOMAIN_MISMATCH;
        totalScore += SCORING.DOMAIN_MISMATCH;
        reasons.push(
          `Domain mismatch: user in ${user.domain}, mentor focuses on ${mentor.expertise.slice(0, 2).join(", ")}`
        );
      }
    }
  }

  // 4. COMMUNICATION SCORE (for call types that value communication)
  if (mentor.communicationScore) {
    const commScore = (mentor.communicationScore - 3) * SCORING.COMMUNICATION_BOOST;
    breakdown.communicationScore = commScore;
    totalScore += commScore;
  }

  // 5. RATING BOOST
  if (mentor.rating) {
    const ratingScore = (mentor.rating - 3) * SCORING.RATING_BOOST;
    breakdown.rating = ratingScore;
    totalScore += ratingScore;
  }

  // 6. CALL-TYPE SPECIFIC BOOSTS
  if (callType === "resume_revamp" && mentor.company) {
    if (isBigTech(mentor.company)) {
      breakdown.bigTechBonus = SCORING.BIG_TECH_BONUS;
      totalScore += SCORING.BIG_TECH_BONUS;
      reasons.push(
        `Big Tech bonus (${mentor.company}): valuable for resume revamp`
      );
    }
  } else if (callType === "job_market_guidance" && mentor.communicationScore) {
    if (mentor.communicationScore >= 4) {
      breakdown.highCommunicationBonus = SCORING.HIGH_COMMUNICATION_BONUS;
      totalScore += SCORING.HIGH_COMMUNICATION_BONUS;
      reasons.push("High communication score: great for guidance");
    }
  } else if (callType === "mock_interview" && user.domain && mentor.expertise) {
    if (mentor.expertise.some((exp) =>
      normalize(exp).includes(normalize(user.domain))
    )) {
      breakdown.mockInterviewBonus = 2.0;
      totalScore += 2.0;
      reasons.push("Domain expertise match for mock interview");
    }
  }

  // 7. EXPERIENCE BOOST (years of experience)
  if (mentor.yearsOfExperience) {
    const expBoost = Math.min(mentor.yearsOfExperience * 0.1, 1.5);
    breakdown.experience = expBoost;
    totalScore += expBoost;
  }

  return {
    score: totalScore,
    matchPercentage: Math.max(0, Math.min(100, totalScore * 5)), // Scale to 0-100
    breakdown,
    reasoning: reasons.length > 0 ? reasons : ["Minimal match on current criteria"],
  };
}

/**
 * Recommend mentors for a user
 * 
 * @param {Object} user - User profile
 * @param {Array} mentors - Array of mentor profiles
 * @param {String} callType - Type of call for context-specific recommendations
 * @param {Number} limit - Maximum number of recommendations to return
 * @returns {Array} Sorted list of mentors with scores and reasoning
 */
export function recommendMentors(user, mentors, callType = null, limit = 5) {
  if (!mentors || mentors.length === 0) {
    return [];
  }

  // Score all mentors
  const scored = mentors
    .map((mentor) => {
      const scoreResult = scoreMentor(user, mentor, callType);
      return {
        ...mentor,
        ...scoreResult,
      };
    })
    // Filter out negative scores (poor matches)
    .filter((m) => m.score >= 0)
    // Sort by score descending, then by rating descending
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (b.rating || 0) - (a.rating || 0);
    })
    // Limit results
    .slice(0, limit);

  return scored;
}

/**
 * Get detailed recommendation report for debugging/UI
 */
export function getRecommendationReport(user, mentors, callType = null) {
  const recommendations = recommendMentors(user, mentors, callType, 10);

  return {
    userProfile: {
      interests: user.interests,
      goal: user.goal,
      domain: user.domain,
    },
    callType: callType || "general",
    recommendations: recommendations.map((rec) => ({
      mentorId: rec.id,
      mentorName: rec.name,
      company: rec.company,
      expertise: rec.expertise,
      score: Math.round(rec.score * 100) / 100,
      matchPercentage: Math.round(rec.matchPercentage),
      reasoning: rec.reasoning,
      breakdown: rec.breakdown,
    })),
    scoringWeights: {
      tagMatch: SCORING.TAG_MATCH,
      keywordMatch: SCORING.KEYWORD_MATCH,
      domainMatch: SCORING.DOMAIN_MATCH,
      domainMismatch: SCORING.DOMAIN_MISMATCH,
      communicationBoost: SCORING.COMMUNICATION_BOOST,
      ratingBoost: SCORING.RATING_BOOST,
    },
  };
}
