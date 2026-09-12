
export const relationshipConfig = {
  scoreRange: { min: 0, max: 100 },
  initialScores: {
    familiarity: 0,
    warmth: 0,
    trust: 0,
    respect: 0,
    closeness: 0,
    conflict: 0,
  },
  familiarityPerInteraction: 3,
  maxEvidenceIds: 12,
  signals: {
    neutral: { expressed: {}, received: {} },
    friendly: { expressed: { warmth: 3 }, received: { warmth: 2 } },
    supportive: {
      expressed: { warmth: 4, trust: 3 },
      received: { warmth: 3, trust: 5 },
    },
    humorous: { expressed: { warmth: 2, closeness: 2 }, received: { warmth: 2, closeness: 2 } },
    vulnerable: { expressed: { trust: 4, closeness: 2 }, received: { trust: 2, closeness: 2 } },
    'boundary-setting': { expressed: { respect: 2 }, received: { respect: 2 } },
    competitive: { expressed: { conflict: 2 }, received: { conflict: 1 } },
    suspicious: { expressed: { trust: -5, conflict: 2 }, received: { trust: -3 } },
    dismissive: { expressed: { warmth: -4, conflict: 3 }, received: { warmth: -3 } },
    apologetic: { expressed: { conflict: -5 }, received: {} },
    forgiving: { expressed: { conflict: -4 }, received: { trust: 2 } },
    collaborating: { expressed: { respect: 3, trust: 2 }, received: { respect: 2 } },
    protective: { expressed: { warmth: 2, trust: 2 }, received: { trust: 2 } },
    comforting: { expressed: { warmth: 4, trust: 4 }, received: { warmth: 3, trust: 4 } },
    reconciling: { expressed: { conflict: -5, trust: 2 }, received: { conflict: -3 } },
  },
}

