import * as THREE from "three";

// Per-planet look. Gas giants have no real surface, so they get a simulated cloud deck.
const THEMES = {
  mercury: { fog: 0x000000, density: 0.004, ground: 0x7a736b, amp: 1.5, spires: 25, stars: true, g: 3.7, light: 3,
    sun: { size: 40, color: 0xfff2cc, dir: [0.5, 0.35, -0.8] }, moons: [] },
  venus: { fog: 0xc9892b, density: 0.012, ground: 0x8a5a2b, amp: 1.2, spires: 20, g: 8.9, light: 1.2, moons: [] },
  earth: { fog: 0x87b8e8, density: 0.004, ground: 0x3f7d3a, amp: 1.5, spires: 12, g: 9.8, light: 2.5,
    sun: { size: 30, color: 0xfff6d8, dir: [0.4, 0.5, -0.8] },
    plants: { color: 0x4caf50, emissive: 0x0a3a0a }, water: { color: 0x2a6fbd, level: -3 },
    moons: [{ size: 40, color: 0xdddddd, dir: [-0.7, 0.4, -0.6] }] },
  mars: { fog: 0xc98d5b, density: 0.006, ground: 0xa5522a, amp: 1.8, spires: 40, g: 3.7, light: 2,
    sun: { size: 14, color: 0xfff0dd, dir: [0.5, 0.45, -0.75] },
    moons: [{ size: 12, color: 0x8a7a6a, dir: [-0.5, 0.55, -0.7] }, { size: 7, color: 0xa09484, dir: [-0.9, 0.3, -0.3] }] },
  jupiter: { fog: 0xb98c5e, density: 0.006, ground: 0xc79a6a, amp: 0.3, spires: 0, g: 24.8, light: 2, gas: true,
    sun: { size: 8, color: 0xffffff, dir: [0.5, 0.5, -0.7] },
    moons: [{ size: 60, color: 0xd8c27a, dir: [-0.6, 0.45, -0.6] }, { size: 35, color: 0xcfd8dc, dir: [0.8, 0.3, -0.4] }] },
  saturn: { fog: 0xcdb98a, density: 0.006, ground: 0xe0cf9a, amp: 0.3, spires: 0, g: 10.4, light: 1.8, gas: true,
    sun: { size: 6, color: 0xffffff, dir: [0.5, 0.5, -0.7] },
    moons: [{ size: 50, color: 0xd9a35a, dir: [-0.6, 0.45, -0.6] }] },
  uranus: { fog: 0x6fc6cc, density: 0.007, ground: 0x8ee0e4, amp: 0.3, spires: 0, g: 8.7, light: 1.5, gas: true,
    sun: { size: 4, color: 0xffffff, dir: [0.5, 0.5, -0.7] },
    moons: [{ size: 30, color: 0xbfc5c8, dir: [-0.6, 0.4, -0.6] }] },
  neptune: { fog: 0x2f45a8, density: 0.007, ground: 0x4a63d0, amp: 0.3, spires: 0, g: 11.2, light: 1.5, gas: true,
    sun: { size: 3, color: 0xffffff, dir: [0.5, 0.5, -0.7] },
    moons: [{ size: 38, color: 0xe4d8d8, dir: [-0.6, 0.4, -0.6] }] },
};

function moonTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#" + new THREE.Color(color).getHexString();
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.12})`;
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 22, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

function glowTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const hex = "#" + new THREE.Color(color).getHexString();
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, hex);
  grad.addColorStop(0.35, hex + "88");
  grad.addColorStop(1, hex + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class PlanetSurface {
  constructor() {
    this.active = false;
    this.looping = false;
    this.keys = {};
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.el = this.renderer.domElement;
    Object.assign(this.el.style, {
      position: "fixed", inset: "0", zIndex: "3", opacity: "0",
      pointerEvents: "none", transition: "opacity 1s ease", cursor: "grab",
    });
    document.body.appendChild(this.el);

    this.hud = document.createElement("div");
    Object.assign(this.hud.style, {
      position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: "4",
      background: "#000a", padding: "10px 18px", borderRadius: "20px", fontSize: "13px",
      color: "#fff", textAlign: "center", opacity: "0", transition: "opacity 1s", pointerEvents: "none",
    });
    document.body.appendChild(this.hud);

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 3000);
    this.camera.rotation.order = "YXZ";
    this.addEvents();
  }

  addEvents() {
    let dragging = false;
    this.el.addEventListener("pointerdown", () => { dragging = true; this.el.style.cursor = "grabbing"; });
    addEventListener("pointerup", () => { dragging = false; this.el.style.cursor = "grab"; });
    addEventListener("pointermove", (e) => {
      if (!dragging || !this.active) return;
      this.yaw -= e.movementX * 0.004;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - e.movementY * 0.004));
    });
    addEventListener("keydown", (e) => {
      if (!this.active) return;
      this.keys[e.code] = true;
      if (e.code === "Space") e.preventDefault();
    });
    addEventListener("keyup", (e) => (this.keys[e.code] = false));
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  build() {
    const t = this.theme;
    if (this.scene) this.disposeScene();
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(t.fog);
    scene.fog = new THREE.FogExp2(t.fog, t.density);

    const amp = t.amp;
    this.height = (x, z) =>
      (Math.sin(x * 0.05) * Math.cos(z * 0.045) * 4 + Math.sin(x * 0.13 + z * 0.1) * 1.2 + Math.cos(z * 0.21) * 0.6) * amp;

    // Lights
    const sunDir = new THREE.Vector3(...(t.sun ? t.sun.dir : [0.5, 0.6, -0.5])).normalize();
    const sunLight = new THREE.DirectionalLight(t.sun ? t.sun.color : 0xffffff, t.light);
    sunLight.position.copy(sunDir).multiplyScalar(200);
    scene.add(sunLight, new THREE.HemisphereLight(t.fog, t.ground, 0.9));

    // Terrain
    const geo = new THREE.PlaneGeometry(600, 600, 256, 256);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const base = new THREE.Color(t.ground);
    for (let i = 0; i < pos.count; i++) {
      const h = this.height(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      const shade = 0.7 + 0.3 * (h / amp / 6 + 0.5);
      colors.push(base.r * shade, base.g * shade, base.b * shade);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    // Rock spires
    const rockMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.45), flatShading: true, roughness: 1 });
    for (let i = 0; i < t.spires; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 50 + Math.random() * 200;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 20 + Math.random() * 45;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(3 + Math.random() * 6, h, 5 + Math.floor(Math.random() * 3), 1), rockMat);
      spire.position.set(x, this.height(x, z) + h / 2 - 2, z);
      spire.rotation.y = Math.random() * 6;
      scene.add(spire);
    }

    // Water
    if (t.water) {
      const w = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: t.water.color, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3 })
      );
      w.position.y = t.water.level * amp;
      scene.add(w);
    }

    // Plants / grass
    if (t.plants) {
      const blade = new THREE.ConeGeometry(0.08, 1, 4).translate(0, 0.5, 0);
      const mat = new THREE.MeshStandardMaterial({ color: t.plants.color, emissive: t.plants.emissive, emissiveIntensity: 1.2 });
      const count = 1800;
      const inst = new THREE.InstancedMesh(blade, mat, count);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
      let n = 0;
      while (n < count) {
        const x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 200;
        const y = this.height(x, z);
        if (y < t.water.level * amp + 0.4) continue;
        e.set((Math.random() - 0.5) * 0.5, Math.random() * 6, (Math.random() - 0.5) * 0.5);
        q.setFromEuler(e);
        const k = 0.6 + Math.random() * 1.2;
        inst.setMatrixAt(n++, m.compose(p.set(x, y, z), q, s.set(k, k, k)));
      }
      scene.add(inst);
    }

    // Sky: stars, sun, moons (follows the camera)
    this.sky = new THREE.Group();
    if (t.stars) {
      const sp = [];
      for (let i = 0; i < 2500; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(1500);
        if (v.y < -100) continue;
        sp.push(v.x, v.y, v.z);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
      this.sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false })));
    }
    if (t.sun) {
      const d = new THREE.Vector3(...t.sun.dir).normalize().multiplyScalar(900);
      const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(t.sun.size, 32, 32), new THREE.MeshBasicMaterial({ color: t.sun.color, fog: false }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(t.sun.color), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glow.scale.setScalar(t.sun.size * 6);
      sunMesh.position.copy(d);
      glow.position.copy(d);
      this.sky.add(sunMesh, glow);
    }
    t.moons.forEach((mo) => {
      const d = new THREE.Vector3(...mo.dir).normalize().multiplyScalar(850);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(mo.size, 32, 32), new THREE.MeshBasicMaterial({ map: moonTexture(mo.color), fog: false }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(0xffffff), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35, transparent: true, fog: false }));
      glow.scale.setScalar(mo.size * 3.5);
      moon.position.copy(d);
      glow.position.copy(d);
      this.sky.add(moon, glow);
    });
    scene.add(this.sky);
  }

  disposeScene() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  enter(id) {
    this.theme = THEMES[id] || THEMES.mars;
    this.build();
    this.yaw = 0;
    this.pitch = 0.05;
    this.x = 0;
    this.z = 0;
    this.jump = 0;
    this.vy = 0;
    const g = this.theme.g;
    const jumpH = (36 / (2 * g)).toFixed(1);
    this.hud.innerHTML =
      `Drag to look · W A S D to walk · Shift to run · Space to jump<br>` +
      `Gravity ${g} m/s² : your jump reaches about ${jumpH} m` +
      (this.theme.gas ? `<br><i>Gas giants have no solid surface. This is a simulated cloud deck.</i>` : "");
    this.active = true;
    this.el.style.pointerEvents = "auto";
    this.el.style.opacity = "1";
    this.hud.style.opacity = "1";
    this.clock.getDelta();
    if (!this.looping) { this.looping = true; this.loop(); }
  }

  exit() {
    this.active = false;
    this.keys = {};
    this.el.style.pointerEvents = "none";
    this.el.style.opacity = "0";
    this.hud.style.opacity = "0";
    setTimeout(() => { if (!this.active) this.looping = false; }, 1100);
  }

  loop = () => {
    if (!this.looping) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const k = this.keys;
    if (this.active) {
      const fwd =