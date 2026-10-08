// Travel-memoir video: turn the user's own posts into ordered map stops plus a
// short script (title, one caption per memory, closing line).
//
// Only the user's own posts are used. Without AI consent, or when the AI
// endpoint is unavailable, the script is assembled from the user's own words,
// so a video can always be made.
import { findPostPlace } from '../data/locations.js';
import { districts, getDistrict } from '../data/districts.js';
import { places } from '../data/places.js';
import { checkpoints } from '../data/checkpoints.js';
import { landmarks } from '../data/landmarks.js';
import { HK_FRAME } from '../data/hkOutline.js';

export const MEMOIR_LANGUAGES = ['en', 'zh-HK', 'zh-CN'];
export const MAX_MEMOIR_POSTS = 20;

export const nameIn = (place, language = 'en') => {
  if (!place) return '';
  if (language === 'zh-HK') return place.nameZhHK || place.nameZh || place.nameEn || '';
  if (language === 'zh-CN') return place.nameZh || place.nameZhHK || place.nameEn || '';
  return place.nameEn || place.nameZh || '';
};

export const momentOf = (post) => post.takenAt || post.createdAt || null;

export function localDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const inFrame = (point) => point
  && point.lat >= HK_FRAME.south && point.lat <= HK_FRAME.north
  && point.lng >= HK_FRAME.west && point.lng <= HK_FRAME.east;

function nearestDistrict(point) {
  return districts.reduce((best, district) => (
    !best || distanceKm(point, district) < distanceKm(point, best) ? district : best
  ), null);
}

// Typed place names ("西贡", "Sai Kung", "香港大學") have no coordinates of
// their own; match them against places we do know. Longest name wins so
// "香港大学" beats "香港".
const squash = (text) => String(text || '').toLowerCase().replace(/[\s·・()（）\-_,，.。&＆'’]/g, '');
// Landmarks come first so that on a tie ("Sai Kung" = the town and the
// district) the more specific sight wins.
const NAMED = [...landmarks, ...places, ...checkpoints, ...districts]
  .flatMap((place) => [place.nameEn, place.nameZh, place.nameZhHK, ...(place.aliases || [])]
    .map((name) => squash(name))
    .filter((name) => name.length >= 2)
    .map((name) => ({ name, place })));
// District names that are also everyday English words; too risky to read
// out of free-text captions ("the north shore", "southern food").
const COMMON_WORDS = new Set(['north', 'eastern', 'southern', 'islands']);
export function matchPlaceName(text, { caption = false } = {}) {
  const typed = squash(text);
  if (typed.length < 2 || typed === 'nolocation') return null;
  let best = null;
  for (const entry of NAMED) {
    if (caption && COMMON_WORDS.has(entry.name)) continue;
    if (typed.includes(entry.name) && (!best || entry.name.length > best.name.length)) best = entry;
  }
  return best?.place || null;
}

// The place a memory was attached to: the picked place, else the district the
// user also chose, else a typed place name we recognise — and, for memories
// saved without any location, a place named in the user's own caption
// ("Walking past the Cenotaph in Central…" → Central). Memoir only; nothing
// here is written back or published.
function resolvePostPlace(post) {
  const place = findPostPlace(post);
  if (place) return place;
  if (post?.locationType !== 'none') {
    const chosen = getDistrict(post?.districtId) || matchPlaceName(post?.place);
    if (chosen) return chosen;
  }
  return matchPlaceName(post?.text, { caption: true }) || undefined;
}

// Where a memory sits on the memoir map, best source first:
// exact photo GPS (device-only) → the place/area the user chose → nothing.
export function memoryPoint(post) {
  const place = resolvePostPlace(post);
  if (inFrame(post.photoGps)) {
    const named = place && place.kind !== 'district' ? place : null;
    return { lat: post.photoGps.lat, lng: post.photoGps.lng, precision: 'photo', place: named || nearestDistrict(post.photoGps), placeIsApproximate: !named };
  }
  if (place && place.lat != null && place.lng != null && inFrame(place)) {
    return { lat: place.lat, lng: place.lng, precision: place.kind === 'district' ? 'district' : 'place', place, placeIsApproximate: false };
  }
  return null;
}

export function memoirDateBounds(posts = []) {
  const days = posts.map((post) => localDay(momentOf(post))).filter(Boolean).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : { from: '', to: '' };
}

// Names a stop can carry, in order of preference for a tapped spot: popular
// mid-sized sights first, then our heritage stops and check-in points (tight
// radius). A heritage stop or check-in point the user picked explicitly is
// used as-is. Districts are only the fallback label ("Around Sai Kung").
const OWN_SPOTS = [...places, ...checkpoints].map((place) => ({ ...place, radiusKm: 0.35 }));
const OWN_SPOT_IDS = new Set(OWN_SPOTS.map((spot) => spot.id));
const CLUSTER_KM = 1; // unnamed memories this close on the same day share a stop

function nearestWithin(point, spots) {
  let best = null;
  let bestKm = Infinity;
  for (const spot of spots) {
    const km = distanceKm(point, spot);
    if (km <= spot.radiusKm && km < bestKm) { best = spot; bestKm = km; }
  }
  return best;
}
export const nearestNamedSpot = (point) => nearestWithin(point, landmarks) || nearestWithin(point, OWN_SPOTS);

// Which stop a located memory belongs to. District-only posts stay at their
// district (their pin is only an approximate anchor, so naming a sight there
// would claim more than the user said).
function anchorFor(point) {
  if (point.precision !== 'district') {
    const picked = point.precision === 'place' && OWN_SPOT_IDS.has(point.place?.id) ? OWN_SPOTS.find((spot) => spot.id === point.place.id) : null;
    const spot = picked || nearestNamedSpot(point);
    if (spot) return { key: spot.id, lat: spot.lat, lng: spot.lng, place: spot, placeIsApproximate: false };
  }
  const district = point.precision === 'district' ? point.place : nearestDistrict(point);
  return { key: null, lat: point.lat, lng: point.lng, place: district, placeIsApproximate: true };
}

// Stops for the memoir video, one per (day, place):
//   • ordered by time; each calendar day is its own run of stops
//   • memories near the same popular sight that day are gathered into one
//     stop named after it, even if the visits were not back-to-back
//   • memories without a location join that day's stop visited just before
//     (or the day's first stop); a day with none stays where the trip was
export function buildMemoirStops(posts = [], { from = '', to = '', limit = MAX_MEMOIR_POSTS } = {}) {
  const selected = posts
    .filter((post) => post && (post.text || post.image))
    .map((post) => ({ post, day: localDay(momentOf(post)), time: new Date(momentOf(post)).getTime() || 0 }))
    .filter(({ day }) => (!from || day >= from) && (!to || day <= to))
    .sort((a, b) => a.time - b.time);
  const truncated = selected.length > limit;
  const used = selected.slice(0, limit);

  const byDay = new Map();
  for (const item of used) {
    if (!byDay.has(item.day)) byDay.set(item.day, []);
    byDay.get(item.day).push(item);
  }

  const stops = [];
  let previous = null; // last stop of the previous day, for location-less days
  for (const [day, items] of byDay) {
    const dayStops = [];
    const waiting = []; // location-less memories before the day's first located one
    let current = null;
    for (const { post } of items) {
      const memory = { post, day };
      const point = memoryPoint(post);
      if (!point) {
        if (current) current.memories.push(memory); else waiting.push(memory);
        continue;
      }
      const anchor = anchorFor(point);
      let stop = anchor.key
        ? dayStops.find((s) => s.key === anchor.key)
        : dayStops.find((s) => !s.key && distanceKm(s, anchor) <= CLUSTER_KM);
      if (!stop) {
        stop = { key: anchor.key, lat: anchor.lat, lng: anchor.lng, precision: point.precision, place: anchor.place, placeIsApproximate: anchor.placeIsApproximate, memories: [] };
        dayStops.push(stop);
      }
      if (point.precision === 'photo') stop.precision = 'photo';
      stop.memories.push(memory);
      current = stop;
    }
    if (waiting.length) {
      if (dayStops.length) dayStops[0].memories.unshift(...waiting);
      else if (previous) dayStops.push({ ...previous, memories: waiting });
      else dayStops.push({ key: null, lat: 22.32, lng: 114.17, precision: 'none', place: null, placeIsApproximate: true, memories: waiting });
    }
    // Inside a stop, memories stay in time order; stops follow first visit.
    for (const stop of dayStops) stop.memories.sort((a, b) => (new Date(momentOf(a.post)) - new Date(momentOf(b.post))));
    stops.push(...dayStops);
    previous = dayStops[dayStops.length - 1];
  }

  return {
    stops: stops.map(({ key, ...stop }, index) => ({
      ...stop,
      id: `stop-${index + 1}`,
      day: stop.memories[0].day,
      lastDay: stop.memories[stop.memories.length - 1].day,
    })),
    memoryCount: used.length,
    totalAvailable: selected.length,
    truncated,
  };
}

const COPY = {
  en: {
    title: 'Hong Kong, in my own frames',
    closing: 'Every stop left a small piece of the city with me.',
    city: 'Hong Kong',
    near: (name) => `Around ${name}`,
    noText: 'A moment I wanted to keep.',
    brand: 'LIVING ROUTES HK',
    day: (n) => `DAY ${n}`,
    stats: (stops, days) => `${stops} ${stops === 1 ? 'stop' : 'stops'} · ${days} ${days === 1 ? 'day' : 'days'}`,
  },
  'zh-HK': {
    title: '我鏡頭下的香港',
    closing: '每一站，都把城市的一小片留給了我。',
    city: '香港',
    near: (name) => `${name}一帶`,
    noText: '想留住的一刻。',
    brand: 'LIVING ROUTES HK · 城市聲線',
    day: (n) => `第 ${n} 天`,
    stats: (stops, days) => `${stops} 個地方 · ${days} 天`,
  },
  'zh-CN': {
    title: '我镜头里的香港',
    closing: '每一站，都把这座城市的一小片留给了我。',
    city: '香港',
    near: (name) => `${name}一带`,
    noText: '想留住的一刻。',
    brand: 'LIVING ROUTES HK · 城市声线',
    day: (n) => `第 ${n} 天`,
    stats: (stops, days) => `${stops} 个地方 · ${days} 天`,
  },
};

// Labels drawn inside the video frames.
export function memoirLabels(language = 'en') {
  const { brand, day, stats } = COPY[language] || COPY.en;
  return { brand, day, stats, language: COPY[language] ? language : 'en' };
}

export function stopLabel(stop, language = 'en') {
  const copy = COPY[language] || COPY.en;
  if (!stop.place) return copy.city;
  const name = nameIn(stop.place, language);
  return stop.placeIsApproximate || stop.place.kind === 'district' ? copy.near(name) : name;
}

export function formatDayRange(from, to, language = 'en') {
  if (!from) return '';
  const fmt = (day, withYear) => {
    const [y, m, d] = day.split('-');
    return withYear ? `${y}.${m}.${d}` : `${m}.${d}`;
  };
  if (!to || from === to) return fmt(from, true);
  return `${fmt(from, true)} – ${fmt(to, from.slice(0, 4) !== to.slice(0, 4))}`;
}

const clip = (text, max) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

// Script assembled only from the user's own words.
export function templateMemoirScript(stops, language = 'en') {
  const copy = COPY[language] || COPY.en;
  const days = stops.flatMap((stop) => [stop.day, stop.lastDay]).filter(Boolean).sort();
  return {
    language,
    source: 'template',
    title: copy.title,
    subtitle: formatDayRange(days[0], days[days.length - 1], language),
    closing: copy.closing,
    stops: stops.map((stop) => ({
      stopId: stop.id,
      title: stopLabel(stop, language),
      memories: stop.memories.map(({ post }) => ({
        postId: post.id,
        caption: clip(post.text, language === 'en' ? 140 : 70) || copy.noText,
      })),
    })),
  };
}

// Keep whatever the model returned that fits; fill every gap from the template
// so a partial or malformed answer can never break the video.
export function mergeAiScript(template, ai) {
  if (!ai || typeof ai !== 'object') return template;
  const text = (value, max) => (typeof value === 'string' && value.trim() ? clip(value, max) : null);
  const aiStops = new Map((Array.isArray(ai.stops) ? ai.stops : []).map((stop) => [stop?.stopId, stop]));
  return {
    ...template,
    source: 'ai',
    title: text(ai.title, 40) || template.title,
    closing: text(ai.closing, 120) || template.closing,
    stops: template.stops.map((stop) => {
      const aiStop = aiStops.get(stop.stopId);
      const aiMemories = new Map((Array.isArray(aiStop?.memories) ? aiStop.memories : []).map((memory) => [memory?.postId, memory]));
      return {
        ...stop,
        title: text(aiStop?.title, 30) || stop.title,
        memories: stop.memories.map((memory) => ({
          ...memory,
          caption: text(aiMemories.get(memory.postId)?.caption, 160) || memory.caption,
          motion: text(aiMemories.get(memory.postId)?.motion, 300) || memory.motion || '',
        })),
      };
    }),
  };
}

// The request sent to the memoir endpoint. Only posts the user explicitly
// allowed are included; exact GPS is never sent (place names only).
export function buildAiRequest(stops, { language = 'en', images = {} } = {}) {
  return {
    language,
    stops: stops.map((stop) => ({
      stopId: stop.id,
      place: stopLabel(stop, language), // in the video's language, so AI titles match
      day: stop.day,
      memories: stop.memories.map(({ post, day }) => ({
        postId: post.id,
        day,
        text: clip(post.text, 600),
        image: images[post.id] || null,
      })),
    })),
  };
}

export async function generateMemoirScript(stops, { language = 'en', allowAi = false, requestAi = null, images = {} } = {}) {
  const template = templateMemoirScript(stops, language);
  if (!allowAi) return { ...template, fallbackReason: 'no-consent' };
  if (typeof requestAi !== 'function') return { ...template, fallbackReason: 'not-configured' };
  try {
    const result = await requestAi(buildAiRequest(stops, { language, images }));
    return mergeAiScript(template, result);
  } catch (error) {
    return { ...template, fallbackReason: 'ai-failed', fallbackMessage: error?.message || String(error) };
  }
}
