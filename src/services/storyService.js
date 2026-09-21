import { getPlaceById } from '../data/places.js';
import { simulateNetwork } from './utils.js';

export function selectStoryLength(remainingTimeSec) {
  if (remainingTimeSec <= 20) return 'short';
  if (remainingTimeSec <= 55) return 'medium';
  return 'long';
}

export async function getStories({ placeId, track = 'official', length = 'medium' }) {
  const place = getPlaceById(placeId);
  if (!place) throw new Error(`Unknown placeId: ${placeId}`);
  if (!place.stories[track]) throw new Error(`Unknown story track: ${track}`);

  const story = place.stories[track][length] || place.stories[track].medium;
  return simulateNetwork({ place, track, length, story });
}

export async function getStoryForJourney({
  placeId,
  track = 'official',
  remainingTimeSec = 45,
  interests = [],
  audience = 'visitor',
} = {}) {
  const length = selectStoryLength(remainingTimeSec);
  const result = await getStories({ placeId, track, length });
  return {
    ...result,
    remainingTimeSec,
    interests,
    audience,
    personalizationStatus: 'mock-selection-ready-for-c',
  };
}
