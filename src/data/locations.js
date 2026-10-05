// One lookup for every kind of place a post can be attached to:
//   1. the five heritage story points (places.js)
//   2. check-in points (checkpoints.js)
//   3. any other spot the user picked on the map — a Google place or a tapped
//      coordinate. These have no file entry; the post itself carries the name
//      and coordinates (post.placeInfo), so they are rebuilt from saved posts.
import { getPlaceById, places } from './places.js';
import { checkpoints, getCheckpointById } from './checkpoints.js';
import { getDistrict } from './districts.js';

export const findKnownPlace = (id) => (id ? getPlaceById(id) || getCheckpointById(id) : undefined);

// Resolve a post's place, falling back to the place info stored on the post.
export const findPostPlace = (post) => {
  if (post?.locationType === 'none') return undefined;
  if (post?.locationType === 'district') return getDistrict(post.districtId);
  const known = findKnownPlace(post?.placeId || post?.location);
  if (known) return known;
  const info = post?.placeInfo;
  if (info && info.lat != null && info.lng != null) {
    return { id: post.placeId, kind: 'user-place', ...info };
  }
  return undefined;
};

// Options for the post composer's place picker.
export const postLocationGroups = () => [
  { key: 'heritage', items: places },
  { key: 'checkpoints', items: checkpoints },
];

// Normalise a place picked on the map (Google POI or tapped spot) into the
// shape addPost() stores. Ids are prefixed so they never collide with ours.
export const makeUserPlace = ({ googlePlaceId, name, lat, lng }) => ({
  id: googlePlaceId ? `gp:${googlePlaceId}` : `pin:${lat.toFixed(5)},${lng.toFixed(5)}`,
  kind: 'user-place',
  nameEn: name,
  nameZh: name,
  lat,
  lng,
  googlePlaceId: googlePlaceId || null,
});
