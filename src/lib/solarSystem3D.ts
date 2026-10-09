import * as THREE from "three";

export interface CelestialBodyInfo {
  id: string;
  name: string;
  symbol: string;
  type: "star" | "planet" | "moon" | "belt";
  color: string;
  colorHex: number;
  radius3D: number;
  orbitRadius: number; // In 3D units relative to its parent (Sun or Earth)
  orbitInclinationDeg: number;
  orbitSpeedRadPerSec: number;
  initialAngleRad: number;
  realDiameterKm: number;
  realDistanceAuOrKm: string;
  orbitalPeriodStr: string;
  classification: string;
  description: string;
  parent: "sun" | "earth";
}

// Fixed Heliocentric Sun Position in the deep background sky
// Earth is at (0,0,0); Sun is placed in the line of sight matching directional illumination
export const SUN_WORLD_POS = new THREE.Vector3(185, 75, 140);
export const ECLIPTIC_TILT_RAD = (23.44 * Math.PI) / 180; // Earth's axial obliquity to ecliptic

export const CELESTIAL_BODIES: CelestialBodyInfo[] = [
  {
    id: "sun",
    name: "Sun (Sol)",
    symbol: "☉",
    type: "star",
    color: "#f59e0b",
    colorHex: 0xf59e0b,
    radius3D: 15.0,
    orbitRadius: 0,
    orbitInclinationDeg: 0,
    orbitSpeedRadPerSec: 0,
    initialAngleRad: 0,
    realDiameterKm: 1392700,
    realDistanceAuOrKm: "1.000 AU (~149.6M km)",
    orbitalPeriodStr: "230M Years (Galactic)",
    classification: "G2V Main-Sequence Yellow Dwarf",
    description: "Central star of the Solar System containing 99.86% of the system's mass.",
    parent: "sun",
  },
  {
    id: "moon",
    name: "Moon (Luna)",
    symbol: "☽",
    type: "moon",
    color: "#e2e8f0",
    colorHex: 0xe2e8f0,
    radius3D: 1.35,
    orbitRadius: 36.0, // Visible orbiting just beyond Earth's GEO belt
    orbitInclinationDeg: 5.14,
    orbitSpeedRadPerSec: 0.045,
    initialAngleRad: 0.85,
    realDiameterKm: 3474,
    realDistanceAuOrKm: "384,400 km (Earth Orbit)",
    orbitalPeriodStr: "27.32 Days (Sidereal)",
    classification: "Planetary Natural Satellite",
    description: "Earth's sole natural satellite in synchronous rotation, responsible for ocean tides.",
    parent: "earth",
  },
  {
    id: "mercury",
    name: "Mercury",
    symbol: "☿",
    type: "planet",
    color: "#94a3b8",
    colorHex: 0x94a3b8,
    radius3D: 1.1,
    orbitRadius: 28.0,
    orbitInclinationDeg: 7.0,
    orbitSpeedRadPerSec: 0.08,
    initialAngleRad: 1.2,
    realDiameterKm: 4879,
    realDistanceAuOrKm: "0.387 AU",
    orbitalPeriodStr: "87.97 Earth Days",
    classification: "Terrestrial Rocky Planet",
    description: "Smallest planet, heavily cratered with zero substantial atmosphere and extreme temperatures.",
    parent: "sun",
  },
  {
    id: "venus",
    name: "Venus",
    symbol: "♀",
    type: "planet",
    color: "#fef08a",
    colorHex: 0xfef08a,
    radius3D: 1.85,
    orbitRadius: 42.0,
    orbitInclinationDeg: 3.39,
    orbitSpeedRadPerSec: 0.055,
    initialAngleRad: 3.4,
    realDiameterKm: 12104,
    realDistanceAuOrKm: "0.723 AU",
    orbitalPeriodStr: "224.7 Earth Days",
    classification: "Terrestrial Runaway Greenhouse",
    description: "Earth's shrouded twin shrouded in thick sulfuric acid clouds with surface pressure of 92 bar.",
    parent: "sun",
  },
  {
    id: "mars",
    name: "Mars",
    symbol: "♂",
    type: "planet",
    color: "#ef4444",
    colorHex: 0xef4444,
    radius3D: 1.45,
    orbitRadius: 65.0,
    orbitInclinationDeg: 1.85,
    orbitSpeedRadPerSec: 0.038,
    initialAngleRad: 5.1,
    realDiameterKm: 6779,
    realDistanceAuOrKm: "1.524 AU",
    orbitalPeriodStr: "686.98 Earth Days",
    classification: "Terrestrial Desert Planet",
    description: "The Red Planet featuring Olympus Mons volcano, Valles Marineris canyon, and polar water ice.",
    parent: "sun",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    symbol: "♃",
    type: "planet",
    color: "#f59e0b",
    colorHex: 0xf59e0b,
    radius3D: 4.8,
    orbitRadius: 108.0,
    orbitInclinationDeg: 1.3,
    orbitSpeedRadPerSec: 0.022,
    initialAngleRad: 2.1,
    realDiameterKm: 139820,
    realDistanceAuOrKm: "5.204 AU",
    orbitalPeriodStr: "11.86 Earth Years",
    classification: "Gas Giant with Great Red Spot",
    description: "Most massive planet in the Solar System with powerful magnetosphere and 95 known moons.",
    parent: "sun",
  },
  {
    id: "saturn",
    name: "Saturn",
    symbol: "♄",
    type: "planet",
    color: "#fcd34d",
    colorHex: 0xfcd34d,
    radius3D: 3.9,
    orbitRadius: 148.0,
    orbitInclinationDeg: 2.48,
    orbitSpeedRadPerSec: 0.016,
    initialAngleRad: 4.6,
    realDiameterKm: 116460,
    realDistanceAuOrKm: "9.582 AU",
    orbitalPeriodStr: "29.45 Earth Years",
    classification: "Ringed Gas Giant",
    description: "Adorned with extensive icy planetary ring system spanning over 282,000 km.",
    parent: "sun",
  },
  {
    id: "uranus",
    name: "Uranus",
    symbol: "♅",
    type: "planet",
    color: "#38bdf8",
    colorHex: 0x38bdf8,
    radius3D: 2.6,
    orbitRadius: 188.0,
    orbitInclinationDeg: 0.77,
    orbitSpeedRadPerSec: 0.011,
    initialAngleRad: 0.4,
    realDiameterKm: 50724,
    realDistanceAuOrKm: "19.22 AU",
    orbitalPeriodStr: "84.02 Earth Years",
    classification: "Ice Giant with Retrograde Tilt",
    description: "Ice giant featuring an extreme 97.77° axial tilt, effectively orbiting the Sun on its side.",
    parent: "sun",
  },
  {
    id: "neptune",
    name: "Neptune",
    symbol: "♆",
    type: "planet",
    color: "#3b82f6",
    colorHex: 0x3b82f6,
    radius3D: 2.5,
    orbitRadius: 228.0,
    orbitInclinationDeg: 1.77,
    orbitSpeedRadPerSec: 0.008,
    initialAngleRad: 2.9,
    realDiameterKm: 49244,
    realDistanceAuOrKm: "30.07 AU",
    orbitalPeriodStr: "164.79 Earth Years",
    classification: "Deep Blue Ice Giant",
    description: "Outermost major planet experiencing supersonic methane storms and planetary winds exceeding 2,100 km/h.",
    parent: "sun",
  },
];

/* -------------------------------------------------------------------------
   Procedural High-Fidelity Canvas Texture Generators
   ------------------------------------------------------------------------- */

export function createSunCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Radial photosphere fiery gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#fffbeb");
  grad.addColorStop(0.3, "#fef08a");
  grad.addColorStop(0.6, "#f59e0b");
  grad.addColorStop(0.9, "#d97706");
  grad.addColorStop(1, "#b45309");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Solar flare turbulent granularity
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = Math.random() * 12 + 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunspots
  ctx.fillStyle = "rgba(120, 53, 15, 0.65)";
  for (let i = 0; i < 18; i++) {
    const x = (0.2 + Math.random() * 0.6) * 512;
    const y = (0.3 + Math.random() * 0.4) * 256;
    const r = Math.random() * 5 + 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createMoonCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Pale lunar regolith base
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 0, 512, 256);

  // Lunar Maria (Dark Basalt Plains: Sea of Tranquility, Storms, etc.)
  ctx.fillStyle = "#64748b";
  const mariaBlobs = [
    { x: 160, y: 110, rx: 50, ry: 35 },
    { x: 230, y: 90, rx: 65, ry: 40 },
    { x: 290, y: 125, rx: 45, ry: 30 },
    { x: 380, y: 140, rx: 70, ry: 45 },
    { x: 110, y: 160, rx: 35, ry: 25 },
  ];
  mariaBlobs.forEach((m) => {
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Impact Craters with subtle rim highlights
  ctx.fillStyle = "#475569";
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1;
  for (let i = 0; i < 120; i++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 256;
    const cr = Math.random() * 6 + 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    if (cr > 3.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI);
      ctx.stroke();
    }
  }

  return new THREE.CanvasTexture(canvas);
}

export function createMarsCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Rust red / orange Martian desert surface
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#c2410c");
  grad.addColorStop(0.5, "#ea580c");
  grad.addColorStop(1, "#9a3412");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Dark volcanic basalt patches (Syrtis Major, Acidalia Planitia)
  ctx.fillStyle = "#7c2d12";
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 512;
    const y = 50 + Math.random() * 150;
    const rx = Math.random() * 45 + 15;
    const ry = Math.random() * 25 + 10;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar Ice Caps (North and South)
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.ellipse(256, 12, 140, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(256, 244, 110, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export function createJupiterCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Alternating ammonia and hydrosulfide cloud belts
  const colors = ["#fef3c7", "#fde68a", "#d97706", "#b45309", "#fef3c7", "#78350f", "#f59e0b", "#fde68a", "#92400e", "#fef3c7"];
  const bandHeight = 256 / colors.length;
  colors.forEach((c, idx) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, idx * bandHeight, 512, bandHeight);
  });

  // Storm eddies and swirls
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.random() * 30 + 10, Math.random() * 5 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Iconic Great Red Spot in Southern Tropical Zone
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.ellipse(320, 160, 32, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fef2f2";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(320, 160, 24, 12, 0, 0, Math.PI * 2);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export function createSaturnRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Radial concentric ring bands with Cassini Division
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, "rgba(217, 119, 6, 0.1)");
  grad.addColorStop(0.15, "rgba(251, 191, 36, 0.75)"); // Ring C
  grad.addColorStop(0.45, "rgba(253, 230, 138, 0.95)"); // Ring B (brightest)
  grad.addColorStop(0.55, "rgba(2, 6, 23, 0.05)");     // Cassini Division (dark gap)
  grad.addColorStop(0.62, "rgba(245, 158, 11, 0.85)");  // Ring A
  grad.addColorStop(0.85, "rgba(217, 119, 6, 0.7)");
  grad.addColorStop(0.92, "rgba(2, 6, 23, 0.02)");     // Encke Gap
  grad.addColorStop(1.0, "rgba(217, 119, 6, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 32);

  return new THREE.CanvasTexture(canvas);
}

/* -------------------------------------------------------------------------
   3D Solar System Scene Builder
   ------------------------------------------------------------------------- */

export interface BuiltSolarSystem {
  rootGroup: THREE.Group;
  bodyMeshes: Map<string, THREE.Group>;
  orbitLinesGroup: THREE.Group;
  sunGlowGroup: THREE.Group;
  asteroidBeltMesh: THREE.Points;
  moonGroup: THREE.Group;
  moonOrbitLine: THREE.Line;
}

export function buildSolarSystem3D(): BuiltSolarSystem {
  const rootGroup = new THREE.Group();
  rootGroup.name = "SolarSystem_Root";

  const bodyMeshes = new Map<string, THREE.Group>();
  const orbitLinesGroup = new THREE.Group();
  orbitLinesGroup.name = "SolarSystem_Orbits";
  rootGroup.add(orbitLinesGroup);

  // 1. Central Heliocentric Sun System
  const sunCenter = SUN_WORLD_POS.clone();

  // Sun Group placed in deep cosmic space
  const sunGroup = new THREE.Group();
  sunGroup.position.copy(sunCenter);
  sunGroup.name = "body_sun";

  // Glowing Sun Photosphere Sphere
  const sunGeo = new THREE.SphereGeometry(15.0, 36, 36);
  const sunTex = createSunCanvasTexture();
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTex,
    color: 0xfffbeb,
  });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunGroup.add(sunMesh);

  // Multi-layered coronal glow shells
  const sunGlowGroup = new THREE.Group();
  const coronaColors = [
    { radius: 17.5, color: 0xfef08a, opacity: 0.35 },
    { radius: 21.0, color: 0xf59e0b, opacity: 0.22 },
    { radius: 28.0, color: 0xd97706, opacity: 0.12 },
  ];
  coronaColors.forEach((layer) => {
    const cGeo = new THREE.SphereGeometry(layer.radius, 24, 24);
    const cMat = new THREE.MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const cMesh = new THREE.Mesh(cGeo, cMat);
    sunGlowGroup.add(cMesh);
  });
  sunGroup.add(sunGlowGroup);

  // Sunlight point light emanating from the Sun
  const solarPointLight = new THREE.PointLight(0xffedd5, 1.8, 1200);
  sunGroup.add(solarPointLight);

  rootGroup.add(sunGroup);
  bodyMeshes.set("sun", sunGroup);

  // 2. Earth's Natural Moon (Luna)
  const moonGroup = new THREE.Group();
  moonGroup.name = "body_moon";

  const moonGeo = new THREE.SphereGeometry(1.35, 24, 24);
  const moonTex = createMoonCanvasTexture();
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonGroup.add(moonMesh);

  // Initial Moon position at 36 units from Earth
  const initialMoonAngle = 0.85;
  const moonX = Math.cos(initialMoonAngle) * 36;
  const moonZ = Math.sin(initialMoonAngle) * 36;
  const moonY = Math.sin(initialMoonAngle) * 36 * Math.sin((5.14 * Math.PI) / 180);
  moonGroup.position.set(moonX, moonY, moonZ);

  rootGroup.add(moonGroup);
  bodyMeshes.set("moon", moonGroup);

  // Moon's orbit trajectory circle around Earth
  const moonOrbitPoints: THREE.Vector3[] = [];
  const moonOrbitSegments = 64;
  for (let i = 0; i <= moonOrbitSegments; i++) {
    const theta = (i / moonOrbitSegments) * Math.PI * 2;
    const x = Math.cos(theta) * 36;
    const z = Math.sin(theta) * 36;
    const y = Math.sin(theta) * 36 * Math.sin((5.14 * Math.PI) / 180);
    moonOrbitPoints.push(new THREE.Vector3(x, y, z));
  }
  const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPoints);
  const moonOrbitMat = new THREE.LineDashedMaterial({
    color: 0x94a3b8,
    dashSize: 1.0,
    gapSize: 0.6,
    transparent: true,
    opacity: 0.35,
  });
  const moonOrbitLine = new THREE.Line(moonOrbitGeo, moonOrbitMat);
  moonOrbitLine.computeLineDistances();
  orbitLinesGroup.add(moonOrbitLine);

  // 3. Planets Orbiting the Sun in the Ecliptic Plane
  const planets = CELESTIAL_BODIES.filter((b) => b.parent === "sun" && b.id !== "sun");

  planets.forEach((planet) => {
    const pGroup = new THREE.Group();
    pGroup.name = `body_${planet.id}`;

    // Planet sphere geometry and material
    const pGeo = new THREE.SphereGeometry(planet.radius3D, 24, 24);
    let pMat: THREE.Material;

    if (planet.id === "mars") {
      pMat = new THREE.MeshStandardMaterial({
        map: createMarsCanvasTexture(),
        roughness: 0.7,
        metalness: 0.1,
      });
    } else if (planet.id === "jupiter") {
      pMat = new THREE.MeshStandardMaterial({
        map: createJupiterCanvasTexture(),
        roughness: 0.6,
        metalness: 0.05,
      });
    } else if (planet.id === "saturn") {
      pMat = new THREE.MeshStandardMaterial({
        color: 0xfcd34d,
        roughness: 0.65,
        metalness: 0.05,
      });

      // Saturn's Ring System
      const innerR = planet.radius3D * 1.35;
      const outerR = planet.radius3D * 2.45;
      const ringGeo = new THREE.RingGeometry(innerR, outerR, 48);
      const ringTex = createSaturnRingTexture();
      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2 + 0.45; // 26.7° ring tilt
      pGroup.add(ringMesh);
    } else {
      pMat = new THREE.MeshStandardMaterial({
        color: planet.colorHex,
        roughness: 0.7,
        metalness: 0.1,
      });
    }

    const pMesh = new THREE.Mesh(pGeo, pMat);
    pGroup.add(pMesh);

    // Initial position along orbit relative to the Sun
    const theta = planet.initialAngleRad;
    const r = planet.orbitRadius;
    const incRad = (planet.orbitInclinationDeg * Math.PI) / 180;

    // Local coordinates relative to Sun in ecliptic plane tilted by ECLIPTIC_TILT_RAD
    const xOrb = r * Math.cos(theta);
    const zOrb = r * Math.sin(theta);
    const yOrb = zOrb * Math.sin(incRad);

    // Apply ecliptic tilt to Y/Z
    const yTilted = yOrb * Math.cos(ECLIPTIC_TILT_RAD) - zOrb * Math.sin(ECLIPTIC_TILT_RAD);
    const zTilted = yOrb * Math.sin(ECLIPTIC_TILT_RAD) + zOrb * Math.cos(ECLIPTIC_TILT_RAD);

    pGroup.position.set(sunCenter.x + xOrb, sunCenter.y + yTilted, sunCenter.z + zTilted);

    rootGroup.add(pGroup);
    bodyMeshes.set(planet.id, pGroup);

    // Planetary Orbit Path Line around the Sun
    const orbitPts: THREE.Vector3[] = [];
    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const xo = r * Math.cos(angle);
      const zo = r * Math.sin(angle);
      const yo = zo * Math.sin(incRad);

      const yt = yo * Math.cos(ECLIPTIC_TILT_RAD) - zo * Math.sin(ECLIPTIC_TILT_RAD);
      const zt = yo * Math.sin(ECLIPTIC_TILT_RAD) + zo * Math.cos(ECLIPTIC_TILT_RAD);

      orbitPts.push(new THREE.Vector3(sunCenter.x + xo, sunCenter.y + yt, sunCenter.z + zt));
    }

    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
    const orbitMat = new THREE.LineBasicMaterial({
      color: planet.colorHex,
      transparent: true,
      opacity: 0.22,
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitLinesGroup.add(orbitLine);
  });

  // 4. Asteroid Belt Between Mars and Jupiter
  const asteroidCount = 450;
  const asteroidGeo = new THREE.BufferGeometry();
  const asteroidPositions = new Float32Array(asteroidCount * 3);
  for (let i = 0; i < asteroidCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 82 + Math.random() * 18; // between 82 and 100 units from Sun
    const xo = r * Math.cos(angle);
    const zo = r * Math.sin(angle);
    const yo = (Math.random() - 0.5) * 5;

    const yt = yo * Math.cos(ECLIPTIC_TILT_RAD) - zo * Math.sin(ECLIPTIC_TILT_RAD);
    const zt = yo * Math.sin(ECLIPTIC_TILT_RAD) + zo * Math.cos(ECLIPTIC_TILT_RAD);

    asteroidPositions[i * 3] = sunCenter.x + xo;
    asteroidPositions[i * 3 + 1] = sunCenter.y + yt;
    asteroidPositions[i * 3 + 2] = sunCenter.z + zt;
  }
  asteroidGeo.setAttribute("position", new THREE.BufferAttribute(asteroidPositions, 3));
  const asteroidMat = new THREE.PointsMaterial({
    color: 0x94a3b8,
    size: 1.1,
    transparent: true,
    opacity: 0.45,
  });
  const asteroidBeltMesh = new THREE.Points(asteroidGeo, asteroidMat);
  rootGroup.add(asteroidBeltMesh);

  return {
    rootGroup,
    bodyMeshes,
    orbitLinesGroup,
    sunGlowGroup,
    asteroidBeltMesh,
    moonGroup,
    moonOrbitLine,
  };
}

/* -------------------------------------------------------------------------
   Animation Step for Solar System
   ------------------------------------------------------------------------- */

export function updateSolarSystem(
  system: BuiltSolarSystem,
  timeSec: number,
  simSpeedMultiplier: number
): Record<string, THREE.Vector3> {
  const positions: Record<string, THREE.Vector3> = {};
  const sunCenter = SUN_WORLD_POS;
  positions.sun = sunCenter.clone();

  // Subtle solar coronal breathing animation
  if (system.sunGlowGroup) {
    const pulse = 1.0 + Math.sin(timeSec * 0.8) * 0.05;
    system.sunGlowGroup.scale.set(pulse, pulse, pulse);
  }

  // 1. Update Moon Position around Earth
  const moonInfo = CELESTIAL_BODIES.find((b) => b.id === "moon")!;
  const moonAngle = moonInfo.initialAngleRad + timeSec * moonInfo.orbitSpeedRadPerSec * 0.4 * simSpeedMultiplier;
  const mX = Math.cos(moonAngle) * moonInfo.orbitRadius;
  const mZ = Math.sin(moonAngle) * moonInfo.orbitRadius;
  const mY = Math.sin(moonAngle) * moonInfo.orbitRadius * Math.sin((moonInfo.orbitInclinationDeg * Math.PI) / 180);

  if (system.moonGroup) {
    system.moonGroup.position.set(mX, mY, mZ);
    system.moonGroup.rotation.y += 0.002 * simSpeedMultiplier;
    positions.moon = system.moonGroup.position.clone();
  }

  // 2. Update Planets Orbiting the Sun
  const planets = CELESTIAL_BODIES.filter((b) => b.parent === "sun" && b.id !== "sun");
  planets.forEach((p) => {
    const mesh = system.bodyMeshes.get(p.id);
    if (!mesh) return;

    const angle = p.initialAngleRad + timeSec * p.orbitSpeedRadPerSec * 0.15 * simSpeedMultiplier;
    const r = p.orbitRadius;
    const incRad = (p.orbitInclinationDeg * Math.PI) / 180;

    const xo = r * Math.cos(angle);
    const zo = r * Math.sin(angle);
    const yo = zo * Math.sin(incRad);

    const yt = yo * Math.cos(ECLIPTIC_TILT_RAD) - zo * Math.sin(ECLIPTIC_TILT_RAD);
    const zt = yo * Math.sin(ECLIPTIC_TILT_RAD) + zo * Math.cos(ECLIPTIC_TILT_RAD);

    const worldPos = new THREE.Vector3(sunCenter.x + xo, sunCenter.y + yt, sunCenter.z + zt);
    mesh.position.copy(worldPos);
    mesh.rotation.y += 0.005 * simSpeedMultiplier;

    positions[p.id] = worldPos;
  });

  return positions;
}
