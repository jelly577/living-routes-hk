// B 的地图层外部服务：道路级路线（OSRM）+ 逆地理编码（Nominatim）。
// 两者都是开源、无需 key、跑在 OpenStreetMap 数据上的服务。
// 离线/失败时由调用方兜底（路线退回直线、反查退回显示坐标）。

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// 返回沿真实道路、依次经过 storyPoints 的路径 [[lat, lng], ...]。
// waypoint 顺序：origin → 各故事点（按 order）→ destination。
export async function fetchRoadPath({ origin, destination, storyPoints = [] }) {
  const waypoints = [origin, ...storyPoints.map((p) => [p.lng, p.lat]), destination]
    .filter((c) => c?.[0] != null && c?.[1] != null);
  if (waypoints.length < 2) throw new Error('Not enough waypoints');

  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const res = await fetch(`${OSRM_URL}${coords}?overview=full&geometries=geojson&steps=false`);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) throw new Error(`OSRM ${data.code}`);
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

// 点坐标反查地名，返回 display_name（中英双语地址）。
export async function reverseGeocode(lat, lng) {
  const res = await fetch(`${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`);
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const data = await res.json();
  if (!data.display_name) throw new Error('Nominatim: no result');
  return data.display_name;
}
