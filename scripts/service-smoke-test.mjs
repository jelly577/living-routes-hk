import {
  addPost,
  deletePost,
  generateJourneyLog,
  getMyPosts,
  getPosts,
  getPostedPlaces,
  getRoute,
  getStoryForJourney,
  processVoiceSubmission,
} from '../src/services/index.js';
import { interestOptions } from '../src/data/options.js';
import { checkpoints } from '../src/data/checkpoints.js';
import { makeUserPlace } from '../src/data/locations.js';

const route = await getRoute({ mode: 'demo' });
const shortStory = await getStoryForJourney({
  placeId: 'central-market',
  remainingTimeSec: 10,
});
const longStory = await getStoryForJourney({
  placeId: 'blue-house',
  track: 'civilian',
  remainingTimeSec: 80,
});
const posts = await getPosts({ filter: 'all' });
const log = await generateJourneyLog({ memories: [{ place: 'Blue House', text: 'Test memory' }] });
const photoLog = await generateJourneyLog({ memories: [{ place: 'Blue House', text: 'I photographed the old facade and afternoon light.' }] });
const cultureBite = await getStoryForJourney({ placeId: 'central-market', track: 'culture', language: 'zh-HK' });
const voice = await processVoiceSubmission({ placeId: 'blue-house', consent: true });
const privatePost = await addPost({ text: 'Private saved memory', location: 'blue-house', visibility: 'private' });
const communityPost = await addPost({ text: 'Shared saved memory', location: 'central-market', visibility: 'community' });
const savedPosts = await getMyPosts();
const postsAfterSave = await getPosts({ filter: 'all' });
await deletePost(privatePost.id);
const postsAfterDelete = await getMyPosts();
const checkpointPost = await addPost({ text: 'Check-in memory', location: 'cp-victoria-park', visibility: 'community' });
const checkpointFeed = await getPosts({ placeId: 'cp-victoria-park' });
const mapPlace = makeUserPlace({ googlePlaceId: 'TEST123', name: 'Test Cafe', lat: 22.28, lng: 114.15 });
const mapPlacePost = await addPost({ text: 'Map place memory', location: mapPlace, visibility: 'community' });
const postedPlaces = await getPostedPlaces();

const checks = [
  ['onboarding offers the approved interest options', JSON.stringify(interestOptions) === JSON.stringify(['Architecture', 'History', 'Culture', 'Food', 'Nature'])],
  ['route contains five story points', route.storyPoints.length === 5],
  ['10 seconds selects a short story', shortStory.length === 'short'],
  ['80 seconds selects a long story', longStory.length === 'long'],
  ['community service returns posts', posts.length > 0],
  ['memory posts persist through the shared storage service', savedPosts.some((post) => post.id === privatePost.id) && savedPosts.some((post) => post.id === communityPost.id)],
  ['private memories stay out of Community', !postsAfterSave.some((post) => post.id === privatePost.id)],
  ['community memories appear in Community', postsAfterSave.some((post) => post.id === communityPost.id)],
  ['users can permanently delete their own memories', !postsAfterDelete.some((post) => post.id === privatePost.id)],
  ['check-in points have unique ids and coordinates', new Set(checkpoints.map((c) => c.id)).size === checkpoints.length && checkpoints.every((c) => c.lat != null && c.lng != null)],
  ['check-in points stay out of the narrated route', !route.storyPoints.some((p) => p.id.startsWith('cp-'))],
  ['posts can attach to a check-in point', checkpointPost.placeId === 'cp-victoria-park' && checkpointPost.place === 'Victoria Park' && checkpointFeed.some((p) => p.id === checkpointPost.id)],
  ['posts can attach to any place picked on the map', mapPlacePost.placeId === 'gp:TEST123' && mapPlacePost.placeInfo?.lat === 22.28],
  ['map-picked places come back for the map layer', postedPlaces.some((p) => p.id === 'gp:TEST123' && p.nameEn === 'Test Cafe') && !postedPlaces.some((p) => p.id === 'cp-victoria-park')],
  ['journey log contains chapters', log.chapters.length > 0],
  ['journey log keeps the user memory', log.chapters[0].text === 'Test memory'],
  ['journey memory updates the recommendation profile', photoLog.nextRecommendation.contentType === 'heritage-facts'],
  ['culture bite is available as a third story type', cultureBite.story.contentType === 'culture-bites' && cultureBite.story.language === 'zh-HK'],
  ['voice demo returns a Cantonese transcript', voice.transcription.language === 'zh-HK'],
  ['voice demo returns three language drafts', Object.keys(voice.generatedStory.languages).length === 3],
  ['voice demo routes content to human review', voice.moderation.status === 'needs-human-review'],
  ['voice replica requires separate consent', voice.voiceOutput.replicaStatus === 'not-authorised'],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Service smoke test failed: ${label}`);
  console.log(`✓ ${label}`);
}
