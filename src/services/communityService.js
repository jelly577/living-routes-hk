import { findKnownPlace, findPostPlace } from '../data/locations.js';
import { getDistrict, aggregateDistrictPosts } from '../data/districts.js';
import { readPhotoMetadata, resolveTakenAt } from './photoMetadata.js';
import { applyPhotoStyle, deleteMemoryPost, listMemoryPosts, readPhotoFile, saveMemoryPost } from './memoryPostStorage.js';
import { isPointInBounds, simulateNetwork } from './utils.js';
import { sharedCommunityEnabled, readSharedPosts, publishSharedPost, removeSharedPost } from './sharedCommunityService.js';
import { placeDistrictId, postMatchesComparisonPlace } from './comparisonService.js';

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

export async function getPosts({ filter = 'all', bounds, placeId, districtId, postId } = {}) {
  const savedPosts = await Promise.all((await listMemoryPosts()).map(migratePhotoTreatment));
  const remotePosts = await readSharedPosts();
  const remoteIds = new Set(remotePosts.map((post) => post.id));
  const communityPosts = [...remotePosts, ...savedPosts.filter((post) => post.visibility === 'community' && (!sharedCommunityEnabled || !post.shared) && !remoteIds.has(post.id))];
  const filtered = communityPosts.filter((post) => {
    if (post.visibility !== 'community') return false;
    if (postId && post.id !== postId) return false;
    if (filter !== 'all' && post.kind !== filter) return false;
    const region = districtId || (getDistrict(placeId) ? placeId : null);
    const postDistrict = placeDistrictId(findPostPlace(post)?.id) || post.districtId;
    const comparisonId = findKnownPlace(placeId)?.id || placeId;
    if (region ? postDistrict !== region : comparisonId && !postMatchesComparisonPlace(post, comparisonId)) return false;
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
  era = 'MODERN',
  consent = false,
  voiceConsent = false,
  voiceSample = null,
  visibility = 'private',
  photoStyle = 'original',
  author = 'You · Prototype user',
  locationType = 'place',
  districtId = null,
  takenAt = null,
} = {}) {
  if (!text?.trim()) throw new Error('A memory post requires text.');
  const district = locationType === 'none' ? null : getDistrict(districtId);
  if (locationType === 'district' && !district) throw new Error('Please choose a district, or choose no location.');
  if (locationType !== 'place') location = null;

  // `location` is a known place id ('central-market', 'cp-hku', …), a place
  // object picked on the map (see makeUserPlace), or free text.
  const pickedPlace = location && typeof location === 'object' ? location : null;
  const place = findKnownPlace(pickedPlace?.id) || findKnownPlace(pickedPlace?.nameEn)
    || findKnownPlace(pickedPlace?.nameZh) || pickedPlace || findKnownPlace(location);
  // Read capture time / GPS before the canvas re-render strips EXIF.
  const metadata = photo && typeof photo !== 'string' ? await readPhotoMetadata(photo) : { takenAt: null, gps: null };
  const image = typeof photo === 'string' ? await applyPhotoStyle(photo, photoStyle) : await readPhotoFile(photo, photoStyle);
  const normalizedVisibility = visibility === 'community' ? 'community' : 'private';
  let post = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`,
    kind: era === 'ARCHIVAL' ? 'local' : role,
    era,
    placeId: place?.id || null,
    place: district && locationType === 'district' ? district.nameEn : place?.nameEn || (typeof location === 'string' && location.trim()) || 'No location',
    locationType,
    districtId: placeDistrictId(place?.id) || district?.id || null,
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
    // Voice collection for "local elder" posts: the recorded sample stays on
    // this device (future AI voice-clone); playback uses the elder voice profile.
    voiceConsent: Boolean(voiceConsent),
    voiceSample: voiceSample || null,
    voiceProfile: era === 'ARCHIVAL' ? 'elder' : 'neutral',
    status: normalizedVisibility === 'community' ? 'public-unverified' : 'private',
    createdAt: new Date().toISOString(),
    // When the moment happened (memoir order + date labels): the user's own
    // date wins, then the photo's EXIF time, then the publishing time.
    ...resolveTakenAt(takenAt, metadata.takenAt),
    // Device-only: removed from every public payload in sharedCommunityService.
    photoGps: image && metadata.gps ? metadata.gps : null,
  };
  post.takenAt = post.takenAt || post.createdAt;
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

// Switch one of the user's own posts between "only me" and Community.
// Private → Community uploads it (when the shared backend is on); Community →
// private removes the public copy first and keeps the local one.
export async function setPostVisibility(id, visibility) {
  const post = (await listMemoryPosts()).find((item) => item.id === id);
  if (!post) throw new Error('This post is not saved in this browser.');
  if (visibility === 'community') {
    if (post.visibility === 'community' && (post.shared || !sharedCommunityEnabled)) return post;
    const marked = { ...post, visibility: 'community', status: 'public-unverified' };
    await saveMemoryPost(marked);
    return sharedCommunityEnabled ? shareSavedPost(id) : marked;
  }
  if (post.shared) await removeSharedPost(id);
  const { canDelete, ...rest } = post;
  const privatePost = { ...rest, visibility: 'private', status: 'private', shared: false };
  await saveMemoryPost(privatePost);
  return privatePost;
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
  const local = await listMemoryPosts();
  const saved = [...await readSharedPosts(), ...local.filter((post) => !sharedCommunityEnabled || !post.shared)];
  // Old precise coordinates remain on the stored post, but do not create new map pins.
  return aggregateDistrictPosts(saved);
}
