import { useEffect, useRef, useState } from 'react';

const VERT = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vUv = uUvOffset + aTexCoord * uUvScale;
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2 uMouse;      // -1..1 across the viewport
uniform float uStrength;  // ~0.03, parallax amount in UV space
varying vec2 vUv;
void main() {
  float d = texture2D(uDepth, vUv).r; // 0 = far, 1 = near
  vec2 uv = vUv + uMouse * uStrength * d;
  gl_FragColor = texture2D(uImage, uv);
}`;

// A "3D photo": a still image whose pixels shift by depth as the pointer moves,
// giving real parallax. The depth map (bright = near) is baked ahead of time so
// there's no runtime AI call. Falls back to a plain <img> if WebGL is missing
// or either texture can't load.
export default function DepthPhoto({ src, depth, alt, className }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(!depth);

  useEffect(() => {
    if (!depth || !src || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { setFailed(true); return; }

    let raf = 0;
    let disposed = false;
    const mouse = { x: 0, y: 0 }; // lerped
    const target = { x: 0, y: 0 };
    let lastPointer = 0;
    const start = performance.now();

    const program = buildProgram(gl, VERT, FRAG);
    if (!program) { setFailed(true); return; }
    gl.useProgram(program);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
    const uUvOffset = gl.getUniformLocation(program, 'uUvOffset');
    const uUvScale = gl.getUniformLocation(program, 'uUvScale');
    const uImage = gl.getUniformLocation(program, 'uImage');
    const uDepth = gl.getUniformLocation(program, 'uDepth');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uStrength = gl.getUniformLocation(program, 'uStrength');

    // Fullscreen quad (two triangles), v=0 at the bottom.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

    gl.uniform1i(uImage, 0);
    gl.uniform1i(uDepth, 1);

    const STRENGTH = 0.035;

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

    // Cover-crop the image into the canvas (like object-fit: cover), plus a small
    // extra crop so the parallax displacement never samples past the edges.
    const MARGIN = 0.08; // 4% each side
    const computeCrop = (img) => {
      const canvasAspect = canvas.width / canvas.height;
      const imgAspect = img.width / img.height;
      let sx = 1, sy = 1;
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
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const onPointer = (e) => {
      const r = canvas.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = 1 - ((e.clientY - r.top) / r.height) * 2;
      lastPointer = performance.now();
    };
    const onLeave = () => { target.x = 0; target.y = 0; lastPointer = 0; };

    const draw = (now) => {
      const idle = Math.min((now - lastPointer) / 2500, 1); // 0 = fresh pointer, 1 = idle
      const t = (now - start) / 1000;
      const idleX = Math.sin(t * 0.35) * 0.55;
      const idleY = Math.cos(t * 0.27) * 0.4;
      const goalX = idle * idleX + (1 - idle) * target.x;
      const goalY = idle * idleY + (1 - idle) * target.y;
      mouse.x += (goalX - mouse.x) * 0.07;
      mouse.y += (goalY - mouse.y) * 0.07;

      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uStrength, STRENGTH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imageTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

        depthTex = makeTexture();
        gl.activeTexture(gl.TEXTURE1);
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
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerleave', onLeave);

    init();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerleave', onLeave);
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    };
  }, [src, depth]);

  if (failed) {
    return <img src={src} alt={alt} className={`${className || ''} ken-burns`} />;
  }
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
