// 路段主题 · 演示占位文案
// ⚠️ 这是 B（地图层）的占位数据，真实「AI 总结 / 讲稿」由 C 同学替换。
// key = `${fromId}->${toId}`，from/to 对应 route.storyPointIds 与 places.js 的 id；
// 起点「港澳码头」用虚拟 id 'macao-ferry'。
export const segmentThemes = {
  'macao-ferry->central-market': {
    zh: '中環海濱填海區與開埠早期的商業中心',
    en: "Central's reclaimed harbourfront and the colony's early commercial heart",
  },
  'central-market->court-of-final-appeal': {
    zh: '皇后大道軸線：金融區與司法權威的百年並存',
    en: "Queen's Road axis — a century of finance and judicial authority side by side",
  },
  'court-of-final-appeal->lee-tung-street': {
    zh: '皇后大道東：老區更新與市井記憶',
    en: "Queensway East — old-quarter renewal and everyday street memory",
  },
  'lee-tung-street->blue-house': {
    zh: '灣仔老街：囍帖街的印刷業與藍屋的唐樓生活',
    en: "Wan Chai old streets — Lee Tung's printing trade and Blue House tenement life",
  },
  'blue-house->happy-valley-racecourse': {
    zh: '跑馬地：馬場、墳場與香港早期城市史',
    en: "Happy Valley — racecourse, cemeteries, and Hong Kong's early urban history",
  },
};
