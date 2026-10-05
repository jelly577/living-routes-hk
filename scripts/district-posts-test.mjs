import test from 'node:test';
import assert from 'node:assert/strict';
import { addPost, getPosts, getPostedPlaces } from '../src/services/communityService.js';
import { districts, aggregateDistrictPosts } from '../src/data/districts.js';

test('one approximate bubble per chosen area; duplicates and private posts excluded', () => {
  const publicPost = { id: 'a', visibility: 'community', districtId: 'district-sai-kung' };
  const markers = aggregateDistrictPosts([publicPost, publicPost,
    { ...publicPost, id: 'b' }, { ...publicPost, id: 'c', visibility: 'private' },
    { ...publicPost, id: 'd', districtId: null }]);
  assert.equal(districts.length, 18);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].postCount, 2);
  assert.equal(markers[0].coordinateStatus, 'approximate');
});

test('area, named place and no-location entries share Community without exposing pins', async () => {
  const region = await addPost({ text: 'A district memory', locationType: 'district', districtId: 'district-sai-kung', visibility: 'community', location: { lat: 22.3, lng: 114.2 } });
  const second = await addPost({ text: 'Another memory', locationType: 'district', districtId: 'district-sai-kung', visibility: 'community' });
  const specific = await addPost({ text: 'Named place', location: 'blue-house', locationType: 'place', districtId: 'district-wan-chai', visibility: 'community' });
  const none = await addPost({ text: 'No position', locationType: 'none', districtId: 'district-sai-kung', location: 'blue-house', visibility: 'community' });
  await addPost({ text: 'Private region', locationType: 'district', districtId: 'district-sai-kung', visibility: 'private' });
  assert.equal(region.placeId, null);
  assert.equal(region.placeInfo, null);
  assert.equal(none.placeId, null);
  assert.equal(none.placeInfo, null);
  assert.equal(none.districtId, null);
  const feed = await getPosts();
  assert.ok([region, second, specific, none].every((post) => feed.some((item) => item.id === post.id)));
  const areaFeed = await getPosts({ placeId: 'district-sai-kung' });
  assert.equal(areaFeed.length, 2);
  const markers = await getPostedPlaces();
  assert.equal(markers.find((item) => item.id === 'district-sai-kung').postCount, 2);
  assert.equal(markers.find((item) => item.id === 'district-wan-chai').postCount, 1);
  await assert.rejects(addPost({ text: 'Missing area', locationType: 'district' }), /choose a district/);
});
