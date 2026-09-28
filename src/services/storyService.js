import { getPlaceById } from '../data/places.js';
import { getCultureBite } from '../content/cultureBites.js';
import { simulateNetwork } from './utils.js';
import { personalizeStory } from './personalization.js';

export function selectStoryLength(remainingTimeSec) {
  if (remainingTimeSec <= 20) return 'short';
  if (remainingTimeSec <= 55) return 'medium';
  return 'long';
}

export async function getStories({ placeId, track = 'official', length = 'medium' }) {
  const place = getPlaceById(placeId);
  if (!place) throw new Error(`Unknown placeId: ${placeId}`);
  if (track === 'culture') return simulateNetwork({ place, track, length: 'medium', story: getCultureBite(placeId) });
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
  language = 'en',
} = {}) {
  const place = getPlaceById(placeId);
  if (!place) throw new Error(`Unknown placeId: ${placeId}`);
  if (track === 'culture') {
    const story = getCultureBite(placeId, language);
    return simulateNetwork({
      place,
      track,
      length: story.length,
      story,
      remainingTimeSec,
      interests,
      audience,
      language,
      personalizationStatus: 'source-grounded-culture-bite',
    });
  }
  if (!place.stories[track]) throw new Error(`Unknown story track: ${track}`);

  // C: personalisation over reviewed scripts (time fit + interest lead-in + language).
  const { story, meta } = personalizeStory({ place, track, remainingTimeSec, interests, language });
  return simulateNetwork({
    place,
    track,
    // `length` = time slot from the rule above; `story.length` = length actually served
    // (some places only have a medium script).
    length: selectStoryLength(remainingTimeSec),
    story,
    remainingTimeSec,
    interests,
    audience,
    language,
    personalization: meta,
    personalizationStatus: 'rule-based-reviewed-content',
  });
}
