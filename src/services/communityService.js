import { mockPosts } from '../data/mockPosts.js';
import { getPlaceById } from '../data/places.js';
import { listMemoryPosts, readPhotoFile, saveMemoryPost } from './memoryPostStorage.js';
import { isPointInBounds, simulateNetwork } from './utils.js';

export async function getPosts({ filter = 'all', bounds } = {}) {
  const savedPosts = await listMemoryPosts();
  const communityPosts = savedPosts.filter((post) => post.visibility === 'community');
  const filtered = [...communityPosts, ...mockPosts].filter((post) => {
    if (filter !== 'all' && post.kind !== filter) return false;
    const place = getPlaceById(post.placeId);
    return !place || isPointInBounds(place, bounds);
  });
  return simulateNetwork([...filtered]);
}

export async function getMyPosts() {
  return simulateNetwork(await listMemoryPosts());
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
  const image = typeof photo === 'string' ? photo : await readPhotoFile(photo);
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
    visibility: normalizedVisibility,
    consentForAi: Boolean(consent),
    status: normalizedVisibility === 'community' ? 'pending-review' : 'private',
    createdAt: new Date().toISOString(),
  };
  await saveMemoryPost(post);
  return simulateNetwork(post);
}
