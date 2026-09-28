const DB_NAME = 'living-routes-hk';
const DB_VERSION = 1;
const STORE_NAME = 'memory-posts';

// Node-based smoke tests do not provide IndexedDB, so keep a small in-memory
// fallback. In the browser, IndexedDB is the source of truth and survives reloads.
let fallbackPosts = [];

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('visibility', 'visibility');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function readPhotoFile(file) {
  if (!file || typeof FileReader === 'undefined') return Promise.resolve(null);

  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const supportedExtension = /\.(jpe?g|png|webp)$/i.test(file.name || '');
  if (!supportedTypes.includes(file.type) && !supportedExtension) {
    return Promise.reject(new Error('Please choose a JPG, PNG or WebP image.'));
  }
  if (file.size > 12 * 1024 * 1024) {
    return Promise.reject(new Error('This photo is larger than 12 MB. Please choose a smaller image.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The browser could not read this photo.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('This image could not be opened. Please try another JPG.'));
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function saveMemoryPost(post) {
  const database = await openDatabase();
  if (!database) {
    fallbackPosts = [post, ...fallbackPosts.filter((item) => item.id !== post.id)];
    return post;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(post);
    transaction.oncomplete = () => { database.close(); resolve(post); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function listMemoryPosts() {
  const database = await openDatabase();
  if (!database) return [...fallbackPosts];

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const posts = request.result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      database.close();
      resolve(posts);
    };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}
