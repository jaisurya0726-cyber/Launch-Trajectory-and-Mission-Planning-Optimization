import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Mission, TrajectoryData } from "../types";
import {
  Globe,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Eye,
  Sliders,
  Layers,
  Compass,
  Zap,
  Info,
  Radio,
  Crosshair,
  Filter,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Gauge,
  ArrowUpRight,
  Pin,
  Lock,
  Rocket,
  Sun,
  Sparkles,
} from "lucide-react";
import {
  buildSolarSystem3D,
  updateSolarSystem,
  SUN_WORLD_POS,
  CELESTIAL_BODIES,
  BuiltSolarSystem,
} from "../lib/solarSystem3D";

interface OrbitVisualizer3DProps {
  mission: Mission;
  trajectory: TrajectoryData;
  currentIndex?: number;
  onIndexChange?: (idx: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

// Satellite Definition for Multi-Satellite Constellation Visualizer
export interface VisualizerSatellite {
  id: string;
  name: string;
  category: "primary" | "station" | "science" | "constellation" | "navigation" | "weather" | "earth_obs";
  categoryLabel: string;
  orbitType: string;
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity: number;
  raanDeg: number; // Right Ascension of Ascending Node (plane rotation around Earth polar axis)
  initialPhaseDeg: number;
  color: string;
  colorHex: number;
  modelType: "primary_probe" | "station" | "telescope" | "flat_panel" | "comm_nav" | "geo_comm" | "earth_obs";
  description: string;
  countryOrOrg: string;
}

// Global launch sites coordinate database
const LAUNCH_SITES: Record<string, { lat: number; lon: number; label: string }> = {
  "Satish Dhawan Space Centre, Sriharikota": { lat: 13.72, lon: 80.23, label: "SDSC SHAR (India)" },
  "Kennedy Space Center": { lat: 28.57, lon: -80.65, label: "KSC (USA)" },
  "Cape Canaveral": { lat: 28.39, lon: -80.60, label: "Cape Canaveral (USA)" },
  "Guiana Space Centre": { lat: 5.23, lon: -52.76, label: "CSG Kourou (ESA)" },
  "Vandenberg Space Force Base": { lat: 34.74, lon: -120.57, label: "VSFB (USA)" },
  "Baikonur Cosmodrome": { lat: 45.96, lon: 63.30, label: "Baikonur (Kazakhstan)" },
  "Tanegashima Space Center": { lat: 30.40, lon: 130.97, label: "Tanegashima (JAXA)" },
  "Jiuquan Satellite Launch Center": { lat: 40.96, lon: 100.29, label: "Jiuquan (China)" },
  "Xichang Satellite Launch Center": { lat: 28.25, lon: 102.03, label: "Xichang (China)" },
};

// Earth physical constants
const EARTH_RADIUS_KM = 6371;
const MU_EARTH = 398600.4418; // km^3 / s^2 (Standard gravitational parameter)

// Scale factor for 3D world: Earth radius = 10 units
const R_EARTH_3D = 10.0;

// Perceptual logarithmic scaling for altitudes to keep Earth and orbits visible
function scaleAltTo3D(altKm: number): number {
  if (altKm <= 2000) {
    return R_EARTH_3D * (1 + (altKm / EARTH_RADIUS_KM) * 1.8);
  }
  const norm = Math.log10(altKm / 2000) * 1.25;
  return R_EARTH_3D * (1 + 0.6 + norm);
}

// Converts lat/lon/alt(km) to 3D Cartesian coordinates (Three.js coordinates: Y is polar up, Z towards viewer)
function latLonAltToVector3(latDeg: number, lonDeg: number, altKm: number, rScale: number = R_EARTH_3D): THREE.Vector3 {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  const r = rScale * (1 + altKm / EARTH_RADIUS_KM);

  const x = -r * Math.sin(phi) * Math.cos(theta);
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Computes sub-satellite geographic latitude & longitude from 3D world vector and Earth rotation angle
function vector3ToSubSatelliteLatLon(pos: THREE.Vector3, earthRotYRad: number): { lat: number; lon: number } {
  const r = pos.length();
  if (r === 0) return { lat: 0, lon: 0 };

  const phi = Math.acos(Math.min(Math.max(pos.y / r, -1), 1));
  const lat = 90 - (phi * 180) / Math.PI;

  const theta = Math.atan2(pos.z, -pos.x);
  let lon = (theta * 180) / Math.PI - 180;
  lon -= (earthRotYRad * 180) / Math.PI;

  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon };
}

// Procedural Canvas generator for High-Detail Earth Texture
function createEarthCanvasTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep ocean background
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, "#081b2e");
  oceanGrad.addColorStop(0.5, "#0b2545");
  oceanGrad.addColorStop(1, "#081b2e");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Stylized continents representation with geographic coordinates
  ctx.fillStyle = "#163852";
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1.5;

  const toCanvas = (lon: number, lat: number) => {
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  const landmasses = [
    // North America
    [[-165, 65], [-140, 70], [-100, 72], [-65, 60], [-60, 48], [-75, 38], [-80, 25], [-97, 20], [-105, 23], [-118, 34], [-125, 48], [-160, 58], [-165, 65]],
    // South America
    [[-80, 10], [-60, 12], [-35, -5], [-40, -22], [-55, -35], [-70, -53], [-75, -45], [-80, -5], [-80, 10]],
    // Eurasia
    [[-10, 36], [0, 44], [10, 55], [30, 70], [60, 73], [100, 76], [140, 72], [170, 65], [145, 45], [120, 32], [105, 20], [80, 15], [75, 28], [55, 25], [40, 38], [25, 36], [10, 36], [-10, 36]],
    // Africa
    [[-15, 30], [10, 37], [35, 32], [50, 12], [42, -10], [30, -32], [18, -34], [10, 0], [-15, 12], [-15, 30]],
    // Australia
    [[115, -22], [130, -12], [145, -15], [152, -28], [148, -38], [130, -35], [115, -32], [115, -22]],
    // Antarctica
    [[-180, -75], [180, -75], [180, -90], [-180, -90]],
  ];

  landmasses.forEach((poly) => {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const [x, y] = toCanvas(lon, lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Latitude & Longitude Graticule grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 45) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Equator Line (High visibility cyan dashed)
  const eqY = height / 2;
  ctx.strokeStyle = "rgba(34, 211, 238, 0.7)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(0, eqY);
  ctx.lineTo(width, eqY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Prime Meridian (Greenwich)
  const pmX = width / 2;
  ctx.strokeStyle = "rgba(147, 197, 253, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pmX, 0);
  ctx.lineTo(pmX, height);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Builds authentic 3D mesh model for different satellite categories
function buildSatelliteModel3D(sat: VisualizerSatellite): THREE.Group {
  const group = new THREE.Group();
  group.name = `sat_${sat.id}`;

  if (sat.modelType === "station") {
    // Space Station (ISS / Tiangong style)
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.7 })
    );
    group.add(truss);

    const mainModule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.75, 12),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25, metalness: 0.8 })
    );
    mainModule.rotation.x = Math.PI / 2;
    group.add(mainModule);

    const crossModule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.75 })
    );
    group.add(crossModule);

    const wingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.6 });
    [-1.0, 1.0].forEach((xOffset) => {
      [-0.25, 0.25].forEach((zOffset) => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.7), wingMat);
        wing.position.set(xOffset, 0, zOffset);
        group.add(wing);
      });
    });

    const radiatorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const rad1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.25), radiatorMat);
    rad1.position.set(-0.35, 0.2, 0);
    group.add(rad1);
  } else if (sat.modelType === "telescope") {
    // Optical Space Telescope (Hubble style)
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 0.85, 16),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.15, metalness: 0.9 })
    );
    tube.rotation.x = Math.PI / 2;
    group.add(tube);

    const baffle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    baffle.position.z = 0.45;
    baffle.rotation.x = Math.PI / 2;
    group.add(baffle);

    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.6 });
    [-0.55, 0.55].forEach((xOff) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.3), panelMat);
      panel.position.set(xOff, 0, -0.05);
      group.add(panel);
    });
  } else if (sat.modelType === "flat_panel") {
    // Megaconstellation Flat Panel (Starlink style)
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.06, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.85 })
    );
    group.add(chassis);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.02, 1.15),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.2, metalness: 0.7 })
    );
    wing.position.set(0, 0, 0.85);
    group.add(wing);
  } else if (sat.modelType === "geo_comm" || sat.modelType === "comm_nav") {
    // Geostationary Communication / Navigation Bus
    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.35, metalness: 0.8 })
    );
    group.add(bus);

    const dishMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.4 });
    const dish1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.05, 0.08, 16), dishMat);
    dish1.position.set(0.26, 0.15, 0);
    dish1.rotation.z = -Math.PI / 3;
    group.add(dish1);

    const dish2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.05, 0.08, 16), dishMat);
    dish2.position.set(-0.26, 0.15, 0);
    dish2.rotation.z = Math.PI / 3;
    group.add(dish2);

    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.6 });
    [-1.1, 1.1].forEach((xOff) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.4), panelMat);
      panel.position.set(xOff, 0, 0);
      group.add(panel);
    });
  } else if (sat.modelType === "earth_obs") {
    // Earth Observation Satellite
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.42, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.7 })
    );
    group.add(body);

    const cameraCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
    );
    cameraCone.position.set(0, -0.3, 0);
    group.add(cameraCone);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.03, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.2, metalness: 0.6 })
    );
    panel.position.set(0.9, 0, 0);
    group.add(panel);
  } else {
    // Primary Mission Target Probe
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.48, 6),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25, metalness: 0.85 })
    );
    group.add(body);

    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.04, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.3, metalness: 0.7 })
    );
    dish.position.set(0, 0.28, 0.15);
    dish.rotation.x = Math.PI / 4;
    group.add(dish);

    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.6 });
    [-0.9, 0.9].forEach((xOff) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.42), panelMat);
      p.position.set(xOff, 0, 0);
      group.add(p);
    });
  }

  // Glowing beacon point light
  const beacon = new THREE.PointLight(sat.colorHex, 1.8, 4.5);
  beacon.position.set(0, 0, 0);
  beacon.name = `beacon_${sat.id}`;
  group.add(beacon);

  // Holographic Selection / Hover Reticle Ring (billboards to camera)
  const reticleGeo = new THREE.RingGeometry(0.65, 0.78, 32);
  const reticleMat = new THREE.MeshBasicMaterial({
    color: sat.colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const reticle = new THREE.Mesh(reticleGeo, reticleMat);
  reticle.name = `reticle_${sat.id}`;
  group.add(reticle);

  // Enlarged interaction hit sphere for easy hover & clicking in 3D
  const hitSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitSphere.name = `hit_${sat.id}`;
  group.add(hitSphere);

  return group;
}

export const OrbitVisualizer3D: React.FC<OrbitVisualizer3DProps> = ({
  mission,
  trajectory,
  currentIndex = 0,
  onIndexChange,
  isPlaying = false,
  onTogglePlay,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // User interactive state toggles
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showOrbit, setShowOrbit] = useState<boolean>(true);
  const [showAscentTrajectory, setShowAscentTrajectory] = useState<boolean>(true);
  const [showAtmosphere, setShowAtmosphere] = useState<boolean>(true);
  const [showEquatorPlane, setShowEquatorPlane] = useState<boolean>(true);
  const [showGroundTrack, setShowGroundTrack] = useState<boolean>(true);
  const [animateOrbitSatellite, setAnimateOrbitSatellite] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<"orbit" | "ascent" | "polar" | "equatorial" | "track" | "solar">("orbit");

  // Solar System background controls
  const [showSolarSystem, setShowSolarSystem] = useState<boolean>(true);
  const [showPlanetaryOrbits, setShowPlanetaryOrbits] = useState<boolean>(true);
  const [showCelestialLabels, setShowCelestialLabels] = useState<boolean>(true);
  const [selectedCelestialId, setSelectedCelestialId] = useState<string | null>(null);
  const [celestialScreenCoords, setCelestialScreenCoords] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

  // Multi-satellite constellation controls
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>("primary");
  const [hoveredSatelliteId, setHoveredSatelliteId] = useState<string | null>(null);
  const [isHoverCardPinned, setIsHoverCardPinned] = useState<boolean>(false);
  const [fleetCategoryFilter, setFleetCategoryFilter] = useState<string>("all");
  const [fleetOrbitsMode, setFleetOrbitsMode] = useState<"all" | "selected" | "none">("all");
  const [showSatelliteLabels, setShowSatelliteLabels] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [isRocketDetailsOpen, setIsRocketDetailsOpen] = useState<boolean>(false);
  const [isFleetPanelOpen, setIsFleetPanelOpen] = useState<boolean>(false);

  // Real-time telemetry map for all fleet satellites
  const [fleetTelemetry, setFleetTelemetry] = useState<
    Record<
      string,
      {
        altKm: number;
        velocityKms: number;
        velocityKmh: number;
        lat: number;
        lon: number;
        periodMin: number;
      }
    >
  >({});

  // 2D Screen projected positions for interactive floating labels & hover tooltips
  const [satelliteScreenCoords, setSatelliteScreenCoords] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

  // Launch pad site coordinates
  const launchSite = useMemo(() => {
    const match = LAUNCH_SITES[mission.launch_site];
    return match || { lat: 13.72, lon: 80.23, label: mission.launch_site };
  }, [mission.launch_site]);

  // Satellite Fleet Database: Primary Mission + Reference Constellation Satellites
  const satellites: VisualizerSatellite[] = useMemo(() => {
    const isElliptical =
      mission.target_orbit.includes("GTO") ||
      mission.target_orbit.includes("Transfer") ||
      mission.target_orbit.includes("Elliptical");

    const primary: VisualizerSatellite = {
      id: "primary",
      name: mission.satellite_name,
      category: "primary",
      categoryLabel: "Primary Mission Payload",
      orbitType: mission.target_orbit,
      altitudeKm: mission.altitude,
      inclinationDeg: mission.inclination,
      eccentricity: isElliptical ? 0.58 : 0.0008,
      raanDeg: 45,
      initialPhaseDeg: 0,
      color: "#22d3ee", // Cyan
      colorHex: 0x22d3ee,
      modelType: "primary_probe",
      description: `Active mission target payload launched by ${mission.rocket} (${mission.data_type} dataset)`,
      countryOrOrg: mission.launch_site.includes("Sriharikota") ? "ISRO" : mission.launch_site.includes("KSC") ? "NASA" : "ESA / Global",
    };

    const fleetReference: VisualizerSatellite[] = [
      {
        id: "iss",
        name: "ISS (Zarya Station)",
        category: "station",
        categoryLabel: "Space Station",
        orbitType: "LEO",
        altitudeKm: 418,
        inclinationDeg: 51.6,
        eccentricity: 0.0006,
        raanDeg: 135,
        initialPhaseDeg: 120,
        color: "#f59e0b", // Amber
        colorHex: 0xf59e0b,
        modelType: "station",
        description: "International Space Station multi-laboratory crewed orbital complex",
        countryOrOrg: "NASA / ESA / JAXA / Roscosmos",
      },
      {
        id: "tiangong",
        name: "Tiangong CSS (Tianhe)",
        category: "station",
        categoryLabel: "Space Station",
        orbitType: "LEO",
        altitudeKm: 389,
        inclinationDeg: 41.5,
        eccentricity: 0.0004,
        raanDeg: 300,
        initialPhaseDeg: 40,
        color: "#eab308", // Yellow
        colorHex: 0xeab308,
        modelType: "station",
        description: "Modular low-Earth orbit crewed space research complex",
        countryOrOrg: "CMSA",
      },
      {
        id: "hst",
        name: "Hubble Space Telescope",
        category: "science",
        categoryLabel: "Space Science",
        orbitType: "LEO",
        altitudeKm: 540,
        inclinationDeg: 28.5,
        eccentricity: 0.0003,
        raanDeg: 215,
        initialPhaseDeg: 260,
        color: "#c084fc", // Purple
        colorHex: 0xc084fc,
        modelType: "telescope",
        description: "Precision deep-space optical telescope orbiting above atmospheric distortion",
        countryOrOrg: "NASA / ESA",
      },
      {
        id: "starlink",
        name: "Starlink-v2 Constellation",
        category: "constellation",
        categoryLabel: "Megaconstellation",
        orbitType: "LEO",
        altitudeKm: 550,
        inclinationDeg: 53.0,
        eccentricity: 0.0001,
        raanDeg: 340,
        initialPhaseDeg: 190,
        color: "#38bdf8", // Sky Blue
        colorHex: 0x38bdf8,
        modelType: "flat_panel",
        description: "Direct-to-cell inter-satellite laser mesh broadband communication node",
        countryOrOrg: "SpaceX",
      },
      {
        id: "cartosat2",
        name: "Cartosat-2 (SSO)",
        category: "earth_obs",
        categoryLabel: "Earth Observation",
        orbitType: "Sun-Synchronous (SSO)",
        altitudeKm: 630,
        inclinationDeg: 97.9,
        eccentricity: 0.001,
        raanDeg: 275,
        initialPhaseDeg: 80,
        color: "#06b6d4", // Cyan
        colorHex: 0x06b6d4,
        modelType: "earth_obs",
        description: "Sun-synchronous high-resolution multi-spectral reconnaissance satellite",
        countryOrOrg: "ISRO",
      },
      {
        id: "navic",
        name: "NavIC / IRNSS-1I",
        category: "navigation",
        categoryLabel: "Satellite Navigation",
        orbitType: "Geosynchronous (GSO)",
        altitudeKm: 20650,
        inclinationDeg: 29.5,
        eccentricity: 0.0012,
        raanDeg: 165,
        initialPhaseDeg: 310,
        color: "#10b981", // Emerald
        colorHex: 0x10b981,
        modelType: "comm_nav",
        description: "Precision regional navigation constellation atomic clock carrier",
        countryOrOrg: "ISRO",
      },
      {
        id: "insat3ds",
        name: "INSAT-3DS (GEO Sounder)",
        category: "weather",
        categoryLabel: "Geostationary Weather",
        orbitType: "Geostationary (GEO)",
        altitudeKm: 35786,
        inclinationDeg: 0.1,
        eccentricity: 0.0002,
        raanDeg: 60,
        initialPhaseDeg: 15,
        color: "#f43f5e", // Rose
        colorHex: 0xf43f5e,
        modelType: "geo_comm",
        description: "Meteorological and oceanographic infrared sounder platform locked in GEO slot",
        countryOrOrg: "ISRO / IMD",
      },
    ];

    return [primary, ...fleetReference];
  }, [mission]);

  // Active selected satellite object
  const selectedSatellite = useMemo(() => {
    return satellites.find((s) => s.id === selectedSatelliteId) || satellites[0];
  }, [satellites, selectedSatelliteId]);

  // Active satellite currently displaying the details telemetry card (only on explicit click/pinned selection, never on cursor hover)
  const activeHoverSatellite = useMemo(() => {
    if (isHoverCardPinned) {
      return selectedSatellite;
    }
    return null;
  }, [isHoverCardPinned, selectedSatellite]);

  // Filtered satellite list based on UI category filter
  const filteredSatellites = useMemo(() => {
    if (fleetCategoryFilter === "all") return satellites;
    if (fleetCategoryFilter === "stations") return satellites.filter((s) => s.category === "station");
    if (fleetCategoryFilter === "leo") return satellites.filter((s) => s.altitudeKm <= 1000);
    if (fleetCategoryFilter === "high") return satellites.filter((s) => s.altitudeKm > 1000);
    return satellites;
  }, [satellites, fleetCategoryFilter]);

  // Keplerian orbital elements computed for the currently selected satellite
  const orbitalParams = useMemo(() => {
    const alt = selectedSatellite.altitudeKm;
    const isElliptical = selectedSatellite.eccentricity > 0.05;

    const perigeeAltKm = isElliptical ? Math.max(250, alt * 0.1) : alt;
    const apogeeAltKm = alt;

    const rPerigee = EARTH_RADIUS_KM + perigeeAltKm;
    const rApogee = EARTH_RADIUS_KM + apogeeAltKm;
    const semiMajorAxis = (rPerigee + rApogee) / 2;
    const eccentricity = selectedSatellite.eccentricity;

    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU_EARTH);
    const periodMinutes = periodSeconds / 60;
    const orbitalVelocityKms = Math.sqrt(MU_EARTH / semiMajorAxis);

    const rPerigee3D = scaleAltTo3D(perigeeAltKm);
    const rApogee3D = scaleAltTo3D(apogeeAltKm);
    const semiMajorAxis3D = (rPerigee3D + rApogee3D) / 2;

    return {
      perigeeAltKm,
      apogeeAltKm,
      semiMajorAxis,
      eccentricity,
      periodMinutes,
      orbitalVelocityKms,
      rPerigee3D,
      rApogee3D,
      semiMajorAxis3D,
      inclinationDeg: selectedSatellite.inclinationDeg,
      raanDeg: selectedSatellite.raanDeg,
    };
  }, [selectedSatellite]);

  // Three.js Scene References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic 3D Objects References
  const rocketMarkerRef = useRef<THREE.Group | null>(null);
  const ascentLineRef = useRef<THREE.Line | null>(null);
  const groundTrackLineRef = useRef<THREE.Line | null>(null);
  const equatorPlaneRef = useRef<THREE.Group | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const solarSystemRef = useRef<BuiltSolarSystem | null>(null);

  // Multi-satellite 3D objects and orbit line meshes mapped by satellite id
  const satelliteMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const orbitLineMeshesRef = useRef<Map<string, THREE.Line>>(new Map());
  const satelliteAnglesRef = useRef<Map<string, number>>(new Map());

  // Function to compute 3D position of a satellite at given orbital angle
  const getSatellitePosition3D = useCallback((sat: VisualizerSatellite, thetaRad: number): THREE.Vector3 => {
    const a3D = scaleAltTo3D(sat.altitudeKm);
    const e = sat.eccentricity;
    const r = (a3D * (1 - e * e)) / (1 + e * Math.cos(thetaRad));

    const xOrb = r * Math.cos(thetaRad);
    const zOrb = r * Math.sin(thetaRad);

    const incRad = (sat.inclinationDeg * Math.PI) / 180;
    const raanRad = (sat.raanDeg * Math.PI) / 180;

    // Rotate into inclined plane
    const x1 = xOrb;
    const y1 = zOrb * Math.sin(incRad);
    const z1 = zOrb * Math.cos(incRad);

    // Rotate by RAAN about Y (polar axis)
    const x = x1 * Math.cos(raanRad) - z1 * Math.sin(raanRad);
    const y = y1;
    const z = x1 * Math.sin(raanRad) + z1 * Math.cos(raanRad);

    return new THREE.Vector3(x, y, z);
  }, []);

  // Set up Three.js Scene, Earth, Lighting, and Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x020617); // Deep cosmic navy/black

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.set(24, 20, 32);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 11.2;
    controls.maxDistance = 350;
    controls.target.set(0, 0, 0);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Directional illumination aligned with visual Sun position in deep sky
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.4);
    sunLight.position.copy(SUN_WORLD_POS);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    fillLight.position.set(-SUN_WORLD_POS.x * 0.4, -SUN_WORLD_POS.y * 0.4, -SUN_WORLD_POS.z * 0.4);
    scene.add(fillLight);

    // 6. Deep Space Starfield Sphere
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 260 + Math.random() * 60;
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 7. High-Detail Earth Sphere
    const earthGeo = new THREE.SphereGeometry(R_EARTH_3D, 64, 64);
    const earthTex = createEarthCanvasTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.65,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // 8. Atmospheric Glow Shell
    const atmoGeo = new THREE.SphereGeometry(R_EARTH_3D * 1.035, 64, 64);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    atmosphereRef.current = atmoMesh;
    scene.add(atmoMesh);

    // 9. Launch Pad Marker Pin on Earth
    const launchPos = latLonAltToVector3(launchSite.lat, launchSite.lon, 0);
    const launchPin = new THREE.Group();
    launchPin.position.copy(launchPos);

    const pinRingGeo = new THREE.RingGeometry(0.18, 0.32, 24);
    const pinRingMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide });
    const pinRing = new THREE.Mesh(pinRingGeo, pinRingMat);
    pinRing.lookAt(launchPos.clone().multiplyScalar(2));
    launchPin.add(pinRing);

    const pinSphereGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const pinSphereMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const pinSphere = new THREE.Mesh(pinSphereGeo, pinSphereMat);
    launchPin.add(pinSphere);
    scene.add(launchPin);

    // 10. Equatorial Reference Plane & Polar Axis
    const equatorGroup = new THREE.Group();
    equatorPlaneRef.current = equatorGroup;

    const eqCirclePoints: THREE.Vector3[] = [];
    const eqRadius = R_EARTH_3D * 1.8;
    for (let i = 0; i <= 96; i++) {
      const angle = (i / 96) * Math.PI * 2;
      eqCirclePoints.push(new THREE.Vector3(Math.cos(angle) * eqRadius, 0, Math.sin(angle) * eqRadius));
    }
    const eqCircleGeo = new THREE.BufferGeometry().setFromPoints(eqCirclePoints);
    const eqCircleMat = new THREE.LineDashedMaterial({
      color: 0x0ea5e9,
      dashSize: 0.6,
      gapSize: 0.4,
      transparent: true,
      opacity: 0.45,
    });
    const eqCircleLine = new THREE.Line(eqCircleGeo, eqCircleMat);
    eqCircleLine.computeLineDistances();
    equatorGroup.add(eqCircleLine);

    const polarPoints = [
      new THREE.Vector3(0, -R_EARTH_3D * 1.6, 0),
      new THREE.Vector3(0, R_EARTH_3D * 1.6, 0),
    ];
    const polarGeo = new THREE.BufferGeometry().setFromPoints(polarPoints);
    const polarMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });
    const polarLine = new THREE.Line(polarGeo, polarMat);
    equatorGroup.add(polarLine);
    scene.add(equatorGroup);

    // 11. Active Ascending Rocket Model (follows scrubber)
    const rocketGroup = new THREE.Group();
    rocketMarkerRef.current = rocketGroup;

    const rocketBodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    rocketGroup.add(rocketBodyMesh);

    const exhaustMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.6, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    exhaustMesh.position.y = -0.6;
    exhaustMesh.rotation.x = Math.PI;
    rocketGroup.add(exhaustMesh);

    const rocketLight = new THREE.PointLight(0xf97316, 2, 4);
    rocketLight.position.y = -0.5;
    rocketGroup.add(rocketLight);
    scene.add(rocketGroup);

    // 12. Solar System in the Deep Cosmic Background
    const solarSys = buildSolarSystem3D();
    solarSystemRef.current = solarSys;
    solarSys.rootGroup.visible = showSolarSystem;
    solarSys.orbitLinesGroup.visible = showPlanetaryOrbits;
    scene.add(solarSys.rootGroup);

    // Raycaster for clicking & hovering directly on satellites in the 3D scene
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isUserDragging = false;
    let pointerDownPos = { x: 0, y: 0 };

    const getIntersectedSatelliteId = (event: MouseEvent): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshesToTest: THREE.Object3D[] = [];
      satelliteMeshesRef.current.forEach((grp) => {
        grp.traverse((child) => {
          if (child instanceof THREE.Mesh) meshesToTest.push(child);
        });
      });

      const intersects = raycaster.intersectObjects(meshesToTest, false);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj !== scene) {
          if (obj.name && obj.name.startsWith("sat_")) {
            return obj.name.replace("sat_", "");
          }
          if (obj.name && obj.name.startsWith("hit_")) {
            return obj.name.replace("hit_", "");
          }
          obj = obj.parent;
        }
      }
      return null;
    };

    const handlePointerDown = (event: MouseEvent) => {
      isUserDragging = false;
      pointerDownPos = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: MouseEvent) => {
      // If primary button is held down and dragged, user is orbiting the camera
      if (event.buttons > 0) {
        const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
        if (dist > 4) isUserDragging = true;
        return;
      }

      const satId = getIntersectedSatelliteId(event);
      if (satId) {
        renderer.domElement.style.cursor = "pointer";
      } else {
        renderer.domElement.style.cursor = "grab";
      }
    };

    const handleCanvasClick = (event: MouseEvent) => {
      if (isUserDragging) return;
      const satId = getIntersectedSatelliteId(event);
      if (satId) {
        setSelectedSatelliteId(satId);
        setIsHoverCardPinned(true);
      }
    };

    const handlePointerLeave = () => {
      setHoveredSatelliteId(null);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleCanvasClick);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Smooth camera damping
      controls.update();

      // Earth rotation
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += 0.0004 * simSpeedMultiplier;
      }

      // Orbital Satellites Motion: propagate each satellite at its physical Keplerian speed
      if (animateOrbitSatellite) {
        const nextScreenCoords: Record<string, { x: number; y: number; visible: boolean }> = {};
        const nextTelemetry: Record<
          string,
          {
            altKm: number;
            velocityKms: number;
            velocityKmh: number;
            lat: number;
            lon: number;
            periodMin: number;
          }
        > = {};
        const earthRot = earthMeshRef.current ? earthMeshRef.current.rotation.y : 0;

        satellites.forEach((sat) => {
          const mesh = satelliteMeshesRef.current.get(sat.id);
          if (!mesh) return;

          // Kepler's 3rd Law mean motion: n = sqrt(mu / a^3)
          const aKm = EARTH_RADIUS_KM + sat.altitudeKm;
          const meanMotionRadSec = Math.sqrt(MU_EARTH / Math.pow(aKm, 3));
          const periodMin = (2 * Math.PI * Math.sqrt(Math.pow(aKm, 3) / MU_EARTH)) / 60;

          // Scaled simulation angular velocity for visual dynamism
          const visualSpeedScale = (meanMotionRadSec / 0.001) * 0.008 * simSpeedMultiplier;

          let currentAngle = satelliteAnglesRef.current.get(sat.id) || (sat.initialPhaseDeg * Math.PI) / 180;
          currentAngle += visualSpeedScale * (dt * 60);
          satelliteAnglesRef.current.set(sat.id, currentAngle);

          // Compute 3D position
          const pos = getSatellitePosition3D(sat, currentAngle);
          mesh.position.copy(pos);

          // Compute forward tangent velocity vector for accurate flight attitude
          const nextPos = getSatellitePosition3D(sat, currentAngle + 0.01);
          const tangent = nextPos.clone().sub(pos).normalize();
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

          // Compute physical orbital mechanics at current true anomaly
          const e = sat.eccentricity;
          const rInstantKm = (aKm * (1 - e * e)) / (1 + e * Math.cos(currentAngle));
          const instantAltKm = rInstantKm - EARTH_RADIUS_KM;
          const instantVelKms = Math.sqrt(MU_EARTH * (2 / rInstantKm - 1 / aKm));
          const subCoords = vector3ToSubSatelliteLatLon(pos, earthRot);

          nextTelemetry[sat.id] = {
            altKm: instantAltKm,
            velocityKms: instantVelKms,
            velocityKmh: Math.round(instantVelKms * 3600),
            lat: subCoords.lat,
            lon: subCoords.lon,
            periodMin,
          };

          // Billboarding & reticle animation for selected satellite
          const reticle = mesh.getObjectByName(`reticle_${sat.id}`) as THREE.Mesh;
          const beacon = mesh.getObjectByName(`beacon_${sat.id}`) as THREE.PointLight;
          const isTargeted = sat.id === selectedSatelliteId;

          if (reticle && camera) {
            reticle.lookAt(camera.position);
            const reticleMat = reticle.material as THREE.MeshBasicMaterial;
            reticleMat.opacity = isTargeted ? 0.95 : 0;
            if (isTargeted) {
              const pulse = 1.0 + Math.sin(currentTime * 0.007) * 0.15;
              reticle.scale.set(pulse, pulse, pulse);
            }
          }

          if (beacon) {
            beacon.intensity = isTargeted ? 3.6 : 1.8;
          }

          // If camera preset is tracking, smoothly follow the selected satellite
          if (sat.id === selectedSatelliteId && cameraPreset === "track") {
            controls.target.lerp(pos, 0.05);
          }

          // Project to 2D screen coordinates for high-tech HUD tags & hover cards
          if (container && camera) {
            const screenV = pos.clone().project(camera);
            const isVisible = screenV.z < 1.0;
            const x = (screenV.x * 0.5 + 0.5) * container.clientWidth;
            const y = (-(screenV.y * 0.5) + 0.5) * container.clientHeight;
            nextScreenCoords[sat.id] = { x, y, visible: isVisible };
          }
        });

        setSatelliteScreenCoords(nextScreenCoords);
        setFleetTelemetry(nextTelemetry);
      }

      // Propagate Solar System celestial bodies & screen HUD coordinates
      if (solarSystemRef.current && showSolarSystem) {
        const celestialPositions = updateSolarSystem(
          solarSystemRef.current,
          currentTime * 0.001,
          simSpeedMultiplier
        );

        if (showCelestialLabels && container && camera) {
          const nextCelestialCoords: Record<string, { x: number; y: number; visible: boolean }> = {};
          Object.entries(celestialPositions).forEach(([bodyId, pos]) => {
            const screenV = pos.clone().project(camera);
            const isVisible = screenV.z < 1.0;
            const x = (screenV.x * 0.5 + 0.5) * container.clientWidth;
            const y = (-(screenV.y * 0.5) + 0.5) * container.clientHeight;
            nextCelestialCoords[bodyId] = { x, y, visible: isVisible };
          });
          setCelestialScreenCoords(nextCelestialCoords);
        }
      }

      renderer.render(scene, camera);
    };

    animate(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        renderer.domElement.removeEventListener("pointermove", handlePointerMove);
        renderer.domElement.removeEventListener("click", handleCanvasClick);
        renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      }
      controls.dispose();
      renderer.dispose();
      if (solarSystemRef.current && scene) {
        scene.remove(solarSystemRef.current.rootGroup);
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    launchSite,
    satellites,
    getSatellitePosition3D,
    selectedSatelliteId,
    simSpeedMultiplier,
    animateOrbitSatellite,
    cameraPreset,
    showSolarSystem,
    showPlanetaryOrbits,
    showCelestialLabels,
  ]);

  // Construct and populate Satellite 3D Models in Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old satellite meshes
    satelliteMeshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
    });
    satelliteMeshesRef.current.clear();

    // Create 3D model for every satellite
    satellites.forEach((sat) => {
      const satGroup = buildSatelliteModel3D(sat);

      // Initial angle
      const initialAngle = (sat.initialPhaseDeg * Math.PI) / 180;
      satelliteAnglesRef.current.set(sat.id, initialAngle);

      const pos = getSatellitePosition3D(sat, initialAngle);
      satGroup.position.copy(pos);

      satelliteMeshesRef.current.set(sat.id, satGroup);
      scene.add(satGroup);
    });

    return () => {
      satelliteMeshesRef.current.forEach((mesh) => {
        scene.remove(mesh);
      });
      satelliteMeshesRef.current.clear();
    };
  }, [satellites, getSatellitePosition3D]);

  // Build and Update 3D Orbit Lines for All or Selected Satellites
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old orbit line meshes
    orbitLineMeshesRef.current.forEach((line) => {
      scene.remove(line);
      line.geometry.dispose();
    });
    orbitLineMeshesRef.current.clear();

    if (!showOrbit || fleetOrbitsMode === "none") return;

    // Render orbit ellipse lines
    satellites.forEach((sat) => {
      if (fleetOrbitsMode === "selected" && sat.id !== selectedSatelliteId) {
        return;
      }

      const orbitPoints: THREE.Vector3[] = [];
      const segments = 144;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const pos = getSatellitePosition3D(sat, theta);
        orbitPoints.push(pos);
      }

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const isSelected = sat.id === selectedSatelliteId;

      const orbitMat = new THREE.LineBasicMaterial({
        color: sat.colorHex,
        linewidth: isSelected ? 3 : 1.5,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.4,
      });

      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      orbitLineMeshesRef.current.set(sat.id, orbitLine);
      scene.add(orbitLine);
    });

    return () => {
      orbitLineMeshesRef.current.forEach((line) => {
        scene.remove(line);
        line.geometry.dispose();
      });
      orbitLineMeshesRef.current.clear();
    };
  }, [satellites, showOrbit, fleetOrbitsMode, selectedSatelliteId, getSatellitePosition3D]);

  // Update Ascent Trajectory 3D Path
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (ascentLineRef.current) {
      scene.remove(ascentLineRef.current);
      ascentLineRef.current.geometry.dispose();
      ascentLineRef.current = null;
    }

    if (!showAscentTrajectory) return;

    const trajPoints: THREE.Vector3[] = [];
    const n = trajectory.time.length;

    const azimuthDeg = 90 - orbitalParams.inclinationDeg;
    const azRad = (azimuthDeg * Math.PI) / 180;

    for (let i = 0; i < n; i++) {
      const altKm = trajectory.altitude_km[i] || 0;
      const downrangeKm = trajectory.downrange_km[i] || 0;

      const downrangeAngleRad = downrangeKm / EARTH_RADIUS_KM;
      const deltaLatDeg = (downrangeAngleRad * Math.cos(azRad) * 180) / Math.PI;
      const deltaLonDeg = (downrangeAngleRad * Math.sin(azRad) * 180) / Math.PI;

      const currentLat = launchSite.lat + deltaLatDeg;
      const currentLon = launchSite.lon + deltaLonDeg;

      const scaledAltKm = altKm * 1.5;
      const vec = latLonAltToVector3(currentLat, currentLon, scaledAltKm);
      trajPoints.push(vec);
    }

    const ascentGeo = new THREE.BufferGeometry().setFromPoints(trajPoints);

    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = (1 - t) * 0.95 + t * 0.13;
      const g = (1 - t) * 0.45 + t * 0.83;
      const b = (1 - t) * 0.08 + t * 0.93;
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    ascentGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const ascentMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });

    const ascentLine = new THREE.Line(ascentGeo, ascentMat);
    ascentLineRef.current = ascentLine;
    scene.add(ascentLine);
  }, [trajectory, launchSite, orbitalParams, showAscentTrajectory]);

  // Update Ground Track Path on Earth's Surface
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (groundTrackLineRef.current) {
      scene.remove(groundTrackLineRef.current);
      groundTrackLineRef.current.geometry.dispose();
      groundTrackLineRef.current = null;
    }

    if (!showGroundTrack) return;

    const groundPoints: THREE.Vector3[] = [];
    const n = trajectory.time.length;
    const azimuthDeg = 90 - orbitalParams.inclinationDeg;
    const azRad = (azimuthDeg * Math.PI) / 180;

    for (let i = 0; i < n; i++) {
      const downrangeKm = trajectory.downrange_km[i] || 0;
      const downrangeAngleRad = downrangeKm / EARTH_RADIUS_KM;
      const currentLat = launchSite.lat + ((downrangeAngleRad * Math.cos(azRad) * 180) / Math.PI);
      const currentLon = launchSite.lon + ((downrangeAngleRad * Math.sin(azRad) * 180) / Math.PI);

      const vec = latLonAltToVector3(currentLat, currentLon, 0.05);
      groundPoints.push(vec);
    }

    const groundGeo = new THREE.BufferGeometry().setFromPoints(groundPoints);
    const groundMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b, // Amber dashed
      dashSize: 0.3,
      gapSize: 0.2,
      transparent: true,
      opacity: 0.8,
    });

    const groundLine = new THREE.Line(groundGeo, groundMat);
    groundLine.computeLineDistances();
    groundTrackLineRef.current = groundLine;
    scene.add(groundLine);
  }, [trajectory, launchSite, orbitalParams, showGroundTrack]);

  // Sync Active Rocket Position to Scrubber
  useEffect(() => {
    if (!rocketMarkerRef.current) return;

    const n = trajectory.time.length;
    const idx = Math.min(Math.max(currentIndex, 0), n - 1);

    const altKm = trajectory.altitude_km[idx] || 0;
    const downrangeKm = trajectory.downrange_km[idx] || 0;

    const azimuthDeg = 90 - orbitalParams.inclinationDeg;
    const azRad = (azimuthDeg * Math.PI) / 180;
    const downrangeAngleRad = downrangeKm / EARTH_RADIUS_KM;

    const currentLat = launchSite.lat + ((downrangeAngleRad * Math.cos(azRad) * 180) / Math.PI);
    const currentLon = launchSite.lon + ((downrangeAngleRad * Math.sin(azRad) * 180) / Math.PI);

    const pos = latLonAltToVector3(currentLat, currentLon, altKm * 1.5);
    rocketMarkerRef.current.position.copy(pos);
    rocketMarkerRef.current.visible = showAscentTrajectory;

    const normal = pos.clone().normalize();
    rocketMarkerRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }, [currentIndex, trajectory, launchSite, orbitalParams, showAscentTrajectory]);

  // Sync rocket visibility if showAscentTrajectory changes
  useEffect(() => {
    if (rocketMarkerRef.current) {
      rocketMarkerRef.current.visible = showAscentTrajectory;
    }
  }, [showAscentTrajectory]);

  // Camera Presets
  const applyCameraPreset = useCallback(
    (preset: "orbit" | "ascent" | "polar" | "equatorial" | "track" | "solar") => {
      setCameraPreset(preset);
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      if (preset === "orbit") {
        camera.position.set(24, 20, 32);
        controls.target.set(0, 0, 0);
      } else if (preset === "ascent") {
        const launchPos = latLonAltToVector3(launchSite.lat, launchSite.lon, 0);
        const camPos = launchPos.clone().multiplyScalar(1.5).add(new THREE.Vector3(4, 3, 4));
        camera.position.copy(camPos);
        controls.target.copy(launchPos.clone().multiplyScalar(1.15));
      } else if (preset === "polar") {
        camera.position.set(0, 42, 4);
        controls.target.set(0, 0, 0);
      } else if (preset === "equatorial") {
        camera.position.set(40, 0, 10);
        controls.target.set(0, 0, 0);
      } else if (preset === "solar") {
        camera.position.set(100, 75, 145);
        controls.target.set(SUN_WORLD_POS.x * 0.35, SUN_WORLD_POS.y * 0.35, SUN_WORLD_POS.z * 0.35);
      } else if (preset === "track") {
        const mesh = satelliteMeshesRef.current.get(selectedSatelliteId);
        if (mesh) {
          const satPos = mesh.position.clone();
          camera.position.copy(satPos.clone().multiplyScalar(1.6).add(new THREE.Vector3(3, 2, 3)));
          controls.target.copy(satPos);
        }
      }
      controls.update();
    },
    [launchSite, selectedSatelliteId]
  );

  // Smooth Focus on specific Celestial Body in the background
  const focusCelestialBody = useCallback((bodyId: string) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !solarSystemRef.current) return;

    const mesh = solarSystemRef.current.bodyMeshes.get(bodyId);
    if (!mesh) return;

    const targetPos = mesh.position.clone();
    controls.target.copy(targetPos);
    const offset = targetPos.clone().normalize().multiplyScalar(24).add(new THREE.Vector3(12, 8, 12));
    camera.position.copy(targetPos.clone().add(offset));
    controls.update();
    setSelectedCelestialId(bodyId);
  }, []);

  // Toggle Visibility Effects
  useEffect(() => {
    if (atmosphereRef.current) atmosphereRef.current.visible = showAtmosphere;
  }, [showAtmosphere]);

  useEffect(() => {
    if (equatorPlaneRef.current) equatorPlaneRef.current.visible = showEquatorPlane;
  }, [showEquatorPlane]);

  useEffect(() => {
    if (solarSystemRef.current) {
      solarSystemRef.current.rootGroup.visible = showSolarSystem;
    }
  }, [showSolarSystem]);

  useEffect(() => {
    if (solarSystemRef.current) {
      solarSystemRef.current.orbitLinesGroup.visible = showPlanetaryOrbits;
    }
  }, [showPlanetaryOrbits]);

  return (
    <div
      className={`relative w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col font-sans transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none h-screen" : "h-[620px]"
      }`}
    >
      {/* =========================================================================
          TOP 3D NAVIGATION & VIEWPORT TOOLBAR
          ========================================================================= */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 py-2.5 bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent flex flex-wrap items-center justify-between gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight">3D Orbit &amp; Trajectory Visualizer</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                Three.js WebGL
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold">
                Fleet: {satellites.length} Satellites
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Click any satellite or use the Fleet panel to track orbital trajectory
            </div>
          </div>
        </div>

        {/* Camera Preset Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-lg backdrop-blur-md">
          <button
            onClick={() => applyCameraPreset("orbit")}
            className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              cameraPreset === "orbit" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Wide
          </button>
          <button
            onClick={() => applyCameraPreset("ascent")}
            className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              cameraPreset === "ascent" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Ascent
          </button>
          <button
            onClick={() => applyCameraPreset("polar")}
            className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              cameraPreset === "polar" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Polar
          </button>
          <button
            onClick={() => applyCameraPreset("equatorial")}
            className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              cameraPreset === "equatorial" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Equator
          </button>
          <button
            onClick={() => applyCameraPreset("solar")}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              cameraPreset === "solar" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-amber-300"
            }`}
            title="Solar System panoramic view"
          >
            <Sun className="w-3 h-3" />
            <span>Solar</span>
          </button>
          <button
            onClick={() => applyCameraPreset("track")}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              cameraPreset === "track" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-amber-300"
            }`}
            title="Track selected satellite in orbit"
          >
            <Crosshair className="w-3 h-3" />
            <span>Track</span>
          </button>
        </div>

        {/* View Controls & Fullscreen */}
        <div className="flex items-center gap-1.5">
          {/* Rocket Details Toggle Button */}
          <button
            onClick={() => setIsRocketDetailsOpen(!isRocketDetailsOpen)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
              isRocketDetailsOpen
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-cyan-950/40"
                : "bg-slate-900/80 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800"
            }`}
            title={isRocketDetailsOpen ? "Hide Rocket Details & Telemetry Panel" : "Show Rocket Details & Telemetry Panel"}
          >
            <Rocket className={`w-3.5 h-3.5 ${isRocketDetailsOpen ? "text-slate-950" : "text-cyan-400"}`} />
            <span>Rocket Details</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-semibold transition-colors ${
                isRocketDetailsOpen
                  ? "bg-slate-950/20 text-slate-950"
                  : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {isRocketDetailsOpen ? "ON" : "OFF"}
            </span>
          </button>

          {/* Fleet Panel Toggle Button */}
          <button
            onClick={() => setIsFleetPanelOpen(!isFleetPanelOpen)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
              isFleetPanelOpen
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-cyan-950/40"
                : "bg-slate-900/80 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800"
            }`}
            title={isFleetPanelOpen ? "Hide Satellite Fleet Selector Panel" : "Show Satellite Fleet Selector Panel"}
          >
            <Radio className={`w-3.5 h-3.5 ${isFleetPanelOpen ? "text-slate-950" : "text-cyan-400"}`} />
            <span>Fleet Panel ({satellites.length})</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-semibold transition-colors ${
                isFleetPanelOpen
                  ? "bg-slate-950/20 text-slate-950"
                  : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {isFleetPanelOpen ? "ON" : "OFF"}
            </span>
          </button>

          {/* Solar System Background Toggle Button */}
          <button
            onClick={() => setShowSolarSystem(!showSolarSystem)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
              showSolarSystem
                ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-amber-950/40"
                : "bg-slate-900/80 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800"
            }`}
            title={showSolarSystem ? "Hide Solar System Background" : "Show Solar System Background"}
          >
            <Sun className={`w-3.5 h-3.5 ${showSolarSystem ? "text-slate-950" : "text-amber-400"}`} />
            <span>Solar System</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-semibold transition-colors ${
                showSolarSystem
                  ? "bg-slate-950/20 text-slate-950"
                  : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {showSolarSystem ? "ON" : "OFF"}
            </span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-cyan-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          THREE.JS WEBGL CANVAS CONTAINER
          ========================================================================= */}
      <div ref={mountRef} className="w-full flex-1 min-h-0 cursor-grab active:cursor-grabbing relative" />

      {/* =========================================================================
          FLOATING 3D SATELLITE HUD LABELS (PROJECTED OVER CANVAS)
          ========================================================================= */}
      {showSatelliteLabels && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {satellites.map((sat) => {
            const coords = satelliteScreenCoords[sat.id];
            if (!coords || !coords.visible) return null;
            const isSelected = sat.id === selectedSatelliteId;
            const isHovered = sat.id === hoveredSatelliteId;
            const liveData = fleetTelemetry[sat.id];

            return (
              <div
                key={`label_${sat.id}`}
                style={{
                  transform: `translate3d(${coords.x}px, ${coords.y}px, 0)`,
                  left: -12,
                  top: -28,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSatelliteId(sat.id);
                  setIsHoverCardPinned(true);
                }}
                className={`absolute pointer-events-auto transition-all duration-150 cursor-pointer select-none group flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-mono shadow-md backdrop-blur-md ${
                  isSelected
                    ? "bg-slate-950/95 border-cyan-400 text-white shadow-cyan-950/80 ring-1 ring-cyan-500/50 scale-105 z-30"
                    : "bg-slate-950/85 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: sat.color }}
                />
                <span className="font-semibold whitespace-nowrap">{sat.name.split(" ")[0]}</span>
                {liveData && (
                  <span className="text-[9px] text-cyan-300 tabular-nums font-mono whitespace-nowrap flex items-center gap-1">
                    <span>{liveData.altKm.toFixed(0)}km</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-amber-400">{liveData.velocityKms.toFixed(1)}km/s</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          SOLAR SYSTEM CELESTIAL BODY HUD TAGS & FLOATING BADGES
          ========================================================================= */}
      {showSolarSystem && showCelestialLabels && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {CELESTIAL_BODIES.map((body) => {
            const coords = celestialScreenCoords[body.id];
            if (!coords || !coords.visible) return null;
            const isSelected = selectedCelestialId === body.id;

            return (
              <div
                key={`celestial_tag_${body.id}`}
                style={{
                  transform: `translate3d(${coords.x}px, ${coords.y}px, 0)`,
                  left: -16,
                  top: -24,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCelestialId(isSelected ? null : body.id);
                }}
                className={`absolute pointer-events-auto transition-all duration-150 cursor-pointer select-none flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono shadow-md backdrop-blur-md ${
                  isSelected
                    ? "bg-amber-950/95 border-amber-400 text-amber-200 ring-1 ring-amber-500/50 scale-105 z-30"
                    : "bg-slate-950/80 border-slate-800/90 text-slate-300 hover:border-amber-500/60 hover:text-white"
                }`}
                title={`Click to inspect ${body.name}`}
              >
                <span className="text-xs">{body.symbol}</span>
                <span className="font-semibold whitespace-nowrap">{body.name.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          CELESTIAL BODY INSPECTOR CARD (PINNED WHEN CELESTIAL TAG CLICKED)
          ========================================================================= */}
      {selectedCelestialId && (
        (() => {
          const body = CELESTIAL_BODIES.find((b) => b.id === selectedCelestialId);
          if (!body) return null;
          const coords = celestialScreenCoords[body.id];

          const containerWidth = mountRef.current?.clientWidth || 800;
          const containerHeight = mountRef.current?.clientHeight || 600;

          const cardX = coords ? coords.x : containerWidth / 2;
          const cardY = coords ? coords.y : containerHeight / 2;

          const isNearRight = cardX > containerWidth - 300;
          const isNearBottom = cardY > containerHeight - 260;

          const styleLeft = isNearRight ? undefined : Math.max(16, cardX + 20);
          const styleRight = isNearRight ? Math.max(16, containerWidth - cardX + 20) : undefined;
          const styleTop = isNearBottom ? Math.max(70, cardY - 220) : Math.max(70, cardY - 40);

          return (
            <div
              style={{
                position: "absolute",
                left: styleLeft !== undefined ? `${styleLeft}px` : undefined,
                right: styleRight !== undefined ? `${styleRight}px` : undefined,
                top: `${styleTop}px`,
              }}
              className="z-40 w-80 pointer-events-auto rounded-xl bg-slate-950/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl p-3.5 font-mono space-y-3 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-amber-500/20"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 shadow-inner"
                    style={{ backgroundColor: `${body.color}25`, color: body.color }}
                  >
                    {body.symbol}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{body.name}</span>
                    </div>
                    <div className="text-[10px] text-amber-400 truncate">{body.classification}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCelestialId(null)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Physical & Astronomical Specifications */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                  <div className="text-slate-500">Real Diameter</div>
                  <div className="text-slate-200 font-bold mt-0.5">{body.realDiameterKm.toLocaleString()} km</div>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                  <div className="text-slate-500">Distance</div>
                  <div className="text-slate-200 font-bold mt-0.5">{body.realDistanceAuOrKm}</div>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80 col-span-2">
                  <div className="text-slate-500">Orbital Period</div>
                  <div className="text-slate-200 font-bold mt-0.5">{body.orbitalPeriodStr}</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans bg-slate-900/50 p-2 rounded border border-slate-800/60">
                {body.description}
              </p>

              {/* Focus Button */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <button
                  onClick={() => focusCelestialBody(body.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-colors cursor-pointer shadow-xs"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Center Camera on {body.name.split(" ")[0]}</span>
                </button>
                <button
                  onClick={() => setSelectedCelestialId(null)}
                  className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* =========================================================================
          INTERACTIVE HOVER & CLICK SATELLITE TELEMETRY CARD (PINNED IN 3D SPACE)
          ========================================================================= */}
      {activeHoverSatellite && (
        (() => {
          const sat = activeHoverSatellite;
          const coords = satelliteScreenCoords[sat.id];
          const tel = fleetTelemetry[sat.id] || {
            altKm: sat.altitudeKm,
            velocityKms: Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + sat.altitudeKm)),
            velocityKmh: Math.round(Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + sat.altitudeKm)) * 3600),
            lat: 0,
            lon: 0,
            periodMin: 90,
          };

          // Position card adjacent to satellite screen projection with boundary awareness
          const containerWidth = mountRef.current?.clientWidth || 800;
          const containerHeight = mountRef.current?.clientHeight || 600;

          const cardX = coords ? coords.x : containerWidth / 2;
          const cardY = coords ? coords.y : containerHeight / 2;

          // Flip card to left if too close to right edge
          const isNearRight = cardX > containerWidth - 280;
          const isNearBottom = cardY > containerHeight - 220;

          const styleLeft = isNearRight ? undefined : Math.max(16, cardX + 16);
          const styleRight = isNearRight ? Math.max(16, containerWidth - cardX + 16) : undefined;
          const styleTop = isNearBottom ? Math.max(70, cardY - 180) : Math.max(70, cardY - 40);

          return (
            <div
              style={{
                position: "absolute",
                left: styleLeft !== undefined ? `${styleLeft}px` : undefined,
                right: styleRight !== undefined ? `${styleRight}px` : undefined,
                top: `${styleTop}px`,
              }}
              className="z-40 w-72 pointer-events-auto rounded-xl bg-slate-950/95 border border-slate-700/90 shadow-2xl backdrop-blur-xl p-3 font-mono space-y-2.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-cyan-500/20"
            >
              {/* Header: Satellite Identity & Status */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm animate-pulse"
                    style={{ backgroundColor: sat.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white tracking-tight truncate">{sat.name}</span>
                      {sat.id === "primary" && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold shrink-0">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {sat.categoryLabel} · {sat.countryOrOrg}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                    style={{
                      backgroundColor: `${sat.color}15`,
                      color: sat.color,
                      border: `1px solid ${sat.color}40`,
                    }}
                  >
                    {sat.orbitType}
                  </span>
                  {isHoverCardPinned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHoverCardPinned(false);
                        setHoveredSatelliteId(null);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      title="Close Card"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Real-Time Primary Telemetry Grid: Velocity & Altitude */}
              <div className="grid grid-cols-2 gap-2">
                {/* Orbital Velocity Card */}
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span className="uppercase tracking-wider font-semibold">Velocity</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  </div>
                  <div className="text-base font-extrabold text-amber-400 tabular-nums">
                    {tel.velocityKms.toFixed(2)}
                    <span className="text-xs font-normal text-slate-400 ml-1">km/s</span>
                  </div>
                  <div className="text-[9px] text-slate-400 tabular-nums">
                    {tel.velocityKmh.toLocaleString()} km/h
                  </div>
                </div>

                {/* Altitude Card */}
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span className="uppercase tracking-wider font-semibold">Altitude</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  </div>
                  <div className="text-base font-extrabold text-cyan-300 tabular-nums">
                    {Math.round(tel.altKm).toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 ml-1">km</span>
                  </div>
                  <div className="text-[9px] text-slate-400 tabular-nums">
                    {(tel.altKm * 0.539957).toFixed(0)} NM
                  </div>
                </div>
              </div>

              {/* Secondary Keplerian Telemetry Details */}
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Orbital Period:</span>
                  <span className="text-emerald-400 font-bold tabular-nums">{tel.periodMin.toFixed(1)} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Inclination:</span>
                  <span className="text-white font-semibold">{sat.inclinationDeg}°</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sub-Sat Lat/Lon:</span>
                  <span className="text-sky-300 font-mono tabular-nums">
                    {tel.lat.toFixed(1)}°N, {tel.lon.toFixed(1)}°E
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSatelliteId(sat.id);
                    setIsHoverCardPinned(true);
                    applyCameraPreset("track");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] transition-colors cursor-pointer shadow-xs"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Track Satellite</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSatelliteId(sat.id);
                    setIsHoverCardPinned(true);
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10px] transition-colors cursor-pointer"
                  title="Inspect Full Telemetry"
                >
                  Inspect
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* =========================================================================
          LEFT HUD OVERLAY: ORBITAL MECHANICS & ROCKET DETAILS
          ========================================================================= */}
      {isRocketDetailsOpen && (
        <div className="absolute top-14 left-4 z-20 pointer-events-auto flex flex-col gap-2 max-w-[270px] animate-in fade-in slide-in-from-left-4 duration-200">
          <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-800/90 backdrop-blur-md shadow-2xl font-mono text-xs space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <Rocket className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-white font-bold truncate">Rocket &amp; Orbit Details</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase"
                  style={{
                    backgroundColor: `${selectedSatellite.color}15`,
                    color: selectedSatellite.color,
                    border: `1px solid ${selectedSatellite.color}40`,
                  }}
                >
                  {selectedSatellite.orbitType}
                </span>
                <button
                  onClick={() => setIsRocketDetailsOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-0.5"
                  title="Hide Rocket Details"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Vehicle & Target Orbit Specs */}
            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Launch Vehicle:</span>
                <span className="text-white font-bold">{mission.rocket}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Payload:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[130px]">{mission.satellite_name}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target Orbit:</span>
                <span className="text-emerald-400 font-bold">{mission.target_orbit} ({mission.altitude} km)</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
              {selectedSatellite.description}
            </div>

            <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800/80">
              <div className="flex justify-between">
                <span className="text-slate-400">Altitude:</span>
                <span className="text-white font-bold">
                  {(fleetTelemetry[selectedSatellite.id]?.altKm || selectedSatellite.altitudeKm).toFixed(0)} km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Velocity:</span>
                <span className="text-amber-400 font-bold tabular-nums">
                  {(
                    fleetTelemetry[selectedSatellite.id]?.velocityKms ||
                    Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + selectedSatellite.altitudeKm))
                  ).toFixed(2)}{" "}
                  km/s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Inclination:</span>
                <span className="text-cyan-300 font-bold">{selectedSatellite.inclinationDeg}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RAAN (Plane):</span>
                <span className="text-slate-300 font-semibold">{selectedSatellite.raanDeg}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Period:</span>
                <span className="text-emerald-400 font-bold">{orbitalParams.periodMinutes.toFixed(1)} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sub-Sat Lat/Lon:</span>
                <span className="text-sky-300 font-mono text-[10px] tabular-nums">
                  {fleetTelemetry[selectedSatellite.id]?.lat.toFixed(1) || 0}°N,{" "}
                  {fleetTelemetry[selectedSatellite.id]?.lon.toFixed(1) || 0}°E
                </span>
              </div>
            </div>

            {/* Hide Rocket Details Action Button */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Toggle panel anytime</span>
              <button
                onClick={() => setIsRocketDetailsOpen(false)}
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                title="Hide Rocket Details"
              >
                <X className="w-3 h-3" />
                <span>Hide Details</span>
              </button>
            </div>
          </div>

          {/* 3D Legend Key */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 backdrop-blur-md font-mono text-[10px] space-y-1 text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-cyan-400 rounded" />
              <span>Target Orbit ({mission.target_orbit})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-gradient-to-r from-amber-500 to-cyan-400 rounded" />
              <span>Ascent Trajectory</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 border-t border-dashed border-amber-400" />
              <span>Ground Track: {launchSite.label.split(" ")[0]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-indigo-400 rounded" />
              <span>Constellation Fleet ({satellites.length} Satellites)</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RIGHT HUD OVERLAY: MULTI-SATELLITE CONSTELLATION FLEET SELECTOR
          ========================================================================= */}
      {isFleetPanelOpen && (
        <div className="absolute top-14 right-4 z-20 pointer-events-auto w-72 max-h-[460px] flex flex-col rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md shadow-2xl font-mono text-xs overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white tracking-tight">Active Satellite Fleet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                {filteredSatellites.length} / {satellites.length}
              </span>
              <button
                onClick={() => setIsFleetPanelOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-0.5"
                title="Hide Fleet Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-1 overflow-x-auto">
            {[
              { id: "all", label: "All" },
              { id: "stations", label: "Stations" },
              { id: "leo", label: "LEO (<1000km)" },
              { id: "high", label: "MEO/GEO" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFleetCategoryFilter(tab.id)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors whitespace-nowrap cursor-pointer ${
                  fleetCategoryFilter === tab.id
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Satellite Fleet List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[300px]">
            {filteredSatellites.map((sat) => {
              const isSelected = sat.id === selectedSatelliteId;
              const liveData = fleetTelemetry[sat.id];

              return (
                <div
                  key={sat.id}
                  onClick={() => {
                    setSelectedSatelliteId(sat.id);
                    setIsHoverCardPinned(true);
                  }}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? "bg-slate-800/90 border-cyan-400 text-white shadow-xs"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: sat.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[11px] truncate">{sat.name}</span>
                        {sat.id === "primary" && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate tabular-nums">
                        {liveData ? `${liveData.altKm.toFixed(0)} km · ${liveData.velocityKms.toFixed(2)} km/s` : `${sat.altitudeKm} km`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSatelliteId(sat.id);
                        setIsHoverCardPinned(true);
                        applyCameraPreset("track");
                      }}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition-colors"
                      title="Focus Camera & Track"
                    >
                      <Crosshair className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Fleet Orbit Mode Selector */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Orbit Rings:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFleetOrbitsMode("all")}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  fleetOrbitsMode === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFleetOrbitsMode("selected")}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  fleetOrbitsMode === "selected" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFleetOrbitsMode("none")}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  fleetOrbitsMode === "none" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Hide
              </button>
            </div>
          </div>

          <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{satellites.length} Active Satellites</span>
            <button
              onClick={() => setIsFleetPanelOpen(false)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white cursor-pointer flex items-center gap-1 transition-colors"
              title="Hide Fleet Panel"
            >
              <X className="w-3 h-3" />
              <span>Hide Fleet Panel</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          BOTTOM HUD OVERLAY: LAYER TOGGLES & TIME SCRUBBER
          ========================================================================= */}
      <div className="absolute bottom-3 inset-x-4 z-20 pointer-events-auto flex flex-col gap-2">
        {/* Layer Visibility Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md font-mono text-xs">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowOrbit(!showOrbit)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                showOrbit
                  ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Orbits: {showOrbit ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowAscentTrajectory(!showAscentTrajectory)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                showAscentTrajectory
                  ? "bg-amber-950 text-amber-300 border-amber-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Ascent: {showAscentTrajectory ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowGroundTrack(!showGroundTrack)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                showGroundTrack
                  ? "bg-purple-950 text-purple-300 border-purple-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Ground Track: {showGroundTrack ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowEquatorPlane(!showEquatorPlane)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                showEquatorPlane
                  ? "bg-blue-950 text-blue-300 border-blue-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Equator: {showEquatorPlane ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowAtmosphere(!showAtmosphere)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                showAtmosphere
                  ? "bg-sky-950 text-sky-300 border-sky-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Atmosphere: {showAtmosphere ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setShowSatelliteLabels(!showSatelliteLabels)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                showSatelliteLabels
                  ? "bg-indigo-950 text-indigo-300 border-indigo-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Labels: {showSatelliteLabels ? "ON" : "OFF"}
            </button>

            {/* Solar System Layer Controls */}
            <button
              onClick={() => setShowSolarSystem(!showSolarSystem)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border flex items-center gap-1.5 ${
                showSolarSystem
                  ? "bg-amber-950 text-amber-300 border-amber-800 font-semibold"
                  : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title="Toggle Solar System Background"
            >
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Solar System: {showSolarSystem ? "ON" : "OFF"}</span>
            </button>

            {showSolarSystem && (
              <>
                <button
                  onClick={() => setShowPlanetaryOrbits(!showPlanetaryOrbits)}
                  className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                    showPlanetaryOrbits
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-slate-950 text-slate-500 border-slate-800"
                  }`}
                  title="Toggle Planetary Orbit Ellipses"
                >
                  Planet Orbits: {showPlanetaryOrbits ? "ON" : "OFF"}
                </button>
                <button
                  onClick={() => setShowCelestialLabels(!showCelestialLabels)}
                  className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                    showCelestialLabels
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-slate-950 text-slate-500 border-slate-800"
                  }`}
                  title="Toggle Celestial HUD Tags"
                >
                  Planet Tags: {showCelestialLabels ? "ON" : "OFF"}
                </button>
              </>
            )}

            {/* Rocket Details HUD Toggle */}
            <button
              onClick={() => setIsRocketDetailsOpen(!isRocketDetailsOpen)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border flex items-center gap-1.5 ${
                isRocketDetailsOpen
                  ? "bg-cyan-950 text-cyan-300 border-cyan-800 font-semibold"
                  : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title={isRocketDetailsOpen ? "Hide Rocket Details Panel" : "Show Rocket Details Panel"}
            >
              <Rocket className="w-3 h-3 text-cyan-400" />
              <span>Rocket Details: {isRocketDetailsOpen ? "ON" : "OFF"}</span>
            </button>

            {/* Fleet Panel HUD Toggle */}
            <button
              onClick={() => setIsFleetPanelOpen(!isFleetPanelOpen)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border flex items-center gap-1.5 ${
                isFleetPanelOpen
                  ? "bg-indigo-950 text-indigo-300 border-indigo-800 font-semibold"
                  : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title={isFleetPanelOpen ? "Hide Satellite Fleet Panel" : "Show Satellite Fleet Panel"}
            >
              <Radio className="w-3 h-3 text-indigo-400" />
              <span>Fleet Panel: {isFleetPanelOpen ? "ON" : "OFF"}</span>
            </button>
            <button
              onClick={() => setAnimateOrbitSatellite(!animateOrbitSatellite)}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                animateOrbitSatellite
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              Simulation: {animateOrbitSatellite ? "ORBITING" : "PAUSED"}
            </button>

            {/* Sim Speed Multiplier */}
            <div className="flex items-center gap-1 border border-slate-800 rounded bg-slate-950 p-0.5 text-[10px]">
              {[1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeedMultiplier(spd)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    simSpeedMultiplier === spd ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Play / Scrubber Synchronization */}
          <div className="flex items-center gap-2">
            {onTogglePlay && (
              <button
                onClick={onTogglePlay}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer transition-colors"
              >
                {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isPlaying ? "Pause Ascent" : "Play Ascent"}</span>
              </button>
            )}

            {onIndexChange && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">T+{trajectory.time[currentIndex] || 0}s</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, trajectory.time.length - 1)}
                  value={currentIndex}
                  onChange={(e) => onIndexChange(Number(e.target.value))}
                  className="w-24 sm:w-32 accent-cyan-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
