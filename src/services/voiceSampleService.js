// One private sample per browser/origin. Never sent to Supabase or a model.
const DB = 'living-routes-hk-private-voice';
const STORE = 'samples';
let fallback = null;
function database() {
  if (typeof indexedDB === 'undefined') {
    if (typeof window !== 'undefined') throw new Error('Private voice storage is unavailable in this browser.');
    return Promise.resolve(null); // Node tests only.
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function operation(mode, action) {
  const db = await database();
  if (!db) return action(null);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Voice storage failed.')); };
  });
}
export async function getVoiceSample() {
  return (await operation('readonly', (store) => store ? store.get('current') : fallback)) || null;
}
export async function saveVoiceSample({ audio, consent = false, name = '' } = {}) {
  if (!consent) throw new Error('Consent is required to save a voice sample.');
  if (typeof audio !== 'string' || !/^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?;base64,[A-Za-z0-9+/=]+$/i.test(audio)) throw new Error('A recorded audio sample is required.');
  if (audio.length > 7 * 1024 * 1024) throw new Error('Voice sample is too large. Please record a shorter sample.');
  const sample = { audio, name: String(name).trim().slice(0, 80), savedAt: new Date().toISOString(),
    consentForLocalStorage: true, consentVersion: 1, voiceCloneEnabled: false };
  await operation('readwrite', (store) => store ? store.put(sample, 'current') : (fallback = sample));
  return sample;
}
export async function removeVoiceSample() {
  await operation('readwrite', (store) => store ? store.delete('current') : (fallback = null));
}
