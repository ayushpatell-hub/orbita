import * as THREE from "three";

const W = 768;
const H = 384;

const lerp = (a, b, t) => a + (b - a) * t;
const C = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf);
  yf = yf * yf * (3 - 2 * yf);
  zf = zf * zf * (3 - 2 * zf);
  const a = lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf);
  const b = lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf);
  const c = lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf);
  const d = lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf);
  return lerp(lerp(a, b, yf), lerp(c, d, yf), zf);
}

function fbm(x, y, z, oct) {
  let v = 0, amp = 0.5, f = 1, sum = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * noise3(x * f, y * f, z * f);
    sum += amp;
    f *= 2;
    amp *= 0.5;
  }
  return v / sum;
}

function sstep(a, b, x) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

function setMix(o, a, b, t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
}

function toward(o, b, t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  o[0] += (b[0] - o[0]) * t;
  o[1] += (b[1] - o[1]) * t;
  o[2] += (b[2] - o[2]) * t;
}

// Paints a sphere texture. Each pixel is turned into a 3D point on the sphere,
// so the noise has no seam and no pinching at the poles.
function paint(w, h, fn) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const o = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const py = Math.sin(lat);
    const r = Math.cos(lat);
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      o[3] = 255;
      fn(Math.cos(lon) * r, py, Math.sin(lon) * r, lat, o);
      const i = (y * w + x) * 4;
      d[i] = o[0];
      d[i + 1] = o[1];
      d[i + 2] = o[2];
      d[i + 3] = o[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCraters(n, minR, maxR) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection();
    const r = minR + Math.pow(Math.random(), 2.5) * (maxR - minR);
    list.push({ x: v.x, y: v.y, z: v.z, r, cmin: Math.cos(r * 1.35) });
  }
  return list;
}

function craterShade(list, px, py, pz) {
  let s = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const dot = c.x * px + c.y * py + c.z * pz;
    if (dot < c.cmin) continue;
    const t = Math.acos(Math.min(1, dot)) / c.r;
    if (t < 1) s -= (1 - t * t) * 0.28;
    else s += Math.sin(((t - 1) / 0.35) * Math.PI) * 0.18;
  }
  return s;
}

const WHITE = C(0xffffff);

export function buildPlanetTexture(id) {
  switch (id) {
    case "mercury": {
      const cr = makeCraters(140, 0.02, 0.2);
      return paint(W, H, (x, y, z, lat, o) => {
        const n = fbm(x * 4, y * 4, z * 4, 5);
        const g = 95 + n * 110;
        const k = 1 + craterShade(cr, x, y, z);
        o[0] = g * k;
        o[1] = g * 0.97 * k;
        o[2] = g * 0.92 * k;
      });
    }
    case "venus": {
      const A = C(0xf0cf8a), B = C(0xb97a38);
      return paint(W, H, (x, y, z, lat, o) => {
        const w = fbm(x * 2, y * 2, z * 2, 4);
        const n = fbm(x * 3 + w * 2.5, y * 7 + w * 2, z * 3 + w * 2.5, 5);
        setMix(o, A, B, sstep(0.3, 0.7, n));
      });
    }
    case "earth": {
      const SHALLOW = C(0x2d78b8), DEEP = C(0x0a2a63), GREEN = C(0x3c7a30);
      const BROWN = C(0x9b7a45), SAND = C(0xcdb987), ROCK = C(0x8a8579);
      const sea = 0.535;
      return paint(W, H, (x, y, z, lat, o) => {
        const h = fbm(x * 2.3 + 10, y * 2.3, z * 2.3 + 10, 6);
        if (h < sea) {
          setMix(o, SHALLOW, DEEP, sstep(0, 0.35, (sea - h) / sea));
        } else {
          const e = (h - sea) / (1 - sea);
          const dry = fbm(x * 3 + 40, y * 3, z * 3 + 40, 4);
          setMix(o, GREEN, BROWN, sstep(0.35, 0.65, dry + e * 0.8 - 0.3));
          toward(o, SAND, 1 - sstep(0, 0.04, h - sea));
          toward(o, ROCK, sstep(0.35, 0.6, e));
        }
        const a = Math.abs(lat) / (Math.PI / 2);
        toward(o, WHITE, sstep(0.8, 0.9, a + (h - 0.5) * 0.15));
      });
    }
    case "mars": {
      const LIGHT = C(0xc9743c), DARK = C(0x7a3a22);
      const cr = makeCraters(70, 0.02, 0.16);
      return paint(W, H, (x, y, z, lat, o) => {
        const big = fbm(x * 1.8 + 5, y * 1.8, z * 1.8 + 5, 5);
        const fine = fbm(x * 9, y * 9, z * 9, 4);
        setMix(o, LIGHT, DARK, sstep(0.45, 0.65, big));
        const dust = 0.82 + fine * 0.35;
        const k = dust * (1 + craterShade(cr, x, y, z));
        o[0] *= k;
        o[1] *= k;
        o[2] *= k;
        const a = Math.abs(lat) / (Math.PI / 2);
        toward(o, WHITE, sstep(0.86, 0.93, a + (fine - 0.5) * 0.08));
      });
    }
    case "jupiter": {
      const CREAM = C(0xe9d8b4), BROWN = C(0xb8764a), DARK = C(0x7d4a2e), SPOT = C(0xb5432a);
      return paint(W, H, (x, y, z, lat, o) => {
        const w = fbm(x * 2.5, y * 2.5, z * 2.5, 4) * 0.35;
        const band = Math.sin((y + w) * 16) * 0.5 + 0.5;
        const fine = fbm(x * 5, y * 28, z * 5, 4);
        setMix(o, CREAM, BROWN, sstep(0.2, 0.8, band * 0.7 + fine * 0.5));
        toward(o, DARK, sstep(0.62, 0.8, fine) * 0.5);
        let dl = Math.atan2(z, x) - 2.2;
        dl = Math.atan2(Math.sin(dl), Math.cos(dl));
        const dy = lat + 0.33;
        const e = (dl * dl) / 0.09 + (dy * dy) / 0.01;
        if (e < 1) toward(o, SPOT, (1 - e) * 0.9);
      });
    }
    case "saturn": {
      const A = C(0xeadba9), B = C(0xc6ad76);
      return paint(W, H, (x, y, z, lat, o) => {
        const w = fbm(x * 2, y * 2, z * 2, 3) * 0.25;
        const band = Math.sin((y + w) * 12) * 0.5 + 0.5;
        const fine = fbm(x * 4, y * 22, z * 4, 4);
        setMix(o, A, B, sstep(0.2, 0.8, band * 0.6 + fine * 0.6) * 0.85);
      });
    }
    case "uranus": {
      const A = C(0xa8eef0), B = C(0x7fcfd6);
      return paint(W, H, (x, y, z, lat, o) => {
        const band = Math.sin(y * 9) * 0.5 + 0.5;
        const fine = fbm(x * 3, y * 10, z * 3, 3);
        setMix(o, A, B, band * 0.4 + fine * 0.5);
      });
    }
    case "neptune": {
      const A = C(0x3a5fd9), B = C(0x1c3392), STREAK = C(0xcfe0ff);
      return paint(W, H, (x, y, z, lat, o) => {
        const band = Math.sin(y * 11 + fbm(x * 2, y * 2, z * 2, 3) * 2) * 0.5 + 0.5;
        const fine = fbm(x * 4, y * 14, z * 4, 4);
        setMix(o, A, B, band * 0.5 + fine * 0.5);
        toward(o, STREAK, sstep(0.7, 0.82, fbm(x * 4 + 20, y * 16, z * 4, 3)) * 0.55);
      });
    }
    default:
      return paint(64, 32, (x, y, z, lat, o) => {
        o[0] = o[1] = o[2] = 150;
      });
  }
}

export function buildSunTexture() {
  const A = C(0xff7a12), B = C(0xffd878), SPOT = C(0x6a2a08);
  return paint(W, H, (x, y, z, lat, o) => {
    const n = fbm(x * 10, y * 10, z * 10, 5);
    const cell = fbm(x * 34 + 3, y * 34, z * 34, 3);
    setMix(o, A, B, sstep(0.25, 0.75, n * 0.7 + cell * 0.5));
    toward(o, SPOT,