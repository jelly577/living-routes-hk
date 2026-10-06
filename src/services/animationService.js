// Photo → short motion clip for the memoir video.
//
// Each photo becomes one image-to-video job (see supabase/functions/animate).
// Jobs run a few at a time, are polled until done, and finished clips are cached
// in IndexedDB by photo + prompt, so re-making a memoir never pays twice.

const DB_NAME = 'living-routes-hk-clips';
const STORE = 'clips';
const memoryCache = new Map(); // Node / no-IndexedDB fallback

function openClipDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null); // caching is best-effort
  });
}

export async function readCachedClip(key) {
  const db = await openClipDb();
  if (!db) return memoryCache.get(key) || null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => { db.close(); resolve(request.result?.blob || null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
}

export async function writeCachedClip(key, blob) {
  const db = await openClipDb();
  if (!db) { memoryCache.set(key, blob); return; }
  await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ key, blob, createdAt: new Date().toISOString() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
export const clipKey = (postId, prompt) => `${postId}:${hash(String(prompt || ''))}`;

// Used when no AI-written motion exists: the traveller's own note guides it.
export function fallbackMotion(note = '') {
  const clean = String(note).replace(/\s+/g, ' ').trim().slice(0, 180);
  return `Bring this photo gently to life with the natural motion of the moment${clean ? ` described as: "${clean}"` : ''}. Subtle movement of people, animals, food, water or light, slight handheld camera.`;
}

const wait = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

/**
 * items:   [{ postId, image (JPEG data URL), prompt }]
 * request: (action, payload) => Promise — start/status/download (requestAnimation)
 * onUpdate(postId, { status, blob?, error? }) — status: cached | queued | generating | ready | failed
 * Resolves to { [postId]: Blob } for every clip that is available.
 */
export async function animateMemories(items, {
  request, onUpdate = () => {}, concurrency = 3, pollMs = 4000, timeoutMs = 8 * 60 * 1000, signal,
  readCache = readCachedClip, writeCache = writeCachedClip,
} = {}) {
  const clips = {};
  const pending = [];
  for (const item of items) {
    const cached = await readCache(clipKey(item.postId, item.prompt));
    if (cached) { clips[item.postId] = cached; onUpdate(item.postId, { status: 'cached', blob: cached }); } else { pending.push(item); onUpdate(item.postId, { status: 'queued' }); }
  }

  const runOne = async (item) => {
    try {
      onUpdate(item.postId, { status: 'generating' });
      const { jobId } = await request('start', { image: item.image, prompt: item.prompt });
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (signal?.aborted) throw new Error('Stopped.');
        if (Date.now() > deadline) throw new Error('Timed out.');
        await wait(pollMs);
        const { status, error } = await request('status', { jobId });
        if (status === 'succeeded') break;
        if (status === 'failed' || status === 'canceled') throw new Error(error || `Generation ${status}.`);
      }
      const blob = await request('download', { jobId });
      await writeCache(clipKey(item.postId, item.prompt), blob);
      clips[item.postId] = blob;
      onUpdate(item.postId, { status: 'ready', blob });
    } catch (error) {
      onUpdate(item.postId, { status: 'failed', error: error?.message || String(error) });
    }
  };

  // Small worker pool: a few jobs at once keeps cost and rate limits in check.
  const queue = [...pending];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await runOne(queue.shift());
  }));
  return clips;
}
