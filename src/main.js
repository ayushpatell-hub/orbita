import gsap from "gsap";
import { SolarSystem } from "./scene/SolarSystem.js";

const $ = (id) => document.getElementById(id);
const panel = $("panel");
const result = $("result");

// Rough, simplified survival estimates for the simulator
const OUTCOMES = {
  mercury: "You would be scorched or frozen within seconds, depending on which side you land. No air to breathe.",
  venus: "Surface heat of 465°C and 92x Earth's pressure would kill you almost instantly.",
  earth: "Breathable air, liquid water and a protective magnetic field. You survive indefinitely.",
  mars: "The air is far too thin to breathe. You would lose consciousness in about 15 seconds, and the cold and radiation would do the rest.",
  jupiter: "There is no solid surface. Crushing pressure and lethal radiation would kill you almost at once.",
  saturn: "No solid surface and -140°C clouds. You would not survive.",
  uranus: "No surface, -195°C and a toxic atmosphere. You would not survive.",
  neptune: "No surface, -200°C and 2000 km/h winds. You would not survive.",
};

const system = new SolarSystem($("app"), (planet, mesh) => flyTo(planet, mesh));
const home = { pos: system.camera.position.clone(), target: system.controls.target.clone() };
let focused = null;
let savedSpeed = 0;

function flyTo(planet, mesh) {
  if (focused) return;
  focused = planet;
  savedSpeed = planet.speed;
  planet.speed = 0; // stop this planet so the camera can reach it

  const target = new mesh.constructor().position; // placeholder Vector3
  mesh.getWorldPosition(target);
  const dir = target.clone().normalize();
  const end = target.clone().sub(dir.multiplyScalar(planet.size * 4.5));
  end.y += planet.size * 1.2; // view the sunlit side

  system.controls.minDistance = 1;
  $("hint").style.opacity = 0;
  result.className = "";

  gsap.to(system.camera.position, { x: end.x, y: end.y, z: end.z, duration: 3, ease: "power3.inOut" });
  gsap.to(system.controls.target, {
    x: target.x, y: target.y, z: target.z, duration: 3, ease: "power3.inOut",
    onComplete: () => showPanel(planet),
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
  result.textContent = "Simulating...";
  result.className = "alive";
  setTimeout(() => {
    result.textContent = OUTCOMES[focused.id];
    result.className = focused.survivable ? "alive" : "dead";
  }, 900);
});

$("backBtn").addEventListener("click", () => {
  if (!focused) return;
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