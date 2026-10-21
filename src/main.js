import gsap from "gsap";
import { Vector3 } from "three";
import { SolarSystem } from "./scene/SolarSystem.js";
import { PlanetSurface } from "./scene/PlanetSurface.js";
import { createSurvivalSimulator } from "./ui/SurvivalSimulator.js";

const $ = (id) => document.getElementById(id);
const panel = $("panel");

const system = new SolarSystem($("app"), (planet, mesh) => flyTo(planet, mesh));
const surface = new PlanetSurface();
const sim = createSurvivalSimulator($("simBtn"));
const home = { pos: system.camera.position.clone(), target: system.controls.target.clone() };
let focused = null;
let savedSpeed = 0;

function enterSurface(planet) {
  system.running = false;
  surface.enter(planet.id);
}

function leaveSurface() {
  if (!surface.active) return;
  surface.exit();
  system.clock.getDelta();
  if (!system.running) {
    system.running = true;
    system.animate();
  }
}

function flyTo(planet, mesh) {
  if (focused) return;
  focused = planet;
  savedSpeed = planet.speed;
  planet.speed = 0;

  const target = new Vector3();
  mesh.getWorldPosition(target);
  const dir = target.clone().normalize();
  const end = target.clone().sub(dir.multiplyScalar(planet.size * 4.5));
  end.y += planet.size * 1.2;

  system.controls.minDistance = 1;
  $("hint").style.opacity = 0;
  sim.stop();

  gsap.to(system.camera.position, { x: end.x, y: end.y, z: end.z, duration: 3, ease: "power3.inOut" });
  gsap.to(system.controls.target, {
    x: target.x, y: target.y, z: target.z, duration: 3, ease: "power3.inOut",
    onComplete: () => {
      showPanel(planet);
      setTimeout(() => { if (focused === planet) enterSurface(planet); }, 600);
    },
  });
}

function showPanel(p) {
  $("pName").textContent = p.name;
  $("pTemp").textContent = p.temp;
  $("pGravity").textContent = p.gravity;
  $("pAtmo").textContent = p.atmosphere;
  $("pWater").textContent = p.water;
  $("pRad").textContent = p.radiation;
  panel.classList.add("open");
}

$("simBtn").addEventListener("click", () => {
  if (!focused) return;
  sim.run(focused);
});

$("backBtn").addEventListener("click", () => {
  if (!focused) return;
  sim.stop();
  leaveSurface();
  panel.classList.remove("open");
  const planet = focused;
  gsap.to(system.camera.position, { x: home.pos.x, y: home.pos.y, z: home.pos.z, duration: 2.5, ease: "power3.inOut" });
  gsap.to(system.controls.target, {
    x: home.target.x, y: home.target.y, z: home.target.z, duration: 2.5, ease: "power3.inOut",
    onComplete: () => {
      planet.speed = savedSpeed;
      system.controls.minDistance = 10;
      $("hint").style.opacity = 0.7;
      focused = null;
    },
  });
});

// ===== Loading screen =====
const loader = $("loader");
const loaderBar = $("loaderBar");
let progress = 0;
const loaderTimer = setInterval(() => {
  progress = Math.min(progress + Math.random() * 18, 95);
  loaderBar.style.width = progress + "%";
}, 150);

function hideLoader() {
  clearInterval(loaderTimer);
  loaderBar.style.width = "100%";
  setTimeout(() => {
    loader.classList.add("done");
    setTimeout(() => loader.remove(), 1000);
  }, 400);
}

if (document.readyState === "complete") {
  setTimeout(hideLoader, 800);
} else {
  window.addEventListener("load", () => setTimeout(hideLoader, 800));
}