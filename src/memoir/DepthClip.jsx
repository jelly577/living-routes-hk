import { useEffect, useRef, useState } from 'react';

const VERT = `
attribute vec2 aScreen;   // [0,1] x [0,1], (0,0) = bottom-left
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
uniform float uAspect;    // canvas width / height
uniform vec2 uOrbit;      // (yaw, pitch) radians — the "rotate around" swing
uniform float uDolly;     // camera distance; focal = dolly so far plane is 1:1
uniform float uDepthScale;// how far near pixels (depth=1) rise toward the camera
varying vec2 vUv;
void main() {
  vec2 uv = uUvOffset + uUvScale * aScreen;
  vec2 ndc = aScreen * 2.0 - 1.0;
  float d = texture2D(uDepth, uv).r; // 0 far, 1 near

  // Depth pushes vertices toward the camera in z.
  vec3 pos = vec3(ndc.x * uAspect, ndc.y, d * uDepthScale);

  // Orbit: yaw around Y, pitch around X. Because near vertices sit in front,
  // they swing farther than the far ones — that parallax is the "3D" feel.
  float cy = cos(uOrbit.x), sy = sin(uOrbit.x);
  pos.xz = mat2(cy, -sy, sy, cy) * pos.xz;
  float cp = cos(uOrbit.y), sp = sin(uOrbit.y);
  pos.yz = mat2(cp, -sp, sp, cp) * pos.yz;

  // Perspective: far plane (z=0) is 1:1, near plane is magnified.
  float w = uDolly - pos.z;
  vec2 proj = pos.xy * (uDolly / w);
  gl_Position = vec4(proj.x / uAspect, proj.y, 0.0, 1.0);
  vUv = uv;
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uImage;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(uImage, vUv); }`;

// A time-driven "3D clip": a photo + its depth map, rendered as a depth-
// displaced mesh under an orbiting perspective camera, so the scene appears to
// rotate in space with real parallax (near moves more than far). The same
// depth-parallax family as DepthPhoto, but scripted by time so it can later be
// recorded into the memoir video.
export default function DepthClip({
  src,
  depth,
  duration = 6,
  yaw = 0.16,
  pitch = 0.06,
  dolly = 1.0,
  dollyAmp = 0.12,
  depthScale = 0.3,
  className,
}) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(!depth || !src);

  useEffect(() => {
    if (!src || !depth) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { setFailed(true); return; }
    // The depth map is sampled in the vertex shader; some WebGL1 devices have
    // no vertex-texture units, so fall back to a still image in that case.
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) { setFailed(true); return; }

    const program = buildProgram(gl, VERT, FRAG);
    if (!program) { setFailed(true); return; }
    gl.useProgram(program);

    const aScreen = gl.getAttribLocation(program, 'aScreen');
    const uUvOffset = gl.getUniformLocation(program, 'uUvOffset');
    const uUvScale = gl.getUniformLocation(program, 'uUvScale');
    const uAspect = gl.getUniformLocation(program, 'uAspect');
    const uOrbit = gl.getUniformLocation(program, 'uOrbit');
    const uDolly = gl.getUniformLocation(program, 'uDolly');
    const uDepthScale = gl.getUniformLocation(program, 'uDepthScale');
    const uImage = gl.getUniformLocation(program, 'uImage');
    const uDepth = gl.getUniformLocation(program, 'uDepth');

    // A uniform screen grid; uv is derived per-vertex from the cover crop.
    const COLS = 72;
    const ROWS = 90;
    const grid = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
    const indices = new Uint16Array(COLS * ROWS * 6);
    let g = 0;
    for (let j = 0; j <= ROWS; j += 1) {
      for (let i = 0; i <= COLS; i += 1) {
        grid[g++] = i / COLS;
        grid[g++] = j / ROWS;
      }
    }
    let k = 0;
    for (let j = 0; j < ROWS; j += 1) {
      for (let i = 0; i < COLS; i += 1) {
        const a = j * (COLS + 1) + i;
        const b = a + 1;
        const c = a + COLS + 1;
        const d = c + 1;
        indices[k++] = a; indices[k++] = b; indices[k++] = c;
        indices[k++] = b; indices[k++] = d; indices[k++] = c;
      }
    }

    const gridBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aScreen);
    gl.vertexAttribPointer(aScreen, 2, gl.FLOAT, false, 0, 0);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const makeTexture = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };

    const loadImage = (url, crossOrigin) => new Promise((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = url;
    });

    let imageTex = null;
    let depthTex = null;
    let raf = 0;
    let disposed = false;

    // Cover-crop with a small margin so parallax never samples past the edges.
    const MARGIN = 0.1;
    const computeCrop = (img) => {
      const canvasAspect = canvas.width / canvas.height;
      const imgAspect = img.width / img.height;
      let sx = 1;
      let sy = 1;
      if (imgAspect > canvasAspect) sx = canvasAspect / imgAspect;
      else sy = imgAspect / canvasAspect;
      sx *= 1 - MARGIN;
      sy *= 1 - MARGIN;
      return { ox: (1 - sx) / 2, oy: (1 - sy) / 2, sx, sy };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform1f(uAspect, w / h);
      }
    };

    const draw = (now) => {
      const t = (now % (duration * 1000)) / (duration * 1000);
      const a = t * Math.PI * 2;
      // Smooth, loop-seamless orbit: yaw once per loop, pitch twice, plus a
      // gentle breathing dolly. All continuous at the loop boundary.
      gl.uniform2f(uOrbit, yaw * Math.sin(a), pitch * Math.sin(a * 2));
      gl.uniform1f(uDolly, dolly + dollyAmp * (0.5 - 0.5 * Math.cos(a)));
      gl.uniform1f(uDepthScale, depthScale);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      gl.uniform1i(uDepth, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, imageTex);
      gl.uniform1i(uImage, 1);

      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      raf = requestAnimationFrame(draw);
    };

    const init = async () => {
      try {
        const [img, depthImg] = await Promise.all([loadImage(src, true), loadImage(depth, false)]);
        if (disposed) return;
        resize();
        const crop = computeCrop(img);
        gl.uniform2f(uUvOffset, crop.ox, crop.oy);
        gl.uniform2f(uUvScale, crop.sx, crop.sy);

        imageTex = makeTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, imageTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

        depthTex = makeTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, depthTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, depthImg);

        raf = requestAnimationFrame(draw);
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (imageTex) resize(); });
      ro.observe(canvas);
    }

    init();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    };
  }, [src, depth, duration, yaw, pitch, dolly, dollyAmp, depthScale]);

  if (failed) return <img src={src} alt="" className={`${className || ''} ken-burns`} />;
  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

function buildProgram(gl, vs, fs) {
  const compile = (type, source) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };
  const v = compile(gl.VERTEX_SHADER, vs);
  const f = compile(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}
