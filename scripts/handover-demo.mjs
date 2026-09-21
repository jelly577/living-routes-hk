import { getRoute, getStoryForJourney } from '../src/services/index.js';

const route = await getRoute({ mode: 'demo' });

console.log('\nLiving Routes HK — A Stage Handover Demo\n');
console.log(`Route: Citybus ${route.routeNumber} · ${route.nameEn}`);
console.log(`Story points: ${route.storyPoints.length}\n`);

for (const place of route.storyPoints) {
  console.log(`${place.order}. ${place.nameZh} / ${place.nameEn}`);
  console.log(`   id: ${place.id}`);
  console.log(`   trigger: ${place.triggerRadiusM}m · coordinate: ${place.lat}, ${place.lng}`);
}

const timingCases = [10, 40, 80];
console.log('\nRemaining-time adaptation:');
for (const remainingTimeSec of timingCases) {
  const result = await getStoryForJourney({
    placeId: 'lee-tung-street',
    track: 'official',
    remainingTimeSec,
    interests: ['Architecture'],
  });
  console.log(`- ${remainingTimeSec}s remaining → ${result.length} (${result.story.durationSec}s script slot)`);
}

console.log('\nStatus: interfaces are ready; map geometry and reviewed story copy are delegated to B and C.\n');

