import { findPostPlace, normalizePlaceName } from '../data/locations.js';
import { matchPlaceName, nearestOwnThenNamedSpot } from './memoirService.js';

const PLACE_DISTRICT = {
  'central-market': 'district-central-western',
  'court-of-final-appeal': 'district-central-western',
  'lee-tung-street': 'district-wan-chai',
  'blue-house': 'district-wan-chai',
  'happy-valley-racecourse': 'district-wan-chai',
};
export const placeDistrictId = (placeId) => PLACE_DISTRICT[placeId] || null;

// Which "place" a post belongs to on the then/now wall. One place must not
// split in two because of language or tap position, so:
//   • our heritage stops, check-in points and districts are used as-is;
//   • a spot tapped on the map / a Google place is filed under the heritage
//     stop or check-in point right beside it, else the popular sight it lies
//     within, else under its
//     Google place id, else a ~200 m grid cell;
//   • a typed name is matched against the trilingual names and aliases of
//     our sights ("藍屋" = "蓝屋" = "Blue House").
const GRID = 0.002; // degrees ≈ 200 m
export function comparisonPlaceForPost(post) {
  const resolved = findPostPlace(post);
  if (resolved && resolved.kind !== 'user-place') return resolved;
  if (resolved) {
    const spot = nearestOwnThenNamedSpot(resolved);
    if (spot) return spot;
    if (resolved.googlePlaceId || String(resolved.id).startsWith('gp:')) return { ...resolved, id: resolved.googlePlaceId ? `gp:${resolved.googlePlaceId}` : resolved.id };
    const cell = `${Math.round(resolved.lat / GRID)},${Math.round(resolved.lng / GRID)}`;
    return { ...resolved, id: `cell:${cell}` };
  }
  const typed = post.locationType !== 'none' && post.place && post.place !== 'No location' ? matchPlaceName(post.place) : null;
  if (typed) return typed;
  const named = post.locationType !== 'none' && post.place && post.place !== 'No location';
  return {
    id: named ? `named:${encodeURIComponent(normalizePlaceName(post.place))}` : `post:${post.id}`,
    nameEn: named ? post.place : '', nameZh: named ? post.place : '',
    kind: 'comparison-place', comparisonPostId: named ? null : post.id,
  };
}

export function postMatchesComparisonPlace(post, placeId) {
  return comparisonPlaceForPost(post).id === placeId;
}
