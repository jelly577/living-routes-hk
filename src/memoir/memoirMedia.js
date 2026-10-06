// Browser-side media helpers for the memoir video: image loading, AI-sized
// image copies, a generated ambient soundtrack and MediaRecorder export.
import { allClips, clipAt, drawMemoirFrame } from './memoirRenderer.js';

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    // Remote (Supabase) photos must be CORS-clean, or the canvas could not be recorded.
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// Small JPEG copy for the AI request (keeps payload and token use low).
export function imageToJpegDataUrl(image, maxSide = 768, quality = 0.8) {
  if (!image) return null;
  try {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null; // tainted remote image: send the text only
  }
}

export async function loadMemoirImages(stops) {
  const entries = await Promise.all(stops.flatMap((stop) => stop.memories.map(async ({ post }) => [post.id, await loadImage(post.image)])));
  return Object.fromEntries(entries.filter(([, image]) => image));
}

// Blob (cached or freshly generated clip) → a muted <video> ready to draw.
export function createClipElement(blob) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = URL.createObjectURL(blob);
    const done = (ok) => { video.onloadeddata = null; video.onerror = null; resolve(ok ? video : null); };
    video.onloadeddata = () => done(true);
    video.onerror = () => done(false);
  });
}

export function releaseClips(clips = {}) {
  Object.values(clips).forEach((video) => { if (video?.src?.startsWith('blob:')) { video.pause(); URL.revokeObjectURL(video.src); } });
}

// Keep clip playback in step with the memoir clock.
// mode 'play': let the current clip run (correcting drift); 'seek': show the exact frame (scrubbing).
export function syncClips(plan, time, mode = 'play') {
  const active = clipAt(plan, time);
  for (const clip of allClips(plan)) {
    if (!active || clip !== active.clip) { if (!clip.paused) clip.pause(); continue; }
    const drift = Math.abs(clip.currentTime - active.position);
    if (mode === 'seek') {
      if (!clip.paused) clip.pause();
      if (drift > 0.04) clip.currentTime = active.position;
    } else {
      if (drift > 0.35) clip.currentTime = active.position;
      if (clip.paused && !clip.ended && active.position < clip.duration - 0.1) clip.play().catch(() => {});
    }
  }
}

export function pickVideoFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  const found = candidates.find(([type]) => MediaRecorder.isTypeSupported(type));
  return found ? { mimeType: found[0], extension: found[1] } : null;
}

// A soft, generated pad (no licensed music): one chord per stop, slow swells.
function createAmbientSoundtrack(plan) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  const audio = new AudioContextClass();
  const destination = audio.createMediaStreamDestination();
  const master = audio.createGain();
  master.gain.value = 0;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  master.connect(filter);
  filter.connect(destination);

  const chords = [
    [220.0, 277.18, 329.63, 440.0], // A
    [196.0, 246.94, 293.66, 392.0], // G
    [174.61, 220.0, 261.63, 349.23], // F
    [164.81, 207.65, 246.94, 329.63], // E
  ];
  const start = audio.currentTime + 0.05;
  const voices = chords[0].map((frequency, i) => {
    const osc = audio.createOscillator();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.value = frequency;
    osc.detune.value = (i - 1.5) * 4;
    const gain = audio.createGain();
    gain.gain.value = i === 0 ? 0.14 : 0.08;
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    return osc;
  });
  // Move to a new chord whenever the camera sets off for the next stop.
  plan.segments.filter((seg) => seg.type === 'travel').forEach((seg) => {
    const chord = chords[seg.stopIndex % chords.length];
    voices.forEach((osc, i) => osc.frequency.setTargetAtTime(chord[i], start + seg.start, 0.6));
  });
  master.gain.setValueAtTime(0, start);
  master.gain.linearRampToValueAtTime(0.5, start + 2);
  master.gain.setValueAtTime(0.5, start + Math.max(2, plan.duration - 2.5));
  master.gain.linearRampToValueAtTime(0, start + plan.duration);
  return {
    track: destination.stream.getAudioTracks()[0],
    stop: () => { voices.forEach((osc) => { try { osc.stop(); } catch { /* already stopped */ } }); audio.close(); },
  };
}

// Plays the plan in real time on `canvas` while recording it.
export function recordMemoir(canvas, plan, { withAudio = true, onProgress } = {}) {
  const format = pickVideoFormat();
  if (!format || typeof canvas.captureStream !== 'function') {
    return Promise.reject(new Error('This browser cannot record video. Please try the latest Chrome, Edge or Safari.'));
  }
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const soundtrack = withAudio ? createAmbientSoundtrack(plan) : null;
  if (soundtrack?.track) stream.addTrack(soundtrack.track);
  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

  return new Promise((resolve, reject) => {
    let frame = 0;
    let startedAt = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      allClips(plan).forEach((clip) => clip.pause());
      soundtrack?.stop();
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.onerror = (event) => { finish(); reject(event.error || new Error('Recording failed.')); };
    recorder.onstop = () => {
      finish();
      resolve({ blob: new Blob(chunks, { type: format.mimeType.split(';')[0] }), ...format, duration: plan.duration });
    };
    const tick = (now) => {
      if (!startedAt) startedAt = now;
      const time = (now - startedAt) / 1000;
      syncClips(plan, Math.min(time, plan.duration), 'play');
      drawMemoirFrame(ctx, plan, Math.min(time, plan.duration));
      onProgress?.(Math.min(1, time / plan.duration));
      if (time >= plan.duration + 0.25) { recorder.stop(); return; }
      frame = requestAnimationFrame(tick);
    };
    allClips(plan).forEach((clip) => { clip.pause(); clip.currentTime = 0; });
    drawMemoirFrame(ctx, plan, 0);
    recorder.start(500);
    frame = requestAnimationFrame(tick);
  });
}
