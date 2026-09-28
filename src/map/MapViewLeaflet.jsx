import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { escapeHtml, fetchRoadPath, reverseGeocode } from './osm.js';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function markerIcon(place) {
  const html = `<span class="lr-marker">${place.order ?? ''}</span>`;
  return L.divIcon({ className: 'lr-marker-wrap', html, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20] });
}

function popupHtml(place) {
  const imgStatus = place.image?.status === 'verified' ? '图片：已核实' : '图片：待核实';
  const coordStatus = place.coordinateStatus === 'verified' ? '坐标：已核对' : '坐标：地图目测（待实地核对）';
  const image = place.image?.url
    ? `<img class="lr-popup-image" src="${escapeHtml(place.image.url)}" alt="${escapeHtml(place.image.alt || place.nameEn)}" />`
    : '';
  const credit = place.image?.attributionRequired && place.image?.credit
    ? `<span class="lr-popup-credit">${escapeHtml(place.image.credit)}</span>`
    : '';
  return `<div class="lr-popup">
    ${image}
    <span class="lr-popup-eyebrow">HERITAGE POINT ${place.order}</span>
    <strong>${place.nameZh}</strong>
    <em>${place.nameEn}</em>
    <small>${imgStatus} · ${coordStatus}</small>
    ${credit}
  </div>`;
}

// 离线/无 key 时的兜底：Leaflet + OSM 底图 + OSRM 路线 + Nominatim 反查
export default function MapViewLeaflet({ route }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [offline, setOffline] = useState(false);
  const [roadPath, setRoadPath] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true });
    mapRef.current = map;

    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
    tiles.on('tileerror', () => setOffline(true));
    tiles.addTo(map);

    layerRef.current = L.layerGroup().addTo(map);

    const onClick = (event) => {
      const { lat, lng } = event.latlng;
      const popup = L.popup()
        .setLatLng(event.latlng)
        .setContent('<div class="lr-popup"><small>查询地名中…</small></div>')
        .openOn(map);
      reverseGeocode(lat, lng)
        .then((name) => popup.setContent(`<div class="lr-popup"><span class="lr-popup-eyebrow">你点到了这里</span><p class="lr-click-name">${escapeHtml(name)}</p></div>`))
        .catch(() => popup.setContent(`<div class="lr-popup"><span class="lr-popup-eyebrow">离线 · 仅坐标</span><strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong></div>`));
    };
    map.on('click', onClick);

    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      cancelAnimationFrame(raf);
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!route?.path?.length) return;
    let cancelled = false;
    const origin = route.path[0];
    const destination = route.path[route.path.length - 1];
    setRoadPath(null);
    fetchRoadPath({ origin, destination, storyPoints: route.storyPoints })
      .then((geometry) => { if (!cancelled) setRoadPath(geometry); })
      .catch(() => { if (!cancelled) setRoadPath(null); });
    return () => { cancelled = true; };
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !route?.path?.length) return;

    layer.clearLayers();

    const polyline = L.polyline(roadPath || route.path, { color: '#c4502f', weight: 4, opacity: 0.9 });
    polyline.addTo(layer);

    route.storyPoints?.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const marker = L.marker([place.lat, place.lng], { icon: markerIcon(place) });
      marker.bindPopup(popupHtml(place));
      marker.addTo(layer);
    });

    map.fitBounds(polyline.getBounds(), { padding: [48, 48] });
  }, [route, roadPath]);

  return (
    <>
      <div ref={containerRef} className="lr-map" />
      {offline && <div className="lr-offline">离线模式 · 仅显示路线与地点（无地图瓦片）</div>}
    </>
  );
}
