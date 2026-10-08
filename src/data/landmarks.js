// Popular, mid-sized sights used to NAME the stops of a travel-memoir video
// ("Tsim Sha Tsui Promenade", not "Yau Tsim Mong" and not a street address).
//
// These never create map pins or route stops; the memoir snaps each memory to
// the nearest one within `radiusKm` and groups that day's nearby memories
// under it. Coordinates are approximate display anchors (hand-placed, roughly
// within 100–200 m) — good enough to name an area, not for navigation.
//
// [id, nameEn, nameZh (Simplified), nameZhHK (Traditional), lat, lng, radiusKm]
const rows = [
  // Hong Kong Island — Central & Western
  ['victoria-peak', 'Victoria Peak', '太平山顶', '太平山頂', 22.2759, 114.1455, 1.2],
  ['central-harbourfront', 'Central Harbourfront', '中环海滨', '中環海濱', 22.2860, 114.1610, 0.7],
  ['soho-tai-kwun', 'Tai Kwun & SoHo', '大馆与苏豪', '大館及蘇豪', 22.2816, 114.1541, 0.5],
  ['lan-kwai-fong', 'Lan Kwai Fong', '兰桂坊', '蘭桂坊', 22.2810, 114.1558, 0.3],
  ['pmq-man-mo', 'PMQ & Man Mo Temple', '元创方与文武庙', '元創方及文武廟', 22.2840, 114.1515, 0.5],
  ['sheung-wan', 'Sheung Wan', '上环', '上環', 22.2865, 114.1500, 0.6],
  ['kennedy-town', 'Kennedy Town Waterfront', '坚尼地城海旁', '堅尼地城海旁', 22.2830, 114.1280, 0.8],
  ['hong-kong-park', 'Hong Kong Park', '香港公园', '香港公園', 22.2775, 114.1610, 0.5],
  // Wan Chai & Eastern
  ['golden-bauhinia', 'Golden Bauhinia Square', '金紫荆广场', '金紫荊廣場', 22.2840, 114.1730, 0.6],
  ['wan-chai-old-town', 'Old Wan Chai', '湾仔旧区', '灣仔舊區', 22.2755, 114.1725, 0.6],
  ['causeway-bay', 'Causeway Bay', '铜锣湾', '銅鑼灣', 22.2800, 114.1840, 0.7],
  ['victoria-park', 'Victoria Park', '维多利亚公园', '維多利亞公園', 22.2820, 114.1885, 0.5],
  ['quarry-bay-monster', 'Quarry Bay "Monster Building"', '鲗鱼涌怪兽大厦', '鰂魚涌怪獸大廈', 22.2846, 114.2120, 0.8],
  ['shek-o', 'Shek O', '石澳', '石澳', 22.2300, 114.2510, 1.5],
  ['dragons-back', "Dragon's Back", '龙脊', '龍脊', 22.2330, 114.2410, 1.5],
  // Southern
  ['repulse-bay', 'Repulse Bay', '浅水湾', '淺水灣', 22.2367, 114.1960, 1.0],
  ['stanley', 'Stanley', '赤柱', '赤柱', 22.2186, 114.2108, 1.2],
  ['ocean-park', 'Ocean Park', '海洋公园', '海洋公園', 22.2467, 114.1757, 0.9],
  ['aberdeen', 'Aberdeen Harbour', '香港仔', '香港仔', 22.2480, 114.1530, 1.0],
  // Kowloon
  ['tst-promenade', 'Tsim Sha Tsui Promenade', '尖沙咀海滨', '尖沙咀海濱', 22.2935, 114.1720, 0.7],
  ['tst-nathan', 'Tsim Sha Tsui', '尖沙咀', '尖沙咀', 22.2990, 114.1720, 0.6],
  ['west-kowloon', 'West Kowloon Cultural District', '西九文化区', '西九文化區', 22.3020, 114.1600, 0.9],
  ['temple-street', 'Temple Street & Yau Ma Tei', '庙街与油麻地', '廟街及油麻地', 22.3080, 114.1700, 0.6],
  ['mong-kok', 'Mong Kok', '旺角', '旺角', 22.3190, 114.1700, 0.7],
  ['sham-shui-po', 'Sham Shui Po', '深水埗', '深水埗', 22.3305, 114.1620, 0.8],
  ['kowloon-walled-city', 'Kowloon Walled City Park', '九龙寨城公园', '九龍寨城公園', 22.3320, 114.1900, 0.6],
  ['kai-tak', 'Kai Tak', '启德', '啟德', 22.3060, 114.2140, 1.2],
  ['wong-tai-sin', 'Wong Tai Sin Temple', '黄大仙祠', '黃大仙祠', 22.3420, 114.1935, 0.6],
  ['chi-lin-nan-lian', 'Chi Lin Nunnery & Nan Lian Garden', '志莲净苑与南莲园池', '志蓮淨苑及南蓮園池', 22.3400, 114.2045, 0.5],
  ['choi-hung', 'Choi Hung Estate', '彩虹邨', '彩虹邨', 22.3345, 114.2085, 0.5],
  ['lion-rock', 'Lion Rock', '狮子山', '獅子山', 22.3520, 114.1870, 1.2],
  ['kwun-tong-promenade', 'Kwun Tong Promenade', '观塘海滨', '觀塘海濱', 22.3090, 114.2210, 0.8],
  // New Territories
  ['sai-kung-town', 'Sai Kung Town', '西贡市中心', '西貢市中心', 22.3820, 114.2740, 1.5],
  ['high-island-geopark', 'High Island Reservoir Geopark', '万宜水库东坝', '萬宜水庫東壩', 22.3640, 114.3720, 2.0],
  ['tai-long-wan', 'Tai Long Wan', '大浪湾', '大浪灣', 22.4060, 114.3780, 2.0],
  ['clear-water-bay', 'Clear Water Bay', '清水湾', '清水灣', 22.2900, 114.2900, 2.0],
  ['ten-thousand-buddhas', 'Ten Thousand Buddhas Monastery', '万佛寺', '萬佛寺', 22.3880, 114.1850, 0.5],
  ['sha-tin-heritage', 'Sha Tin & Heritage Museum', '沙田与文化博物馆', '沙田及文化博物館', 22.3780, 114.1880, 0.9],
  ['tai-mei-tuk', 'Tai Mei Tuk', '大美督', '大美督', 22.4720, 114.2340, 1.5],
  ['tai-po', 'Tai Po Market', '大埔墟', '大埔墟', 22.4460, 114.1650, 1.0],
  ['wetland-park', 'Hong Kong Wetland Park', '香港湿地公园', '香港濕地公園', 22.4670, 114.0090, 1.2],
  ['tsuen-wan', 'Tsuen Wan', '荃湾', '荃灣', 22.3720, 114.1140, 1.0],
  ['tsing-ma', 'Tsing Ma Bridge', '青马大桥', '青馬大橋', 22.3510, 114.0740, 1.5],
  // Islands
  ['big-buddha', 'Tian Tan Buddha & Ngong Ping', '天坛大佛与昂坪', '天壇大佛及昂坪', 22.2540, 113.9050, 1.5],
  ['tai-o', 'Tai O Fishing Village', '大澳渔村', '大澳漁村', 22.2530, 113.8620, 1.2],
  ['disneyland', 'Hong Kong Disneyland', '香港迪士尼乐园', '香港迪士尼樂園', 22.3130, 114.0410, 1.2],
  ['airport', 'Hong Kong International Airport', '香港国际机场', '香港國際機場', 22.3080, 113.9180, 2.0],
  ['cheung-chau', 'Cheung Chau', '长洲', '長洲', 22.2100, 114.0280, 1.8],
  ['lamma', 'Lamma Island', '南丫岛', '南丫島', 22.2150, 114.1150, 2.5],
  ['mui-wo', 'Mui Wo', '梅窝', '梅窩', 22.2650, 113.9980, 1.5],
];

export const landmarks = rows.map(([slug, nameEn, nameZh, nameZhHK, lat, lng, radiusKm]) => ({
  id: `lm-${slug}`, kind: 'landmark', nameEn, nameZh, nameZhHK, lat, lng, radiusKm,
  coordinateStatus: 'approximate',
}));
