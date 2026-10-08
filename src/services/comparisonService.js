import { findPostPlace, normalizePlaceName } from '../data/locations.js';

const PLACE_DISTRICT = {
  'central-market': 'district-central-western',
  'court-of-final-appeal': 'district-central-western',
  'lee-tung-street': 'district-wan-chai',
  'blue-house': 'district-wan-chai',
  'happy-valley-racecourse': 'district-wan-chai',
};
export const placeDistrictId = (placeId) => PLACE_DISTRICT[placeId] || null;

// Exact names only; never attach an unknown location to a nearby landmark.
export function comparisonPlaceForPost(post) {
  const resolved = findPostPlace(post);
  if (resolved) return resolved;
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
