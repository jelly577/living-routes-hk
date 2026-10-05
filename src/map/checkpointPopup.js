// Shared popup content for check-in points and map-picked places.
// Built as a DOM element (not an HTML string) so the "Post here" button can
// call back into React without global handlers. Used by both map engines.
import { placeName, t } from '../i18n.js';

export function placePopupElement(place, { onPost, eyebrow } = {}) {
  const root = document.createElement('div');
  root.className = 'lr-popup lr-cp-popup';

  const label = document.createElement('span');
  label.className = 'lr-popup-eyebrow';
  label.textContent = eyebrow
    || (place.kind === 'district' ? t('loc.stories', { count: place.postCount }) : place.kind === 'user-place'
      ? t('cp.eyebrowUser')
      : `${t('cp.eyebrow')} · ${t(`cp.cat.${place.category}`)}`);
  root.appendChild(label);

  const title = document.createElement('strong');
  title.textContent = placeName(place);
  root.appendChild(title);

  if (place.noteKey) {
    const note = document.createElement('em');
    note.textContent = t(place.noteKey);
    root.appendChild(note);
  }

  if (place.coordinateStatus === 'approximate') {
    const approx = document.createElement('small');
    approx.textContent = t('cp.coordApprox');
    root.appendChild(approx);
  }

  if (onPost) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lr-popup-post';
    button.textContent = t(place.kind === 'district' ? 'loc.browse' : 'mapui.postHere');
    button.addEventListener('click', () => onPost(place));
    root.appendChild(button);
  }
  return root;
}

export function loadingPopupElement(text) {
  const root = document.createElement('div');
  root.className = 'lr-popup';
  const small = document.createElement('small');
  small.textContent = text;
  root.appendChild(small);
  return root;
}

// Short display name from a long geocoder address: "12 Foo St, Wan Chai, HK" → "12 Foo St".
export const shortAddress = (address) => String(address || '').split(',')[0].trim() || address;
