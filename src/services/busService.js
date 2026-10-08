// Bus mode: search a stop, list every route through it, show the one picked.
//
// Data comes from public/bus/bus-data.json, built from DATA.GOV.HK by
// `npm run build:bus-data` (KMB + Citybus). It is loaded once, on first use.
// Our narrated demo route (Citybus 1 → Happy Valley) keeps its stories: when
// that route is picked, the caller gets the demo route instead.

const OPERATOR_NAMES = {
  KMB: { en: 'KMB', 'zh-HK': '九巴', 'zh-CN': '九巴' },
  CTB: { en: 'Citybus', 'zh-HK': '城巴', 'zh-CN': '城巴' },
};
export const operatorName = (op, language = 'zh-CN') => OPERATOR_NAMES[op]?.[language] || op;

let loading = null;
export function loadBusData(url = `${import.meta.env?.BASE_URL || '/'}bus/bus-data.json`) {
  if (!loading) {
    const missing = (why) => Object.assign(new Error(`Bus data missing (${why})`), { code: 'missing' });
    loading = fetch(url)
      .then(async (res) => {
        if (!res.ok) throw missing(`HTTP ${res.status}`);
        // A dev server answers a missing file with the app's index.html (200),
        // so check that we really got the JSON data file.
        const text = await res.text();
        let raw;
        try { raw = JSON.parse(text); } catch { throw missing('not JSON'); }
        if (!Array.isArray(raw?.stops) || !Array.isArray(raw?.routes)) throw missing('unexpected format');
        return raw;
      })
      .then(indexBusData)
      .catch((error) => { loading = null; throw error; });
  }
  return loading;
}

const squash = (text) => String(text || '').toLowerCase().replace(/[\s·・()（）\-_,，.。&＆'’/]/g, '');
// "中環碼頭 (CE123)" / "STAR FERRY (TS941)" → drop the stop code for grouping.
const cleanName = (name) => String(name || '').replace(/\s*[(（][A-Z]{1,3}\d{1,4}[)）]\s*$/i, '').trim();
const km = (a, b) => {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

// Stops of either company with the same name within ~200 m become one group,
// so "Central (Exchange Square)" appears once with all its routes.
export function indexBusData(raw) {
  const stops = raw.stops.map(([id, op, tc, sc, en, lat, lng], index) => ({
    index, id, op, lat, lng, tc: cleanName(tc), sc: cleanName(sc), en: cleanName(en),
  }));
  const routes = raw.routes.map(([op, route, bound, serviceType, oTc, oSc, oEn, dTc, dSc, dEn, stopIdx], index) => ({
    index, op, route, bound, serviceType, stopIdx,
    orig: { tc: oTc, sc: oSc || oTc, en: oEn }, dest: { tc: dTc, sc: dSc || dTc, en: dEn },
  }));
  const routesByStop = new Map();
  routes.forEach((r) => r.stopIdx.forEach((i) => {
    if (!routesByStop.has(i)) routesByStop.set(i, new Set());
    routesByStop.get(i).add(r.index);
  }));

  const groups = [];
  const byName = new Map();
  for (const stop of stops) {
    const key = squash(stop.tc || stop.en);
    const near = (byName.get(key) || []).find((g) => km(g, stop) < 0.2);
    if (near) {
      near.stops.push(stop);
      // Prefer "Central (Exchange Square)" over KMB's "CENTRAL (EXCHANGE SQUARE)".
      if (near.en === near.en.toUpperCase() && /[a-z]/.test(stop.en)) near.en = stop.en;
      continue;
    }
    const group = { id: `g${groups.length}`, tc: stop.tc, sc: stop.sc || stop.tc, en: stop.en, lat: stop.lat, lng: stop.lng, stops: [stop] };
    groups.push(group);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(group);
  }
  for (const g of groups) {
    g.names = [g.tc, g.sc, g.en].map(squash).filter(Boolean);
    g.routeCount = new Set(g.stops.flatMap((s) => [...(routesByStop.get(s.index) || [])])).size;
  }
  return { stops, routes, groups, routesByStop, generatedAt: raw.generatedAt };
}

export function searchStops(data, query, limit = 8) {
  const q = squash(query);
  if (!q || !data) return [];
  const scored = [];
  for (const g of data.groups) {
    if (!g.routeCount) continue;
    let best = Infinity;
    for (const name of g.names) {
      if (name === q) best = Math.min(best, 0);
      else if (name.startsWith(q)) best = Math.min(best, 1);
      else if (name.includes(q)) best = Math.min(best, 2);
    }
    if (best < Infinity) scored.push({ g, best });
  }
  // Better match first; on a tie, the busier stop (more routes) first.
  scored.sort((a, b) => a.best - b.best || b.g.routeCount - a.g.routeCount);
  return scored.slice(0, limit).map(({ g }) => g);
}

const routeOrder = (a, b) => {
  const num = (r) => parseInt(r.route, 10) || 9999;
  return num(a) - num(b) || a.route.localeCompare(b.route) || a.op.localeCompare(b.op) || a.bound.localeCompare(b.bound);
};

// Every route variant that calls at any stop of the group (main service first).
export function routesAtGroup(data, group) {
  const seen = new Map();
  for (const stop of group.stops) {
    for (const ri of data.routesByStop.get(stop.index) || []) {
      const r = data.routes[ri];
      const key = `${r.op}|${r.route}|${r.bound}`;
      const kept = seen.get(key);
      if (!kept || Number(r.serviceType) < Number(kept.serviceType)) seen.set(key, r);
    }
  }
  return [...seen.values()].sort(routeOrder);
}

export const nameIn = (named, language = 'zh-CN') => (language === 'en' ? named.en || named.tc : language === 'zh-HK' ? named.tc || named.sc : named.sc || named.tc);

// Is this the narrated demo route (Citybus 1 towards Happy Valley)?
export const isDemoRoute = (r) => r.op === 'CTB' && r.route === '1' && /跑馬地|跑马地|happy valley/i.test(`${r.dest.tc} ${r.dest.en}`);

// A route object the map can draw: a line through its stops, in order.
export function routeForMap(data, r, language = 'zh-CN') {
  const stops = r.stopIdx.map((i) => data.stops[i]).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, nameEn: s.en, nameZh: s.sc || s.tc, nameZhHK: s.tc }));
  return {
    id: `${r.op}-${r.route}-${r.bound}-${r.serviceType}`,
    operator: operatorName(r.op, 'en'),
    operatorCode: r.op,
    routeNumber: r.route,
    nameZh: `${nameIn(r.orig, 'zh-CN')} → ${nameIn(r.dest, 'zh-CN')}`,
    nameEn: `${r.orig.en} → ${r.dest.en}`,
    destination: nameIn(r.dest, language),
    path: stops.map((s) => [s.lat, s.lng]),
    pathIsStops: true, // draw straight through the stops; no road routing
    busStops: stops,
    storyPoints: [],
    estimatedDurationMin: Math.max(5, Math.round(stops.length * 1.6)),
  };
}
