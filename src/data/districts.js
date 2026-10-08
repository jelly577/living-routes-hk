// District names follow https://www.had.gov.hk/en/18_districts/my_map.htm.
// Coordinates are approximate display anchors, NOT user positions or boundary centroids.
// Regions are always chosen by contributors; never inferred from nearby landmarks.
const rows = [
  ['central-western', 'Central & Western', '中西区', '中西區', 22.282, 114.144],
  ['wan-chai', 'Wan Chai', '湾仔', '灣仔', 22.277, 114.175],
  ['eastern', 'Eastern', '东区', '東區', 22.284, 114.216],
  ['southern', 'Southern', '南区', '南區', 22.248, 114.160],
  ['yau-tsim-mong', 'Yau Tsim Mong', '油尖旺', '油尖旺', 22.309, 114.170],
  ['sham-shui-po', 'Sham Shui Po', '深水埗', '深水埗', 22.331, 114.162],
  ['kowloon-city', 'Kowloon City', '九龙城', '九龍城', 22.328, 114.190],
  ['wong-tai-sin', 'Wong Tai Sin', '黄大仙', '黃大仙', 22.341, 114.198],
  ['kwun-tong', 'Kwun Tong', '观塘', '觀塘', 22.313, 114.225],
  ['kwai-tsing', 'Kwai Tsing', '葵青', '葵青', 22.356, 114.127],
  ['tsuen-wan', 'Tsuen Wan', '荃湾', '荃灣', 22.371, 114.113],
  ['tuen-mun', 'Tuen Mun', '屯门', '屯門', 22.391, 113.977],
  ['yuen-long', 'Yuen Long', '元朗', '元朗', 22.445, 114.028],
  ['north', 'North', '北区', '北區', 22.500, 114.135],
  ['tai-po', 'Tai Po', '大埔', '大埔', 22.450, 114.165],
  ['sha-tin', 'Sha Tin', '沙田', '沙田', 22.382, 114.188],
  ['sai-kung', 'Sai Kung', '西贡', '西貢', 22.382, 114.272],
  ['islands', 'Islands', '离岛', '離島', 22.287, 113.942],
];
export const districts = rows.map(([slug, nameEn, nameZh, nameZhHK, lat, lng]) => ({
  id: `district-${slug}`, kind: 'district', nameEn, nameZh, nameZhHK, lat, lng,
  coordinateStatus: 'approximate',
}));
export const getDistrict = (id) => districts.find((district) => district.id === id);

// Closest district anchor to a point — used to file a map-tapped post under a
// district so it groups with the Community wall. Approximate by design.
export function nearestDistrict(point) {
  if (!point || point.lat == null || point.lng == null) return null;
  const cos = Math.cos((point.lat * Math.PI) / 180);
  let best = null;
  let bestD = Infinity;
  for (const district of districts) {
    const d = ((district.lng - point.lng) * cos) ** 2 + (district.lat - point.lat) ** 2;
    if (d < bestD) { bestD = d; best = district; }
  }
  return best;
}

export function aggregateDistrictPosts(posts) {
  const counts = new Map();
  const seen = new Set();
  for (const post of posts) {
    if (seen.has(post.id) || post.visibility !== 'community' || !getDistrict(post.districtId)) continue;
    seen.add(post.id);
    counts.set(post.districtId, (counts.get(post.districtId) || 0) + 1);
  }
  return districts.filter((district) => counts.has(district.id)).map((district) => ({ ...district, postCount: counts.get(district.id) }));
}
