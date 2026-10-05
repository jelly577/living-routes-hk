import { findKnownPlace, findPostPlace } from '../data/locations.js';
import { applyPhotoStyle, deleteMemoryPost, listMemoryPosts, readPhotoFile, saveMemoryPost } from './memoryPostStorage.js';
import { isPointInBounds, simulateNetwork } from './utils.js';
import { sharedCommunityEnabled, readSharedPosts, publishSharedPost, removeSharedPost } from './sharedCommunityService.js';

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
  const remotePosts = await readSharedPosts();
  const remoteIds = new Set(remotePosts.map((post) => post.id));
  const communityPosts = [...remotePosts, ...savedPosts.filter((post) => post.visibility === 'community' && (!sharedCommunityEnabled || !post.shared) && !remoteIds.has(post.id))];
  const filtered = communityPosts.filter((post) => {
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
  const saved = (await listMemoryPosts()).find((post) => post.id === id);
  if (saved?.shared || (!saved && sharedCommunityEnabled)) await removeSharedPost(id);
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
  let post = {
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
    imageStatus: image ? 'user-provided-unverified' : 'not-provided',
    photoStyle: image ? photoStyle : 'none',
    imageTreatmentVersion: image && ['cartoon', 'cyberpunk', 'pencil'].includes(photoStyle) ? 2 : 0,
    visibility: normalizedVisibility,
    consentForAi: Boolean(consent),
    status: normalizedVisibility === 'community' ? 'public-unverified' : 'private',
    createdAt: new Date().toISOString(),
  };
  if (normalizedVisibility === 'community' && sharedCommunityEnabled) post = await publishSharedPost(post);
  try { await saveMemoryPost(post); }
  catch (error) {
    if (!post.shared) throw error;
    // The cloud write already succeeded; never tell users to publish it again.
    post.localSaveFailed = true;
  }
  return simulateNetwork(post);
}

export async function shareSavedPost(id) {
  const post = (await listMemoryPosts()).find((item) => item.id === id);
  if (!post || post.visibility !== 'community') throw new Error('Choose an existing Community post.');
  if (post.shared) return post;
  const shared = await publishSharedPost(post);
  try { await saveMemoryPost(shared); }
  catch { shared.localSaveFailed = true; }
  return shared;
}

// Only entries explicitly marked public are eligible; never upload private journals.
export async function shareAllSavedCommunityPosts() {
  const posts = await listMemoryPosts();
  const published = [];
  const failed = [];
  for (const post of posts.filter((item) => item.visibility === 'community' && !item.shared)) {
    try { published.push(await shareSavedPost(post.id)); }
    catch (error) { failed.push({ id: post.id, message: error.message }); }
  }
  return { published, failed };
}

// Places that only exist because someone posted there (Google places or tapped
// spots), so the map can draw them alongside the check-in points.
export async function getPostedPlaces() {
  const saved = [...await listMemoryPosts(), ...await readSharedPosts()];
  const byId = new Map();
  saved.forEach((post) => {
    if (!post.placeInfo || findKnownPlace(post.placeId)) return;
    const place = findPostPlace(post);
    if (place && !byId.has(place.id)) byId.set(place.id, place);
  });
  return [...byId.values()];
}
