import DepthClip from './DepthClip.jsx';
import { getThenNowImages } from '../services/thenNowService.js';

// Temporary preview for the depth-parallax "3D clip" prototype. Reachable at
//   /#depthclip   (hash-only, never part of the normal app flow).

const DEMO = [
  { id: 'central-market', era: 'past', label: '中環街市 · past' },
  { id: 'blue-house', era: 'now', label: '藍屋 · now' },
  { id: 'lee-tung-street', era: 'past', label: '利東街 · past' },
];

export default function DepthClipDemo() {
  return (
    <main className="depthclip-demo">
      <header>
        <span className="eyebrow">Prototype · Depth clip</span>
        <h1>图片 → 3D 环绕旋转 clip</h1>
        <p>每张照片 + 深度图，用深度位移网格 + 环绕相机渲染成自动循环的「旋转 / 身临其境」片段（免费 / 离线，纯 WebGL）。</p>
      </header>
      <div className="depthclip-grid">
        {DEMO.map(({ id, era, label }) => {
          const images = getThenNowImages(id);
          const img = images[era];
          return (
            <figure key={`${id}:${era}`} className="depthclip-item">
              <DepthClip src={img?.url} depth={img?.depthUrl} className="depthclip-canvas" />
              <figcaption>{label}</figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
