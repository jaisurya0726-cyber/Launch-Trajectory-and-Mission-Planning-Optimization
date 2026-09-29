import { Mission, TrajectoryData } from "../types";

export const G0 = 9.80665;
export const EARTH_RADIUS_M = 6371000.0;
export const EARTH_MU = 3.986004418e14;
export const RHO_0 = 1.225;
export const SCALE_HEIGHT = 8500.0;

export function gravityAtAltitude(altM: number): number {
  const r = EARTH_RADIUS_M + Math.max(0, altM);
  return EARTH_MU / (r * r);
}

export function atmosphericDensity(altM: number): number {
  if (altM > 140000) return 0;
  return RHO_0 * Math.exp(-altM / SCALE_HEIGHT);
}

export function aerodynamicDrag(vMs: number, altM: number, cd: number, areaM2: number): number {
  const rho = atmosphericDensity(altM);
  return 0.5 * rho * vMs * vMs * cd * areaM2;
}

export function simulateAscentTrajectory(
  mission: Mission,
  timeStep = 2.0,
  maxDuration?: number,
  angleDeviationDeg = 0.0
): TrajectoryData {
  const duration = maxDuration || Math.min(mission.flight_time, 1200);
  const initialMass = mission.rocket_mass + mission.fuel_consumption + mission.payload_mass;
  const dryPlusPayload = mission.rocket_mass + mission.payload_mass;

  let h = 0.0;
  let x = 0.0;
  let v = 0.5;
  const nominalGammaDeg = 89.8;
  const initialGammaDeg = Math.max(82.0, Math.min(89.95, nominalGammaDeg + angleDeviationDeg * 0.25));
  let gamma = (initialGammaDeg * Math.PI) / 180;
  let m = initialMass;

  const thrustN = mission.thrust * 1000;
  const cd = mission.drag_coefficient || 0.32;
  const areaM2 = mission.cross_section_area || 10.0;
  const massFlow = thrustN / (mission.specific_impulse * G0);
  const burnTime = mission.fuel_consumption / massFlow;
  const targetAltM = mission.altitude * 1000;

  const times: number[] = [];
  const altitudes: number[] = [];
  const velocities: number[] = [];
  const accelerations: number[] = [];
  const accelG: number[] = [];
  const masses: number[] = [];
  const fuelRemaining: number[] = [];
  const thrusts: number[] = [];
  const drags: number[] = [];
  const dynamicPressures: number[] = [];
  const gammasDeg: number[] = [];
  const downranges: number[] = [];

  const pitchoverAlt = 1200.0;
  const pitchBias = ((angleDeviationDeg * Math.PI) / 180) * 0.00035;

  let t = 0.0;
  while (t <= duration) {
    const curThrust = t <= burnTime ? thrustN : 0.0;
    const curMdot = t <= burnTime ? massFlow : 0.0;

    const gLocal = gravityAtAltitude(h);
    const rho = atmosphericDensity(h);
    const fd = aerodynamicDrag(v, h, cd, areaM2);
    const q = (0.5 * rho * v * v) / 1000.0;
    const totalAccel = (curThrust - fd) / m - gLocal * Math.sin(gamma);

    times.push(Number(t.toFixed(1)));
    altitudes.push(Number((h / 1000).toFixed(2)));
    velocities.push(Number(v.toFixed(1)));
    accelerations.push(Number(totalAccel.toFixed(2)));
    accelG.push(Number((Math.abs(totalAccel) / G0).toFixed(2)));
    masses.push(Math.round(m));
    fuelRemaining.push(Math.max(0, Math.round(m - dryPlusPayload)));
    thrusts.push(Number((curThrust / 1000).toFixed(1)));
    drags.push(Number((fd / 1000).toFixed(2)));
    dynamicPressures.push(Number(q.toFixed(2)));
    gammasDeg.push(Number(((gamma * 180) / Math.PI).toFixed(2)));
    downranges.push(Number((x / 1000).toFixed(2)));

    if (h >= targetAltM && v >= 7500) break;

    // RK4
    const deriv = (
      _tVal: number,
      state: [number, number, number, number, number]
    ): [number, number, number, number, number] => {
      const [sh, _sx, sv, sgamma, sm] = state;
      if (sm <= 0) return [0, 0, 0, 0, 0];
      const sg = gravityAtAltitude(sh);
      const sfd = aerodynamicDrag(sv, sh, cd, areaM2);

      const dh = sv * Math.sin(sgamma);
      const sr = EARTH_RADIUS_M + sh;
      const dx = (EARTH_RADIUS_M / sr) * sv * Math.cos(sgamma);
      const dv = (curThrust - sfd) / sm - sg * Math.sin(sgamma);

      let dgamma = 0;
      if (sh < pitchoverAlt) {
        dgamma = -0.001 + pitchBias;
      } else if (sv > 15.0) {
        const cent = (sv * sv) / sr;
        dgamma = -((sg - cent) * Math.cos(sgamma)) / sv + pitchBias * 0.4;
      }
      return [dh, dx, dv, dgamma, -curMdot];
    };

    const s0: [number, number, number, number, number] = [h, x, v, gamma, m];
    const k1 = deriv(t, s0);
    const s1: [number, number, number, number, number] = [
      s0[0] + 0.5 * timeStep * k1[0],
      s0[1] + 0.5 * timeStep * k1[1],
      s0[2] + 0.5 * timeStep * k1[2],
      s0[3] + 0.5 * timeStep * k1[3],
      s0[4] + 0.5 * timeStep * k1[4],
    ];
    const k2 = deriv(t + 0.5 * timeStep, s1);
    const s2: [number, number, number, number, number] = [
      s0[0] + 0.5 * timeStep * k2[0],
      s0[1] + 0.5 * timeStep * k2[1],
      s0[2] + 0.5 * timeStep * k2[2],
      s0[3] + 0.5 * timeStep * k2[3],
      s0[4] + 0.5 * timeStep * k2[4],
    ];
    const k3 = deriv(t + 0.5 * timeStep, s2);
    const s3: [number, number, number, number, number] = [
      s0[0] + timeStep * k3[0],
      s0[1] + timeStep * k3[1],
      s0[2] + timeStep * k3[2],
      s0[3] + timeStep * k3[3],
      s0[4] + timeStep * k3[4],
    ];
    const k4 = deriv(t + timeStep, s3);

    h = Math.max(0, s0[0] + (timeStep / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]));
    x = s0[1] + (timeStep / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    v = Math.max(0.1, s0[2] + (timeStep / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]));
    gamma = Math.max(0, Math.min(Math.PI / 2, s0[3] + (timeStep / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])));
    m = Math.max(dryPlusPayload, s0[4] + (timeStep / 6) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]));

    t += timeStep;
  }

  const maxAlt = Math.max(...altitudes, 0);
  const maxQ = Math.max(...dynamicPressures, 0);
  const maxAcc = Math.max(...accelG, 0);

  return {
    time: times,
    altitude_km: altitudes,
    velocity_ms: velocities,
    acceleration_ms2: accelerations,
    accel_g: accelG,
    mass_kg: masses,
    fuel_remaining_kg: fuelRemaining,
    thrust_kN: thrusts,
    drag_kN: drags,
    dynamic_pressure_kPa: dynamicPressures,
    flight_path_angle_deg: gammasDeg,
    downrange_km: downranges,
    summary: {
      max_altitude_km: maxAlt,
      final_velocity_ms: velocities[velocities.length - 1] || 0,
      max_acceleration_g: maxAcc,
      max_dynamic_pressure_kPa: maxQ,
      burn_time_sec: Number(burnTime.toFixed(1)),
      final_mass_kg: masses[masses.length - 1] || dryPlusPayload,
    },
  };
}
