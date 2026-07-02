import * as satellite from 'satellite.js';

export interface SatellitePosition {
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
}

export interface OrbitalElements {
  inclinationDeg: number;  // degrees
  eccentricity: number;    // 0-1
  meanMotionRev: number;   // revolutions per day
  apogeeKm: number;        // km above Earth surface
  perigeeKm: number;       // km above Earth surface
  bstar: number;           // drag term (1/earth radii)
}

const EARTH_RADIUS_KM = 6378.137;

export function getSatRec(tle1: string, tle2: string): satellite.SatRec | null {
  try {
    return satellite.twoline2satrec(tle1, tle2);
  } catch {
    return null;
  }
}

export function getSatRecFromOMM(omm: Record<string, unknown>): satellite.SatRec | null {
  try {
    return satellite.json2satrec(omm as Parameters<typeof satellite.json2satrec>[0]);
  } catch {
    return null;
  }
}

export function getOrbitalPeriod(satrec: satellite.SatRec): number {
  if (!satrec || !satrec.no) return 0;
  return (2 * Math.PI) / satrec.no; // period in minutes
}

export function getOrbitalElements(satrec: satellite.SatRec): OrbitalElements | null {
  if (!satrec || !satrec.no) return null;

  // 1. Basic Keplerian elements from mean elements
  const inclinationDeg = (satrec.inclo * 180) / Math.PI;
  const eccentricity = satrec.ecco;
  const meanMotionRev = (satrec.no * 60 * 24) / (2 * Math.PI);
  const bstar = satrec.bstar;

  // 2. Sample one full orbit to find true max/min altitude
  // This accounts for Earth's oblateness (WGS84) and SGP4 perturbations
  const periodMins = (2 * Math.PI) / satrec.no;
  const samples = 30; // Reduced from 60 for optimization
  let minAlt = Infinity;
  let maxAlt = -Infinity;

  const now = new Date();
  for (let i = 0; i <= samples; i++) {
    const timeOffset = (i / samples) * periodMins;
    const sampleTime = new Date(now.getTime() + timeOffset * 60000);
    
    const posAndVel = satellite.propagate(satrec, sampleTime);
    if (posAndVel.position && typeof posAndVel.position !== 'boolean') {
      const gmst = satellite.gstime(sampleTime);
      const gd = satellite.eciToGeodetic(posAndVel.position as satellite.EciVec3<number>, gmst);
      
      if (gd.height < minAlt) minAlt = gd.height;
      if (gd.height > maxAlt) maxAlt = gd.height;
    }
  }

  // If sampling failed, fall back to mean calculation
  if (minAlt === Infinity || maxAlt === -Infinity) {
    const mu = 398600.4418;
    const nRadPerSec = satrec.no / 60;
    const semiMajorAxisKm = Math.cbrt(mu / (nRadPerSec * nRadPerSec));
    maxAlt = semiMajorAxisKm * (1 + eccentricity) - EARTH_RADIUS_KM;
    minAlt = semiMajorAxisKm * (1 - eccentricity) - EARTH_RADIUS_KM;
  }

  return {
    inclinationDeg,
    eccentricity,
    meanMotionRev,
    apogeeKm: maxAlt,
    perigeeKm: minAlt,
    bstar,
  };
}

export function getSatellitePositionFromSatRec(satrec: satellite.SatRec, date: Date = new Date()): SatellitePosition | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    const positionEci = positionAndVelocity.position;

    if (typeof positionEci === 'boolean' || !positionEci) {
      return null;
    }

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci as satellite.EciVec3<number>, gmst);

    // Velocity
    const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;
    let velocity = 0;
    if (velocityEci) {
      velocity = Math.sqrt(
        Math.pow(velocityEci.x, 2) +
        Math.pow(velocityEci.y, 2) +
        Math.pow(velocityEci.z, 2)
      );
    }

    // Longitude is returned in radians, convert to degrees
    const longitude = satellite.degreesLong(positionGd.longitude);
    const latitude = satellite.degreesLat(positionGd.latitude);

    return {
      lat: latitude,
      lng: longitude,
      alt: positionGd.height, // altitude in km
      velocity
    };
  } catch {
    return null;
  }
}

export function getOrbitRegime(params: {
  apoapsis?: number | null;
  eccentricity?: number | null;
  gcatOpOrbit?: string | null;
} | null | undefined): string | null {
  if (!params) return null;
  const { apoapsis, eccentricity, gcatOpOrbit } = params;

  // 1. Try to use explicit metadata
  if (gcatOpOrbit) {
    const orb = String(gcatOpOrbit).toUpperCase();
    if (orb.startsWith('LEO')) return 'LEO';
    if (orb.startsWith('MEO')) return 'MEO';
    if (orb.startsWith('GEO') || orb.startsWith('GSO')) return 'GEO';
    if (orb.startsWith('HEO')) return 'HEO';
    if (orb === 'GTO') return 'GTO';
    if (orb === 'SSO') return 'SSO';
  }

  // 2. Fallback to calculation
  if (apoapsis == null) return null;
  const ecc = eccentricity ?? 0;

  if (ecc > 0.25) return 'HEO';
  if (apoapsis < 2000) return 'LEO';
  if (apoapsis < 35000) return 'MEO';
  if (apoapsis < 36500) return 'GEO';
  return 'HEO';
}
