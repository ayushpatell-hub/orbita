import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const BASE = '/textures/';

const FILES = {
  sun:     { map: '2k_sun.jpg' },
  mercury: { map: '2k_mercury.jpg' },
  venus:   { map: '2k_venus_surface.jpg' },
  earth:   { map: '2k_earth_daymap.jpg', clouds: '2k_earth_clouds.jpg' },
  moon:    { map: '2k_moon.jpg' },
  mars:    { map: '2k_mars.jpg' },
  jupiter: { map: '2k_jupiter.jpg' },
  saturn:  { map: '2k_saturn.jpg', ring: '2k_saturn_ring_alpha.png' },
  uranus:  { map: '2k_uranus.jpg' },
  neptune: { map: '2k_neptune.jpg' },
};

function load(file, srgb = true) {
  return new Promise((resolve) => {
    loader.load(
      BASE + file,
      (t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => resolve(null)
    );
  });
}

export async function applyPhotoTextures(group, name) {
  const key = String(name).toLowerCase();
  const f = FILES[key];
  if (!f) return;
  const body = group.userData.body;
  if (!body) return;

  const map = await load(f.map);
  if (map) {
    body.material.map = map;
    if (body.material.bumpMap) {
      body.material.bumpMap = map;
      body.material.bumpScale = 0.4;
    }
    body.material.needsUpdate = true;
  }

  if (f.clouds) {
    const c = await load(f.clouds);
    if (c) {
      const r = body.geometry.parameters.radius;
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.01, 96, 96),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          alphaMap: c,
          transparent: true,
          depthWrite: false,
          opacity: 0.9,
        })
      );
      group.add(clouds);
      group.userData.clouds = clouds;
    }
  }

  if (f.ring) {
    const t = await load(f.ring);
    const ring = group.children.find((o) => o.geometry && o.geometry.type === 'RingGeometry');
    if (t && ring) {
      ring.material.map = t;
      ring.material.needsUpdate = true;
    }
  }
}

export async function applySkyBackground(scene) {
  const t = await load('2k_stars_milky_way.jpg');
  if (!t) return;
  t.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = t;
}