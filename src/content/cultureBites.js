// Culture Bites are source-grounded cultural connections, not invented gossip.
// Keep this small for the MVP; each item must be checked before public demo use.
export const cultureBitesByPlace = {
  'central-market': {
    title: 'The market as a daily stage',
    text: 'A market is more than its architecture: it is a daily stage for buying food, greeting familiar vendors and noticing what a neighbourhood eats. This culture bite connects Central Market’s heritage story to the ordinary routines that make a market feel local.',
    sourceUrls: [
      'https://www.amo.gov.hk/sc/heritage-trails/cw-trails/sheungwan/section-a/a2/index.html',
      'https://www.ura.org.hk/en/project/heritage-preservation-and-revitalisation/central-market',
    ],
  },
  'lee-tung-street': {
    title: 'The street behind the wedding-card trade',
    text: 'For decades, families from across Hong Kong came to Lee Tung Street to order wedding cards. The street became a cultural shorthand for preparing a wedding, connecting print shops, family rituals and the changing shape of Wan Chai.',
    language: 'en',
    contentType: 'culture-bites',
    contentTypeLabel: 'Culture Bites · source-grounded',
    sourceUrls: [
      'https://www.ura.org.hk/en/project/redevelopment/lee-tung-street-mcgregor-street-project',
      'https://en.wikipedia.org/wiki/Lee_Tung_Street',
    ],
    status: 'draft-needs-human-review',
  },
};

const CENTRAL_MARKET_TRANSLATIONS = {
  'zh-CN': {
    title: '街市：日常生活的舞台',
    text: '街市不只是建筑，也是每天买菜、和熟悉的档主打招呼、观察社区饮食的生活舞台。这段城市趣闻把中环街市的历史，连接到让一个街市保持本地气息的日常习惯。',
  },
  'zh-HK': {
    title: '街市：日常生活嘅舞台',
    text: '街市唔只係建築，亦係每日買餸、同熟悉嘅檔主打招呼、留意社區食乜嘢嘅生活舞台。呢段城市趣聞將中環街市嘅歷史，同令一個街市保持本地味道嘅日常習慣連埋一齊。',
  },
};

export function getCultureBite(placeId, language = 'en') {
  const bite = cultureBitesByPlace[placeId] || cultureBitesByPlace['central-market'];
  const localized = { en: { title: bite.title, text: bite.text }, ...(placeId === 'central-market' ? CENTRAL_MARKET_TRANSLATIONS : {}) };
  const entry = localized[language] || localized.en;
  return {
    placeId,
    track: 'culture',
    trackLabel: 'Culture Bites',
    contentType: 'culture-bites',
    contentTypeLabel: 'Culture Bites · source-grounded',
    length: 'medium',
    title: entry.title,
    text: entry.text,
    durationSec: Math.max(10, Math.round(entry.text.length / (language === 'en' ? 15 : 8))),
    language,
    sourceUrls: bite.sourceUrls,
    status: 'draft',
    reviewStatus: bite.status || 'draft-needs-human-review',
    disclosure: 'Curated from public sources; not a resident submission and not celebrity gossip.',
    localized,
  };
}
