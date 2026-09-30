import { mockPosts } from '../data/mockPosts.js';
import { getPlaceById } from '../data/places.js';
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
    const place = getPlaceById(post.placeId);
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

  const place = getPlaceById(location);
  const image = typeof photo === 'string' ? await applyPhotoStyle(photo, photoStyle) : await readPhotoFile(photo, photoStyle);
  const normalizedVisibility = visibility === 'community' ? 'community' : 'private';
  const post = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`,
    kind: role,
    era: 'MODERN',
    placeId: place?.id || null,
    place: place?.nameEn || location || 'Current location',
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
