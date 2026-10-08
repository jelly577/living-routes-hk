import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseExif, resolveTakenAt } from '../src/services/photoMetadata.js';
import { animateMemories, clipKey, fallbackMotion } from '../src/services/animationService.js';
import {
  matchPlaceName, nearestNamedSpot,
  buildAiRequest, buildMemoirStops, generateMemoirScript, memoirDateBounds, mergeAiScript, templateMemoirScript,
} from '../src/services/memoirService.js';

const fixture = readFileSync(new URL('./fixtures/exif-sample.jpg', import.meta.url));

test('reads capture time and GPS from JPEG EXIF', () => {
  const { takenAt, gps } = parseExif(fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength));
  assert.equal(takenAt, '2026-10-03T06:22:05.000Z'); // 14:22:05 at +08:00
  assert.deepEqual(gps, { lat: 22.2801, lng: 114.155 });
});

test('non-JPEG input yields no metadata', () => {
  assert.deepEqual(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), { takenAt: null, gps: null });
});

test('a date-only user date keeps the photo time on the same day, else means local noon', () => {
  assert.deepEqual(resolveTakenAt(null, '2026-10-03T06:22:05.000Z'), { takenAt: '2026-10-03T06:22:05.000Z', takenAtSource: 'photo' });
  const noon = resolveTakenAt('2026-09-30', '2026-10-03T06:22:05.000Z');
  assert.equal(noon.takenAtSource, 'user');
  assert.equal(new Date(noon.takenAt).getHours(), 12);
  assert.deepEqual(resolveTakenAt(null, null), { takenAt: null, takenAtSource: 'posted' });
});

const post = (id, takenAt, extra = {}) => ({ id, text: `memory ${id}`, takenAt, createdAt: '2026-10-05T10:00:00.000Z', ...extra });

const posts = [
  post('c', '2026-10-02T10:00:00.000Z', { locationType: 'district', districtId: 'district-yau-tsim-mong' }),
  post('a', '2026-10-01T10:00:00.000Z', { photoGps: { lat: 22.2801, lng: 114.155 } }),
  post('b', '2026-10-01T11:00:00.000Z', { photoGps: { lat: 22.2805, lng: 114.1552 } }), // ~50 m from a → same stop
  post('n', '2026-10-01T12:00:00.000Z', { locationType: 'none' }), // no location → joins previous stop
  post('d', '2026-10-03T10:00:00.000Z', { photoGps: { lat: 35.68, lng: 139.76 } }), // Tokyo: outside the HK map, no place → unlocated
  post('e', '2026-10-04T10:00:00.000Z', { locationType: 'district', districtId: 'district-islands' }),
];

test('orders by capture time, merges nearby memories, attaches unlocated ones', () => {
  const { stops, memoryCount } = buildMemoirStops(posts);
  assert.equal(memoryCount, 6);
  // Each day is its own run of stops; d (no usable location, its own day) stays where the trip was.
  assert.deepEqual(stops.map((stop) => stop.memories.map((m) => m.post.id)), [['a', 'b', 'n'], ['c'], ['d'], ['e']]);
  assert.equal(stops[2].place.id, 'district-yau-tsim-mong');
  assert.equal(stops[2].day, '2026-10-03');
  assert.equal(stops[0].precision, 'photo');
  assert.equal(stops[0].day, '2026-10-01');
  assert.equal(stops[1].place.id, 'district-yau-tsim-mong');
});

test('date range filter and bounds', () => {
  assert.deepEqual(memoirDateBounds(posts), { from: '2026-10-01', to: '2026-10-04' });
  const { stops } = buildMemoirStops(posts, { from: '2026-10-02', to: '2026-10-03' });
  assert.deepEqual(stops.flatMap((s) => s.memories.map((m) => m.post.id)), ['c', 'd']);
});

test('no located memories still gives one city stop', () => {
  const { stops } = buildMemoirStops([post('x', '2026-10-01T00:00:00.000Z', { locationType: 'none' })]);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].precision, 'none');
});

test('template script uses the user\'s own words in each language', () => {
  const { stops } = buildMemoirStops(posts);
  const zh = templateMemoirScript(stops, 'zh-CN');
  assert.equal(zh.stops[1].title, '油尖旺一带');
  assert.equal(zh.stops[0].memories[0].caption, 'memory a');
  assert.equal(templateMemoirScript(stops, 'en').subtitle, '2026.10.01 – 10.04');
});

test('AI request never contains GPS and AI gaps fall back to the template', async () => {
  const { stops } = buildMemoirStops(posts);
  const request = buildAiRequest(stops, { images: { a: 'data:image/jpeg;base64,AAAA' } });
  assert.doesNotMatch(JSON.stringify(request), /22\.28|114\.15|photoGps/);
  assert.equal(request.stops[0].memories[0].image, 'data:image/jpeg;base64,AAAA');

  const template = templateMemoirScript(stops, 'en');
  const merged = mergeAiScript(template, { title: 'Three days', stops: [{ stopId: 'stop-1', memories: [{ postId: 'b', caption: 'Rain on the tram window.' }] }] });
  assert.equal(merged.source, 'ai');
  assert.equal(merged.title, 'Three days');
  assert.equal(merged.stops[0].memories[1].caption, 'Rain on the tram window.');
  assert.equal(merged.stops[0].memories[0].caption, 'memory a');

  const noConsent = await generateMemoirScript(stops, { allowAi: false, requestAi: () => { throw new Error('must not be called'); } });
  assert.equal(noConsent.fallbackReason, 'no-consent');
  const failed = await generateMemoirScript(stops, { allowAi: true, requestAi: async () => { throw new Error('offline'); } });
  assert.equal(failed.fallbackReason, 'ai-failed');
  assert.equal(failed.source, 'template');
});

test('AI motion prompts are kept, missing ones stay empty for the fallback', async () => {
  const { stops } = buildMemoirStops(posts);
  const merged = mergeAiScript(templateMemoirScript(stops, 'en'), { stops: [{ stopId: 'stop-1', memories: [{ postId: 'a', caption: 'x', motion: 'The person takes a bite, steam rising.' }] }] });
  assert.equal(merged.stops[0].memories[0].motion, 'The person takes a bite, steam rising.');
  assert.equal(merged.stops[0].memories[1].motion, '');
});

test('photo animation: cache hits skip the model, jobs are polled, failures stay still photos', async () => {
  const cache = new Map([[clipKey('cached', 'p'), 'old-clip']]);
  const calls = [];
  let polls = 0;
  const request = async (action, payload) => {
    calls.push(action);
    if (action === 'start') return { jobId: payload.prompt === 'boom' ? 'bad' : `job-${payload.prompt}` };
    if (action === 'status') { polls += 1; return payload.jobId === 'bad' ? { status: 'failed', error: 'nsfw filter' } : { status: polls > 1 ? 'succeeded' : 'processing' }; }
    return `clip-for-${payload.jobId}`;
  };
  const updates = [];
  const clips = await animateMemories([
    { postId: 'cached', image: 'data:', prompt: 'p' },
    { postId: 'new', image: 'data:', prompt: 'eat' },
    { postId: 'broken', image: 'data:', prompt: 'boom' },
  ], {
    request, pollMs: 1, concurrency: 1,
    onUpdate: (id, u) => updates.push(`${id}:${u.status}`),
    readCache: async (key) => cache.get(key) || null,
    writeCache: async (key, blob) => { cache.set(key, blob); },
  });
  assert.deepEqual(clips, { cached: 'old-clip', new: 'clip-for-job-eat' });
  assert.ok(updates.includes('broken:failed'));
  assert.equal(cache.get(clipKey('new', 'eat')), 'clip-for-job-eat');
  assert.equal(calls.filter((c) => c === 'start').length, 2); // never for the cached photo
  assert.notEqual(clipKey('a', 'one'), clipKey('a', 'two')); // edited motion → new clip
  assert.match(fallbackMotion('和小猫合影'), /和小猫合影/);
});

test('typed place names and a side-picked district still put the memory on the map', () => {
  const typed = post('t', '2026-10-08T10:00:00.000Z', { locationType: 'place', placeId: null, place: '西贡' });
  const sideDistrict = post('s', '2026-10-09T10:00:00.000Z', { locationType: 'place', placeId: null, place: 'my favourite cafe', districtId: 'district-wan-chai' });
  const unknown = post('u', '2026-10-10T10:00:00.000Z', { locationType: 'place', placeId: null, place: 'somewhere nice' });
  const { stops } = buildMemoirStops([typed, sideDistrict, unknown]);
  assert.equal(stops[0].place.id, 'district-sai-kung');
  assert.equal(stops[1].place.id, 'district-wan-chai');
  assert.deepEqual(stops[2].memories.map((m) => m.post.id), ['u']); // own day, stays at the last place
  assert.equal(stops[2].place.id, 'district-wan-chai');
  assert.equal(matchPlaceName('西贡码头海鲜')?.id, 'district-sai-kung');
  assert.equal(matchPlaceName('Sai Kung pier')?.id, 'district-sai-kung');
  assert.equal(matchPlaceName('香港'), null); // too vague: must not snap to 香港科学园
});

test('a day of map posts becomes one stop per popular sight, in order of first visit', () => {
  const at = (id, time, lat, lng) => post(id, time, { locationType: 'place', placeInfo: { nameEn: 'tapped', lat, lng }, placeId: `pin:${id}` });
  const posts = [
    at('p1', '2026-10-05T02:00:00.000Z', 22.2938, 114.1712), // TST promenade
    at('p2', '2026-10-05T04:00:00.000Z', 22.2759, 114.1460), // the Peak
    at('p3', '2026-10-05T07:00:00.000Z', 22.2930, 114.1730), // back at the promenade, same day
    at('p4', '2026-10-06T02:00:00.000Z', 22.2932, 114.1725), // promenade again, next day → its own stop
    at('p5', '2026-10-06T05:00:00.000Z', 22.3825, 114.2745), // Sai Kung
  ];
  const { stops } = buildMemoirStops(posts);
  assert.deepEqual(stops.map((s) => s.memories.map((m) => m.post.id)), [['p1', 'p3'], ['p2'], ['p4'], ['p5']]);
  assert.deepEqual(stops.map((s) => s.place.id), ['lm-tst-promenade', 'lm-victoria-peak', 'lm-tst-promenade', 'lm-sai-kung-town']);
  assert.deepEqual(stops.map((s) => s.day), ['2026-10-05', '2026-10-05', '2026-10-06', '2026-10-06']);
  assert.equal(templateMemoirScript(stops, 'zh-CN').stops[3].title, '西贡市中心');
});

test('far from any sight: nearby memories cluster and are named by district', () => {
  assert.equal(nearestNamedSpot({ lat: 22.5000, lng: 114.1350 }), null);
  const far = (id, time, lat, lng) => post(id, time, { locationType: 'place', placeInfo: { nameEn: 'x', lat, lng }, placeId: `pin:${id}` });
  const { stops } = buildMemoirStops([far('f1', '2026-10-07T02:00:00.000Z', 22.5000, 114.1350), far('f2', '2026-10-07T03:00:00.000Z', 22.5040, 114.1380)]);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].place.id, 'district-north');
  assert.equal(templateMemoirScript(stops, 'zh-CN').stops[0].title, '北区一带');
});
