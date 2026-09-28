// Living Routes HK — narration / TTS service (Student C)
//
// Playback order for every story:
//   1. Pre-generated audio file   public/audio/<placeId>.<track>.<length>.<lang>.m4a  (most stable)
//   2. Browser speech synthesis    (needs a matching voice on the device)
//   3. Text only                   (state 'text-only' — the player keeps showing the script)
//
// Usage (React, inside the player):
//   const narrator = useMemo(() => createNarrator({ onStateChange: setAudioState, onProgress: setProgress }), []);
//   narrator.play(story, 'zh-HK');   // stops whatever was playing first
//   narrator.pause(); narrator.resume(); narrator.stop();
//   useEffect(() => () => narrator.stop(), []);   // stop on unmount
//
// States sent to onStateChange({ state, mode, reason }):
//   'loading' | 'playing' | 'paused' | 'ended' | 'idle' | 'text-only'
//   mode = 'audio' (file) | 'speech' (browser TTS) | 'text'

import { localizeStory } from '../content/stories.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const AUDIO_DIR = `${BASE}audio/`;

// Browser voice language tags to try, in order. Cantonese text is never read by a Mandarin voice.
const VOICE_TAGS = {
  en: ['en-GB', 'en-US', 'en-AU', 'en'],
  'zh-CN': ['zh-CN', 'cmn-CN', 'zh-TW', 'cmn'],
  'zh-HK': ['zh-HK', 'yue-HK', 'yue'],
};

export const storyAudioKey = (story, language) =>
  `${story.placeId}.${story.track}.${story.length}.${language}`;

let manifestPromise = null;
export function loadAudioManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(`${AUDIO_DIR}manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}

// Real duration of the pre-generated file, if there is one (seconds), else null.
export async function getAudioDurationSec(story, language) {
  const manifest = await loadAudioManifest();
  return manifest[storyAudioKey(story, language)]?.durationSec ?? null;
}

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function getVoices() {
  if (!hasSpeech()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  // Chrome loads voices asynchronously.
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}

export async function pickVoice(language) {
  const voices = await getVoices();
  const norm = (l) => (l || '').replace('_', '-').toLowerCase();
  for (const tag of VOICE_TAGS[language] || [language]) {
    const t = tag.toLowerCase();
    const exact = voices.filter((v) => norm(v.lang) === t);
    const prefix = voices.filter((v) => norm(v.lang).startsWith(`${t}-`));
    const found = [...exact, ...prefix];
    if (found.length) return found.find((v) => v.localService) || found[0];
  }
  return null;
}

// Chrome cuts long utterances after ~15s, so speak sentence by sentence.
const splitSentences = (text) =>
  text.match(/[^.!?。！？；]+[.!?。！？；]*[”」』"]?\s*/g)?.map((s) => s.trim()).filter(Boolean) || [text];

export function createNarrator({ onStateChange, onProgress } = {}) {
  let audio = null;
  let token = 0;
  let state = 'idle';
  let mode = null;

  const emit = (next, extra = {}) => {
    state = next;
    onStateChange?.({ state: next, mode, ...extra });
  };
  const progress = (p) => onProgress?.(Math.max(0, Math.min(1, p)));

  function stop() {
    token += 1;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }
    if (hasSpeech()) window.speechSynthesis.cancel();
    progress(0);
    if (state !== 'idle') emit('idle');
  }

  function playFile(url, my) {
    return new Promise((resolve) => {
      const a = new Audio();
      audio = a;
      let started = false;
      a.preload = 'auto';
      a.addEventListener('timeupdate', () => {
        if (my === token && a.duration) progress(a.currentTime / a.duration);
      });
      a.addEventListener('ended', () => {
        if (my === token) { progress(1); emit('ended'); }
      });
      a.addEventListener('error', () => {
        if (!started) resolve(false);
        else if (my === token) emit('text-only', { reason: 'audio-error' });
      });
      a.src = url;
      a.play()
        .then(() => {
          if (my !== token) { a.pause(); return resolve(true); }
          started = true;
          mode = 'audio';
          emit('playing');
          resolve(true);
        })
        .catch(() => resolve(false)); // missing file, or autoplay blocked
    });
  }

  async function speak(text, language, my) {
    if (!hasSpeech()) return false;
    const voice = await pickVoice(language);
    if (!voice || my !== token) return false;
    const parts = splitSentences(text);
    const total = text.length || 1;
    let spoken = 0;
    mode = 'speech';
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 1;
      u.onstart = () => { if (my === token && i === 0) emit('playing'); };
      u.onboundary = (e) => { if (my === token) progress((spoken + e.charIndex) / total); };
      u.onend = () => {
        if (my !== token) return;
        spoken += part.length + 1;
        progress(spoken / total);
        if (i === parts.length - 1) emit('ended');
      };
      u.onerror = (e) => {
        if (my === token && e.error !== 'interrupted' && e.error !== 'canceled') {
          emit('text-only', { reason: `speech-${e.error}` });
        }
      };
      window.speechSynthesis.speak(u);
    });
    return true;
  }

  async function play(story, language = 'en') {
    stop();
    const my = ++token;
    const localized = localizeStory(story, language);
    mode = null;
    emit('loading');

    const manifest = await loadAudioManifest();
    if (my !== token) return;
    const entry = manifest[storyAudioKey(story, language)];
    if (entry && (await playFile(`${AUDIO_DIR}${entry.file}`, my))) return;
    if (my !== token) return;

    if (await speak(localized.text, language, my)) return;
    if (my !== token) return;

    mode = 'text';
    emit('text-only', { reason: 'no-audio-or-voice' });
  }

  function pause() {
    if (state !== 'playing') return;
    if (mode === 'audio' && audio) audio.pause();
    if (mode === 'speech' && hasSpeech()) window.speechSynthesis.pause();
    emit('paused');
  }

  function resume() {
    if (state !== 'paused') return;
    if (mode === 'audio' && audio) audio.play().catch(() => emit('text-only', { reason: 'resume-blocked' }));
    if (mode === 'speech' && hasSpeech()) window.speechSynthesis.resume();
    emit('playing');
  }

  return { play, pause, resume, stop, getState: () => ({ state, mode }) };
}
