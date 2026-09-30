import { mockPosts } from '../data/mockPosts.js';
import { getPlaceById } from '../data/places.js';
import { isPointInBounds, simulateNetwork } from './utils.js';

let posts = [...mockPosts];

export async function getPosts({ filter = 'all', bounds, placeId } = {}) {
  const filtered = posts.filter((post) => {
    if (filter !== 'all' && post.kind !== filter) return false;
    if (placeId && post.placeId !== placeId) return false;
    const place = getPlaceById(post.placeId);
    return !place || isPointInBounds(place, bounds);
  });
  return simulateNetwork([...filtered]);
}

export async function getMyPosts() {
  return simulateNetwork(posts.filter((post) => post.author === 'You · Prototype user'));
}

export async function addPost({ photo, text, location, role = 'tourist', consent = false } = {}) {
  if (!text?.trim()) throw new Error('A community post requires text.');

  const place = getPlaceById(location);
  const post = {
    id: `post-${Date.now()}`,
    kind: role,
    era: 'MODERN',
    placeId: place?.id || null,
    place: place?.nameEn || location || 'Current location',
    author: 'You · Prototype user',
    text: text.trim(),
    image: photo || null,
    imageStatus: photo ? 'user-provided-pending-review' : 'not-provided',
    consentForAi: Boolean(consent),
    status: 'pending-review',
  };
  posts = [post, ...posts];
  return simulateNetwork(post);
}
