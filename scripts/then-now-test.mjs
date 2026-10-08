import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonPlaceForPost } from '../src/services/comparisonService.js';
import { getPlaceById } from '../src/data/places.js';

import { addPost, getPosts } from '../src/services/communityService.js';
import { saveMemoryPost } from '../src/services/memoryPostStorage.js';

test('legacy Google racecourse post joins the heritage comparison without rewriting it', async () => {
  const legacy = { id: 'legacy-racecourse', visibility: 'community', era: 'MODERN',
    locationType: 'place', placeId: 'gp:ChIJcVnvqE8ABDQRmlCv6UgfOvk', place: '跑馬地馬場',
    placeInfo: { nameEn: '跑馬地馬場', lat: 22.2718214, lng: 114.1806169 }, text: 'My racecourse memory' };
  await saveMemoryPost(legacy);
  assert.equal(comparisonPlaceForPost(legacy).id, 'happy-valley-racecourse');
  const feed = await getPosts({ placeId: 'happy-valley-racecourse' });
  assert.ok(feed.some((p) => p.id === legacy.id));
  assert.ok((await getPosts({ placeId: legacy.placeId })).some((p) => p.id === legacy.id));
  assert.equal(legacy.placeId, 'gp:ChIJcVnvqE8ABDQRmlCv6UgfOvk');
  const place = getPlaceById('happy-valley-racecourse');
  const past = place.gallery.find((i) => i.era === 'past' && !i.contentWarning);
  assert.ok(past?.url);
  assert.equal(past.contentWarning, undefined);
  assert.ok(place.stories.official.medium);
});

test('future posts normalize exact aliases; private and unrelated posts are excluded', async () => {
  const publicPost = await addPost({ text: 'Racecourse', visibility: 'community', location: {
    id: 'gp:another-racecourse', nameEn: 'Happy Valley Racecourse', lat: 22.27, lng: 114.18 } });
  assert.equal(publicPost.placeId, 'happy-valley-racecourse');
  assert.equal(publicPost.districtId, 'district-wan-chai');
  const privatePost = await addPost({ text: 'Private', location: '跑马地马场' });
  const other = await addPost({ text: 'Blue House', visibility: 'community', location: 'blue-house' });
  const feed = await getPosts({ placeId: 'happy-valley-racecourse' });
  assert.ok(feed.some((p) => p.id === publicPost.id));
  assert.ok(!feed.some((p) => [privatePost.id, other.id].includes(p.id)));
});

test('unknown, district, unlocated and photo-free posts have comparisons without invented archives', async () => {
  const first = await addPost({ text: 'Cafe note', visibility: 'community', location: 'A quiet cafe' });
  const second = await addPost({ text: 'Another note', visibility: 'community', location: 'A quiet cafe' });
  const cafe = comparisonPlaceForPost(first);
  assert.deepEqual((await getPosts({ placeId: cafe.id })).map((p) => p.id).sort(), [first.id, second.id].sort());
  assert.equal(getPlaceById(cafe.id), undefined);
  const unlocated = await addPost({ text: 'No location', visibility: 'community', locationType: 'none' });
  const single = comparisonPlaceForPost(unlocated);
  assert.equal(single.comparisonPostId, unlocated.id);
  assert.deepEqual((await getPosts({ postId: single.comparisonPostId })).map((p) => p.id), [unlocated.id]);
  assert.equal(single.lat, undefined);
  const region = await addPost({ text: 'District note', visibility: 'community', locationType: 'district', districtId: 'district-wan-chai' });
  assert.equal(comparisonPlaceForPost(region).id, 'district-wan-chai');
  assert.equal(getPlaceById('district-wan-chai'), undefined);
});
