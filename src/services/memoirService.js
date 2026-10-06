// Travel-memoir video: turn the user's own posts into ordered map stops plus a
// short script (title, one caption per memory, closing line).
//
// Only the user's own posts are used. Without AI consent, or when the AI
// endpoint is unavailable, the script is assembled from the user's own words,
// so a video can always be made.
import { findPostPlace } from '../data/locations.js';
import { districts } from '../data/districts.js';
import { HK_FRAME } from '../data/hkOutline.js';

export const MEMOIR_LANGUAGES = ['en', 'zh-HK', 'zh-CN'];
export const MAX_MEMOIR_POSTS = 20;
const MERGE_RADIUS_KM = 0.35;

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

// Where a memory sits on the memoir map, best source first:
// exact photo GPS (device-only) → the place/area the user chose → nothing.
export function memoryPoint(post) {
  const place = findPostPlace(post);
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

// Ordered stops. Consecutive memories at (nearly) the same spot become one stop
// with several memories; memories without a location join the previous stop.
export function buildMemoirStops(posts = [], { from = '', to = '', limit = MAX_MEMOIR_POSTS } = {}) {
  const selected = posts
    .filter((post) => post && (post.text || post.image))
    .map((post) => ({ post, day: localDay(momentOf(post)), time: new Date(momentOf(post)).getTime() || 0 }))
    .filter(({ day }) => (!from || day >= from) && (!to || day <= to))
    .sort((a, b) => a.time - b.time);
  const truncated = selected.length > limit;
  const used = selected.slice(0, limit);

  const stops = [];
  const waiting = []; // unlocated memories before the first located one
  for (const { post, day } of used) {
    const point = memoryPoint(post);
    const memory = { post, day };
    const last = stops[stops.length - 1];
    if (!point) {
      if (last) last.memories.push(memory); else waiting.push(memory);
      continue;
    }
    if (last && distanceKm(last, point) < MERGE_RADIUS_KM) {
      last.memories.push(memory);
      if (point.precision === 'photo' && last.precision !== 'photo') Object.assign(last, { precision: 'photo' });
      continue;
    }
    stops.push({
      id: `stop-${stops.length + 1}`,
      lat: point.lat,
      lng: point.lng,
      precision: point.precision,
      place: point.place,
      placeIsApproximate: point.placeIsApproximate,
      memories: [memory],
    });
  }
  if (waiting.length) {
    if (stops.length) stops[0].memories.unshift(...waiting);
    else {
      // Nothing has a location: one stop over the city so the video still works.
      stops.push({ id: 'stop-1', lat: 22.32, lng: 114.17, precision: 'none', place: null, placeIsApproximate: true, memories: waiting });
    }
  }
  return {
    stops: stops.map((stop) => ({ ...stop, day: stop.memories[0].day, lastDay: stop.memories[stop.memories.length - 1].day })),
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
  return { brand, day, stats };
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
      place: stopLabel(stop, 'en'),
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
