export interface SatNogsSatellite {
  norad_cat_id: number;
  name: string;
  status: string;
  telemetries: any[];
  countries?: string;
  updated?: string;
  description?: string;
  operator?: string;
  launched?: string;
  deployed?: string;
  website?: string;
  image?: string;
  names?: string;
  associated_satellites?: string[];
  citation?: string;
}

export interface MergedSatellite {
  name: string;
  noradId: number;
  tle1: string;
  tle2: string;
  omm?: Record<string, any>;
  masterData?: Record<string, any>;
  hasTelemetry: boolean;
  status: string;
  countries?: string;
  telemetries?: any[];
  updated?: string;
  description?: string;
  operator?: string;
  launched?: string;
  deployed?: string;
  website?: string;
  names?: string;
  associated_satellites?: string[];
  citation?: string;
  // Fields from satellite-list index (populated at load time, no detail fetch needed)
  objectType?: string | null;   // "PAYLOAD" | "ROCKET BODY" | "DEBRIS" | "UNKNOWN"
  apoapsis?: number | null;     // km, used for orbit regime bucketing
  launchYear?: number | null;   // e.g. 1998
  decayed?: boolean;            // true if DECAY_DATE is set
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://satplex.io';
const ORBITAL_URL = `${API_BASE}/api/orbital-binary`;
const SATNOGS_URL = `${API_BASE}/api/satnogs`;

const CACHE_BASE_KEY = 'satellite_data_cache';
const CACHE_TIMEOUT = 1000 * 60 * 60; // 1 hour

async function getDynamicCacheKey(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const version = data.cacheVersion || 'default';
    return `${CACHE_BASE_KEY}_v${version}`;
  } catch (e) {
    console.warn('Failed to fetch dynamic cache version, falling back to static key');
    return `${CACHE_BASE_KEY}_v37`; // Fallback
  }
}

export async function fetchSatelliteData(): Promise<{
  satellites: MergedSatellite[];
  totalSatellites: number;
  withTelemetry: number;
  orbitalBuffer?: Float32Array;
}> {
  const currentCacheKey = await getDynamicCacheKey();
  const cached = localStorage.getItem(currentCacheKey);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TIMEOUT && data.satellites.length > 0) {
        console.log(`Serving from local orbital cache (${currentCacheKey})`);
        try {
          const orbitalRes = await fetch(`${ORBITAL_URL}?v=${Date.now()}`);
          if (orbitalRes.ok) {
            const objBuf = await orbitalRes.arrayBuffer();
            data.orbitalBuffer = new Float32Array(objBuf);
          }
        } catch (e) { }
        return data;
      }
    } catch (e) {
      localStorage.removeItem(currentCacheKey);
    }
  }

  try {
    console.log('Fetching lightweight satellite index and orbital data...');

    // Fetch Orbital Data, SatNOGS, and the lightweight index in parallel
    let [orbitalRes, listRes, satNogsRes] = await Promise.all([
      fetch(`${ORBITAL_URL}?v=${Date.now()}`),
      fetch(`${API_BASE}/api/satellite-list`).then(r => r.json()).catch(() => []),
      fetch(SATNOGS_URL),
    ]);

    if (!orbitalRes.ok) throw new Error(`Binary Orbital API responded with ${orbitalRes.status}`);

    const orbitalBuffer = await orbitalRes.arrayBuffer();
    const orbitalView = new Float32Array(orbitalBuffer);
    const listIndexData: any[] = listRes;
    const satNogsData: SatNogsSatellite[] = await satNogsRes.json();

    const satNogsMap = new Map<number, SatNogsSatellite>();
    satNogsData.forEach(sat => satNogsMap.set(sat.norad_cat_id, sat));

    const listIndexMap = new Map<number, any>();
    listIndexData.forEach(sat => listIndexMap.set(sat.noradId, sat));

    const satellites: MergedSatellite[] = [];
    let withTelemetryCount = 0;

    // Process binary records
    // Record schema: [id, mean_mo, ecc, incl, raan, argp, mean_an, bstar, epoch_low, epoch_high, mo_dot]
    const ELEMENT_COUNT = 11;
    for (let i = 0; i < orbitalView.length; i += ELEMENT_COUNT) {
      const noradId = orbitalView[i];
      if (!noradId) continue;

      const indexRecord = listIndexMap.get(noradId) || {};
      const satMatch = satNogsMap.get(noradId);
      const hasTelemetry = !!(satMatch?.telemetries && satMatch.telemetries.length > 0);
      if (hasTelemetry) withTelemetryCount++;

      satellites.push({
        name: indexRecord.name || satMatch?.name || 'UNKNOWN',
        noradId: noradId,
        tle1: '',
        tle2: '',
        omm: undefined,
        masterData: undefined,
        hasTelemetry,
        status: satMatch?.status || 'unknown',
        countries: indexRecord.countries || satMatch?.countries || '',
        telemetries: satMatch?.telemetries || [],
        updated: satMatch?.updated,
        description: undefined,
        operator: satMatch?.operator || undefined,
        launched: satMatch?.launched || undefined,
        deployed: satMatch?.deployed || undefined,
        website: satMatch?.website || undefined,
        names: satMatch?.names || undefined,
        associated_satellites: satMatch?.associated_satellites || undefined,
        citation: satMatch?.citation || undefined,
        objectType: indexRecord.objectType || null,
        apoapsis: indexRecord.apoapsis ?? null,
        launchYear: indexRecord.launchYear ?? null,
        decayed: indexRecord.decayed ?? false,
      });
    }

    const result = {
      satellites,
      totalSatellites: satellites.length,
      withTelemetry: withTelemetryCount,
      orbitalBuffer: orbitalView,
    };

    // Store in cache (much smaller now, should fit in localStorage easily)
    if (result.totalSatellites > 0) {
      try {
        const toCache = { ...result };
        toCache.orbitalBuffer = undefined as any; // Do not stringify Float32Array into LocalStorage
        localStorage.setItem(currentCacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: toCache,
        }));
      } catch (e) {
        console.warn('Storage quota exceeded even with optimized data.');
      }
    }

    return result;
  } catch (error) {
    console.error('Data pipeline error:', error);
    throw error;
  }
}

/**
 * Fetches deep metadata and AI descriptions for a single satellite on-demand.
 */
export async function fetchSatelliteDetail(noradId: number): Promise<{
  masterData: Record<string, any>;
  description: string | null;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/satellite/${noradId}`);
    if (!response.ok) throw new Error(`Detail fetch failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching detail for NORAD ${noradId}:`, error);
    return { masterData: {}, description: null };
  }
}
