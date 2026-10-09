import { useEffect, useRef, useState } from 'react';
import { escapeHtml } from './osm.js';
import { loadGoogleMaps } from './loadGoogleMaps.js';
import { segmentThemes } from './segmentThemes.js';
import { getLanguage, placeName, t } from '../i18n.js';
import { loadingPopupElement, placePopupElement, shortAddress } from './checkpointPopup.js';
import { makeUserPlace } from '../data/locations.js';
import { communityMarkerSvg } from './communityMarker.js';

const segmentThemeText = (theme) => !theme ? '' : getLanguage() === 'zh-HK' ? theme.zh : getLanguage() === 'zh-CN' ? (theme.zhCN || theme.zh) : theme.en;

const ROUTE_COLOR = '#c4502f';
const ON_ROUTE_MAX_M = 600; // 距路线超过该距离则视为「不在车上」，不显示讲解
const BUS_SPEED_MPS = 5;    // 市区巴士约 18 km/h，用于把站间距换算成讲解时长
const DEMO_SPEED_KMH = 30;  // 试乘自动行驶车速（固定；快慢对比改由对比卡展示）

function pinIcon(gmaps, order, active) {
  const fill = active ? '#c4502f' : '#173e31';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/><text x="17" y="23" font-family="Georgia, serif" font-size="15" fill="#ffffff" text-anchor="middle">${order}</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new gmaps.Point(17, 17), scaledSize: new gmaps.Size(34, 34) };
}

// Check-in points: smaller, no number, so they never read as route stops.
function checkpointIcon(gmaps, place) {
  if (place.kind === 'district') {
    return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(communityMarkerSvg)}`, anchor: new gmaps.Point(18, 18), scaledSize: new gmaps.Size(36, 36) };
  }
  if (place.kind === 'user-place') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="#fffaf2" stroke="#c4502f" stroke-width="3"/></svg>`;
    return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new gmaps.Point(9, 9), scaledSize: new gmaps.Size(18, 18) };
  }
  const organizer = place.category === 'organizer';
  const size = organizer ? 30 : 26;
  const c = size / 2;
  const fill = organizer ? '#b8862b' : '#d99a2b';
  const ring = organizer ? `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="none" stroke="#173e31" stroke-width="1.5"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${c}" cy="${c}" r="${c - 3}" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/>${ring}<text x="${c}" y="${c + 4.5}" font-family="Arial, sans-serif" font-size="13" fill="#ffffff" text-anchor="middle">✦</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new gmaps.Point(c, c), scaledSize: new gmaps.Size(size, size) };
}

// Name + location for a Google point of interest. Uses the Places API (New)
// when the key allows it, otherwise falls back to geocoding the place id.
async function resolveGooglePlace(gmaps, geocoder, googlePlaceId, fallbackLatLng) {
  try {
    if (!gmaps.places?.Place) throw new Error('Places library unavailable');
    const place = new gmaps.places.Place({ id: googlePlaceId, requestedLanguage: getLanguage() });
    await place.fetchFields({ fields: ['displayName', 'location'] });
    return makeUserPlace({ googlePlaceId, name: place.displayName, lat: place.location.lat(), lng: place.location.lng() });
  } catch {
    const results = await new Promise((resolve, reject) => {
      geocoder.geocode({ placeId: googlePlaceId, language: getLanguage() }, (res, status) => (status === 'OK' && res[0] ? resolve(res) : reject(new Error(status))));
    });
    const loc = results[0].geometry?.location || fallbackLatLng;
    return makeUserPlace({ googlePlaceId, name: shortAddress(results[0].formatted_address), lat: loc.lat(), lng: loc.lng() });
  }
}

function blueDotIcon(gmaps) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="9" fill="#2d7ecb" stroke="#ffffff" stroke-width="2.5"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, anchor: new gmaps.Point(11, 11), scaledSize: new gmaps.Size(22, 22) };
}

function popupHtml(place, arriving) {
  const imgStatus = place.image?.status === 'verified' ? t('mapui.photoVerified') : t('mapui.photoPending');
  const coordStatus = place.coordinateStatus === 'verified' ? t('mapui.locVerified') : t('mapui.locApprox');
  const eyebrow = arriving ? t('mapui.passing', { n: place.order }) : t('mapui.point', { n: place.order });
  const image = place.image?.url
    ? `<img class="lr-popup-image" src="${escapeHtml(place.image.url)}" alt="${escapeHtml(place.image.alt || place.nameEn)}" />`
    : '';
  const credit = place.image?.attributionRequired && place.image?.credit
    ? `<span class="lr-popup-credit">${escapeHtml(place.image.credit)}</span>`
    : '';
  return `<div class="lr-popup">
    ${image}
    <span class="lr-popup-eyebrow">${eyebrow}</span>
    <strong>${escapeHtml(placeName(place))}</strong>
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

export default function MapViewGoogle({ route, checkpoints = [], onFail, onArrive, onSelectPlace, mode = 'bus', focus, onSegmentChange, onNearbyPlace, onDemoingChange }) {
  const containerRef = useRef(null);
  const gmapsRef = useRef(null);
  const mapRef = useRef(null);
  const routePolylineRef = useRef(null);
  const infoWindowRef = useRef(null);
  const markersRef = useRef([]); // [{ place, marker }]
  const checkpointMarkersRef = useRef([]); // 打卡点图层 [{ place, marker }]，不参与旅程
  const routeBoundsRef = useRef(null);
  const busStopMarkersRef = useRef([]); // stops of a route picked in bus search
  const ghostLinesRef = useRef([]); // other routes through the chosen stop, dimmed
  const routeRef = useRef(route);
  const routePathRef = useRef(null); // Directions 返回的 overview_path（沿道路）
  const journeyRef = useRef(null);  // 站间路段预计算
  const dotRef = useRef(null);
  const accuracyRef = useRef(null);
  const watchIdRef = useRef(null);
  const demoingRef = useRef(false);
  const arrivedRef = useRef(null);
  const announcedRef = useRef(null); // 已触发自动讲解的景点 id（避免拖动时重复播）
  const revealedRef = useRef(new Set()); // 已「冒出」的景点 id
  const nearbyRef = useRef(null);        // 步行模式当前感应到的 place id
  const geofenceRef = useRef([]);        // 步行模式的 geofence 圈
  const demoTimerRef = useRef(null);     // 试乘自动行驶定时器
  const demoDistRef = useRef(0);         // 试乘已行驶的沿线距离（米）
  const scrubbingRef = useRef(false);    // 拖动进度条时暂停自动前进
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [demoing, setDemoing] = useState(false);
  const [status, setStatus] = useState(null);
  const [segment, setSegment] = useState(null); // 当前讲解段（连贯面板）
  const [demoProgress, setDemoProgress] = useState(0);
  const [showingCheckins, setShowingCheckins] = useState(false);

  useEffect(() => { routeRef.current = route; }, [route]);
  const onArriveRef = useRef(onArrive);
  useEffect(() => { onArriveRef.current = onArrive; }, [onArrive]);
  const onSelectPlaceRef = useRef(onSelectPlace);
  useEffect(() => { onSelectPlaceRef.current = onSelectPlace; }, [onSelectPlace]);
  const onSegmentChangeRef = useRef(onSegmentChange);
  useEffect(() => { onSegmentChangeRef.current = onSegmentChange; }, [onSegmentChange]);
  const onNearbyPlaceRef = useRef(onNearbyPlace);
  useEffect(() => { onNearbyPlaceRef.current = onNearbyPlace; }, [onNearbyPlace]);
  const onDemoingChangeRef = useRef(onDemoingChange);
  useEffect(() => { onDemoingChangeRef.current = onDemoingChange; }, [onDemoingChange]);
  useEffect(() => { onDemoingChangeRef.current?.(demoing); }, [demoing]);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

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
        const openPopup = (content, position) => {
          infoWindowRef.current.close();
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.setPosition(position);
          infoWindowRef.current.open(map);
        };
        const postAt = (place) => {
          infoWindowRef.current.close();
          onSelectPlaceRef.current?.(place);
        };
        map.addListener('click', (event) => {
          const latlng = event.latLng;
          // Tapped one of Google's own place icons (shop, school, park…):
          // replace Google's default bubble with ours, which can open the post sheet.
          if (event.placeId) {
            event.stop();
            openPopup(loadingPopupElement(t('mapui.loadingPlace')), latlng);
            resolveGooglePlace(gmaps, geocoder, event.placeId, latlng)
              .then((place) => openPopup(placePopupElement(place, { onPost: postAt, eyebrow: t('mapui.tapped') }), latlng))
              .catch(() => openPopup(placePopupElement(makeUserPlace({ name: `${latlng.lat().toFixed(5)}, ${latlng.lng().toFixed(5)}`, lat: latlng.lat(), lng: latlng.lng() }), { onPost: postAt, eyebrow: t('mapui.offlineCoords') }), latlng));
            return;
          }
          openPopup(loadingPopupElement(t('mapui.lookingUp')), latlng);
          reverseGeocodeLine(geocoder, latlng, getLanguage())
            .then((address) => {
              const place = makeUserPlace({ name: shortAddress(address), lat: latlng.lat(), lng: latlng.lng() });
              const el = placePopupElement(place, { onPost: postAt, eyebrow: t('mapui.tapped') });
              const full = document.createElement('p');
              full.className = 'lr-click-name';
              full.textContent = address;
              el.insertBefore(full, el.querySelector('.lr-popup-post'));
              openPopup(el, latlng);
            })
            .catch(() => {
              const place = makeUserPlace({ name: `${latlng.lat().toFixed(5)}, ${latlng.lng().toFixed(5)}`, lat: latlng.lat(), lng: latlng.lng() });
              openPopup(placePopupElement(place, { onPost: postAt, eyebrow: t('mapui.offlineCoords') }), latlng);
            });
        });

        setReady(true);
      })
      .catch(() => { if (!disposed && onFail) onFail(); });

    return () => {
      disposed = true;
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (routePolylineRef.current) { routePolylineRef.current.setMap(null); routePolylineRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 路线/模式变化时重绘：常显标记 + Directions 道路级路线 + 预计算（步行模式跳过路线）
  useEffect(() => {
    if (!ready || !route?.path?.length) return;
    const gmaps = window.google.maps;
    const map = mapRef.current;

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = [];
    revealedRef.current.clear();
    busStopMarkersRef.current.forEach((marker) => marker.setMap(null));
    busStopMarkersRef.current = [];

    route.storyPoints?.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const marker = new gmaps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        visible: true, // 默认常显，点击可查看该地点的社区投稿
        icon: pinIcon(gmaps, place.order, false),
      });
      marker.addListener('click', () => {
        onSelectPlaceRef.current?.(place);
      });
      markersRef.current.push({ place, marker });
    });

    if (mode === 'walk') {
      // 步行模式：不画巴士路线，只留常显 pin + geofence（geofence 由下方单独 effect 绘制）
      if (routePolylineRef.current) { routePolylineRef.current.setMap(null); routePolylineRef.current = null; }
      journeyRef.current = null;
      return;
    }

    // A route picked in the bus search: a line through its stops, with a small
    // dot per stop (tap for its name). No road routing or narration.
    if (route.pathIsStops) {
      const path = route.path.map(([lat, lng]) => new gmaps.LatLng(lat, lng));
      routePathRef.current = path;
      journeyRef.current = null;
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      routePolylineRef.current = new gmaps.Polyline({ path, map, strokeColor: ROUTE_COLOR, strokeWeight: 5, strokeOpacity: 0.9 });
      const bounds = new gmaps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      (route.busStops || []).forEach((stop) => {
        const marker = new gmaps.Marker({
          position: { lat: stop.lat, lng: stop.lng },
          map,
          title: placeName(stop),
          zIndex: 40,
          icon: { path: gmaps.SymbolPath.CIRCLE, scale: 4.5, fillColor: '#fffaf2', fillOpacity: 1, strokeColor: ROUTE_COLOR, strokeWeight: 2 },
        });
        marker.addListener('click', () => {
          infoWindowRef.current.setContent(loadingPopupElement(placeName(stop)));
          infoWindowRef.current.open({ map, anchor: marker });
        });
        busStopMarkersRef.current.push(marker);
      });
      routeBoundsRef.current = bounds;
      map.fitBounds(bounds, 48);
      return;
    }

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
      routeBoundsRef.current = result.routes[0].bounds;
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
  }, [ready, route, mode]);

  // A place picked in the search box: pan there and offer "Post here".
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus?.place) return;
    const { place } = focus;
    const position = { lat: place.lat, lng: place.lng };
    map.panTo(position);
    if (map.getZoom() < 17) map.setZoom(17);
    infoWindowRef.current.close();
    infoWindowRef.current.setContent(placePopupElement(place, {
      onPost: (p) => { infoWindowRef.current.close(); onSelectPlaceRef.current?.(p); },
      eyebrow: t('mapui.searched'),
    }));
    infoWindowRef.current.setPosition(position);
    infoWindowRef.current.open(map);
  }, [ready, focus]);

  // Other routes through the chosen bus stop: dimmed lines under the lit route.
  useEffect(() => {
    if (!ready) return;
    const gmaps = window.google.maps;
    ghostLinesRef.current.forEach((line) => line.setMap(null));
    ghostLinesRef.current = (mode === 'walk' ? [] : route?.ghostPaths || []).map((path) => new gmaps.Polyline({
      path: path.map(([lat, lng]) => ({ lat, lng })), map: mapRef.current, strokeColor: '#8a958f', strokeOpacity: 0.4, strokeWeight: 3, zIndex: 1,
    }));
  }, [ready, route, mode]);

  // 打卡点图层：独立于路线和试乘，常显；点击直接打开该地点的投稿面板
  useEffect(() => {
    if (!ready) return;
    const gmaps = window.google.maps;
    const map = mapRef.current;
    checkpointMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
    checkpointMarkersRef.current = [];
    checkpoints.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const marker = new gmaps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        icon: checkpointIcon(gmaps, place),
        title: placeName(place),
        zIndex: 50,
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(placePopupElement(place, {
          onPost: (p) => { infoWindowRef.current.close(); onSelectPlaceRef.current?.(p); },
        }));
        infoWindowRef.current.open({ map, anchor: marker });
      });
      checkpointMarkersRef.current.push({ place, marker });
    });
  }, [ready, checkpoints]);

  // 「打卡点」按钮：缩放到所有打卡点；再按一次回到路线
  const toggleCheckins = () => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    if (!gmaps || !map) return;
    if (showingCheckins) {
      if (routeBoundsRef.current) map.fitBounds(routeBoundsRef.current);
      setShowingCheckins(false);
      return;
    }
    const bounds = new gmaps.LatLngBounds();
    checkpoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    routeRef.current?.storyPoints?.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 40);
    setShowingCheckins(true);
  };

  // 步行模式：围绕各遗产点画 geofence 圈（半径 = triggerRadiusM）
  useEffect(() => {
    if (!ready || !route?.storyPoints?.length) return;
    const gmaps = window.google.maps;
    const map = mapRef.current;
    geofenceRef.current.forEach((circle) => circle.setMap(null));
    geofenceRef.current = [];
    if (mode !== 'walk') return;
    route.storyPoints.forEach((place) => {
      if (place.lat == null || place.lng == null) return;
      const circle = new gmaps.Circle({
        map,
        center: { lat: place.lat, lng: place.lng },
        radius: place.triggerRadiusM || 150,
        strokeColor: '#2d7ecb',
        strokeOpacity: 0.5,
        strokeWeight: 1.5,
        fillColor: '#2d7ecb',
        fillOpacity: 0.08,
        clickable: false,
      });
      geofenceRef.current.push(circle);
    });
  }, [ready, route, mode]);

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
    markersRef.current.forEach(({ marker }) => marker.setAnimation(null));
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

  // 步行模式：判断是否进入某地点的 geofence，进入则 pin 脉冲 + 通知上层
  const updateWalkPosition = (latlng) => {
    const gmaps = gmapsRef.current;
    if (!gmaps?.geometry?.spherical) return;
    let hit = null;
    for (const { place, marker } of [...markersRef.current, ...checkpointMarkersRef.current]) {
      if (place.kind === 'district') continue; // An area anchor is not a user's precise location.
      const d = gmaps.geometry.spherical.computeDistanceBetween(latlng, new gmaps.LatLng(place.lat, place.lng));
      const inRange = d <= (place.triggerRadiusM || 150);
      marker.setAnimation(inRange ? gmaps.Animation.BOUNCE : null);
      if (inRange && !hit) hit = place;
    }
    if (hit?.id !== nearbyRef.current) {
      nearbyRef.current = hit?.id ?? null;
      onNearbyPlaceRef.current?.(hit || null);
    }
  };

  // 连贯讲解：面板始终显示「当前段 A→B + 主题」，随位置无缝切换到下一段
  // announce=false 时只更新位置/面板（拖动进度条过程中），不触发自动讲解；
  // announce=true 时若进入新站，才把「当前站 + 到下一站时长」上报给上层自动连播。
  const updateJourney = (latlng, announce = true) => {
    const j = journeyRef.current;
    if (!j) { setSegment(null); onSegmentChangeRef.current?.(null); return; }
    const { idx, dist } = j.nearest(latlng);
    if (dist > ON_ROUTE_MAX_M) {
      if (arrivedRef.current) { arrivedRef.current = null; resetArrival(); }
      setSegment(null);
      onSegmentChangeRef.current?.(null);
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
    onSegmentChangeRef.current?.(seg);

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

    // 播报对象 = 正在接近的下一站（seg.to）：乘车即讲第一站，过站即讲下一站，中间不停
    const approaching = seg.to;
    if (approaching && approaching.id !== 'macao-ferry' && announce && announcedRef.current !== approaching.id) {
      announcedRef.current = approaching.id;
      // 播报该站可用的时间预算 = 该站到再下一站的站间距 ÷ 速度（末站给足 60s）
      const segIdx = j.segments.indexOf(seg);
      const nextSeg = j.segments[segIdx + 1];
      const speedMps = demoingRef.current ? (DEMO_SPEED_KMH / 3.6) : BUS_SPEED_MPS;
      const timeToNextSec = nextSeg ? Math.max(15, Math.round((nextSeg.to.progress - approaching.progress) / speedMps)) : 60;
      // 试乘由速度对比卡连播（走 onSegmentChange），不再触发讲解弹窗
      if (!demoingRef.current) onArriveRef.current?.(approaching, timeToNextSec);
    }
  };

  const startLocating = () => {
    if (!('geolocation' in navigator)) { setStatus(t('mapui.noGeo')); return; }
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    if (!gmaps || !map) return;
    setLocating(true);
    setStatus(t('mapui.locating'));
    resetReveal();
    announcedRef.current = null;
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
        if (modeRef.current === 'walk') updateWalkPosition(latlng);
        else updateJourney(latlng);
      },
      (err) => {
        setLocating(false);
        setStatus(err.code === 1 ? t('mapui.geoDenied') : t('mapui.geoFailed'));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  const stopLocating = () => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    clearDot();
    arrivedRef.current = null;
    announcedRef.current = null;
    nearbyRef.current = null;
    onNearbyPlaceRef.current?.(null);
    resetArrival();
    [...markersRef.current, ...checkpointMarkersRef.current].forEach(({ marker }) => marker.setAnimation(null));
    setLocating(false);
    setStatus(null);
    setSegment(null);
  };

  // 沿线距离 → 经纬度（试乘自动行驶用）
  const pointAtDistance = (dist) => {
    const gmaps = gmapsRef.current;
    const path = routePathRef.current;
    const j = journeyRef.current;
    if (!gmaps || !path?.length || !j) return null;
    const cum = j.cum;
    if (dist <= 0) return path[0];
    if (dist >= cum[cum.length - 1]) return path[path.length - 1];
    let i = 1;
    while (i < cum.length && cum[i] < dist) i++;
    const a = path[i - 1];
    const b = path[i];
    const segLen = cum[i] - cum[i - 1] || 1;
    const t = (dist - cum[i - 1]) / segLen;
    return new gmaps.LatLng(a.lat() + (b.lat() - a.lat()) * t, a.lng() + (b.lng() - a.lng()) * t);
  };

  const moveDemoDot = () => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    const j = journeyRef.current;
    if (!gmaps || !map || !j) return;
    const ll = pointAtDistance(demoDistRef.current);
    if (!ll) return;
    if (!dotRef.current) {
      dotRef.current = new gmaps.Marker({ position: ll, map, icon: blueDotIcon(gmaps), zIndex: 1000, clickable: false });
      accuracyRef.current = new gmaps.Circle({ map, strokeColor: '#2d7ecb', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#2d7ecb', fillOpacity: 0.12, clickable: false });
    }
    dotRef.current.setPosition(ll);
    accuracyRef.current.setCenter(ll);
    accuracyRef.current.setRadius(30);
    const total = j.cum[j.cum.length - 1] || 1;
    setDemoProgress(Math.min(1, demoDistRef.current / total));
    updateJourney(ll, true);
  };

  const scrubDemo = (event) => {
    const j = journeyRef.current;
    if (!j) return;
    const total = j.cum[j.cum.length - 1] || 1;
    demoDistRef.current = (Number(event.target.value) / 100) * total;
    moveDemoDot();
  };

  const tickDemo = () => {
    if (!demoingRef.current || scrubbingRef.current) return;
    const j = journeyRef.current;
    if (!j) return;
    const total = j.cum[j.cum.length - 1] || 1;
    demoDistRef.current += (DEMO_SPEED_KMH / 3.6) * 0.2; // 每 200ms：速度(m/s) × 0.2s
    if (demoDistRef.current >= total) {
      demoDistRef.current = total;
      moveDemoDot();
      stopDemo();
      return;
    }
    moveDemoDot();
  };

  const startDemo = () => {
    const gmaps = gmapsRef.current;
    const map = mapRef.current;
    const path = routePathRef.current;
    if (!gmaps || !map || !path?.length || !journeyRef.current) { setStatus(t('mapui.routeNotReady')); return; }

    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setLocating(false);
    clearDot();
    arrivedRef.current = null;
    announcedRef.current = null;
    resetArrival();
    resetReveal();
    setSegment(null);
    onSegmentChangeRef.current?.(null);

    demoingRef.current = true;
    setDemoing(true);
    setStatus(t('mapui.demoRide', { kmh: DEMO_SPEED_KMH }));
    demoDistRef.current = 0;
    moveDemoDot();
    demoTimerRef.current = setInterval(tickDemo, 200);
  };

  const stopDemo = () => {
    demoingRef.current = false;
    setDemoing(false);
    if (demoTimerRef.current != null) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
    clearDot();
    arrivedRef.current = null;
    announcedRef.current = null;
    resetArrival();
    setStatus(null);
    setSegment(null);
    onSegmentChangeRef.current?.(null);
    setDemoProgress(0);
    demoDistRef.current = 0;
  };

  const toggleLocate = () => {
    if (demoing) stopDemo();
    if (locating) stopLocating(); else startLocating();
  };

  const toggleDemo = () => {
    if (locating) stopLocating();
    if (demoing) stopDemo(); else startDemo();
  };

  // 切换模式时清理进行中的定位/试乘状态
  useEffect(() => {
    if (demoTimerRef.current != null) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
    demoingRef.current = false;
    setDemoing(false);
    arrivedRef.current = null;
    announcedRef.current = null;
    nearbyRef.current = null;
    onNearbyPlaceRef.current?.(null);
    [...markersRef.current, ...checkpointMarkersRef.current].forEach(({ marker }) => marker.setAnimation(null));
    setSegment(null);
    onSegmentChangeRef.current?.(null);
    setDemoProgress(0);
    demoDistRef.current = 0;
  }, [mode]);

  return (
    <>
      <div ref={containerRef} className="lr-map" />
      {segment && (
        <div className="lr-segment">
          <span className="lr-segment-eyebrow">{t('mapui.youreOn')}</span>
          <div className="lr-segment-route">{placeName(segment.from)} <b>→</b> {placeName(segment.to)}</div>
                    {segmentThemeText(segment.theme) && <div className="lr-segment-theme-en">{segmentThemeText(segment.theme)}</div>}
        </div>
      )}
      {status && <div className="lr-locate-status">{status}</div>}
      <button className={`lr-locate ${locating ? 'is-on' : ''}`} onClick={toggleLocate} title={locating ? t('mapui.stopLocate') : t('mapui.locate')} aria-label={locating ? t('mapui.stopLocate') : t('mapui.locate')}>
        <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
      </button>
      {mode !== 'walk' && route?.storyPoints?.length > 0 && <button className={`lr-demo ${demoing ? 'is-on' : ''}`} onClick={toggleDemo} title={demoing ? t('mapui.stopDemo') : t('mapui.startDemo')} aria-label={demoing ? t('mapui.stopDemo') : t('mapui.startDemo')}>
        {demoing ? '■' : '▶'}
      </button>}
      {!demoing && checkpoints.length > 0 && (
        <button className={`lr-checkins ${showingCheckins ? 'is-on' : ''}`} onClick={toggleCheckins}>
          {showingCheckins ? `← ${t('map.backToRoute')}` : `✦ ${t('map.checkins')}`}
        </button>
      )}
      {demoing && (
        <div className="lr-demo-controls">
          <input className="lr-demo-range" type="range" min="0" max="100" step="0.5" value={Math.round(demoProgress * 100)} onChange={scrubDemo} onPointerDown={() => { scrubbingRef.current = true; }} onPointerUp={() => { scrubbingRef.current = false; }} aria-label={t('mapui.demoProgress')} />
        </div>
      )}
    </>
  );
}
