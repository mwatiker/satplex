import * as satellite from 'satellite.js';
import { getSatRecFromOMM, getSatellitePositionFromSatRec, getOrbitalPeriod } from '../utils/orbitalPhysics';

let satrecs = new Map<number, satellite.SatRec>();
let noradIdOrder: number[] = [];

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case 'INIT_SATELLITES': {
      const { orbitalBuffer } = data;
      const ELEMENT_COUNT = 11;
      const newSatrecs = new Map<number, satellite.SatRec>();
      const newOrder: number[] = [];

      if (orbitalBuffer) {
        const floatView = orbitalBuffer as Float32Array;
        const uintView = new Uint32Array(floatView.buffer, floatView.byteOffset, floatView.length);
        console.log(`[Globe Worker] INIT_SATELLITES: Processing ${floatView.length / ELEMENT_COUNT} records...`);

        for (let i = 0; i < floatView.length; i += ELEMENT_COUNT) {
          const noradId = floatView[i];
          
          if (!noradId) {
            newOrder.push(0);
            continue;
          }

          const epochLow = uintView[i + 8];
          const epochHigh = uintView[i + 9];
          const epochMs = epochLow + (epochHigh * 0x100000000);
          
          if (isNaN(epochMs) || epochMs === 0) {
              newOrder.push(0);
              continue;
          }

          const epochDate = new Date(epochMs);
          let epochStr: string;
          try {
            epochStr = epochDate.toISOString();
          } catch (e) {
            newOrder.push(0);
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
            newOrder.push(noradId);
          } else {
            newOrder.push(0);
          }
        }
      }

      satrecs = newSatrecs;
      noradIdOrder = newOrder;
      console.log(`[Globe Worker] INIT_DONE: Successfully initialized ${newSatrecs.size}/${newOrder.length} satrecs.`);
      (self as any).postMessage({ type: 'INIT_DONE' });
      break;
    }

    case 'GET_POSITIONS': {
      const { time } = data;
      const now = new Date(time);
      const n = noradIdOrder.length;

      const lats = new Float32Array(n);
      const lngs = new Float32Array(n);
      const alts = new Float32Array(n);
      const velocities = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        const noradId = noradIdOrder[i];
        const satrec = noradId > 0 ? satrecs.get(noradId) : null;
        if (!satrec) {
            lats[i] = 0; lngs[i] = 0; alts[i] = -1000;
            continue;
        }

        const pos = getSatellitePositionFromSatRec(satrec, now);
        if (!pos) {
            lats[i] = 0; lngs[i] = 0; alts[i] = -1000;
            continue;
        }

        lats[i] = pos.lat;
        lngs[i] = pos.lng;
        alts[i] = pos.alt;
        velocities[i] = pos.velocity;
      }

      (self as any).postMessage(
        { type: 'POSITIONS_UPDATED', lats, lngs, alts, velocities },
        [lats.buffer, lngs.buffer, alts.buffer, velocities.buffer]
      );
      break;
    }

    case 'UPDATE_POSITIONS': {
      const { time, renderSet } = data;
      const now = new Date(time);
      const buffer = new Float32Array(renderSet.length * 6);

      for (let i = 0; i < renderSet.length; i++) {
        const sat = renderSet[i];
        const offset = i * 6;
        const satrec = satrecs.get(sat.noradId);

        if (!satrec) {
          buffer[offset] = -1;
          continue;
        }

        const pos = getSatellitePositionFromSatRec(satrec, now);
        if (!pos) {
          buffer[offset] = -1;
          continue;
        }

        buffer[offset] = sat.noradId;
        buffer[offset + 1] = pos.lat;
        buffer[offset + 2] = pos.lng;
        buffer[offset + 3] = pos.alt;
        buffer[offset + 4] = pos.velocity;
        buffer[offset + 5] = getOrbitalPeriod(satrec);
      }

      (self as any).postMessage({ type: 'POSITIONS_UPDATED', buffer }, [buffer.buffer]);
      break;
    }
  }
};