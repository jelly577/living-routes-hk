// Then-and-now helpers: pick the past/now image pair and the stories for a
// heritage place, used by the community photo wall and the immersive door.
import { getPlaceById, places } from '../data/places.js';
import { depthMaps } from '../content/depthMaps.js';
import { placeDistrictId } from './comparisonService.js';
export { placeDistrictId, comparisonPlaceForPost, postMatchesComparisonPlace } from './comparisonService.js';

export function isHeritagePlace(placeId) {
  const place = getPlaceById(placeId);
  return Boolean(place?.gallery?.length && place?.stories);
}

// One representative "past" image (oldest, never a content-warning one) and the
// verified "now" image for a place.
export function getThenNowImages(placeId) {
  const place = getPlaceById(placeId);
  const gallery = place?.gallery || [];
  const pastImg = gallery
    .filter((item) => item.era === 'past' && !item.contentWarning)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null;
  const nowImg = place?.image?.url ? place.image : gallery.find((item) => item.era === 'now') || null;
  const depths = depthMaps[placeId] || {};
  return {
    past: pastImg ? { ...pastImg, depthUrl: depths.past || null } : null,
    now: nowImg ? { ...nowImg, depthUrl: depths.now || null } : null,
  };
}

// The reviewed stories for a place (official heritage + civilian voices),
// medium length. Each is already trilingual and carries sourceUrls.
export function getPlaceStories(placeId) {
  const place = getPlaceById(placeId);
  const tracks = place?.stories || {};
  return ['official', 'civilian']
    .map((track) => (tracks[track]?.medium ? { ...tracks[track].medium, placeId } : null))
    .filter(Boolean);
}

// Every heritage place that can anchor the wall's "then" side.
export function heritagePlaces() {
  return places.filter((place) => place.gallery?.length && place.stories);
}

// Story cards for the wall's "then" side, one per (place, track).
export function buildThenCards() {
  const cards = [];
  for (const place of heritagePlaces()) {
    const { past } = getThenNowImages(place.id);
    for (const story of getPlaceStories(place.id)) {
      cards.push({ type: 'story', place, story, image: past, districtId: placeDistrictId(place.id) });
    }
  }
  return cards;
}
