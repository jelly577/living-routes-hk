#!/usr/bin/env node
// Generates backup narration audio for all scripts.
//
// Two engines:
//   edge (default) — Microsoft neural voices via the free `edge-tts` tool. Natural-sounding,
//                    real Cantonese voices. Needs internet + `pip3 install edge-tts` once.
//   say            — macOS built-in voices (offline, but robotic). Old behaviour.
//
// Run on a Mac, from the project folder:
//   node scripts/generate-audio.mjs                          # (re)generate everything with neural voices
//   node scripts/generate-audio.mjs --lang zh-HK             # one language (en | zh-CN | zh-HK)
//   node scripts/generate-audio.mjs --voice zh-HK=zh-HK-WanLungNeural   # pick another voice
//   node scripts/generate-audio.mjs --rate -5%               # a bit slower (edge only)
//   node scripts/generate-audio.mjs --engine say             # offline macOS voices
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
const argValue = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const argValues = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const force = args.includes('--force');
const langArg = argValue('--lang');
const engine = argValue('--engine') || 'edge';

if (process.platform !== 'darwin') {
  console.error('Run this script on a Mac (it uses afinfo/afconvert, and `say` for the offline engine).');
  process.exit(1);
}

// ---------- Engine: edge (Microsoft neural voices) ----------

// Default neural voices. Alternatives worth trying:
//   en:    en-GB-RyanNeural (male), en-HK-YanNeural / en-HK-SamNeural (Hong Kong English accent)
//   zh-CN: zh-CN-YunxiNeural (male), zh-CN-XiaoyiNeural
//   zh-HK: zh-HK-WanLungNeural (male), zh-HK-HiuGaaiNeural
const EDGE_VOICES = {
  en: 'en-GB-SoniaNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'zh-HK': 'zh-HK-HiuMaanNeural',
};
for (const pair of argValues('--voice')) {
  const [lang, name] = pair.split('=');
  if (lang && name) EDGE_VOICES[lang] = name;
}
const EDGE_RATE = argValue('--rate') || '+0%';

function edgeCommand() {
  try { execFileSync('edge-tts', ['--help'], { stdio: 'ignore' }); return ['edge-tts']; } catch {}
  try { execFileSync('python3', ['-m', 'edge_tts', '--help'], { stdio: 'ignore' }); return ['python3', '-m', 'edge_tts']; } catch {}
  return null;
}

// ---------- Engine: say (macOS built-in voices) ----------

const PREFERRED = {
  en: ['Daniel', 'Serena', 'Kate', 'Samantha', 'Alex'],
  'zh-CN': ['Tingting', 'Ting-Ting', 'Lili', 'Yu-shu'],
  'zh-HK': ['Sinji', 'Sin-ji'],
};
const LOCALES = { en: ['en_GB', 'en_US', 'en_AU'], 'zh-CN': ['zh_CN'], 'zh-HK': ['zh_HK'] };
const SAY_RATE = { en: 175, 'zh-CN': 190, 'zh-HK': 190 }; // words/min for `say -r`

function installedVoices() {
  const out = execFileSync('say', ['-v', '?']).toString();
  return out.split('\n').map((line) => {
    const m = line.match(/^(.+?)\s+([a-z]{2,3}_[A-Z0-9]{2,3})\s+#/);
    return m ? { name: m[1].trim(), locale: m[2] } : null;
  }).filter(Boolean);
}

function chooseSayVoice(voices, lang) {
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

// ---------- Listing ----------

if (args.includes('--list-voices')) {
  if (engine === 'edge') {
    const cmd = edgeCommand();
    if (!cmd) { console.error('edge-tts is not installed. Run: pip3 install edge-tts'); process.exit(1); }
    const out = execFileSync(cmd[0], [...cmd.slice(1), '--list-voices']).toString();
    console.log(out.split('\n').filter((l) => /(en-GB|en-HK|zh-CN|zh-HK)-/.test(l)).join('\n'));
  } else {
    const voices = installedVoices();
    for (const lang of SUPPORTED_LANGUAGES) {
      console.log(lang, '→', voices.filter((v) => LOCALES[lang].includes(v.locale)).map((v) => v.name).join(', ') || '(none installed)');
    }
  }
  process.exit(0);
}

// ---------- Helpers ----------

const durationOf = (file) => {
  const info = execFileSync('afinfo', [file]).toString();
  const m = info.match(/estimated duration:\s*([\d.]+)/);
  return m ? Math.round(parseFloat(m[1]) * 10) / 10 : null;
};

function encodeM4a(input, output, bitrate) {
  // Newer macOS versions no longer accept afconvert's historical `-d aac`
  // spelling consistently. Homebrew ffmpeg is more predictable when present.
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-c:a', 'aac', '-b:a', String(bitrate), output]);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(bitrate), input, output]);
}

// ---------- Main ----------

let edge = null;
let sayVoices = null;
if (engine === 'edge') {
  edge = edgeCommand();
  if (!edge) {
    console.error('\nedge-tts is not installed. Install it once, then run this again:\n  pip3 install edge-tts\n');
    console.error('(Or use the offline robotic voices: node scripts/generate-audio.mjs --engine say)');
    process.exit(1);
  }
} else if (engine === 'say') {
  sayVoices = installedVoices();
} else {
  console.error(`Unknown engine "${engine}". Use --engine edge or --engine say.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const langs = langArg ? [langArg] : SUPPORTED_LANGUAGES;
const tmpTxt = join(tmpdir(), 'lrhk-tts.txt');
const tmpRaw = join(tmpdir(), engine === 'edge' ? 'lrhk-tts.mp3' : 'lrhk-tts.aiff');
let made = 0; let skipped = 0; let failed = 0;

for (const lang of langs) {
  const voice = engine === 'edge' ? EDGE_VOICES[lang] : chooseSayVoice(sayVoices, lang);
  if (!voice) {
    console.warn(`\n⚠ No voice for ${lang}.`);
    if (engine === 'say') console.warn('  Install one: System Settings → Accessibility → Spoken Content → System voice → Manage Voices…');
    continue;
  }
  console.log(`\n${lang}: using ${engine} voice "${voice}"`);
  for (const story of allStories) {
    const key = `${story.placeId}.${story.track}.${story.length}.${lang}`;
    const file = `${key}.m4a`;
    const out = join(outDir, file);
    // Skip only files already made with this same voice, so switching voices (or retrying failures) just works.
    if (!force && existsSync(out) && manifest[key]?.voice === voice) { skipped += 1; continue; }
    const { text } = localizeStory(story, lang);
    writeFileSync(tmpTxt, text, 'utf8');
    rmSync(tmpRaw, { force: true });
    try {
      if (engine === 'edge') {
        execFileSync(edge[0], [...edge.slice(1), '--voice', voice, `--rate=${EDGE_RATE}`, '--file', tmpTxt, '--write-media', tmpRaw], { stdio: ['ignore', 'ignore', 'pipe'] });
      } else {
        execFileSync('say', ['-v', voice, '-r', String(SAY_RATE[lang]), '-f', tmpTxt, '-o', tmpRaw]);
      }
      if (!existsSync(tmpRaw) || statSync(tmpRaw).size <= 4096) throw new Error('no audio produced');
    } catch (error) {
      console.warn(`  ✗ ${file}  ${String(error.stderr || error.message).trim().split('\n').pop()}`);
      failed += 1;
      continue;
    }
    encodeM4a(tmpRaw, out, engine === 'edge' ? 64000 : 48000);
    const durationSec = durationOf(out);
    manifest[key] = { file, language: lang, engine, voice, durationSec, kb: Math.round(statSync(out).size / 1024), generatedAt: new Date().toISOString().slice(0, 10) };
    console.log(`  ✓ ${file}  ${durationSec}s`);
    made += 1;
  }
}

rmSync(tmpTxt, { force: true });
rmSync(tmpRaw, { force: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nDone: ${made} generated, ${skipped} already existed, ${failed} failed. Manifest: public/audio/manifest.json`);
if (failed) console.log('Failures are usually network hiccups — run the same command again; finished files are skipped.');
