import { allStories } from '../src/content/stories.js';
import { places } from '../src/data/places.js';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
const errors = [];
const intentionalSpeechFallbacks = new Set([
  'court-of-final-appeal.official.medium.en',
  'court-of-final-appeal.official.medium.zh-CN',
  'court-of-final-appeal.official.medium.zh-HK',
]);
const check = (condition, message) => { if (!condition) errors.push(message); };

check(allStories.length === 18, `expected 18 stories, found ${allStories.length}`);
for (const story of allStories) {
  for (const language of ['en', 'zh-CN', 'zh-HK']) {
    check(Boolean(story.localized?.[language]?.title), `${story.placeId}.${story.track}.${story.length} missing ${language} title`);
    check(Boolean(story.localized?.[language]?.text), `${story.placeId}.${story.track}.${story.length} missing ${language} text`);
  }
  check(story.sourceUrls?.length > 0, `${story.placeId}.${story.track}.${story.length} has no source URL`);
  if (story.track === 'civilian') check(Boolean(story.disclosure), `${story.placeId}.${story.track}.${story.length} missing civilian disclosure`);
  for (const language of ['en', 'zh-CN', 'zh-HK']) {
    const key = `${story.placeId}.${story.track}.${story.length}.${language}`;
    check(Boolean(manifest[key]) || intentionalSpeechFallbacks.has(key), `missing audio or declared browser-speech fallback ${key}`);
  }
}

for (const place of places) {
  check(place.image?.status === 'verified', `${place.id} image is not verified`);
  check(Boolean(place.image?.url), `${place.id} image has no URL`);
}

console.log(`Stories: ${allStories.length}`);
console.log(`Three-language stories: ${allStories.filter((s) => ['en', 'zh-CN', 'zh-HK'].every((l) => s.localized?.[l])).length}/${allStories.length}`);
console.log(`Audio entries: ${Object.keys(manifest).length}`);
console.log(`Browser-speech fallbacks: ${intentionalSpeechFallbacks.size}`);
console.log(`Verified place images: ${places.filter((p) => p.image?.status === 'verified').length}/${places.length}`);
console.log(`Human review status: ${allStories.filter((s) => s.reviewStatus === 'human-reviewed').length}/${allStories.length}`);

if (errors.length) {
  console.error('\nContent audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Structural content audit passed. Human source review is still required before final publication.');
