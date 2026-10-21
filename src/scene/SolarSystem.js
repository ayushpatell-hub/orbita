import { createSun, createPlanet, createStarfield } from './textures.js';
import { applyPhotoTextures, applySkyBackground } from './photoTextures.js';import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PLANETS } from "../data/planets.js";
import {
  buildPlanetTexture, buildSunTexture, buildSkyTexture,
  buildCloudTexture, buildRingTexture, dotTexture,
} from "../utils/textures.js";

// [glow color, shell size relative to the planet]
const ATMOS = {
  venus: [0xffcc77, 1.07],
  earth: [0x5aa8ff, 1.08],
  mars: [0xff9966, 1.05],
  jupiter: [0xffd9a0, 1.05],
  saturn: [0xfff0c0, 1.05],
  uranus: [0x9ff0ff, 1.07],
  neptune: [0x4f7aff, 1.07],
};
const ROCKY = new Set(["mercury", "mars"]);

function atmosphereMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
        gl_FragColor = vec4(glowColor * f * 1.4, f);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

export class SolarSystem {
  constructor(container, onPlanetClick) {
    this.container = container;
    this.onPlanetClick = onPlanetClick;
    this.clock = new THREE.Clock();
    this.planets = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02030a);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3000);
    this.camera.position.set(0, 60, 130);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    container.appendChild(this.renderer.domElement);

    // Bloom makes the Sun glow like the real thing
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.6, 1.0));
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 400;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.addLights();
    this.addStars();
    this.addSun();
    PLANETS.forEach((p) => this.addPlanet(p));
    this.addEvents();
    this.queueTextures();
    this.running = true;
    this.animate();
  }

  addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    this.scene.add(new THREE.PointLight(0xffffff, 3, 0, 0));
  }

  addStars() {
    const dot = dotTexture();
    const layer = (count, pxSize) => {
      const pos = [];
      const col = [];
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 600);
        pos.push(v.x, v.y, v.z);
        const t = Math.random();
        if (t < 0.15) c.setRGB(0.65, 0.75, 1.0);
        else if (t < 0.6) c.setRGB(1, 1, 1);
        else if (t < 0.85) c.setRGB(1, 0.92, 0.76);
        else c.setRGB(1, 0.7, 0.5);
        c.multiplyScalar(0.45 + Math.random() * 0.55);
        col.push(c.r, c.g, c.b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      return new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: pxSize, sizeAttenuation: false, vertexColors: true, map: dot,
          transparent: true, alphaTest: 0.02, depthWrite: false,
        })
      );
    };
    this.scene.add(layer(5500, 2.2));
    this.scene.add(layer(600, 4.5));
  }

  glowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,200,80,1)");
    grad.addColorStop(0.3, "rgba(255,140,30,0.5)");
    grad.addColorStop(1, "rgba(255,100,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  addSun() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.color.setRGB(2.2, 1.4, 0.4); // brighter than white so it blooms
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(7, 96, 96), mat);

    const glowMat = () =>
      new THREE.SpriteMaterial({ map: this.glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Sprite(glowMat());
    glow.scale.set(40, 40, 1);
    const corona = new THREE.Sprite(glowMat());
    corona.material.opacity = 0.35;
    corona.scale.set(90, 90, 1);
    this.sun.add(glow, corona);
    this.scene.add(this.sun);
  }

  addPlanet(data) {
    const mat = new THREE.MeshStandardMaterial({
      color: data.color,
      roughness: data.id === "earth" ? 0.65 : 0.9,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.size, 64, 64), mat);
    mesh.userData = data;

    // holder keeps the glow and rings still while the planet itself spins
    const holder = new THREE.Group();
    holder.position.x = data.distance;
    holder.add(mesh);

    const atmo = ATMOS[data.id];
    if (atmo) {
      holder.add(new THREE.Mesh(new THREE.SphereGeometry(data.size * atmo[1], 64, 64), atmosphereMaterial(atmo[0])));
    }

    if (data.ring) {
      const inner = data.size * 1.4;
      const outer = data.size * 2.4;
      const geo = new THREE.RingGeometry(inner, outer, 128, 1);
      const p = geo.attributes.position;
      const uv = geo.attributes.uv;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
      }
      const ring = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ map: buildRingTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2.3;
      holder.add(ring);
    }

    const pivot = new THREE.Object3D();
    pivot.rotation.y = Math.random() * Math.PI * 2;
    pivot.add(holder);

    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(data.distance - 0.08, data.distance + 0.08, 256),
      new THREE.MeshBasicMaterial({ color: 0x4466aa, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
    );
    orbit.rotation.x = Math.PI / 2;
    this.scene.add(orbit, pivot);
    this.planets.push({ data, mesh, holder, pivot, clouds: null });
  }

  // Textures are generated one by one after the first frame so the page opens fast.
  // Planets start as plain colors and turn realistic within a few seconds.
  queueTextures() {
    const jobs = [];

    jobs.push(() => {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1900, 48, 24),
        new THREE.MeshBasicMaterial({ map: buildSkyTexture(), side: THREE.BackSide, depthWrite: false })
      );
      sky.renderOrder = -1;
      this.scene.add(sky);
    });

    jobs.push(() => {
      this.sun.material.map = buildSunTexture();
      this.sun.material.color.setRGB(1.8, 1.55, 1.3);
      this.sun.material.needsUpdate = true;
    });

    this.planets.forEach((p) =>
      jobs.push(() => {
        const id = p.data.id;
        const tex = buildPlanetTexture(id);
        const m = p.mesh.material;
        m.map = tex;
        m.color.set(0xffffff);
        if (ROCKY.has(id)) {
          m.bumpMap = tex;
          m.bumpScale = 0.8;
        }
        m.needsUpdate = true;
        if (id === "earth") {
          const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(p.data.size * 1.012, 64, 64),
            new THREE.MeshStandardMaterial({ map: buildCloudTexture(), transparent: true, depthWrite: false, roughness: 1 })
          );
          p.holder.add(clouds);
          p.clouds = clouds;
        }
      })
    );

    const next = () => {
      const job = jobs.shift();
      if (!job) return;
      job();
      setTimeout(next, 40);
    };
    setTimeout(next, 300);
  }

  addEvents() {
    let down = { x: 0, y: 0 };
    const el = this.renderer.domElement;

    el.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const hit = this.pick(e);
      if (hit && this.onPlanetClick) this.onPlanetClick(hit.userData, hit);
    });
    el.addEventListener("pointermove", (e) => {
      el.style.cursor = this.pick(e) ? "pointer" : "grab";
    });
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });
  }

  pick(e) {
    this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.planets.map((p) => p.mesh), false);
    return hits.length ? hits[0].object : null;
  }

  animate = () => {
    if (!this.running) return;
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.sun.rotation.y += dt * 0.03;
    this.planets.forEach((p) => {
      p.pivot.rotation.y += p.data.speed * dt * 4;
      p.mesh.rotation.y += dt * 0.5;
      if (p.clouds) p.clouds.rotation.y += dt * 0.6;
    });
    this.controls.update();
    this.composer.render();
  };
}