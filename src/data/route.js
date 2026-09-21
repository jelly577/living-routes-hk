export const demoRoute = {
  id: 'citybus-1-central-happy-valley',
  operator: 'Citybus',
  routeNumber: '1',
  nameZh: '中环（港澳码头）→ 跑马地（上）',
  nameEn: 'Central (Macao Ferry) → Happy Valley (Upper)',
  origin: 'Central (Macao Ferry)',
  destination: 'Happy Valley (Upper)',
  estimatedDurationMin: 32,
  sourceUrl: 'https://mobile.citybus.com.hk/nwp3/printout1.php?l=0',
  storyPointIds: [
    'central-market',
    'court-of-final-appeal',
    'lee-tung-street',
    'blue-house',
    'happy-valley-racecourse',
  ],
  // Demo-only simplified path. B should replace this with a checked route geometry.
  path: [
    [22.2872, 114.1522],
    [22.2840, 114.1553],
    [22.2811, 114.1602],
    [22.2785, 114.1655],
    [22.2765, 114.1710],
    [22.2742, 114.1734],
    [22.2722, 114.1819],
  ],
};

export const demoRouteStops = [
  { id: 'central-macao-ferry', nameZh: '中环（港澳码头）', nameEn: 'Central (Macao Ferry)' },
  { id: 'central-market-stop', nameZh: '中环街市附近', nameEn: 'Central Market area' },
  { id: 'statue-square', nameZh: '皇后像广场附近', nameEn: 'Statue Square area' },
  { id: 'wan-chai', nameZh: '湾仔', nameEn: 'Wan Chai' },
  { id: 'happy-valley-upper', nameZh: '跑马地（上）', nameEn: 'Happy Valley (Upper)' },
];

