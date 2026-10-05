import { mockPosts } from '../data/mockPosts.js';
import { findKnownPlace, findPostPlace } from '../data/locations.js';
import { applyPhotoStyle, deleteMemoryPost, listMemoryPosts, readPhotoFile, saveMemoryPost } from './memoryPostStorage.js';
import { isPointInBounds, simulateNetwork } from './utils.js';

async function migratePhotoTreatment(post) {
  if (!post.image) return post;

  // Version 1 used the current high-contrast treatment under the Cartoon name.
  // Preserve that rendered image and relabel it as Cyberpunk instead of degrading
  // it through a second transformation.
  if (post.photoStyle === 'cartoon' && post.imageTreatmentVersion === 1) {
    const relabelled = { ...post, photoStyle: 'cyberpunk', imageTreatmentVersion: 2 };
    await saveMemoryPost(relabelled);
    return relabelled;
  }

  if (!['cartoon', 'cyberpunk', 'pencil'].includes(post.photoStyle) || post.imageTreatmentVersion) return post;
  const migratedStyle = post.photoStyle === 'cartoon' ? 'cyberpunk' : post.photoStyle;
  const migrated = {
    ...post,
    image: await applyPhotoStyle(post.image, migratedStyle),
    photoStyle: migratedStyle,
    imageTreatmentVersion: 2,
  };
  await saveMemoryPost(migrated);
  return migrated;
}

export async function getPosts({ filter = 'all', bounds, placeId } = {}) {
  const savedPosts = await Promise.all((await listMemoryPosts()).map(migratePhotoTreatment));
  const communityPosts = savedPosts.filter((post) => post.visibility === 'community');
  const filtered = [...communityPosts, ...mockPosts].filter((post) => {
    if (filter !== 'all' && post.kind !== filter) return false;
    if (placeId && post.placeId !== placeId) return false;
    const place = findPostPlace(post);
    return !place || isPointInBounds(place, bounds);
  });
  return simulateNetwork([...filtered]);
}

export async function getMyPosts() {
  return simulateNetwork(await Promise.all((await listMemoryPosts()).map(migratePhotoTreatment)));
}

export async function deletePost(id) {
  await deleteMemoryPost(id);
  return simulateNetwork({ id, deleted: true });
}

export async function addPost({
  photo,
  text,
  location,
  role = 'tourist',
  consent = false,
  visibility = 'private',
  photoStyle = 'original',
  author = 'You · Prototype user',
} = {}) {
  if (!text?.trim()) throw new Error('A memory post requires text.');

  // `location` is a known place id ('central-market', 'cp-hku', …), a place
  // object picked on the map (see makeUserPlace), or free text.
  const pickedPlace = location && typeof location === 'object' ? location : null;
  const place = pickedPlace || findKnownPlace(location);
  const image = typeof photo === 'string' ? await applyPhotoStyle(photo, photoStyle) : await readPhotoFile(photo, photoStyle);
  const normalizedVisibility = visibility === 'community' ? 'community' : 'private';
  const post = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`,
    kind: role,
    era: 'MODERN',
    placeId: place?.id || null,
    place: place?.nameEn || (typeof location === 'string' && location.trim()) || 'Current location',
    // Places outside our data files keep their own name and coordinates so the
    // map can show them again later.
    placeInfo: pickedPlace ? {
      nameEn: pickedPlace.nameEn,
      nameZh: pickedPlace.nameZh,
      lat: pickedPlace.lat,
      lng: pickedPlace.lng,
      googlePlaceId: pickedPlace.googlePlaceId || null,
    } : null,
    author,
    text: text.trim(),
    image: image || null,
    imageStatus: image ? 'user-provided-pending-review' : 'not-provided',
    photoStyle: image ? photoStyle : 'none',
    imageTreatmentVersion: image && ['cartoon', 'cyberpunk', 'pencil'].includes(photoStyle) ? 2 : 0,
    visibility: normalizedVisibility,
    consentForAi: Boolean(consent),
    status: normalizedVisibility === 'community' ? 'pending-review' : 'private',
    createdAt: new Date().toISOString(),
  };
  await saveMemoryPost(post);
  return simulateNetwork(post);
}

// Places that only exist because someone posted there (Google places or tapped
// spots), so the map can draw them alongside the check-in points.
export async function getPostedPlaces() {
  const saved = await listMemoryPosts();
  const byId = new Map();
  saved.forEach((post) => {
    if (!post.placeInfo || findKnownPlace(post.placeId)) return;
    const place = findPostPlace(post);
    if (place && !byId.has(place.id)) byId.set(place.id, place);
  });
  return [...byId.values()];
}
