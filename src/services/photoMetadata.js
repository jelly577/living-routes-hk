// Minimal JPEG EXIF reader: capture time and GPS only.
//
// Photos are re-rendered through a canvas before they are stored (resizing and
// style filters), which strips every EXIF tag. The memoir video needs the
// original capture time and position, so read them from the untouched file
// first. GPS stays on this device: sharedCommunityService removes it from any
// public payload.

const TAG = {
  exifPointer: 0x8769,
  gpsPointer: 0x8825,
  dateTime: 0x0132,
  dateTimeOriginal: 0x9003,
  offsetTimeOriginal: 0x9011,
  gpsLatRef: 0x0001,
  gpsLat: 0x0002,
  gpsLngRef: 0x0003,
  gpsLng: 0x0004,
};
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(view, tiffStart, offset, little) {
  const entries = new Map();
  if (offset <= 0 || tiffStart + offset + 2 > view.byteLength) return entries;
  const count = view.getUint16(tiffStart + offset, little);
  for (let i = 0; i < count; i += 1) {
    const entry = tiffStart + offset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const n = view.getUint32(entry + 4, little);
    const size = (TYPE_SIZE[type] || 1) * n;
    const valueOffset = size > 4 ? tiffStart + view.getUint32(entry + 8, little) : entry + 8;
    if (valueOffset + size > view.byteLength) continue;
    entries.set(tag, { type, n, at: valueOffset });
  }
  return entries;
}

function readAscii(view, entry) {
  if (!entry) return null;
  let text = '';
  for (let i = 0; i < entry.n; i += 1) {
    const code = view.getUint8(entry.at + i);
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text.trim() || null;
}

function readRationals(view, entry, little) {
  if (!entry || entry.type !== 5) return null;
  const values = [];
  for (let i = 0; i < entry.n; i += 1) {
    const num = view.getUint32(entry.at + i * 8, little);
    const den = view.getUint32(entry.at + i * 8 + 4, little);
    values.push(den ? num / den : 0);
  }
  return values;
}

const toDegrees = (dms) => (dms && dms.length >= 3 ? dms[0] + dms[1] / 60 + dms[2] / 3600 : null);

// "2026:10:03 14:22:05" (+ optional "+08:00") → ISO string, or null.
export function exifDateToIso(value, offset) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value || '');
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  if (y === '0000') return null;
  const local = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  // Without an offset tag the camera's clock is assumed to be in this device's zone.
  const date = new Date(/^[+-]\d{2}:\d{2}$/.test(offset || '') ? `${local}${offset}` : local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseExif(buffer) {
  const empty = { takenAt: null, gps: null };
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty;
  let pos = 2;
  while (pos + 4 <= view.byteLength) {
    const marker = view.getUint16(pos);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break; // start of scan: no more metadata
    const length = view.getUint16(pos + 2);
    const isExif = marker === 0xffe1 && pos + 10 <= view.byteLength
      && view.getUint32(pos + 4) === 0x45786966 && view.getUint16(pos + 8) === 0; // "Exif\0\0"
    if (isExif) {
      const tiff = pos + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, little), little);
      const exifIfd = ifd0.has(TAG.exifPointer)
        ? readIfd(view, tiff, view.getUint32(ifd0.get(TAG.exifPointer).at, little), little) : new Map();
      const gpsIfd = ifd0.has(TAG.gpsPointer)
        ? readIfd(view, tiff, view.getUint32(ifd0.get(TAG.gpsPointer).at, little), little) : new Map();

      const takenAt = exifDateToIso(
        readAscii(view, exifIfd.get(TAG.dateTimeOriginal)) || readAscii(view, ifd0.get(TAG.dateTime)),
        readAscii(view, exifIfd.get(TAG.offsetTimeOriginal)),
      );
      let gps = null;
      const lat = toDegrees(readRationals(view, gpsIfd.get(TAG.gpsLat), little));
      const lng = toDegrees(readRationals(view, gpsIfd.get(TAG.gpsLng), little));
      if (lat != null && lng != null && !(lat === 0 && lng === 0)) {
        const latSign = readAscii(view, gpsIfd.get(TAG.gpsLatRef)) === 'S' ? -1 : 1;
        const lngSign = readAscii(view, gpsIfd.get(TAG.gpsLngRef)) === 'W' ? -1 : 1;
        gps = { lat: Math.round(latSign * lat * 1e6) / 1e6, lng: Math.round(lngSign * lng * 1e6) / 1e6 };
      }
      return { takenAt, gps };
    }
    pos += 2 + length;
  }
  return empty;
}

export async function readPhotoMetadata(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return { takenAt: null, gps: null };
  try {
    // EXIF lives in the first APP1 segment, at most 64 KB into the file.
    const head = file.slice ? file.slice(0, 256 * 1024) : file;
    return parseExif(await head.arrayBuffer());
  } catch {
    return { takenAt: null, gps: null };
  }
}

const localDay = (iso) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// `userValue` may be a full timestamp or a date-only "YYYY-MM-DD" from a date
// picker. A date-only value keeps the photo's exact time when both agree on
// the day, otherwise it means local noon of that day (no timezone drift).
export function resolveTakenAt(userValue, photoTakenAt) {
  if (userValue && /^\d{4}-\d{2}-\d{2}$/.test(userValue)) {
    if (photoTakenAt && localDay(photoTakenAt) === userValue) return { takenAt: photoTakenAt, takenAtSource: 'photo' };
    const noon = new Date(`${userValue}T12:00:00`);
    if (!Number.isNaN(noon.getTime())) return { takenAt: noon.toISOString(), takenAtSource: 'user' };
  } else if (userValue) {
    const date = new Date(userValue);
    if (!Number.isNaN(date.getTime())) return { takenAt: date.toISOString(), takenAtSource: 'user' };
  }
  return photoTakenAt ? { takenAt: photoTakenAt, takenAtSource: 'photo' } : { takenAt: null, takenAtSource: 'posted' };
}
