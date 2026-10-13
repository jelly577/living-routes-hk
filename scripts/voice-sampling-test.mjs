import test from 'node:test';
import assert from 'node:assert/strict';
import { saveVoiceSample, getVoiceSample, removeVoiceSample } from '../src/services/voiceSampleService.js';
import { readFileSync } from 'node:fs';

test('local sample needs consent, supports any contributor, replaces and deletes', async () => {
  await removeVoiceSample();
  await assert.rejects(saveVoiceSample({ audio: 'data:audio/webm;base64,AQID' }), /Consent/);
  assert.equal(await getVoiceSample(), null);
  await assert.rejects(saveVoiceSample({ consent: true, audio: 'https://example.com/audio' }), /recorded audio/);
  const first = await saveVoiceSample({ consent: true, audio: 'data:audio/webm;base64,AQID', name: ' Visitor ' });
  assert.equal(first.name, 'Visitor');
  assert.equal(first.voiceCloneEnabled, false);
  assert.equal(first.consentForLocalStorage, true);
  assert.ok(first.savedAt);
  assert.deepEqual(await getVoiceSample(), first);
  const second = await saveVoiceSample({ consent: true, audio: 'data:audio/mp4;base64,BAUG', name: 'Another contributor' });
  assert.deepEqual(await getVoiceSample(), second);
  await removeVoiceSample();
  assert.equal(await getVoiceSample(), null);
});

test('sample has size guard and storage service has no network calls', async () => {
  await assert.rejects(saveVoiceSample({ consent: true, audio: 'data:audio/webm;base64,' + 'A'.repeat(7 * 1024 * 1024) }), /too large/);
  const source = readFileSync(new URL('../src/services/voiceSampleService.js', import.meta.url), 'utf8');
  assert.ok(!/fetch\(|supabase|functions\.invoke/i.test(source.replace(/\/\/[^\n]*/g, '')));
});
