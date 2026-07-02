export interface LunarSatellite {
  name: string;
  noradId: number;
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  description: string;
  trajectory: { lat: number, lng: number, alt: number, timestamp: number, velocity: number }[];
  type: 'satellite';
  status: 'alive';
}

const LUNAR_SATELLITE_IDS = [
  { 
    id: '-85', 
    name: 'Lunar Reconnaissance Orbiter (LRO)',
    description: 'NASA mission providing high-resolution mapping and study of the lunar surface since 2009.'
  },
  { 
    id: '-152', 
    name: 'Chandrayaan-2 Orbiter',
    description: 'Indian mission studying the lunar surface, composition, and exosphere.'
  },
  { 
    id: '-155', 
    name: 'KPLO (Danuri)',
    description: 'South Korea\'s first lunar orbiter, exploring the Moon\'s environment and searching for resources.'
  },
  { 
    id: '-1176', 
    name: 'CAPSTONE',
    description: 'NASA-funded CubeSat testing a unique near-rectilinear halo orbit for the future Lunar Gateway.'
  },
  { 
    id: '-192', 
    name: 'ARTEMIS-P1',
    description: 'NASA mission (originally THEMIS-B) studying the Moon\'s magnetic environment and solar wind interactions.'
  },
  { 
    id: '-193', 
    name: 'ARTEMIS-P2',
    description: 'NASA mission (originally THEMIS-C) studying solar wind interactions and the lunar wake.'
  }
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://satplex.io';
const CACHE_BASE_KEY = 'horizons_data_cache';
const CACHE_TIMEOUT = 1000 * 60 * 30; // 30 minutes

async function getHorizonsCacheKey(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const version = data.cacheVersion || 'default';
    return `${CACHE_BASE_KEY}_v${version}`;
  } catch {
    return `${CACHE_BASE_KEY}_static`;
  }
}

export async function fetchLunarSatellites(): Promise<LunarSatellite[]> {
  console.log('[DEBUG] fetchLunarSatellites started');

  const currentCacheKey = await getHorizonsCacheKey();
  const cached = localStorage.getItem(currentCacheKey);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TIMEOUT) {
        console.log(`[DEBUG] Serving lunar data from cache (${currentCacheKey})`);
        return data;
      }
    } catch {
      localStorage.removeItem(currentCacheKey);
    }
  }

  const results: LunarSatellite[] = [];
  
  for (const sat of LUNAR_SATELLITE_IDS) {
    try {
      console.log(`[DEBUG] Fetching horizons for ${sat.name}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${API_BASE}/api/horizons/${sat.id}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[DEBUG] Fetch failed for ${sat.name}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const ephemerisText = data.result;

      if (!ephemerisText) {
        console.warn(`[DEBUG] No ephemerisText for ${sat.name}`);
        continue;
      }

      const startMarker = '$$SOE';
      const endMarker = '$$EOE';
      const startIndex = ephemerisText.indexOf(startMarker);
      const endIndex = ephemerisText.indexOf(endMarker);

      if (startIndex === -1 || endIndex === -1) {
        console.warn(`[DEBUG] Markers not found for ${sat.name}. Full NASA Result:`, ephemerisText);
        continue;
      }

      const lines = ephemerisText.substring(startIndex + startMarker.length, endIndex).trim().split('\n');
      const trajectory: { lat: number, lng: number, alt: number, timestamp: number, velocity: number }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const timeStr = `${parts[0]} ${parts[1]}`;
          const timestamp = new Date(timeStr + ' UTC').getTime();
          
          // Determine indices based on whether velocity column is present (length >= 7)
          let lngIdx, latIdx, rangeIdx, velIdx;
          if (parts.length >= 7) {
            lngIdx = parts.length - 5;
            latIdx = parts.length - 4;
            rangeIdx = parts.length - 3;
            velIdx = parts.length - 1;
          } else {
            lngIdx = parts.length - 4;
            latIdx = parts.length - 3;
            rangeIdx = parts.length - 2;
            velIdx = -1;
          }

          const lng = parseFloat(parts[lngIdx]);
          const lat = parseFloat(parts[latIdx]);
          const rangeAu = parseFloat(parts[rangeIdx]);
          const velocity = velIdx !== -1 ? parseFloat(parts[velIdx]) : 0;

          if (!isNaN(lat) && !isNaN(lng) && !isNaN(rangeAu) && !isNaN(timestamp)) {
            const rangeKm = rangeAu * 149597870.7;
            const alt = Math.max(0, rangeKm - 1737.4);
            trajectory.push({ lat, lng, alt, timestamp, velocity });
          }
        }
      }

      // Estimate velocity when the ephemeris response omits it.
      for (let i = 0; i < trajectory.length; i++) {
        if (trajectory[i].velocity === 0 && i < trajectory.length - 1) {
          const first = trajectory[i];
          const second = trajectory[i + 1];
          const dt = (second.timestamp - first.timestamp) / 1000;
          if (dt > 0) {
            const dLat = (second.lat - first.lat) * Math.PI / 180;
            const dLng = (second.lng - first.lng) * Math.PI / 180;
            const meanRadius = 1737.4 + (first.alt + second.alt) / 2;
            const dist = Math.sqrt(dLat * dLat + Math.pow(Math.cos(first.lat * Math.PI / 180) * dLng, 2)) * meanRadius;
            trajectory[i].velocity = dist / dt;
          }
        } else if (trajectory[i].velocity === 0 && i > 0) {
          trajectory[i].velocity = trajectory[i - 1].velocity;
        }
      }

      if (trajectory.length > 0) {
        const first = trajectory[0];
        
        let velocity = 0;
        if (trajectory.length > 1) {
          const second = trajectory[1];
          const dt = (second.timestamp - first.timestamp) / 1000;
          if (dt > 0) {
            const dLat = (second.lat - first.lat) * Math.PI / 180;
            const dLng = (second.lng - first.lng) * Math.PI / 180;
            const meanRadius = 1737.4 + (first.alt + second.alt) / 2;
            const dist = Math.sqrt(dLat * dLat + Math.pow(Math.cos(first.lat * Math.PI / 180) * dLng, 2)) * meanRadius;
            velocity = dist / dt;
          }
        }

        results.push({
          name: sat.name,
          noradId: parseInt(sat.id),
          lat: first.lat,
          lng: first.lng,
          alt: first.alt,
          velocity,
          trajectory,
          description: sat.description,
          type: 'satellite',
          status: 'alive'
        });
        
        console.log(`[DEBUG] Loaded ${sat.name} with ${trajectory.length} trajectory points`);
      }
    } catch (err) {
      console.error(`[DEBUG] Error fetching lunar satellite ${sat.name}:`, err);
    }
  }

  console.log(`[DEBUG] fetchLunarSatellites returning ${results.length} satellites`);
  
  if (results.length > 0) {
    try {
      localStorage.setItem(currentCacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: results
      }));
    } catch {
      console.warn('Failed to cache horizons data');
    }
  }

  return results;
}
