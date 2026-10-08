import { useState } from 'react';
import MapViewGoogle from './map/MapViewGoogle.jsx';
import MapViewLeaflet from './map/MapViewLeaflet.jsx';

// 有 key 优先走 Google Maps；加载失败（无 key / 无网）自动退回 Leaflet 兜底。
const hasKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_KEY);

export default function MapView({ route, checkpoints, onArrive, onSelectPlace, mode, focus, onSegmentChange, onNearbyPlace, onDemoingChange }) {
  const [useGoogle, setUseGoogle] = useState(hasKey);

  if (useGoogle) {
    return <MapViewGoogle route={route} checkpoints={checkpoints} onFail={() => setUseGoogle(false)} onArrive={onArrive} onSelectPlace={onSelectPlace} mode={mode} focus={focus} onSegmentChange={onSegmentChange} onNearbyPlace={onNearbyPlace} onDemoingChange={onDemoingChange} />;
  }
  return <MapViewLeaflet route={route} checkpoints={checkpoints} onSelectPlace={onSelectPlace} focus={focus} />;
}
