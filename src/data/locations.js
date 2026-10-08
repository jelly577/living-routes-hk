// One lookup for every kind of place a post can be attached to:
//   1. the five heritage story points (places.js)
//   2. check-in points (checkpoints.js)
//   3. any other spot the user picked on the map — a Google place or a tapped
//      coordinate. These have no file entry; the post itself carries the name
//      and coordinates (post.placeInfo), so they are rebuilt from saved posts.
import { getPlaceById, places } from './places.js';
import { checkpoints, getCheckpointById } from './checkpoints.js';
import { getDistrict } from './districts.js';

const placeAliases = {
  'happy-valley-racecourse': ['Happy Valley Racecourse', '跑马地马场', '跑馬地馬場', '马场火灾纪念碑', '馬場火災紀念碑', 'gp:ChIJcVnvqE8ABDQRmlCv6UgfOvk'],
  'blue-house': ['Blue House', '蓝屋', '藍屋', '藍屋建築群'],
  'central-market': ['中環街市'],
  'court-of-final-appeal': ['Court of Final Appeal', '終審法院大樓', '终审法院大楼'],
  'lee-tung-street': ['利東街', '利东街', '囍帖街'],
};
export const normalizePlaceName = (name) => String(name || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
// Exact names / curated aliases only: never guess from proximity or post text.
export const findKnownPlace = (value) => {
  if (!value) return undefined;
  const direct = getPlaceById(value) || getCheckpointById(value);
  if (direct) return direct;
  const name = normalizePlaceName(value);
  return [...places, ...checkpoints].find((place) =>
    [place.nameEn, place.nameZh, ...(placeAliases[place.id] || [])].some((alias) => normalizePlaceName(alias) === name));
};

// Resolve a post's place, falling back to the place info stored on the post.
export const findPostPlace = (post) => {
  if (post?.locationType === 'none') return undefined;
  if (post?.locationType === 'district') return getDistrict(post.districtId);
  const known = findKnownPlace(post?.placeId) || findKnownPlace(post?.location)
    || findKnownPlace(post?.placeInfo?.nameEn) || findKnownPlace(post?.placeInfo?.nameZh) || findKnownPlace(post?.place);
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
