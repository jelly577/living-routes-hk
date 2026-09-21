import {
  generateJourneyLog,
  getPosts,
  getRoute,
  getStoryForJourney,
} from '../src/services/index.js';

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

const checks = [
  ['route contains five story points', route.storyPoints.length === 5],
  ['10 seconds selects a short story', shortStory.length === 'short'],
  ['80 seconds selects a long story', longStory.length === 'long'],
  ['community service returns posts', posts.length > 0],
  ['journey log contains chapters', log.chapters.length > 0],
  ['journey log keeps the user memory', log.chapters[0].text === 'Test memory'],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`Service smoke test failed: ${label}`);
  console.log(`✓ ${label}`);
}
