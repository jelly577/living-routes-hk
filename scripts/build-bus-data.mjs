#!/usr/bin/env node
// Builds public/bus/bus-data.json: every KMB and Citybus stop and route, from
// the Transport Department's open data (DATA.GOV.HK). Run it once, and again
// whenever routes change:
//
//   npm run build:bus-data
//
// KMB:     https://data.etabus.gov.hk/v1/transport/kmb/{stop|route|route-stop}
// Citybus: https://rt.data.gov.hk/v2/transport/citybus/{route|route-stop|stop}
//
// Output (compact, so the app can load it in one request):
//   stops:  [[id, operator, name_tc, name_sc, name_en, lat, lng], …]
//   routes: [[operator, route, bound, serviceType, orig_tc, orig_sc, orig_en,
//             dest_tc, dest_sc, dest_en, [stopIndex, …]], …]
import { mkdir, writeFile } from 'node:fs/promises';

const KMB = 'https://data.etabus.gov.hk/v1/transport/kmb';
const CTB = 'https://rt.data.gov.hk/v2/transport/citybus';
const OUT = new URL('../public/bus/bus-data.json', import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function getJson(url, tries = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt >= tries) throw new Error(`${url}: ${error.message}`);
      await sleep(500 * attempt);
    }
  }
}
// Run `task` over `items` with a small worker pool (be gentle with the API).
async function pool(items, size, task, label) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
      done += 1;
      if (label && done % 200 === 0) console.log(`  ${label}: ${done}/${items.length}`);
    }
  }));
  return results;
}

const stops = [];
const stopIndex = new Map(); // `${op}:${id}` → index
const addStop = (op, s) => {
  const key = `${op}:${s.stop}`;
  if (stopIndex.has(key)) return stopIndex.get(key);
  const lat = Number(s.lat);
  const lng = Number(s.long);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return -1;
  stops.push([s.stop, op, s.name_tc || '', s.name_sc || '', s.name_en || '', +lat.toFixed(6), +lng.toFixed(6)]);
  stopIndex.set(key, stops.length - 1);
  return stops.length - 1;
};
const routes = [];

async function buildKmb() {
  console.log('KMB: stops, routes, route-stops…');
  const [stopRes, routeRes, routeStopRes] = await Promise.all([
    getJson(`${KMB}/stop`), getJson(`${KMB}/route`), getJson(`${KMB}/route-stop`),
  ]);
  const byId = new Map(stopRes.data.map((s) => [s.stop, s]));
  const seqs = new Map(); // route|bound|service_type → [[seq, stop], …]
  for (const rs of routeStopRes.data) {
    const key = `${rs.route}|${rs.bound}|${rs.service_type}`;
    if (!seqs.has(key)) seqs.set(key, []);
    seqs.get(key).push([Number(rs.seq), rs.stop]);
  }
  for (const r of routeRes.data) {
    const list = (seqs.get(`${r.route}|${r.bound}|${r.service_type}`) || []).sort((a, b) => a[0] - b[0]);
    const idx = list.map(([, id]) => (byId.has(id) ? addStop('KMB', byId.get(id)) : -1)).filter((i) => i >= 0);
    if (idx.length < 2) continue;
    routes.push(['KMB', r.route, r.bound, r.service_type, r.orig_tc, r.orig_sc, r.orig_en, r.dest_tc, r.dest_sc, r.dest_en, idx]);
  }
  console.log(`KMB: ${routes.length} route variants`);
}

async function buildCitybus() {
  console.log('Citybus: routes…');
  const routeRes = await getJson(`${CTB}/route/ctb`);
  const jobs = routeRes.data.flatMap((r) => [{ r, dir: 'outbound', bound: 'O' }, { r, dir: 'inbound', bound: 'I' }]);
  console.log(`Citybus: stop lists for ${jobs.length} route directions…`);
  const lists = await pool(jobs, 8, async ({ r, dir }) => {
    try { return (await getJson(`${CTB}/route-stop/CTB/${encodeURIComponent(r.route)}/${dir}`)).data || []; } catch { return []; }
  }, 'route-stops');
  const stopIds = [...new Set(lists.flat().map((rs) => rs.stop))];
  console.log(`Citybus: details for ${stopIds.length} stops…`);
  const details = await pool(stopIds, 8, async (id) => {
    try { return (await getJson(`${CTB}/stop/${id}`)).data; } catch { return null; }
  }, 'stops');
  const byId = new Map(details.filter(Boolean).map((s) => [s.stop, s]));
  const before = routes.length;
  jobs.forEach(({ r, bound }, i) => {
    const list = lists[i].sort((a, b) => Number(a.seq) - Number(b.seq));
    const idx = list.map((rs) => (byId.has(rs.stop) ? addStop('CTB', byId.get(rs.stop)) : -1)).filter((x) => x >= 0);
    if (idx.length < 2) return;
    // Outbound runs orig → dest; inbound runs the other way.
    const [oTc, oSc, oEn, dTc, dSc, dEn] = bound === 'O'
      ? [r.orig_tc, r.orig_sc, r.orig_en, r.dest_tc, r.dest_sc, r.dest_en]
      : [r.dest_tc, r.dest_sc, r.dest_en, r.orig_tc, r.orig_sc, r.orig_en];
    routes.push(['CTB', r.route, bound, '1', oTc, oSc, oEn, dTc, dSc, dEn, idx]);
  });
  console.log(`Citybus: ${routes.length - before} route variants`);
}

const started = Date.now();
await buildKmb();
await buildCitybus();
await mkdir(new URL('.', OUT), { recursive: true });
const payload = { generatedAt: new Date().toISOString(), source: 'DATA.GOV.HK — KMB & Citybus open data', stops, routes };
await writeFile(OUT, JSON.stringify(payload));
console.log(`Wrote ${stops.length} stops and ${routes.length} routes to public/bus/bus-data.json in ${Math.round((Date.now() - started) / 1000)} s`);
