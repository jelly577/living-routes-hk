// 按需加载 Google Maps JavaScript API。
// key 从 Vite 环境变量读取（.env.local，已被 .gitignore 忽略，不会提交）。
import { getLanguage } from '../i18n.js';

let loadingPromise = null;

export function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadingPromise) return loadingPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_KEY'));

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // Map labels follow the interface language chosen on the first screen.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&language=${getLanguage()}&region=HK`;
    script.async = true;
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    script.onload = () => resolve(window.google.maps);
    document.head.appendChild(script);
  });
  return loadingPromise;
}
