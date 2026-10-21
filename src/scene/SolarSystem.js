import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PLANETS } from "../data/planets.js";
import { makeTexture, createRings } from "./textures.js";

// ---------- photo loading (falls back to generated textures if missing) ----------
const texLoader = new THREE.TextureLoader();
function loadPhoto(file, srgb = true) {
  return new Promise((resolve) => {
    texLoader.load(
      "/textures/" + file,
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

const PHOTO = {
  mercury: "2k_mercury.jpg",
  venus: "2k_venus_surface.jpg",
  earth: "2k_earth_daymap.jpg",
  mars: "2k_mars.jpg",
  jupiter: "2k_jupiter.jpg",
  saturn: "2k_saturn.jpg",
  uranus: "2k_uranus.jpg",
  neptune: "2k_neptune.jpg",
};

const ROCKY = new Set(["mercury", "mars"]);

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.4, "rgba(255,255,255,0.8)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
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

    // Bloom (kept soft so only the Sun glows)
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 1.0));
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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
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
    mat.color.setRGB(2.2, 1.4, 0.4);
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(7, 96, 96), mat);

    const glowMat = () =>
      new THREE.SpriteMaterial({ map: this.glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false });

    // smaller haze so it doesn't cover the inner planets
    const glow = new THREE.Sprite(glowMat());
    glow.scale.set(22, 22, 1);
    const corona = new THREE.Sprite(glowMat());
    corona.material.opacity = 0.18;
    corona.scale.set(38, 38, 1);
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

    // holder keeps rings still while the planet itself spins
    const holder = new THREE.Group();
    holder.position.x = data.distance;
    holder.add(mesh);

    // (no glow shell around planets)

    let ring = null;
    if (data.ring) {
      ring = createRings(data.size * 1.4, data.size * 2.4);
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
    this.planets.push({ data, mesh, holder, pivot, ring, clouds: null });
  }

  // Each texture tries the real photo first, then the generated one.
  queueTextures() {
    const jobs = [];

    // Milky Way sky
    jobs.push(async () => {
      const t = await loadPhoto("2k_stars_milky_way.jpg");
      if (!t) return;
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1900, 48, 24),
        new THREE.MeshBasicMaterial({ map: t, color: 0xaaaaaa, side: THREE.BackSide, depthWrite: false })
      );
      sky.renderOrder = -1;
      this.scene.add(sky);
    });

    // Sun
    jobs.push(async () => {
      const t = (await loadPhoto("2k_sun.jpg")) || makeTexture("sun", 1024, 512);
      this.sun.material.map = t;
      this.sun.material.color.setRGB(1.8, 1.55, 1.3);
      this.sun.material.needsUpdate = true;
    });

    // Planets
    this.planets.forEach((p) =>
      jobs.push(async () => {
        const id = p.data.id;
        const tex = (PHOTO[id] && (await loadPhoto(PHOTO[id]))) || makeTexture(id);
        const m = p.mesh.material;
        m.map = tex;
        m.color.set(0xffffff);
        if (ROCKY.has(id)) {
          m.bumpMap = tex;
          m.bumpScale = 0.8;
        }
        m.needsUpdate = true;

        if (id === "earth") {
          const ct = await loadPhoto("2k_earth_clouds.jpg", false);
          if (ct) {
            const clouds = new THREE.Mesh(
              new THREE.SphereGeometry(p.data.size * 1.012, 64, 64),
              new THREE.MeshStandardMaterial({
                color: 0xffffff, alphaMap: ct, transparent: true, depthWrite: false, opacity: 0.9, roughness: 1,
              })
            );
            p.holder.add(clouds);
            p.clouds = clouds;
          }
        }

        if (id === "saturn" && p.ring) {
          const rt = await loadPhoto("2k_saturn_ring_alpha.png");
          if (rt) {
            p.ring.material.map = rt;
            p.ring.material.needsUpdate = true;
          }
        }
      })
    );

    const next = async () => {
      const job = jobs.shift();
      if (!job) return;
      try {
        await job();
      } catch (e) {
        console.warn("texture job failed", e);
      }
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