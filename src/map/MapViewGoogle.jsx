import { useEffect, useRef, useState } from 'react';
import { escapeHtml } from './osm.js';
import { loadGoogleMaps } from './loadGoogleMaps.js';
import { segmentThemes } from './segmentThemes.js';

const ROUTE_COLOR = '#c4502f';
const ON_ROUTE_MAX_M = 600; // 距路线超过该距离则视为「不在车上」，不显示讲解
const DEMO_TICK_MS = 200;   // 试乘每步间隔（越大越慢、越连贯）
const DEMO_STEPS = 260;     // 试乘总步数（越大越慢/越平滑）

function pinIcon(gmaps, order, active) {
  const fill = active ? '#c4502f' : '#173e31';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/><text x="17" y="23" font-family="Georgia, serif" font-size="15" fill="#ffffff" text-anchor="middle">${order}</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new gmaps.Point(17, 17), scaledSize: new gmaps.Size(34, 34) };
}

function blueDotIcon(gmaps) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="9" fill="#2d7ecb" stroke="#ffffff" stroke-width="2.5"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new gmaps.Point(11, 11), scaledSize: new gmaps.Size(22, 22) };
}

function popupHtml(place, arriving) {
  const imgStatus = place.image?.status === 'verified' ? '图片：已核实' : '图片：待核实';
  const coordStatus = place.coordinateStatus === 'verified' ? '坐标：已核对' : '坐标：地图目测（待实地核对）';
  const eyebrow = arriving ? `📍 你正在经过 · POINT ${place.order}` : `HERITAGE POINT ${place.order}`;
  const image = place.image?.url
    ? `<img class="lr-popup-image" src="${escapeHtml(place.image.url)}" alt="${escapeHtml(place.image.alt || place.nameEn)}" />`
    : '';
  const credit = place.image?.attributionRequired && place.image?.credit
    ? `<span class="lr-popup-credit">${escapeHtml(place.image.credit)}</span>`
    : '';
  return `<div class="lr-popup">
    ${image}
    <span class="lr-popup-eyebrow">${eyebrow}</span>
    <strong>${place.nameZh}</strong>
    <em>${place.nameEn}</em>
    <small>${imgStatus} · ${coordStatus}</small>
    ${credit}
  </div>`;
}

function reverseGeocodeLine(geocoder, latlng, language) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: latlng, language }, (results, status) => {
      if (status === 'OK' && results[0]) resolve(results[0].formatted_address);
      else reject(new Error(status));
    });
  });
}

// 依据 Directions 的 overview_path 预计算：每站的累计里程 + 站间路段
function buildJourney(path, storyPoints, gmaps) {
  const spherical = gmaps.geometry?.spherical;
  if (!spherical || !path?.length || !storyPoints?.length) return null;

  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum[i] = cum[i - 1] + spherical.computeDistanceBetween(path[i - 1], path[i]);
  }

  const nearest = (ll) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = spherical.computeDistanceBetween(ll, path[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return { idx: best, dist: bd };
  };

  const stations = [
    { id: 'macao-ferry', nameZh: '中環（港澳碼頭）', nameEn: 'Central (Macao Ferry)', lat: path[0].lat(), lng: path[0].lng() },
    ...storyPoints,
  ].map((s) => ({ ...s, progress: cum[nearest(new gmaps.LatLng(s.lat, s.lng)).idx] }));

  const segments = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    segments.push({ from, to, theme: segmentThemes[`${from.id}->${to.id}`] || { zh: '', en: '' } });
  }
  return { cum, nearest, stations, segments };
}

export default function MapViewGoogle({ route, onFail }) {
  const containerRef = useRef(null);
  const gmapsRef = useRef(null);
  const mapRef = useRef(null);
  const routePolylineRef = useRef(null);
  const infoWindowRef = useRef(null);
  const markersRef = useRef([]); // [{ place, marker }]
  const routeRef = useRef(route);
  const routePathRef = useRef(null); // Directions 返回的 overview_path（沿道路）
  const journeyRef = useRef(null);  // 站间路段预计算
  const dotRef = useRef(null);
  const accuracyRef = useRef(null);
  const watchIdRef = useRef(null);
  const demoingRef = useRef(false);
  const demoTimerRef = useRef(null);
  const arrivedRef = useRef(null);
  const revealedRef = useRef(new Set()); // 已「冒出」的景点 id
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [demoing, setDemoing] = useState(false);
  const [status, setStatus] = useState(null);
  const [segment, setSegment] = useState(null); // 当前讲解段（连贯面板）

  useEffect(() => { routeRef.current = route; }, [route]);

  // 初始化地图 + 点击反查（只跑一次）
  useEffect(() => {
    let disposed = false;
    loadGoogleMaps()
      .then((gmaps) => {
        if (disposed || !containerRef.current) return;
        gmapsRef.current = gmaps;
        const map = new gmaps.Map(containerRef.current, {
          zoom: 15,
          tilt: 45,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new gmaps.InfoWindow();

        const geocoder = new gmaps.Geocoder();
        map.addListener('click', (event) => {
          const latlng = event.latLng;
          infoWindowRef.current.close();
          infoWindowRef.current.setContent('<div class="lr-popup"><small>查询地名中…</small></div>');
          infoWindowRef.current.setPosition(latlng);
          infoWindowRef.current.open(map);
          Promise.all([
            reverseGeocodeLine(geocoder, latlng, 'en'),
            reverseGeocodeLine(geocoder, latlng, 'zh-Hant'),
          ])
            .then(([en, zh]) => {
              infoWindowRef.current.setContent(`<div class="lr-popup"><span class="lr-popup-eyebrow">你点到了这里</span><p class="lr-click-name">${escapeHtml(en)}</p><p class="lr-click-name">${escapeHtml(zh)}</p></div>`);
            })
            .catch(() => {
              infoWindowRef.current.setContent(`<div class="lr-popup"><span class="lr-popup-eyebrow">离线 · 仅坐标</span><strong>${latlng.lat().toFixed(5)}, ${latlng.lng().toFixed(5)}</strong></div>`);
            });
        });

        setReady(true);
      })
      .catch(() => { if (!disposed && onFail) onFail(); });

    return () => {
      disposed = true;
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      if (routePolylineRef.current) { routePolylineRef.current.setMap(null); routePolylineRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 路线变化时重绘：标记（初始隐藏，经过才冒出）+ Directions 道路级路线 + 预计算
  useEffect(() => {
    if (!ready || !route?.path?.length) return;
    const gmaps = window.google.maps;
    const map = mapRef.current;

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = [];
    revealedRef.current.clear();

    route.storyPoints?.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const marker = new gmaps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        visible: false, // 初始隐藏，经过才「冒出」
        icon: pinIcon(gmaps, place.order, false),
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(popupHtml(place, false));
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current.push({ place, marker });
    });

    const origin = route.path[0];
    const destination = route.path[route.path.length - 1];
    const originLL = { lat: origin[0], lng: origin[1] };
    const destinationLL = { lat: destination[0], lng: destination[1] };

    const drawRoute = (result) => {
      const path = result.routes[0].overview_path;
      routePathRef.current = path;
      journeyRef.current = buildJourney(path, route.storyPoints, gmaps);
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      routePolylineRef.current = new gmaps.Polyline({
        path,
        map,
        strokeColor: ROUTE_COLOR,
        strokeWeight: 5,
        strokeOpacity: 0.9,
      });
      map.fitBounds(result.routes[0].bounds);
      map.setTilt(45);
    };

    const dirService = new gmaps.DirectionsService();
    // 只查起点→终点一条干净路线（不加途经点，避免为「停靠」绕圈/U 转），失败回退开车
    dirService.route(
      { origin: originLL, destination: destinationLL, travelMode: gmaps.TravelMode.TRANSIT, transitOptions: { modes: [gmaps.TransitMode.BUS] } },
      (result, status) => {
        if (status === 'OK') drawRoute(result);
        else dirService.route({ origin: originLL, destination: destinationLL, travelMode: gmaps.TravelMode.DRIVING }, (r2, s2) => { if (s2 === 'OK') drawRoute(r2); });
      },
    );
  }, [ready, route]);

  const clearDot = () => {
    if (dotRef.current) { dotRef.current.setMap(null); dotRef.current = null; }
    if (accuracyRef.current) { accuracyRef.current.setMap(null); accuracyRef.current = null; }
  };

  const revealMarker = (placeId) => {
    const gmaps = gmapsRef.current;
    const entry = markersRef.current.find(({ place }) => place.id === placeId);
    if (entry) {
      entry.marker.setVisible(true);
      entry.marker.setAnimation(gmaps.Animation.DROP);
    }
  };

  const resetReveal = () => {
    revealedRef.current.clear();
    markersRef.current.forEach(({ marker }) => marker.setVisible(false));
  };

  // 只做 pin 高亮（不弹框、不打断），内容在连贯面板里
  const highlightStation = (place) => {
    const gmaps = gmapsRef.current;
    markersRef.current.forEach(({ place: p, marker }) => {
      marker.setIcon(pinIcon(gmaps, p.order, p.id === place.id));
    });
  };

  const resetArrival = () => {
    const gmaps = gmapsRef.current;
    markersRef.current.forEach(({ place, marker }) => marker.setIcon(pinIcon(gmaps, place.order, false)));
  };

  // 连贯讲解：面板始终显示「当前段 A→B + 主题」，随位置无缝切换到下一段
  const updateJourney = (latlng) => {
    const j = journeyRef.current;
    if (!j) { setSegment(null); return; }
    const { idx, dist } = j.nearest(latlng);
    if (dist > ON_ROUTE_MAX_M) {
      if (arrivedRef.current) { arrivedRef.current = null; resetArrival(); }
      setSegment(null);
      return;
    }
    const progress = j.cum[idx];

    // 当前段（覆盖整条路线，无空隙 → 连贯）
    let seg = null;
    for (const s of j.segments) {
      if (progress >= s.from.progress && progress < s.to.progress) { seg = s; break; }
    }
    if (!seg) seg = j.segments[j.segments.length - 1];
    setSegment(seg);

    // 当前景点 = 最近已越过的景点（跳过虚拟起点 macao-ferry），用于 pin 高亮
    let current = null;
    for (const st of j.stations) {
      if (st.id === 'macao-ferry') continue;
      if (progress >= st.progress) current = st; else break;
    }

    if (current) {
      if (!revealedRef.current.has(current.id)) {
        revealedRef.current.add(current.id);
        revealMarker(current.id);
      }
      if (arrivedRef.current !== current.id) {
        arrivedRef.current = current.id;
        highlightStation(current);
      }
    } else if (arrivedRef.current) {
      arrivedRef.current = null;
      resetArrival();
    }
  };

  const startLocating = () => {
    if (!('geolocation' in navigator)) { setStatus('此设备不支持定位'); return; }
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    if (!gmaps || !map) return;
    setLocating(true);
    setStatus('正在定位…');
    resetReveal();
    let firstFix = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const latlng = new gmaps.LatLng(pos.coords.latitude, pos.coords.longitude);
        if (!dotRef.current) {
          dotRef.current = new gmaps.Marker({ position: latlng, map, icon: blueDotIcon(gmaps), zIndex: 1000, clickable: false });
          accuracyRef.current = new gmaps.Circle({ map, strokeColor: '#2d7ecb', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#2d7ecb', fillOpacity: 0.12, clickable: false });
        }
        dotRef.current.setPosition(latlng);
        accuracyRef.current.setCenter(latlng);
        accuracyRef.current.setRadius(Math.max(pos.coords.accuracy || 40, 10));

        if (firstFix) { map.panTo(latlng); map.setZoom(16); firstFix = false; }
        updateJourney(latlng);
      },
      (err) => {
        setLocating(false);
        setStatus(err.code === 1 ? '定位被拒绝 · 请在浏览器允许位置权限' : '定位失败，请重试');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  const stopLocating = () => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    clearDot();
    arrivedRef.current = null;
    resetArrival();
    setLocating(false);
    setStatus(null);
    setSegment(null);
  };

  const startDemo = () => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    const path = routePathRef.current;
    if (!gmaps || !map || !path?.length) { setStatus('路线尚未就绪，稍后再试'); return; }

    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setLocating(false);
    clearDot();
    arrivedRef.current = null;
    resetArrival();
    resetReveal();
    setSegment(null);

    demoingRef.current = true;
    setDemoing(true);
    setStatus('试乘中 · 沿 1 号线…');
    let idx = 0;
    const stepSize = Math.max(1, Math.round(path.length / DEMO_STEPS));

    const step = () => {
      if (!demoingRef.current) return;
      const ll = path[Math.min(idx, path.length - 1)];

      if (!dotRef.current) {
        dotRef.current = new gmaps.Marker({ position: ll, map, icon: blueDotIcon(gmaps), zIndex: 1000, clickable: false });
        accuracyRef.current = new gmaps.Circle({ map, strokeColor: '#2d7ecb', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#2d7ecb', fillOpacity: 0.12, clickable: false });
      }
      dotRef.current.setPosition(ll);
      accuracyRef.current.setCenter(ll);
      accuracyRef.current.setRadius(30);

      updateJourney(ll);

      idx += stepSize;
      if (idx >= path.length) {
        demoingRef.current = false;
        setDemoing(false);
        setStatus('试乘结束 · 已到达跑马地');
        return;
      }
      demoTimerRef.current = setTimeout(step, DEMO_TICK_MS);
    };

    step();
  };

  const stopDemo = () => {
    demoingRef.current = false;
    setDemoing(false);
    if (demoTimerRef.current) { clearTimeout(demoTimerRef.current); demoTimerRef.current = null; }
    clearDot();
    arrivedRef.current = null;
    resetArrival();
    setStatus(null);
    setSegment(null);
  };

  const toggleLocate = () => {
    if (demoing) stopDemo();
    if (locating) stopLocating(); else startLocating();
  };

  const toggleDemo = () => {
    if (locating) stopLocating();
    if (demoing) stopDemo(); else startDemo();
  };

  return (
    <>
      <div ref={containerRef} className="lr-map" />
      {segment && (
        <div className="lr-segment">
          <span className="lr-segment-eyebrow">你正在 · YOU&apos;RE ON</span>
          <div className="lr-segment-route">{segment.from.nameZh} <b>→</b> {segment.to.nameZh}</div>
          {segment.theme?.zh && <div className="lr-segment-theme">主題 · {segment.theme.zh}</div>}
          {segment.theme?.en && <div className="lr-segment-theme-en">{segment.theme.en}</div>}
        </div>
      )}
      {status && <div className="lr-locate-status">{status}</div>}
      <button className={`lr-locate ${locating ? 'is-on' : ''}`} onClick={toggleLocate} title={locating ? '停止定位' : '定位到我的位置'}>
        <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
      </button>
      <button className={`lr-demo ${demoing ? 'is-on' : ''}`} onClick={toggleDemo} title={demoing ? '停止试乘' : '试乘（模拟沿 1 号线移动）'}>
        {demoing ? '■' : '▶'}
      </button>
    </>
  );
}
