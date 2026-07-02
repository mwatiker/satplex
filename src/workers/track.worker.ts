import * as satellite from 'satellite.js';
import { getSatRecFromOMM, getOrbitalPeriod } from '../utils/orbitalPhysics';

let satrecs = new Map<number, satellite.SatRec>();
let lastRequestId: number = 0;

interface TrackCacheEntry {
  segments: Float32Array[];
  minSpeed: number;
  maxSpeed: number;
  groundTrack: null;
}

// Cache ground-track results by satellite and duration.
const trackCache = new Map<string, TrackCacheEntry>();
const MAX_CACHE_SIZE = 50;

self.onmessage = (e: MessageEvent) => {
  const { type, data, requestId } = e.data;

  switch (type) {
    case 'INIT_SATELLITES': {
      const { orbitalBuffer } = data;
      const ELEMENT_COUNT = 11;
      const newSatrecs = new Map<number, satellite.SatRec>();

      if (orbitalBuffer) {
        const floatView = orbitalBuffer as Float32Array;
        const uintView = new Uint32Array(floatView.buffer, floatView.byteOffset, floatView.length);

        for (let i = 0; i < floatView.length; i += ELEMENT_COUNT) {
          const noradId = floatView[i];
          if (!noradId) continue;

          const epochLow = uintView[i + 8];
          const epochHigh = uintView[i + 9];
          const epochMs = epochLow + (epochHigh * 0x100000000);

          if (isNaN(epochMs) || epochMs === 0) continue;

          const epochDate = new Date(epochMs);
          let epochStr: string;
          try {
            epochStr = epochDate.toISOString();
          } catch {
            continue;
          }

          const omm = {
            NORAD_CAT_ID: noradId,
            MEAN_MOTION: floatView[i + 1],
            ECCENTRICITY: floatView[i + 2],
            INCLINATION: floatView[i + 3],
            RA_OF_ASC_NODE: floatView[i + 4],
            ARG_OF_PERICENTER: floatView[i + 5],
            MEAN_ANOMALY: floatView[i + 6],
            BSTAR: floatView[i + 7],
            EPOCH: epochStr,
            MEAN_MOTION_DOT: floatView[i + 10]
          };

          const rec = getSatRecFromOMM(omm);
          if (rec) {
            newSatrecs.set(noradId, rec);
          }
        }
      }

      satrecs = newSatrecs;
      (self as unknown as Worker).postMessage({ type: 'INIT_DONE' });
      break;
    }
    case 'CALCULATE_GROUND_TRACK': {
      const { noradId, durationMins, startTime } = data;
      const currentRequestId = requestId || Date.now();
      lastRequestId = currentRequestId;

      const cacheKey = `${noradId}_${durationMins}`;
      const satrec = satrecs.get(noradId);
      if (!satrec) {
        (self as unknown as Worker).postMessage({
          type: 'GROUND_TRACK_FAILED',
          noradId,
          requestId: currentRequestId,
          error: 'Satellite record not found'
        });
        return;
      }

      const periodMins = getOrbitalPeriod(satrec);
      const mins = durationMins === 180 ? periodMins : durationMins;

      const TARGET_POINTS = 150;
      const stepSecs = Math.max(30, Math.ceil((mins * 60) / TARGET_POINTS));
      const steps = Math.ceil((mins * 60) / stepSecs);

      const baseTime = startTime ? new Date(startTime) : new Date();
      const rawLats: number[] = [];
      const rawLngs: number[] = [];
      const rawAlts: number[] = [];
      const rawSpeeds: number[] = [];

      let minSpeed = Infinity;
      let maxSpeed = -Infinity;

      // Split the work into chunks to allow preemption checks
      const CHUNK_SIZE = 50;
      let currentStep = 0;

      const processChunk = () => {
        if (lastRequestId !== currentRequestId) {
          return;
        }

        const endStep = Math.min(currentStep + CHUNK_SIZE, steps);

        for (let i = currentStep; i <= endStep; i++) {
          const time = new Date(baseTime.getTime() + i * stepSecs * 1000);
          const posAndVel = satellite.propagate(satrec, time);

          if (
            posAndVel.position && typeof posAndVel.position !== 'boolean' &&
            posAndVel.velocity && typeof posAndVel.velocity !== 'boolean'
          ) {
            const gmst = satellite.gstime(time);
            const gd = satellite.eciToGeodetic(posAndVel.position as satellite.EciVec3<number>, gmst);
            const v = posAndVel.velocity as satellite.EciVec3<number>;
            const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

            rawLats.push(satellite.degreesLat(gd.latitude));
            rawLngs.push(satellite.degreesLong(gd.longitude));
            rawAlts.push(gd.height);
            rawSpeeds.push(speed);

            if (speed < minSpeed) minSpeed = speed;
            if (speed > maxSpeed) maxSpeed = speed;
          }
        }

        currentStep = endStep + 1;

        if (currentStep <= steps) {
          // Continue in next turn of event loop to allow other messages
          setTimeout(processChunk, 0);
        } else {
          finishCalculation();
        }
      };

      const finishCalculation = () => {
        // Antimeridian split
        const STRIDE = 4;
        const ANTIMERIDIAN_THRESHOLD = 360; // This is intentionally set to 360 so that we get one continuous line.
        const segments: Float32Array[] = [];
        let segBuf: number[] = [];

        for (let i = 0; i < rawLats.length; i++) {
          if (i > 0 && Math.abs(rawLngs[i] - rawLngs[i - 1]) > ANTIMERIDIAN_THRESHOLD) {
            if (segBuf.length >= STRIDE * 2) {
              segments.push(new Float32Array(segBuf));
            }
            segBuf = [];
          }
          segBuf.push(rawLats[i], rawLngs[i], rawAlts[i], rawSpeeds[i]);
        }
        if (segBuf.length >= STRIDE * 2) {
          segments.push(new Float32Array(segBuf));
        }

        const result = {
          segments,
          minSpeed: minSpeed === Infinity ? 0 : minSpeed,
          maxSpeed: maxSpeed === -Infinity ? 0 : maxSpeed,
          groundTrack: null
        };

        // Cache the result (clone segments to avoid transfer issues)
        if (trackCache.size >= MAX_CACHE_SIZE) {
          const firstKey = trackCache.keys().next().value;
          if (firstKey !== undefined) {
            trackCache.delete(firstKey);
          }
        }
        trackCache.set(cacheKey, {
          ...result,
          segments: segments.map(s => new Float32Array(s))
        });

        (self as unknown as Worker).postMessage(
          {
            type: 'GROUND_TRACK_CALCULATED',
            noradId,
            requestId: currentRequestId,
            ...result
          },
          segments.map(s => s.buffer)
        );
      };

      processChunk();
      break;
    }

    case 'CLEAR_CACHE': {
      trackCache.clear();
      break;
    }
  }
};
