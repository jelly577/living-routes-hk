import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { escapeHtml, fetchRoadPath, reverseGeocode } from './osm.js';
import { placeName, t } from '../i18n.js';
import { placePopupElement, shortAddress } from './checkpointPopup.js';
import { makeUserPlace } from '../data/locations.js';
import { communityMarkerSvg } from './communityMarker.js';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function markerIcon(place) {
  const html = `<span class="lr-marker">${place.order ?? ''}</span>`;
  return L.divIcon({ className: 'lr-marker-wrap', html, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20] });
}

function checkpointIcon(place) {
  if (place.kind === 'district') return L.divIcon({ className: 'lr-marker-wrap', html: `<span class="lr-district-marker">${communityMarkerSvg}</span>`, iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -19] });
  const cls = place.kind === 'user-place' ? 'lr-cp-marker is-user' : `lr-cp-marker${place.category === 'organizer' ? ' is-organizer' : ''}`;
  const size = place.kind === 'user-place' ? 18 : 28;
  return L.divIcon({ className: 'lr-marker-wrap', html: `<span class="${cls}">${place.kind === 'user-place' ? '' : '✦'}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -14] });
}

function popupHtml(place) {
  const imgStatus = place.image?.status === 'verified' ? t('mapui.photoVerified') : t('mapui.photoPending');
  const coordStatus = place.coordinateStatus === 'verified' ? t('mapui.locVerified') : t('mapui.locApprox');
  const image = place.image?.url
    ? `<img class="lr-popup-image" src="${escapeHtml(place.image.url)}" alt="${escapeHtml(place.image.alt || place.nameEn)}" />`
    : '';
  const credit = place.image?.attributionRequired && place.image?.credit
    ? `<span class="lr-popup-credit">${escapeHtml(place.image.credit)}</span>`
    : '';
  return `<div class="lr-popup">
    ${image}
    <span class="lr-popup-eyebrow">${t('mapui.point', { n: place.order })}</span>
    <strong>${escapeHtml(placeName(place))}</strong>
    <small>${imgStatus} · ${coordStatus}</small>
    ${credit}
  </div>`;
}

// 离线/无 key 时的兜底：Leaflet + OSM 底图 + OSRM 路线 + Nominatim 反查
export default function MapViewLeaflet({ route, checkpoints = [], onSelectPlace, focus }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const checkpointLayerRef = useRef(null);
  const onSelectPlaceRef = useRef(onSelectPlace);
  useEffect(() => { onSelectPlaceRef.current = onSelectPlace; }, [onSelectPlace]);
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
    checkpointLayerRef.current = L.layerGroup().addTo(map);

    const onClick = (event) => {
      const { lat, lng } = event.latlng;
      const popup = L.popup()
        .setLatLng(event.latlng)
        .setContent(`<div class="lr-popup"><small>${t('mapui.lookingUp')}</small></div>`)
        .openOn(map);
      const postAt = (place) => { map.closePopup(); onSelectPlaceRef.current?.(place); };
      reverseGeocode(lat, lng)
        .then((name) => {
          const el = placePopupElement(makeUserPlace({ name: shortAddress(name), lat, lng }), { onPost: postAt, eyebrow: t('mapui.tapped') });
          const full = document.createElement('p');
          full.className = 'lr-click-name';
          full.textContent = name;
          el.insertBefore(full, el.querySelector('.lr-popup-post'));
          popup.setContent(el);
        })
        .catch(() => popup.setContent(placePopupElement(makeUserPlace({ name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng }), { onPost: postAt, eyebrow: t('mapui.offlineCoords') })));
    };
    map.on('click', onClick);

    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      cancelAnimationFrame(raf);
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      checkpointLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!route?.path?.length) return;
    let cancelled = false;
    if (route.pathIsStops) { setRoadPath(null); return undefined; } // straight through its stops
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

    // Stops of a route picked in the bus search: small dots, tap for the name.
    route.busStops?.forEach((stop) => {
      L.circleMarker([stop.lat, stop.lng], { radius: 4.5, color: '#c4502f', weight: 2, fillColor: '#fffaf2', fillOpacity: 1 })
        .bindPopup(`<div class="lr-popup"><strong>${escapeHtml(placeName(stop))}</strong></div>`)
        .addTo(layer);
    });

    route.storyPoints?.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const marker = L.marker([place.lat, place.lng], { icon: markerIcon(place) });
      marker.bindPopup(popupHtml(place));
      marker.addTo(layer);
    });

    map.fitBounds(polyline.getBounds(), { padding: [48, 48] });
  }, [route, roadPath]);

  // 打卡点图层（与路线分开，不随路线重绘）
  useEffect(() => {
    const map = mapRef.current;
    const layer = checkpointLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    checkpoints.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const marker = L.marker([place.lat, place.lng], { icon: checkpointIcon(place), zIndexOffset: 500 });
      marker.bindPopup(() => placePopupElement(place, {
        onPost: (p) => { map.closePopup(); onSelectPlaceRef.current?.(p); },
      }));
      marker.addTo(layer);
    });
  }, [checkpoints]);

  // A place picked in the search box: fly there and offer "Post here".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus?.place) return;
    const { place } = focus;
    const latlng = [place.lat, place.lng];
    map.flyTo(latlng, Math.max(map.getZoom(), 17), { duration: 0.8 });
    L.popup()
      .setLatLng(latlng)
      .setContent(placePopupElement(place, { onPost: (p) => { map.closePopup(); onSelectPlaceRef.current?.(p); }, eyebrow: t('mapui.searched') }))
      .openOn(map);
  }, [focus]);

  return (
    <>
      <div ref={containerRef} className="lr-map" />
      {offline && <div className="lr-offline">{t('mapui.offlineMode')}</div>}
    </>
  );
}
