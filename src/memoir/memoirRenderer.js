// Canvas renderer for the travel-memoir video.
//
// The map is a stylised Hong Kong basemap (no tiles, so the canvas never gets
// tainted and can be recorded). The camera travels from stop to stop along a
// dashed route; at each stop a card rises with that place's photos and
// captions, then the camera moves on. Everything is a pure function of time:
// drawMemoirFrame(ctx, plan, t) can be called for preview, scrubbing or
// recording alike.
import { HK_FRAME, HK_LAND, MAINLAND_LAND } from '../data/hkOutline.js';

export const VIDEO_SIZE = { width: 720, height: 1280 };

const C = {
  sea: '#cfdcd5',
  seaDeep: '#bccfc6',
  grid: 'rgba(23,62,49,0.07)',
  mainland: '#e2dccd',
  land: '#f4efe4',
  coast: '#b8ab95',
  shadow: 'rgba(23,62,49,0.12)',
  ink: '#173e31',
  inkSoft: '#5f6e67',
  accent: '#c4502f',
  paper: '#f8f5ee',
  white: '#ffffff',
};
const SERIF = '"DM Serif Display", "Noto Serif SC", "Noto Serif CJK SC", "Noto Serif TC", "Songti SC", "Songti TC", serif';
const SANS = '"DM Sans", "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans TC", "PingFang SC", "PingFang HK", sans-serif';

const DUR = {
  intro: 3.4,
  firstTravel: 2.4,
  travel: 2.8,
  hop: 1.2, // next stop at (nearly) the same spot
  memory: 4.6,
  outro: 4.0,
};
const CARD_IN = 0.55;
const CARD_OUT = 0.45;
const CLIP_START = 0.3; // clip starts once the card has mostly risen
const COS_LAT = Math.cos((22.3 * Math.PI) / 180);

// ── maths ─────────────────────────────────────────────────────────────────
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const spanKm = (a, b) => Math.hypot((b.lng - a.lng) * COS_LAT, b.lat - a.lat) * 111;

function fitScale(points, width, height, pad = 0.22) {
  // pixels per degree of latitude so that every point fits with padding
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const dLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.012);
  const dLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * COS_LAT, 0.012);
  return Math.min((width * (1 - pad * 2)) / dLng, (height * (1 - pad * 2)) / dLat);
}

const centerOf = (points) => ({
  lat: (Math.min(...points.map((p) => p.lat)) + Math.max(...points.map((p) => p.lat))) / 2,
  lng: (Math.min(...points.map((p) => p.lng)) + Math.max(...points.map((p) => p.lng))) / 2,
});

// Control point of the gentle arc between two stops (alternating sides).
function arcControl(a, b, index) {
  const mx = (a.lng + b.lng) / 2;
  const my = (a.lat + b.lat) / 2;
  const dx = (b.lng - a.lng) * COS_LAT;
  const dy = b.lat - a.lat;
  const side = index % 2 === 0 ? 1 : -1;
  return { lng: mx + (-dy * 0.22 * side) / COS_LAT, lat: my + dx * 0.22 * side };
}
const bezier = (a, c, b, t) => ({
  lat: (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * c.lat + t * t * b.lat,
  lng: (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * c.lng + t * t * b.lng,
});

// ── plan: stops + script → timed segments ─────────────────────────────────
export function createMemoirPlan({ stops, script, images = {}, clips = {}, labels = {}, size = VIDEO_SIZE }) {
  const { width, height } = size;
  const byStop = new Map((script?.stops || []).map((stop) => [stop.stopId, stop]));
  const planStops = stops.map((stop, index) => {
    const scripted = byStop.get(stop.id);
    const captions = new Map((scripted?.memories || []).map((m) => [m.postId, m.caption]));
    return {
      id: stop.id,
      index,
      lat: stop.lat,
      lng: stop.lng,
      day: stop.day,
      title: scripted?.title || '',
      memories: stop.memories.map(({ post, day }) => ({
        postId: post.id,
        day,
        caption: captions.get(post.id) || post.text || '',
        image: images[post.id] || null,
        clip: clips[post.id] || null, // HTMLVideoElement of the animated photo
      })),
    };
  });

  const overviewScale = Math.min(fitScale(planStops, width, height * 0.72, 0.18), fitScale(planStops, width, height, 0.12));
  const overview = { ...centerOf(planStops), k: overviewScale };
  const focusK = Math.max(overviewScale, width / (0.075 * COS_LAT)); // ~8 km across
  const days = [...new Set(planStops.map((s) => s.day).filter(Boolean))].sort();

  const segments = [];
  let t = 0;
  const push = (seg, duration) => { segments.push({ ...seg, start: t, end: t + duration }); t += duration; };
  push({ type: 'intro' }, DUR.intro);
  planStops.forEach((stop, index) => {
    const prev = planStops[index - 1];
    const close = prev && spanKm(prev, stop) < 0.05;
    push({ type: 'travel', stopIndex: index, from: prev ? 'stop' : 'overview' }, index === 0 ? DUR.firstTravel : close ? DUR.hop : DUR.travel);
    // A motion clip sets the memory's length (plus a moment to read the caption).
    stop.memories.forEach((memory, memoryIndex) => push({ type: 'memory', stopIndex: index, memoryIndex }, memoryDuration(memory)));
  });
  push({ type: 'outro' }, DUR.outro);

  return {
    width,
    height,
    stops: planStops,
    days,
    overview,
    focusK,
    segments,
    duration: t,
    title: script?.title || '',
    subtitle: script?.subtitle || '',
    closing: script?.closing || '',
    brand: labels.brand || 'LIVING ROUTES HK · 城市聲線',
    labels,
  };
}

function memoryDuration(memory) {
  const length = memory.clip?.duration;
  return memory.clip && Number.isFinite(length) && length > 0 ? clamp(length + CLIP_START + 0.4, DUR.memory, 7.5) : DUR.memory;
}

// Which clip should be showing at `time`, and where inside it (seconds).
export function clipAt(plan, time) {
  const seg = segmentAt(plan, time);
  if (seg.type !== 'memory') return null;
  const clip = plan.stops[seg.stopIndex].memories[seg.memoryIndex].clip;
  if (!clip) return null;
  const length = Number.isFinite(clip.duration) ? clip.duration : Infinity;
  return { clip, position: clamp(time - seg.start - CLIP_START, 0, Math.max(0, length - 0.05)) };
}

export const allClips = (plan) => plan.stops.flatMap((stop) => stop.memories.map((memory) => memory.clip).filter(Boolean));

export function segmentAt(plan, time) {
  const t = clamp(time, 0, plan.duration - 1e-6);
  return plan.segments.find((seg) => t >= seg.start && t < seg.end) || plan.segments[plan.segments.length - 1];
}

// ── camera & route state at time t ────────────────────────────────────────
function stateAt(plan, time) {
  const seg = segmentAt(plan, time);
  const local = (time - seg.start) / (seg.end - seg.start);
  const { overview, focusK, stops, height } = plan;
  const focusOffset = height * 0.24; // stop sits in the upper part while a card is open
  const travelOffset = height * 0.44;
  const state = { seg, local, legsDone: 0, legProgress: 0, traveller: null, card: 0, overlay: 0 };

  if (seg.type === 'intro') {
    Object.assign(state, { cam: { ...overview, y: height * 0.56 }, overlay: 1 - easeInOut(clamp((local - 0.72) / 0.28)) });
  } else if (seg.type === 'travel') {
    const stop = stops[seg.stopIndex];
    const e = easeInOut(local);
    state.legsDone = seg.stopIndex - 1;
    if (seg.from === 'overview') {
      const k = Math.exp(lerp(Math.log(overview.k), Math.log(focusK), e));
      state.cam = { lat: lerp(overview.lat, stop.lat, e), lng: lerp(overview.lng, stop.lng, e), k, y: lerp(height * 0.56, travelOffset, e) };
      state.traveller = { lat: stop.lat, lng: stop.lng, alpha: clamp(local * 3) };
      state.legsDone = 0;
    } else {
      const prev = stops[seg.stopIndex - 1];
      const control = arcControl(prev, stop, seg.stopIndex);
      const both = [prev, stop, control];
      const midK = Math.min(focusK, fitScale(both, plan.width, plan.height * 0.6, 0.2));
      const zoom = Math.sin(Math.PI * local);
      const k = Math.exp(lerp(Math.log(focusK), Math.log(midK), zoom));
      const centre = bezier(prev, control, stop, e);
      // Leave the card position early in the move, settle at the end.
      const y = local < 0.25 ? lerp(focusOffset, travelOffset, easeInOut(local / 0.25)) : travelOffset;
      state.cam = { lat: centre.lat, lng: centre.lng, k, y };
      state.legProgress = e;
      state.traveller = { ...bezier(prev, control, stop, e), alpha: 1 };
    }
  } else if (seg.type === 'memory') {
    const stop = stops[seg.stopIndex];
    const memories = stop.memories.length;
    const first = seg.memoryIndex === 0;
    const last = seg.memoryIndex === memories - 1;
    const seconds = (time - seg.start);
    const span = seg.end - seg.start;
    const cardIn = first ? easeOut(clamp(seconds / CARD_IN)) : 1;
    const cardOut = last ? 1 - easeInOut(clamp((seconds - (span - CARD_OUT)) / CARD_OUT)) : 1;
    state.card = Math.min(cardIn, cardOut);
    const y = lerp(travelOffset, focusOffset, first ? easeInOut(clamp(seconds / CARD_IN)) : 1);
    state.cam = { lat: stop.lat, lng: stop.lng, k: focusK, y };
    state.legsDone = seg.stopIndex;
    state.traveller = { lat: stop.lat, lng: stop.lng, alpha: 1 };
  } else {
    const lastStop = stops[stops.length - 1];
    const e = easeInOut(clamp(local / 0.55));
    const k = Math.exp(lerp(Math.log(focusK), Math.log(overview.k), e));
    state.cam = { lat: lerp(lastStop.lat, overview.lat, e), lng: lerp(lastStop.lng, overview.lng, e), k, y: lerp(focusOffset, height * 0.5, e) };
    state.legsDone = stops.length - 1;
    state.overlay = easeInOut(clamp((local - 0.3) / 0.35));
  }
  return state;
}

// ── drawing helpers ───────────────────────────────────────────────────────
function projector(plan, cam) {
  return (p) => ({
    x: plan.width / 2 + (p.lng - cam.lng) * cam.k * COS_LAT,
    y: cam.y - (p.lat - cam.lat) * cam.k,
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const NO_LINE_START = /^[，。、！？；：,.!?;:」』）)》〉…—%]$/;
const isCjk = (ch) => /[⺀-鿿豈-﫿＀-￯　-〿]/.test(ch);

// Line breaking that works for both Chinese (per character) and English (per word).
export function wrapText(ctx, text, maxWidth, maxLines = 4) {
  const tokens = [];
  let word = '';
  for (const ch of String(text || '')) {
    if (isCjk(ch)) { if (word) { tokens.push(word); word = ''; } tokens.push(ch); } else if (ch === ' ') { if (word) tokens.push(word); tokens.push(' '); word = ''; } else word += ch;
  }
  if (word) tokens.push(word);
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const next = line + token;
    // Never start a line with closing punctuation (。，、！？ etc.).
    if (ctx.measureText(next.trim()).width > maxWidth && line.trim() && !NO_LINE_START.test(token)) {
      lines.push(line.trim());
      line = token === ' ' ? '' : token;
    } else line = next;
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let tail = kept[maxLines - 1];
    while (tail && ctx.measureText(`${tail}…`).width > maxWidth) tail = tail.slice(0, -1);
    kept[maxLines - 1] = `${tail}…`;
    return kept;
  }
  return lines;
}

const shortDay = (day) => (day ? `${day.slice(5, 7)}.${day.slice(8, 10)}` : '');

function drawBasemap(ctx, plan, cam, project) {
  const { width, height } = plan;
  const sea = ctx.createLinearGradient(0, 0, 0, height);
  sea.addColorStop(0, C.sea);
  sea.addColorStop(1, C.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, width, height);

  // Faint graticule every 0.05° — gives the sea a printed-map texture.
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  const step = 0.05;
  for (let lng = Math.floor(HK_FRAME.west / step) * step; lng <= HK_FRAME.east + 0.2; lng += step) {
    const { x } = project({ lat: cam.lat, lng });
    if (x < -2 || x > width + 2) continue;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let lat = Math.floor(HK_FRAME.south / step) * step; lat <= HK_FRAME.north + 0.2; lat += step) {
    const { y } = project({ lat, lng: cam.lng });
    if (y < -2 || y > height + 2) continue;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  const path = (rings) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([lng, lat], i) => {
        const p = project({ lat, lng });
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
    }
  };
  path(MAINLAND_LAND);
  ctx.fillStyle = C.mainland;
  ctx.fill();

  ctx.save();
  ctx.translate(0, Math.max(2, cam.k / 900));
  path(HK_LAND);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.restore();
  path(HK_LAND);
  ctx.fillStyle = C.land;
  ctx.fill();
  ctx.strokeStyle = C.coast;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawRoute(ctx, plan, state, project) {
  const { stops } = plan;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const legs = [];
  for (let i = 1; i < stops.length; i += 1) legs.push({ a: stops[i - 1], b: stops[i], c: arcControl(stops[i - 1], stops[i], i), i });

  // Full route preview, faint and dashed.
  ctx.setLineDash([2, 12]);
  ctx.strokeStyle = 'rgba(23,62,49,0.28)';
  ctx.lineWidth = 3;
  for (const leg of legs) {
    const a = project(leg.a); const b = project(leg.b); const c = project(leg.c);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Travelled part, solid accent.
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 5;
  legs.forEach((leg, n) => {
    const legIndex = n + 1;
    let upto = 0;
    if (legIndex <= state.legsDone) upto = 1;
    else if (state.seg.type === 'travel' && legIndex === state.seg.stopIndex && state.seg.from === 'stop') upto = state.legProgress;
    if (upto <= 0) return;
    ctx.beginPath();
    const steps = 40;
    for (let s = 0; s <= steps; s += 1) {
      const p = project(bezier(leg.a, leg.c, leg.b, (s / steps) * upto));
      if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  });
}

function drawPill(ctx, x, y, text, { bg = C.paper, fg = C.ink, size = 20, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `700 ${size}px ${SANS}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.shadowColor = 'rgba(23,62,49,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
  return { x: x - w / 2, y: y - h / 2, w, h };
}

function pillRect(ctx, x, y, text, size) {
  ctx.save();
  ctx.font = `700 ${size}px ${SANS}`;
  const w = ctx.measureText(text).width + size * 1.1;
  ctx.restore();
  const h = size * 1.7;
  return { x: x - w / 2, y: y - h / 2, w, h };
}
const overlaps = (a, b) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;

function drawStops(ctx, plan, state, project, time) {
  const reached = state.seg.type === 'outro' ? plan.stops.length - 1
    : state.seg.type === 'memory' ? state.seg.stopIndex
      : state.seg.type === 'travel' ? state.seg.stopIndex - (state.local < 0.98 ? 1 : 0) : -1;
  const pills = [];
  plan.stops.forEach((stop, i) => {
    const p = project(stop);
    const done = i <= reached;
    const current = i === reached && state.seg.type !== 'outro';
    const r = current ? 17 : 13;
    if (done && stop.day) pills.push({ x: p.x, y: p.y - r - 22, text: shortDay(stop.day), current, order: i });
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = done ? C.ink : 'rgba(248,245,238,0.9)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = done ? C.paper : 'rgba(23,62,49,0.45)';
    ctx.stroke();
    ctx.fillStyle = done ? C.paper : C.ink;
    ctx.font = `700 ${current ? 17 : 14}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), p.x, p.y + 1);
  });
  // The date travels with the route: each reached stop keeps its date label.
  // The current stop wins; otherwise later stops win; colliding labels are skipped.
  const placed = [];
  pills.sort((a, b) => (b.current - a.current) || (b.order - a.order)).forEach((pill) => {
    const size = pill.current ? 19 : 15;
    const rect = pillRect(ctx, pill.x, pill.y, pill.text, size);
    if (placed.some((other) => overlaps(rect, other))) return;
    placed.push(rect);
    drawPill(ctx, pill.x, pill.y, pill.text, { size, bg: pill.current ? C.accent : C.paper, fg: pill.current ? C.white : C.ink });
  });

  if (state.traveller && state.seg.type !== 'outro') {
    const p = project(state.traveller);
    const pulse = (time * 1.4) % 1;
    ctx.save();
    ctx.globalAlpha = state.traveller.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12 + pulse * 26, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(196,80,47,${0.32 * (1 - pulse)})`;
    ctx.fill();
    if (state.seg.type === 'travel') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = C.accent;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.white;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCover(ctx, image, x, y, w, h, zoom, panX = 0, panY = 0) {
  const iw = image.naturalWidth || image.videoWidth || image.width;
  const ih = image.naturalHeight || image.videoHeight || image.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, x + (w - dw) / 2 + panX * (dw - w) / 2, y + (h - dh) / 2 + panY * (dh - h) / 2, dw, dh);
}

function drawTopTitle(ctx, plan, state) {
  if (!['travel', 'memory'].includes(state.seg.type)) return;
  const stop = plan.stops[state.seg.stopIndex];
  const appear = state.seg.type === 'travel' ? easeOut(clamp((state.local - 0.55) / 0.45)) : 1;
  if (appear <= 0) return;
  const { width } = plan;
  const fade = ctx.createLinearGradient(0, 0, 0, 230);
  fade.addColorStop(0, 'rgba(248,245,238,0.96)');
  fade.addColorStop(1, 'rgba(248,245,238,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, 230);
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.translate(0, (1 - appear) * 14);
  const dayNumber = plan.days.indexOf(stop.day) + 1;
  ctx.fillStyle = C.accent;
  ctx.font = `700 20px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const dayLabel = dayNumber > 0 ? (plan.labels.day ? plan.labels.day(dayNumber) : `DAY ${dayNumber}`) : '';
  ctx.fillText([dayLabel, stop.day ? stop.day.replaceAll('-', '.') : ''].filter(Boolean).join('  ·  '), 48, 82);
  ctx.fillStyle = C.ink;
  ctx.font = `46px ${SERIF}`;
  const [line] = wrapText(ctx, stop.title, width - 96, 1);
  ctx.fillText(line || '', 48, 138);
  ctx.restore();
}

function drawCard(ctx, plan, state, time) {
  if (state.seg.type !== 'memory' || state.card <= 0) return;
  const { width, height } = plan;
  const stop = plan.stops[state.seg.stopIndex];
  const memory = stop.memories[state.seg.memoryIndex];
  const seconds = time - state.seg.start;
  const span = state.seg.end - state.seg.start;

  const cardTop = height * 0.38;
  const y = cardTop + (1 - state.card) * (height - cardTop + 40);
  const x = 28;
  const w = width - 56;
  const h = height - cardTop - 30;

  ctx.save();
  ctx.shadowColor = 'rgba(23,62,49,0.28)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, x, y, w, h, 34);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.restore();

  // Crossfade between memories of the same stop.
  const fadeIn = state.seg.memoryIndex === 0 ? 1 : easeInOut(clamp(seconds / 0.5));
  ctx.save();
  ctx.globalAlpha = fadeIn;
  const photoX = x + 22;
  const photoY = y + 22;
  const photoW = w - 44;
  const visual = memory.clip && memory.clip.readyState >= 2 ? memory.clip : memory.image;
  const photoH = visual ? Math.round(photoW * 0.66) : 0;
  if (visual) {
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 22);
    ctx.clip();
    const progress = clamp(seconds / span);
    const direction = (state.seg.memoryIndex + state.seg.stopIndex) % 2 === 0 ? 1 : -1;
    if (visual === memory.clip) drawCover(ctx, visual, photoX, photoY, photoW, photoH, 1.02, 0, 0); // the clip carries its own motion
    else drawCover(ctx, visual, photoX, photoY, photoW, photoH, 1.04 + 0.08 * progress, direction * (progress - 0.5) * 0.6, 0);
    ctx.restore();
  }

  const textX = photoX + 6;
  let textY = photoY + photoH + (visual ? 52 : 46);
  ctx.fillStyle = C.accent;
  ctx.font = `700 19px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const meta = [memory.day ? memory.day.replaceAll('-', '.') : '', stop.title].filter(Boolean).join('  ·  ');
  ctx.fillText(wrapText(ctx, meta, photoW - 12, 1)[0] || '', textX, textY);

  textY += 52;
  ctx.fillStyle = C.ink;
  const size = visual ? 33 : 40;
  ctx.font = `${size}px ${SERIF}`;
  const room = y + h - 66 - textY;
  const maxLines = Math.max(1, Math.floor(room / (size * 1.32)) + 1);
  const lines = wrapText(ctx, memory.caption, photoW - 12, Math.min(maxLines, visual ? 4 : 7));
  // Caption fades in word-group by line for a gentle "reading" rhythm.
  lines.forEach((line, i) => {
    ctx.save();
    ctx.globalAlpha *= easeOut(clamp((seconds - 0.35 - i * 0.22) / 0.5));
    ctx.fillText(line, textX, textY + i * size * 1.32);
    ctx.restore();
  });
  ctx.restore();

  // Memory dots for stops with several memories.
  if (stop.memories.length > 1) {
    const dotsY = y + h - 34;
    stop.memories.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc(width / 2 + (i - (stop.memories.length - 1) / 2) * 20, dotsY, i === state.seg.memoryIndex ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === state.seg.memoryIndex ? C.accent : 'rgba(23,62,49,0.25)';
      ctx.fill();
    });
  }
}

function drawTitleOverlay(ctx, plan, state) {
  if (state.overlay <= 0) return;
  const { width, height } = plan;
  const intro = state.seg.type === 'intro';
  ctx.save();
  ctx.globalAlpha = state.overlay;
  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, 'rgba(248,245,238,0.97)');
  veil.addColorStop(0.36, 'rgba(248,245,238,0.86)');
  veil.addColorStop(0.62, 'rgba(248,245,238,0)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = `700 19px ${SANS}`;
  ctx.fillText(plan.brand, width / 2, 150);

  ctx.fillStyle = C.ink;
  ctx.font = `64px ${SERIF}`;
  const heading = intro ? plan.title : plan.closing;
  const headingSize = intro ? 64 : 44;
  ctx.font = `${headingSize}px ${SERIF}`;
  const lines = wrapText(ctx, heading, width - 120, 3);
  lines.forEach((line, i) => ctx.fillText(line, width / 2, 250 + i * headingSize * 1.2));

  const below = 250 + lines.length * headingSize * 1.2 + 10;
  ctx.fillStyle = C.inkSoft;
  ctx.font = `600 24px ${SANS}`;
  const stats = plan.labels.stats ? plan.labels.stats(plan.stops.length, plan.days.length) : `${plan.stops.length} stops · ${plan.days.length} days`;
  ctx.fillText(intro ? plan.subtitle : stats, width / 2, below);
  if (!intro) {
    ctx.fillStyle = C.accent;
    ctx.fillText(plan.subtitle, width / 2, below + 38);
  }
  ctx.restore();
}

export function drawMemoirFrame(ctx, plan, time) {
  const state = stateAt(plan, time);
  const project = projector(plan, state.cam);
  ctx.save();
  ctx.clearRect(0, 0, plan.width, plan.height);
  drawBasemap(ctx, plan, state.cam, project);
  drawRoute(ctx, plan, state, project);
  drawStops(ctx, plan, state, project, time);
  drawTopTitle(ctx, plan, state);
  drawCard(ctx, plan, state, time);
  drawTitleOverlay(ctx, plan, state);
  ctx.restore();
  return state.seg;
}
