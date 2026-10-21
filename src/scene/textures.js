// src/utils/textures.js
// Procedural realistic planets + Sun. No downloads needed.
import * as THREE from 'three';

/* ---------- 3D value noise (seamless on a sphere) ---------- */
function hash(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = (t) => t * t * (3 - 2 * t);
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf), yf),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf), yf),
    zf
  );
}
function fbm(x, y, z, oct = 5) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * f, y * f, z * f);
    f *= 2; a *= 0.5;
  }
  return v;
}

/* ---------- colour helpers ---------- */
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function ramp(stops, t) {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mix(stops[i], stops[i + 1], t - i);
}

/* ---------- planet shaders (return [r,g,b]) ---------- */
const STYLES = {
  mercury: (p) => {
    const n = fbm(p.x * 5, p.y * 5, p.z * 5, 6);
    const crater = Math.abs(noise3(p.x * 18, p.y * 18, p.z * 18) - 0.5) * 2;
    return ramp([hex(0x4a4543), hex(0x8c8580), hex(0xb5aea6)], n * 0.8 + crater * 0.25);
  },
  venus: (p) => {
    const n = fbm(p.x * 2 + fbm(p.x * 3, p.y * 3, p.z * 3) * 1.5, p.y * 6, p.z * 2, 5);
    return ramp([hex(0xa8742f), hex(0xd9a559), hex(0xf0d9a0)], n);
  },
  earth: (p) => {
    const h = fbm(p.x * 2.4 + 5, p.y * 2.4, p.z * 2.4, 6);
    const lat = Math.abs(p.y);
    let c;
    if (h < 0.5) {
      c = mix(hex(0x06214d), hex(0x1d63a8), clamp((h - 0.3) / 0.2));
    } else {
      const e = (h - 0.5) / 0.3;
      const dry = fbm(p.x * 3, p.y * 3, p.z * 3, 3);
      c = e < 0.5
        ? mix(hex(0x2f6b2f), hex(0x6f8a3a), dry)
        : mix(hex(0x7a6a45), hex(0xdad5c8), clamp(e - 0.5) * 2);
      if (lat < 0.35 && dry > 0.55) c = mix(c, hex(0xc9a867), 0.6); // deserts
    }
    if (lat > 0.86) c = mix(c, hex(0xffffff), clamp((lat - 0.86) * 12));
    const cl = clamp((fbm(p.x * 4 + 9, p.y * 6, p.z * 4, 5) - 0.5) * 3);
    return mix(c, hex(0xffffff), cl * 0.85);
  },
  moon: (p) => {
    const n = fbm(p.x * 6, p.y * 6, p.z * 6, 6);
    const crater = Math.abs(noise3(p.x * 22, p.y * 22, p.z * 22) - 0.5) * 2;
    return ramp([hex(0x555555), hex(0x9a9a9a), hex(0xcfcfcf)], n * 0.7 + crater * 0.3);
  },
  mars: (p) => {
    const n = fbm(p.x * 4, p.y * 4, p.z * 4, 6);
    const dark = fbm(p.x * 2 + 3, p.y * 2, p.z * 2, 4);
    let c = ramp([hex(0x5b2a16), hex(0xa8512a), hex(0xd98a52)], n);
    c = mix(c, hex(0x3a1f14), clamp((dark - 0.55) * 3) * 0.5);
    if (Math.abs(p.y) > 0.9) c = mix(c, hex(0xffffff), clamp((Math.abs(p.y) - 0.9) * 14));
    return c;
  },
  jupiter: (p) => {
    const turb = fbm(p.x * 4, p.y * 14, p.z * 4, 5);
    const band = Math.sin(p.y * 22 + turb * 4.5) * 0.5 + 0.5;
    let c = ramp([hex(0x7a4a2c), hex(0xc99b6b), hex(0xefe0c8), hex(0xb5714a)], band);
    // Great Red Spot
    const dx = Math.atan2(p.z, p.x) - 0.8, dy = (p.y + 0.3) * 3.2;
    const d = Math.sqrt(dx * dx * 2 + dy * dy);
    if (d < 0.5) c = mix(c, hex(0xb4452b), clamp(1 - d / 0.5));
    return c;
  },
  saturn: (p) => {
    const turb = fbm(p.x * 3, p.y * 10, p.z * 3, 4);
    const band = Math.sin(p.y * 18 + turb * 2.5) * 0.5 + 0.5;
    return ramp([hex(0xa88f5a), hex(0xd8c28a), hex(0xf1e2b8)], band * 0.7 + turb * 0.3);
  },
  uranus: (p) => {
    const band = Math.sin(p.y * 10 + fbm(p.x * 2, p.y * 4, p.z * 2) * 1.5) * 0.5 + 0.5;
    return ramp([hex(0x7ecfd4), hex(0xa6e3e6), hex(0xc8f0f0)], band);
  },
  neptune: (p) => {
    const turb = fbm(p.x * 3, p.y * 8, p.z * 3, 5);
    const band = Math.sin(p.y * 12 + turb * 3) * 0.5 + 0.5;
    let c = ramp([hex(0x1a3a9a), hex(0x2f5fd6), hex(0x5a8cf0)], band);
    const streak = clamp((fbm(p.x * 6 + 4, p.y * 20, p.z * 6, 3) - 0.62) * 6);
    return mix(c, hex(0xe8f0ff), streak * 0.5);
  },
  sun: (p) => {
    const g = fbm(p.x * 8, p.y * 8, p.z * 8, 6);
    const big = fbm(p.x * 2, p.y * 2, p.z * 2, 3);
    let c = ramp([hex(0xff4b00), hex(0xff9a1a), hex(0xffd84a), hex(0xfff3b0)], g * 0.8 + big * 0.3);
    const spot = clamp((fbm(p.x * 3 + 7, p.y * 3, p.z * 3, 3) - 0.68) * 8);
    return mix(c, hex(0x8a2400), spot * 0.7);
  },
};

const cache = {};
export function makeTexture(name, w = 1024, h = 512) {
  if (cache[name]) return cache[name];
  const style = STYLES[name] || STYLES.moon;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const p = { x: 0, y: 0, z: 0 };
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - j / h) * Math.PI;
    const cy = Math.sin(lat), cr = Math.cos(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i / w) * Math.PI * 2;
      p.x = cr * Math.cos(lon); p.y = cy; p.z = cr * Math.sin(lon);
      const c = style(p);
      const k = (j * w + i) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache[name] = tex;
  return tex;
}

/* ---------- atmosphere (fresnel glow) ---------- */
function atmosphere(radius, color, power = 3.0, scale = 1.12) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vN = normalize(normalMatrix*normal);
        vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; uniform float p; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), p);
        gl_FragColor = vec4(c, f); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 64, 64), mat);
}

const ATMOS = {
  venus: [0xffd28a, 3.0], earth: [0x4a9bff, 2.6], mars: [0xff8a5a, 4.0],
  jupiter: [0xe8c9a0, 4.0], saturn: [0xf0dca0, 4.0], uranus: [0x8fe8ee, 2.8], neptune: [0x4a7bff, 2.8],
};

/* ---------- public API ---------- */
// name: 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'moon'
export function createPlanet(name, radius) {
  const key = name.toLowerCase();
  const rocky = ['mercury', 'mars', 'moon'].includes(key);
  const tex = makeTexture(key);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: rocky ? 0.95 : 0.8,
    metalness: 0,
    bumpMap: rocky ? tex : null,
    bumpScale: rocky ? 0.6 : 0,
  });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), mat);
  group.add(mesh);
  group.userData.body = mesh; // rotate this one for day/night spin

  if (key === 'earth') {
    const cloudCv = makeTexture('earth'); // reuse; clouds are baked in
    mesh.material.map = cloudCv;
  }
  if (ATMOS[key]) group.add(atmosphere(radius, ATMOS[key][0], ATMOS[key][1]));
  if (key === 'saturn') group.add(createRings(radius * 1.3, radius * 2.3));
  return group;
}

export function createRings(inner, outer) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 1024; i++) {
    const t = i / 1024;
    let a = 0.15 + fbm(t * 40, 1, 1, 4) * 0.9;
    if (t > 0.46 && t < 0.52) a *= 0.05; // Cassini division
    if (t < 0.08 || t > 0.97) a *= 0.3;
    const c = mix(hex(0xb59f78), hex(0xe6d7b0), fbm(t * 25, 3, 3, 3));
    ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a)})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  ring.rotation.x = -Math.PI / 2 + 0.47; // tilt
  return ring;
}

export function createSun(radius = 8) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: makeTexture('sun', 2048, 1024) });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), mat);
  group.add(sun);
  group.userData.body = sun;

  // soft glow layers
  group.add(atmosphere(radius, 0xff9a1a, 1.6, 1.15));
  group.add(atmosphere(radius, 0xff6a00, 2.5, 1.5));

  // glow sprite
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,230,160,0.9)');
  grad.addColorStop(0.3, 'rgba(255,150,40,0.35)');
  grad.addColorStop(1, 'rgba(255,100,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.setScalar(radius * 6);
  group.add(sprite);

  const light = new THREE.PointLight(0xfff1d0, 3.2, 0, 0);
  group.add(light);
  return group;
}

export function createStarfield(count = 6000, radius = 900) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(t), radius * u, radius * s * Math.sin(t)], i * 3);
    const tint = Math.random();
    col.set([0.8 + tint * 0.2, 0.85 + tint * 0.1, 1 - tint * 0.3], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9,
  }));
}