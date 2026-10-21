const PROFILES = {
  mercury: { o2: 15, heat: 30, rad: 86400,
    note: "No air and a surface that swings between -173°C and 427°C. You pass out from lack of oxygen first." },
  venus: { o2: 6, heat: 2, rad: 86400,
    note: "465°C and 92x Earth's pressure. The heat and crushing pressure kill you almost instantly." },
  earth: { o2: Infinity, heat: Infinity, rad: Infinity,
    note: "Breathable air, liquid water and a magnetic field that blocks radiation. You survive." },
  mars: { o2: 15, heat: 300, rad: 2592000,
    note: "The air is 1% as thick as Earth's and is mostly CO2. You lose consciousness in about 15 seconds. The cold and radiation would finish the job." },
  jupiter: { o2: 4, heat: 1, rad: 3,
    note: "There is no surface, only crushing pressure and lethal radiation. You would not last a moment." },
  saturn: { o2: 5, heat: 2, rad: 60,
    note: "No surface, -140°C clouds and no breathable air. You would not survive." },
  uranus: { o2: 5, heat: 2, rad: 600,
    note: "No surface, -195°C and a toxic atmosphere. You would not survive." },
  neptune: { o2: 5, heat: 1.5, rad: 600,
    note: "No surface, -200°C and winds near 2000 km/h. You would not survive." },
};

const LABELS = { o2: "Oxygen", heat: "Heat and pressure", rad: "Radiation" };
const SAFE_DEMO_SECONDS = 8;

const CSS = `
#simBox { margin-top: 12px; display: none; }
#simBox.show { display: block; }
#simBox .timer { font-size: 13px; opacity: .8; margin-bottom: 10px; }
#simBox .timer b { font-size: 20px; color: #ffb84d; }
#simBox .bar { margin-bottom: 8px; }
#simBox .bar span { display: block; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #7da2ff; margin-bottom: 3px; }
#simBox .track { height: 8px; background: #ffffff1f; border-radius: 6px; overflow: hidden; }
#simBox .fill { height: 100%; width: 100%; background: #30a46c; border-radius: 6px; }
#simBox .verdict { margin-top: 10px; padding: 12px; border-radius: 8px; font-size: 14px; line-height: 1.4; }
#simBox .verdict.dead { background: #4a1217; border: 1px solid #e5484d; }
#simBox .verdict.alive { background: #0f3a22; border: 1px solid #30a46c; }
`;

export function createSurvivalSimulator(anchor) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "simBox";
  anchor.insertAdjacentElement("afterend", box);

  let raf = null;

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    box.className = "";
    box.innerHTML = "";
  }

  function run(planet) {
    stop();
    const p = PROFILES[planet.id];
    if (!p) return;

    const keys = ["o2", "heat", "rad"];
    const deathTime = Math.min(p.o2, p.heat, p.rad);
    const survives = deathTime === Infinity;
    const endTime = survives ? SAFE_DEMO_SECONDS : deathTime;

    box.innerHTML =
      `<div class="timer">Time survived: <b id="simTime">0.0</b> s</div>` +
      keys.map((k) =>
        `<div class="bar"><span>${LABELS[k]}</span><div class="track"><div class="fill" id="bar-${k}"></div></div></div>`
      ).join("") +
      `<div id="simVerdict"></div>`;
    box.className = "show";

    const start = performance.now();
    const tick = (now) => {
      const elapsed = Math.min((now - start) / 1000, endTime);
      document.getElementById("simTime").textContent = elapsed.toFixed(1);

      keys.forEach((k) => {
        const left = p[k] === Infinity ? 1 : Math.max(0, 1 - elapsed / p[k]);
        const fill = document.getElementById("bar-" + k);
        fill.style.width = (left * 100).toFixed(1) + "%";
        fill.style.background = left > 0.5 ? "#30a46c" : left > 0.2 ? "#f5a524" : "#e5484d";
      });

      if (elapsed >= endTime) {
        const verdict = document.getElementById("simVerdict");
        verdict.className = "verdict " + (survives ? "alive" : "dead");
        verdict.textContent = survives
          ? "You survived. " + p.note
          : "You died after " + endTime.toFixed(1) + " s. " + p.note;
        raf = null;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  return { run, stop };
}