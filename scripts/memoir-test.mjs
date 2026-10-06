import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseExif, resolveTakenAt } from '../src/services/photoMetadata.js';
import {
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
  assert.deepEqual(stops.map((stop) => stop.memories.map((m) => m.post.id)), [['a', 'b', 'n'], ['c', 'd'], ['e']]);
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
