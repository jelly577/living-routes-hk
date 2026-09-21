const pendingStory = (placeName, track, length) => ({
  title: `${placeName} · ${track === 'official' ? 'Official Heritage' : 'Civilian Voices'}`,
  text: `[Demo placeholder: C will provide the reviewed ${length} ${track} script.]`,
  durationSec: { short: 10, medium: 30, long: 75 }[length],
  status: 'content-pending',
});

const createStoryTracks = (placeName, sourceUrls) => ({
  official: {
    short: { ...pendingStory(placeName, 'official', 'short'), sourceUrls },
    medium: { ...pendingStory(placeName, 'official', 'medium'), sourceUrls },
    long: { ...pendingStory(placeName, 'official', 'long'), sourceUrls },
  },
  civilian: {
    short: { ...pendingStory(placeName, 'civilian', 'short'), sourceUrls: [], disclosure: 'Demo sample; not a verified resident submission.' },
    medium: { ...pendingStory(placeName, 'civilian', 'medium'), sourceUrls: [], disclosure: 'Demo sample; not a verified resident submission.' },
    long: { ...pendingStory(placeName, 'civilian', 'long'), sourceUrls: [], disclosure: 'Demo sample; not a verified resident submission.' },
  },
});

export const places = [
  {
    id: 'central-market',
    nameZh: '中环街市',
    nameEn: 'Central Market',
    lat: 22.28383,
    lng: 114.15542,
    order: 1,
    nearestStop: 'Central Market area',
    triggerRadiusM: 220,
    focus: ['architecture', 'local-life', 'official-history'],
    sourceUrls: ['https://www.amo.gov.hk/sc/heritage-trails/cw-trails/sheungwan/section-a/a2/index.html'],
  },
  {
    id: 'court-of-final-appeal',
    nameZh: '终审法院大楼（旧最高法院）',
    nameEn: 'Court of Final Appeal Building',
    lat: 22.28091,
    lng: 114.16036,
    order: 2,
    nearestStop: 'Statue Square area',
    triggerRadiusM: 180,
    focus: ['architecture', 'official-history'],
    sourceUrls: ['https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_26/index.html'],
  },
  {
    id: 'lee-tung-street',
    nameZh: '利东街（囍帖街）',
    nameEn: 'Lee Tung Street',
    lat: 22.2746,
    lng: 114.1722,
    order: 3,
    nearestStop: 'Wan Chai Road area',
    triggerRadiusM: 140,
    focus: ['local-life', 'urban-change', 'people-memories'],
    sourceUrls: ['https://www.ura.org.hk/en/project/redevelopment/lee-tung-street-mcgregor-street-project'],
  },
  {
    id: 'blue-house',
    nameZh: '蓝屋建筑群',
    nameEn: 'Blue House Cluster',
    lat: 22.2740,
    lng: 114.1736,
    order: 4,
    nearestStop: 'Wan Chai Road area',
    triggerRadiusM: 140,
    focus: ['architecture', 'community', 'people-memories'],
    sourceUrls: ['https://www.heritage.gov.hk/en/about-us/revitalisation-scheme/viva-blue-house/index.html'],
  },
  {
    id: 'happy-valley-racecourse',
    nameZh: '跑马地马场／马场火灾纪念碑',
    nameEn: 'Happy Valley Racecourse / Fire Memorial',
    lat: 22.2721,
    lng: 114.1822,
    order: 5,
    nearestStop: 'Happy Valley Racecourse area',
    triggerRadiusM: 300,
    focus: ['official-history', 'soundscape', 'people-memories'],
    sourceUrls: ['https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_110/index.html'],
    contentWarning: 'Historical account includes a fatal fire; use respectful wording.',
  },
].map((place) => ({
  ...place,
  coordinateStatus: 'demo-coordinate-needs-field-verification',
  image: {
    url: null,
    alt: `${place.nameEn} verified location photograph`,
    sourceUrl: null,
    license: null,
    status: 'pending-content-verification',
  },
  stories: createStoryTracks(place.nameEn, place.sourceUrls),
}));

export const getPlaceById = (placeId) => places.find((place) => place.id === placeId);
