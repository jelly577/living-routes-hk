#!/usr/bin/env node
// Generates backup narration audio for all scripts with the macOS built-in voices.
// Run on a Mac, from the project folder:
//   node scripts/generate-audio.mjs              # all languages
//   node scripts/generate-audio.mjs --lang en    # one language (en | zh-CN | zh-HK)
//   node scripts/generate-audio.mjs --force      # regenerate files that already exist
//   node scripts/generate-audio.mjs --list-voices
// Output: public/audio/<placeId>.<track>.<length>.<lang>.m4a + public/audio/manifest.json
// The player (src/services/ttsService.js) plays these first and falls back to browser TTS.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allStories, localizeStory, SUPPORTED_LANGUAGES } from '../src/content/stories.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio');
const args = process.argv.slice(2);
const force = args.includes('--force');
const langArg = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;

if (process.platform !== 'darwin') {
  console.error('This script uses the macOS "say" command. Run it on a Mac.');
  process.exit(1);
}

// Preferred voices per language (first one installed wins), then any voice with a matching locale.
const PREFERRED = {
  en: ['Daniel', 'Serena', 'Kate', 'Samantha', 'Alex'],
  'zh-CN': ['Tingting', 'Ting-Ting', 'Lili', 'Yu-shu'],
  'zh-HK': ['Sinji', 'Sin-ji'],
};
const LOCALES = { en: ['en_GB', 'en_US', 'en_AU'], 'zh-CN': ['zh_CN'], 'zh-HK': ['zh_HK'] };
const RATE = { en: 175, 'zh-CN': 190, 'zh-HK': 190 }; // words/min for `say -r`

function installedVoices() {
  const out = execFileSync('say', ['-v', '?']).toString();
  return out.split('\n').map((line) => {
    const m = line.match(/^(.+?)\s+([a-z]{2,3}_[A-Z0-9]{2,3})\s+#/);
    return m ? { name: m[1].trim(), locale: m[2] } : null;
  }).filter(Boolean);
}

const voices = installedVoices();
if (args.includes('--list-voices')) {
  for (const lang of SUPPORTED_LANGUAGES) {
    console.log(lang, '→', voices.filter((v) => LOCALES[lang].includes(v.locale)).map((v) => v.name).join(', ') || '(none installed)');
  }
  process.exit(0);
}

function chooseVoice(lang) {
  for (const name of PREFERRED[lang]) {
    const v = voices.find((x) => x.name === name || x.name.startsWith(`${name} (`));
    if (v) return v.name;
  }
  for (const loc of LOCALES[lang]) {
    const v = voices.find((x) => x.locale === loc);
    if (v) return v.name;
  }
  return null;
}

const durationOf = (file) => {
  const info = execFileSync('afinfo', [file]).toString();
  const m = info.match(/estimated duration:\s*([\d.]+)/);
  return m ? Math.round(parseFloat(m[1]) * 10) / 10 : null;
};

function encodeM4a(input, output) {
  // Newer macOS versions no longer accept afconvert's historical `-d aac`
  // spelling consistently. Homebrew ffmpeg is more predictable when present.
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-c:a', 'aac', '-b:a', '48000', output]);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', input, output]);
}

mkdirSync(outDir, { recursive: true });
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const langs = langArg ? [langArg] : SUPPORTED_LANGUAGES;
const tmpTxt = join(tmpdir(), 'lrhk-tts.txt');
const tmpAiff = join(tmpdir(), 'lrhk-tts.aiff');
let made = 0; let skipped = 0;

for (const lang of langs) {
  const voice = chooseVoice(lang);
  if (!voice) {
    console.warn(`\n⚠ No macOS voice for ${lang}. Install one: System Settings → Accessibility → Spoken Content → System voice → Manage Voices…`);
    console.warn(`  Look for: ${PREFERRED[lang].join(' / ')}. Then run this script again.`);
    continue;
  }
  console.log(`\n${lang}: using voice "${voice}"`);
  for (const story of allStories) {
    const key = `${story.placeId}.${story.track}.${story.length}.${lang}`;
    const file = `${key}.m4a`;
    const out = join(outDir, file);
    if (!force && existsSync(out) && manifest[key]) { skipped += 1; continue; }
    const { text } = localizeStory(story, lang);
    writeFileSync(tmpTxt, text, 'utf8');
    execFileSync('say', ['-v', voice, '-r', String(RATE[lang]), '-f', tmpTxt, '-o', tmpAiff]);
    if (!existsSync(tmpAiff) || statSync(tmpAiff).size <= 4096) {
      throw new Error(`macOS say produced no audio for ${key}. Run this script from a normal local Terminal session.`);
    }
    encodeM4a(tmpAiff, out);
    const durationSec = durationOf(out);
    manifest[key] = { file, language: lang, voice, durationSec, kb: Math.round(statSync(out).size / 1024), generatedAt: new Date().toISOString().slice(0, 10) };
    console.log(`  ✓ ${file}  ${durationSec}s`);
    made += 1;
  }
}

rmSync(tmpTxt, { force: true });
rmSync(tmpAiff, { force: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nDone: ${made} generated, ${skipped} already existed. Manifest: public/audio/manifest.json`);
