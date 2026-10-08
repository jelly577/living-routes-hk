// Place search for the map: find a spot by name, then post there.
//
// 1. Our own places first — popular sights, heritage stops, check-in points and
//    districts (all three languages + common aliases). Instant and offline, so
//    results appear while typing.
// 2. Then the map service, on submit only: Google Places when the Google map
//    is loaded, otherwise OpenStreetMap's Nominatim (no key; its usage policy
//    asks for at most one request per second and no search-as-you-type).
import { landmarks } from '../data/landmarks.js';
import { places } from '../data/places.js';
import { checkpoints } from '../data/checkpoints.js';
import { districts } from '../data/districts.js';
import { makeUserPlace } from '../data/locations.js';

const HK_CENTER = { lat: 22.32, lng: 114.17 };
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
// Hong Kong bounding box (lng/lat) so the map service never jumps abroad.
const HK_VIEWBOX = '113.82,22.56,114.44,22.15';

const squash = (text) => String(text || '').toLowerCase().replace(/[\s·・()（）\-_,，.。&＆'’]/g, '');

const LOCAL = [...landmarks, ...places, ...checkpoints, ...districts].map((place) => ({
  place,
  names: [place.nameEn, place.nameZh, place.nameZhHK, ...(place.aliases || [])].map(squash).filter(Boolean),
}));

export function searchLocalPlaces(query, limit = 6) {
  const q = squash(query);
  if (!q) return [];
  const scored = [];
  for (const { place, names } of LOCAL) {
    let best = Infinity;
    for (const name of names) {
      if (name === q) best = Math.min(best, 0);
      else if (name.startsWith(q)) best = Math.min(best, 1);
      else if (name.includes(q)) best = Math.min(best, 2);
      else if (q.length >= 2 && q.includes(name) && name.length >= 2) best = Math.min(best, 3);
    }
    if (best < Infinity) scored.push({ place, score: best });
  }
  // Exact/prefix matches first; sights before districts on a tie.
  const kindRank = { landmark: 0, checkpoint: 1, district: 3 };
  scored.sort((a, b) => a.score - b.score || (kindRank[a.place.kind] ?? 1) - (kindRank[b.place.kind] ?? 1));
  const seen = new Set();
  return scored.filter(({ place }) => !seen.has(place.id) && seen.add(place.id)).slice(0, limit).map(({ place }) => place);
}

async function searchGoogle(query, language) {
  const gmaps = typeof window !== 'undefined' ? window.google?.maps : null;
  if (!gmaps?.importLibrary) return null;
  const { Place } = await gmaps.importLibrary('places');
  if (!Place?.searchByText) return null;
  const { places: found = [] } = await Place.searchByText({
    textQuery: query,
    fields: ['displayName', 'location', 'formattedAddress'],
    locationBias: { center: HK_CENTER, radius: 30000 },
    language,
    region: 'hk',
    maxResultCount: 6,
  });
  return found.filter((p) => p.location).map((p) => ({
    ...makeUserPlace({ googlePlaceId: p.id, name: p.displayName, lat: p.location.lat(), lng: p.location.lng() }),
    address: p.formattedAddress || '',
  }));
}

async function searchNominatim(query, language) {
  const params = new URLSearchParams({
    format: 'jsonv2', q: query, limit: '6', countrycodes: 'hk', viewbox: HK_VIEWBOX, bounded: '1',
    'accept-language': language === 'en' ? 'en' : language === 'zh-HK' ? 'zh-HK,zh' : 'zh-CN,zh',
  });
  const res = await fetch(`${NOMINATIM_SEARCH}?${params}`);
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map((row) => ({
    ...makeUserPlace({ name: row.name || String(row.display_name).split(',')[0], lat: Number(row.lat), lng: Number(row.lon) }),
    address: row.display_name || '',
  }));
}

// Map-service results; Google first when available, Nominatim otherwise.
export async function searchOnlinePlaces(query, { language = 'zh-CN' } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  try {
    const google = await searchGoogle(q, language);
    if (google) return google;
  } catch { /* fall back to OpenStreetMap */ }
  return searchNominatim(q, language);
}
