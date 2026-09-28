// Explainable profile signals for the MVP. This is deliberately rule-based:
// judges can see why a memory changed the next recommendation, and it works
// offline without sending private photos or text to a model.

const SIGNAL_RULES = [
  { key: 'food', label: 'Food & neighbourhood life', terms: ['food', 'eat', 'taste', 'restaurant', 'market', '食', '味', '餐廳', '街市', '美食'] },
  { key: 'photography', label: 'Photography & architecture', terms: ['photo', 'camera', 'light', 'facade', 'building', 'photo', '影', '相', '建築', '外牆', '樓'] },
  { key: 'people', label: 'People & memories', terms: ['family', 'friend', 'neighbour', 'memory', 'grand', '街坊', '鄰居', '屋企人', '回憶', '老人', '長者'] },
  { key: 'culture', label: 'Popular culture & city stories', terms: ['film', 'star', 'singer', 'actor', 'music', '電影', '明星', '歌手', '演員', '音樂'] },
];

export function deriveInterestSignals(memories = []) {
  const corpus = memories.map((memory) => `${memory.place || ''} ${memory.text || ''}`).join(' ').toLowerCase();
  const matches = SIGNAL_RULES.map((rule) => ({
    ...rule,
    score: rule.terms.reduce((score, term) => score + (corpus.includes(term.toLowerCase()) ? 1 : 0), 0),
  })).filter((rule) => rule.score > 0).sort((a, b) => b.score - a.score);

  return matches.length > 0
    ? matches.map(({ key, label, score }) => ({ key, label, score }))
    : [{ key: 'local-life', label: 'Local life', score: 1 }];
}

export function buildNextRecommendation(signals = []) {
  const top = signals[0] || { key: 'local-life', label: 'Local life' };
  const recommendations = {
    food: { contentType: 'culture-bites', label: 'A food-and-street-life story', reason: 'Your memory mentions food or market life.' },
    photography: { contentType: 'heritage-facts', label: 'An architecture detail story', reason: 'Your memory shows interest in buildings and visual details.' },
    people: { contentType: 'local-voices', label: 'A local voice from the next neighbourhood', reason: 'Your memory focuses on people and relationships.' },
    culture: { contentType: 'culture-bites', label: 'A verified popular-culture connection', reason: 'Your memory mentions music, film or public figures.' },
    'local-life': { contentType: 'local-voices', label: 'A neighbourhood memory', reason: 'We will start with everyday local life.' },
  };
  return { ...recommendations[top.key] || recommendations['local-life'], signal: top.label };
}

