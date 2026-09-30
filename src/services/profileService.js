// Living Routes HK — adaptive interest profile (Student B)
//
// Builds the user's four-axis interest profile { architecture, culture, food, nature }
// from (a) the interests chosen at onboarding and (b) keyword analysis of their own
// community posts. Rule-based and explainable (like recommendationService), so it works
// offline and a judge can see why a ratio moved.

import { INTEREST_KEYS } from '../content/interestHooks.js';

const CATEGORY_TERMS = {
  architecture: ['architecture', 'building', 'facade', 'column', 'granite', 'balcony', 'tenement', '唐樓', '建築', '外牆', '柱', '樓', '大廈', '花崗岩'],
  culture: ['culture', 'film', 'music', 'festival', 'tradition', 'cinema', 'star', 'singer', '文化', '電影', '音樂', '節日', '傳統', '戲', '廟', '明星', '歌'],
  food: ['food', 'eat', 'taste', 'restaurant', 'market', 'tea', 'snack', 'dim sum', '食', '味', '餐廳', '街市', '美食', '茶', '蛋撻', '魚蛋', '小食', '點心'],
  nature: ['nature', 'tree', 'sea', 'harbour', 'hill', 'park', 'green', 'hike', '自然', '樹', '海', '山', '公園', '綠', '維港', '港', '行山'],
};

const CATEGORIES = ['architecture', 'culture', 'food', 'nature'];

export function analyzeInterestProfile({ seedInterests = [], posts = [] } = {}) {
  const counts = { architecture: 0, culture: 0, food: 0, nature: 0 };

  // Onboarding seed: each chosen interest is a strong signal.
  for (const label of seedInterests) {
    const key = INTEREST_KEYS[label] || label;
    if (counts[key] !== undefined) counts[key] += 2;
  }

  // Community posts: count keyword hits across the user's own posts.
  const corpus = posts.map((post) => post.text || '').join(' ').toLowerCase();
  for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
    counts[category] += terms.reduce((sum, term) => sum + (corpus.includes(term.toLowerCase()) ? 1 : 0), 0);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    const uniform = 0.25;
    return { architecture: uniform, culture: uniform, food: uniform, nature: uniform, dominant: 'architecture', counts, total: 0 };
  }
  const profile = {
    architecture: counts.architecture / total,
    culture: counts.culture / total,
    food: counts.food / total,
    nature: counts.nature / total,
  };
  const dominant = CATEGORIES.reduce((best, key) => (profile[key] > profile[best] ? key : best), 'architecture');
  return { ...profile, dominant, counts, total };
}

// Interest keys ordered by proportion (highest first), used to inject 1–2 lead-in sentences.
export function rankInterests(profile) {
  return CATEGORIES
    .map((key) => ({ key, weight: profile?.[key] ?? 0 }))
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.key);
}
