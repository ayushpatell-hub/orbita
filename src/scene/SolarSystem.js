import * as THREE from 'three';
import * as PLANET_DATA from '../data/planets.js';
import { createSun, createPlanet, createStarfield } from './textures.js';
import { applyPhotoTextures, applySkyBackground } from './photoTextures.js';

// Fallback data in case your planets.js uses different names
const FALLBACK = [
  { name: 'Mercury', radius: 1.0, distance: 18,  speed: 0.040 },
  { name: 'Venus',   radius: 1.6, distance: 26,  speed: 0.030 },
  { name: 'Earth',   radius: 1.7, distance: 36,  speed: 0.025 },
  { name: 'Mars',    radius: 1.3, distance: 46,  speed: 0.020 },
  { name: 'Jupiter', radius: 4.5, distance: 66,  speed: 0.012 },
  { name: 'Saturn',  radius: 3.8, distance: 90,  speed: 0.009 },
  { name: 'Uranus',  radius: 2.6, distance: 112, speed: 0.006 },
  { name: 'Neptune', radius: 2.5, distance: 132, speed: 0.005 },
];

function getList() {
  const raw =
    PLANET_DATA.planets || PLANET_DATA.PLANETS || PLANET_DATA.planetData ||
    PLANET_DATA.default || FALLBACK;
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list.map((p, i) => ({
    ...p,
    name: p.name || FALLBACK[i]?.name || 'Planet' + i,
    radius: p.radius ?? p.size ?? FALLBACK[i]?.radius ?? 1.5,
    distance: p.distance ?? p.orbitRadius ?? p.orbit ?? p.dist ?? FALLBACK[i]?.distance ?? 20 + i * 15,
    speed: p.speed ?? p.orbitSpeed ?? FALLBACK[i]?.speed ?? 0.02,
  }));
}

export class SolarSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.planets = [];   // { data, pivot, mesh (group), angle }
    this.clickables = [];

    scene.add(this.group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    scene.add(createStarfield());
    applySkyBackground(scene);

    this.sun = createSun(8);
    applyPhotoTextures(this.sun, 'sun');
    this.group.add(this.sun);
    this.sun.userData.body.userData.planetName = 'Sun';
    this.clickables.push(this.sun.userData.body);

    getList().forEach((data, i) => {
      const mesh = createPlanet(data.name, data.radius);
      applyPhotoTextures(mesh, data.name);

      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * data.distance, 0, Math.sin(angle) * data.distance);
      mesh.userData.body.userData.planetName = data.name;
      mesh.userData.body.userData.planetData = data;
      mesh.userData.data = data;
      mesh.name = data.name;
      this.group.add(mesh);

      // orbit ring line
      const pts = [];
      for (let k = 0; k <= 256; k++) {
        const a = (k / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * data.distance, 0, Math.sin(a) * data.distance));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3a4a6a, transparent: true, opacity: 0.35 })
      );
      this.group.add(line);

      this.planets.push({ data, mesh, angle });
      this.clickables.push(mesh.userData.body);
    });
  }

  update(delta = 0.016) {
    this.sun.userData.body.rotation.y += 0.0005;
    this.planets.forEach((p) => {
      p.angle += p.data.speed * delta;
      p.mesh.position.x = Math.cos(p.angle) * p.data.distance;
      p.mesh.position.z = Math.sin(p.angle) * p.data.distance;
      p.mesh.userData.body.rotation.y += 0.004;
      if (p.mesh.userData.clouds) p.mesh.userData.clouds.rotation.y += 0.0007;
    });
  }

  getPlanetByName(name) {
    return this.planets.find((p) => p.data.name.toLowerCase() === String(name).toLowerCase());
  }
}

export function createSolarSystem(scene) {
  return new SolarSystem(scene);
}
export default SolarSystem;