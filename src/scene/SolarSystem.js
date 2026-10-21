import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLANETS } from "../data/planets.js";

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
    this.running = true;
    this.animate();
  }

  addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0);
    this.scene.add(sunLight);
  }

  addStars() {
    const pos = [];
    for (let i = 0; i < 4000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(500 + Math.random() * 1000);
      pos.push(v.x, v.y, v.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
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
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(7, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xffaa22 })
    );
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.scale.set(40, 40, 1);
    this.sun.add(glow);
    this.scene.add(this.sun);
  }

  addPlanet(data) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(data.size, 48, 48),
      new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.9 })
    );
    const pivot = new THREE.Object3D();
    pivot.rotation.y = Math.random() * Math.PI * 2;
    mesh.position.x = data.distance;
    mesh.userData = data;
    pivot.add(mesh);

    if (data.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(data.size * 1.4, data.size * 2.3, 96),
        new THREE.MeshBasicMaterial({ color: 0xcdb98a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
      );
      ring.rotation.x = Math.PI / 2.3;
      mesh.add(ring);
    }

    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(data.distance - 0.08, data.distance + 0.08, 256),
      new THREE.MeshBasicMaterial({ color: 0x4466aa, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
    );
    orbit.rotation.x = Math.PI / 2;
    this.scene.add(orbit, pivot);
    this.planets.push({ data, mesh, pivot });
  }

  addEvents() {
    let down = { x: 0, y: 0 };
    const el = this.renderer.domElement;

    el.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // it was a drag
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
    });
  }

  pick(e) {
    this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.planets.map((p) => p.mesh));
    return hits.length ? hits[0].object : null;
  }

  animate = () => {
    if (!this.running) return;
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    this.sun.rotation.y += dt * 0.05;
    this.planets.forEach((p) => {
      p.pivot.rotation.y += p.data.speed * dt * 4;
      p.mesh.rotation.y += dt * 0.5;
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}