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

function renderPhotoStyle(source, photoStyle = 'original') {
  if (photoStyle === 'none') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('This image could not be opened. Please try another JPG.'));
    image.onload = () => {
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: photoStyle !== 'original' });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      if (['cartoon', 'cyberpunk', 'pencil'].includes(photoStyle)) {
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const original = new Uint8ClampedArray(frame.data);
        const { data } = frame;
        const width = canvas.width;
        const height = canvas.height;
        const luminance = (index) => original[index] * 0.299 + original[index + 1] * 0.587 + original[index + 2] * 0.114;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            const right = (y * width + Math.min(width - 1, x + 1)) * 4;
            const below = (Math.min(height - 1, y + 1) * width + x) * 4;
            const edge = Math.abs(luminance(index) - luminance(right)) + Math.abs(luminance(index) - luminance(below));

            if (photoStyle === 'cartoon') {
              const average = (original[index] + original[index + 1] + original[index + 2]) / 3;
              for (let channel = 0; channel < 3; channel += 1) {
                const gentlySaturated = average + (original[index + channel] - average) * 1.16;
                const illustrated = Math.round(gentlySaturated / 26) * 26;
                const detailed = original[index + channel] * 0.28 + illustrated * 0.72;
                data[index + channel] = edge > 105
                  ? Math.round(detailed * 0.7)
                  : Math.max(0, Math.min(255, detailed));
              }
            } else if (photoStyle === 'cyberpunk') {
              const average = (original[index] + original[index + 1] + original[index + 2]) / 3;
              const light = luminance(index);
              for (let channel = 0; channel < 3; channel += 1) {
                const saturated = average + (original[index + channel] - average) * 1.62;
                const blocked = Math.round(saturated / 42) * 42;
                const neonShift = channel === 2 ? (light < 145 ? 34 : 16) : channel === 0 ? 14 : -8;
                const neonValue = Math.max(0, Math.min(255, blocked + neonShift));
                data[index + channel] = edge > 48 ? Math.round(neonValue * 0.18) : neonValue;
              }
            } else {
              // Colour-pencil treatment: preserve the source hues, lift them
              // towards warm paper and add a restrained graphite-like edge.
              // The previous treatment discarded all colour and produced a
              // sparse black-and-white outline.
              const average = (original[index] + original[index + 1] + original[index + 2]) / 3;
              const grain = ((x * 17 + y * 29) % 11) - 5;
              for (let channel = 0; channel < 3; channel += 1) {
                const coloured = average + (original[index + channel] - average) * 1.18;
                const paper = channel === 0 ? 248 : channel === 1 ? 243 : 232;
                const softened = coloured * 0.62 + paper * 0.38;
                const pencilEdge = Math.min(82, edge * 0.78);
                data[index + channel] = Math.max(0, Math.min(255, softened - pencilEdge + grain));
              }
            }
          }
        }
        context.putImageData(frame, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    image.src = source;
  });
}

export function applyPhotoStyle(source, photoStyle = 'original') {
  if (!source || typeof document === 'undefined') return Promise.resolve(source || null);
  return renderPhotoStyle(source, photoStyle);
}

export function readPhotoFile(file, photoStyle = 'original') {
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
    reader.onload = () => renderPhotoStyle(reader.result, photoStyle).then(resolve, reject);
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

export async function deleteMemoryPost(id) {
  const database = await openDatabase();
  if (!database) {
    fallbackPosts = fallbackPosts.filter((post) => post.id !== id);
    return id;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(id); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}
