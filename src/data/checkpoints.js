// Check-in points (打卡点) — places where people can leave a memory post.
//
// These are NOT story points: they have no narration, are not part of the
// Citybus 1 journey engine, and never create route segments. The map draws
// them as a separate layer, and the post composer can attach a post to them.
//
// coordinateStatus:
//   'verified'    — taken from the place's Wikipedia infobox coordinates
//   'approximate' — hand-placed; within roughly 100 m, check before filming
//
// To add a point: copy one entry, give it a unique `cp-` id, and set lat/lng
// (right-click the spot in Google Maps; the first menu line is "lat, lng").

export const checkpointCategories = ['organizer', 'university', 'landmark'];

export const checkpoints = [
  // ---- Hack for SDGs 2026 related ----
  {
    id: 'cp-hku-innovation-wing-two',
    kind: 'checkpoint',
    category: 'organizer',
    nameEn: 'HKU Innovation Wing Two',
    nameZh: '港大 Innovation Wing Two（邵逸夫楼）',
    nameZhHK: '港大 Innovation Wing Two（邵逸夫樓）',
    noteKey: 'cp.note.iw2',
    lat: 22.2830,
    lng: 114.1372,
    coordinateStatus: 'approximate',
    triggerRadiusM: 60,
    topics: ['architecture', 'culture'],
  },
  {
    id: 'cp-hk-science-park',
    kind: 'checkpoint',
    category: 'organizer',
    nameEn: 'Hong Kong Science Park',
    nameZh: '香港科学园',
    nameZhHK: '香港科學園',
    noteKey: 'cp.note.sciencePark',
    lat: 22.426565,
    lng: 114.211249,
    coordinateStatus: 'verified',
    triggerRadiusM: 200,
    topics: ['architecture', 'nature'],
  },

  // ---- Universities ----
  {
    id: 'cp-hku',
    kind: 'checkpoint',
    category: 'university',
    nameEn: 'The University of Hong Kong',
    nameZh: '香港大学',
    nameZhHK: '香港大學',
    noteKey: 'cp.note.hku',
    lat: 22.28417,
    lng: 114.13778,
    coordinateStatus: 'verified',
    triggerRadiusM: 150,
    topics: ['architecture', 'culture'],
  },
  {
    id: 'cp-hkust',
    kind: 'checkpoint',
    category: 'university',
    nameEn: 'HKUST',
    nameZh: '香港科技大学',
    nameZhHK: '香港科技大學',
    noteKey: 'cp.note.hkust',
    lat: 22.3375,
    lng: 114.2633,
    coordinateStatus: 'approximate',
    triggerRadiusM: 200,
    topics: ['architecture', 'nature'],
  },
  {
    id: 'cp-cityu',
    kind: 'checkpoint',
    category: 'university',
    nameEn: 'City University of Hong Kong',
    nameZh: '香港城市大学',
    nameZhHK: '香港城市大學',
    noteKey: 'cp.note.cityu',
    lat: 22.3364222,
    lng: 114.1729889,
    coordinateStatus: 'verified',
    triggerRadiusM: 150,
    topics: ['architecture', 'culture'],
  },
  {
    id: 'cp-cuhk',
    kind: 'checkpoint',
    category: 'university',
    nameEn: 'The Chinese University of Hong Kong',
    nameZh: '香港中文大学',
    nameZhHK: '香港中文大學',
    noteKey: 'cp.note.cuhk',
    lat: 22.41972,
    lng: 114.2067917,
    coordinateStatus: 'verified',
    triggerRadiusM: 250,
    topics: ['nature', 'culture'],
  },

  // ---- City landmarks ----
  {
    id: 'cp-victoria-park',
    kind: 'checkpoint',
    category: 'landmark',
    nameEn: 'Victoria Park',
    nameZh: '维多利亚公园',
    nameZhHK: '維多利亞公園',
    noteKey: 'cp.note.victoriaPark',
    lat: 22.2829,
    lng: 114.1891,
    coordinateStatus: 'verified',
    triggerRadiusM: 200,
    topics: ['nature', 'culture'],
  },
  {
    id: 'cp-victoria-harbour-tst',
    kind: 'checkpoint',
    category: 'landmark',
    nameEn: 'Victoria Harbour · Tsim Sha Tsui Promenade',
    nameZh: '维多利亚港 · 尖沙咀海滨长廊',
    nameZhHK: '維多利亞港 · 尖沙咀海濱長廊',
    noteKey: 'cp.note.harbour',
    lat: 22.2934,
    lng: 114.1717,
    coordinateStatus: 'approximate',
    triggerRadiusM: 150,
    topics: ['nature', 'architecture'],
  },
  {
    id: 'cp-cheung-chau',
    kind: 'checkpoint',
    category: 'landmark',
    nameEn: 'Cheung Chau · Ferry Pier',
    nameZh: '长洲 · 码头',
    nameZhHK: '長洲 · 碼頭',
    noteKey: 'cp.note.cheungChau',
    lat: 22.2098,
    lng: 114.0287,
    coordinateStatus: 'approximate',
    triggerRadiusM: 150,
    topics: ['culture', 'food', 'nature'],
  },
];

export const getCheckpointById = (id) => checkpoints.find((point) => point.id === id);
