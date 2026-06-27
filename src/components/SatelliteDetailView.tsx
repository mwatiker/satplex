import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, Line as MapLine } from 'react-simple-maps';
import { splitTrajectory } from '../utils/resampleTrajectory';
import { getCountryName } from '../utils/countryUtils';
import { getOrbitRegime } from '../utils/orbitalPhysics';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ---------------------------------------------------------------------------
// Primitive UI components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Collapsible
// ---------------------------------------------------------------------------

interface CollapsibleCtx {
  isOpen: boolean;
  toggle: () => void;
}

const CollapsibleContext = React.createContext<CollapsibleCtx>({ isOpen: true, toggle: () => { } });

const Collapsible = ({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className="space-y-2">{children}</div>
    </CollapsibleContext.Provider>
  );
};

const CollapsibleTrigger = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { isOpen, toggle } = React.useContext(CollapsibleContext);
  return (
    <button onClick={toggle} className={className}>
      {children}
      <span
        style={{
          display: 'inline-block',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 200ms ease',
        }}
      >
        ▾
      </span>
    </button>
  );
};

const CollapsibleContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { isOpen } = React.useContext(CollapsibleContext);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: 'grid-template-rows 200ms ease',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div className={className ?? ''}>{children}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ground track loading state
// ---------------------------------------------------------------------------

/**
 * Animated "Calculating orbit track..." placeholder shown while the worker
 * is still propagating the TLE data. Consists of:
 *   - A faint dashed arc slowly tracing across the map area (CSS animation)
 *   - A pulsing monospace label in the center
 */
const GroundTrackLoading = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Animate a dashed line drawing across the SVG using stroke-dashoffset
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const path = svg.querySelector<SVGPathElement>('#loading-arc');
    if (!path) return;

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    let start: number | null = null;
    const DURATION = 2200;
    let rafId: number;

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      path.style.strokeDashoffset = `${length * (1 - eased)}`;

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          path.style.strokeDashoffset = `${length}`;
          start = null;
          rafId = requestAnimationFrame(tick);
        }, 600);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="relative w-full h-[180px] bg-black/40 rounded-lg border border-white/5 overflow-hidden mb-3 flex flex-col items-center justify-center gap-3">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 320 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0" y1="80" x2="320" y2="80"
          stroke="white" strokeOpacity="0.04" strokeWidth="0.5"
        />
        <line
          x1="160" y1="0" x2="160" y2="160"
          stroke="white" strokeOpacity="0.04" strokeWidth="0.5"
        />
        <path
          id="loading-arc"
          d="M -10 80 C 40 20, 100 140, 160 80 S 280 20, 330 80"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
        <path
          d="M -10 85 C 40 25, 100 145, 160 85 S 280 25, 330 85"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="0.5"
          strokeOpacity="0.15"
          strokeLinecap="round"
        />
      </svg>

      <span
        className="relative z-10 font-mono text-[10px] tracking-widest uppercase text-sky-400/70"
        style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
      >
        Calculating orbital track
      </span>

      <div className="relative z-10 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1 h-1 rounded-full bg-sky-400/40"
            style={{
              animation: `pulse 1.4s ease-in-out infinite`,
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Satellite {
  noradId: string | null;
  name: string | null;
  description: string | null;
  ucs: any;
  oscar: any;
  satnogs: any;
  gcat: any;
  spacetrack: any;
  gunters: any;
  wiki: any;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getStatusInfo = (sat: Satellite) => {
  const isDecayed = sat?.satnogs?.decayed || sat?.spacetrack?.DECAY_DATE != null || sat?.gcat?.Status === 'R';
  if (isDecayed) return { label: 'Decayed', color: 'bg-red-100 text-red-800' };

  if (sat?.gcat?.Status === 'O') return { label: 'Operational', color: 'bg-green-100 text-green-800' };
  if (sat?.gcat?.Status === 'AO') return { label: 'Inactive', color: 'bg-gray-100 text-gray-600' };

  const status = (sat?.satnogs?.status || sat?.oscar?.status || '').toLowerCase();
  if (status.includes('alive')) return { label: 'Operational', color: 'bg-green-100 text-green-800' };
  if (status.includes('dead')) return { label: 'Inactive', color: 'bg-gray-100 text-gray-600' };
  return { label: 'Unknown', color: 'bg-yellow-100 text-yellow-700' };
};


const isGeostationary = (spacetrack: any, gcat: any): boolean => {
  if (gcat?.OpOrbit) {
    const orb = String(gcat.OpOrbit).toUpperCase();
    return orb === 'GEO' || orb === 'GSO';
  }
  if (!spacetrack) return false;
  const apoapsis = Number(spacetrack.APOAPSIS);
  const ecc = Number(spacetrack.meanElements?.ECCENTRICITY);
  if (!isNaN(ecc) && ecc > 0.25) return false;
  return !isNaN(apoapsis) && apoapsis >= 35_000 && apoapsis < 36_500;
};

const lerpColor = (
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number,
): string => {
  const c = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r1 + (r2 - r1) * c)},${Math.round(g1 + (g2 - g1) * c)},${Math.round(b1 + (b2 - b1) * c)})`;
};

const SLOW = [0x1d, 0x4e, 0xd8] as const;
const FAST = [0x0e, 0xa5, 0xe9] as const;

const speedColor = (speed: number, minSpeed: number, maxSpeed: number): string => {
  const range = maxSpeed - minSpeed || 1;
  return lerpColor(...SLOW, ...FAST, (speed - minSpeed) / range);
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const GroundTrackMap = React.memo(({
  groundTrack,
  trackLines,
  currentLat,
  currentLng,
}: {
  groundTrack: { lat: number; lng: number; speed: number }[][];
  trackLines: React.ReactNode;
  currentLat?: number;
  currentLng?: number;
}) => {
  if (groundTrack.length === 0) return null;

  return (
    <div className="relative w-full h-[180px] bg-black/30 rounded-md border border-white/[0.06] overflow-hidden mb-3">
      <ComposableMap
        projection="geoEquirectangular"
        width={320}
        height={160}
        projectionConfig={{ scale: 45, center: [0, 0] }}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#18181b"
                stroke="#27272a"
                strokeWidth={0.5}
              />
            ))
          }
        </Geographies>

        {trackLines}

        {currentLat !== undefined && currentLng !== undefined && (
          <Marker coordinates={[currentLng, currentLat]}>
            <circle r={2.5} fill="#38bdf8" />
          </Marker>
        )}
      </ComposableMap>
    </div>
  );
});

const MetricCard = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
  <div className="py-1">
    <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">{label}</div>
    <div className="text-sm font-mono text-zinc-100 leading-none">{value}</div>
    {unit && <div className="text-[9px] font-mono text-zinc-500 mt-0.5">{unit}</div>}
  </div>
);

const FieldRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-baseline justify-between gap-2 border-t border-zinc-800 pt-2">
    <span className="text-zinc-500 text-xs shrink-0">{label}</span>
    <span className="text-zinc-300 text-xs font-mono text-right">{String(value)}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SatelliteDetailView(props: {
  satellite: any;
  onClose?: () => void;
  groundTrack?: { lat: number; lng: number; speed: number }[][];
  minSpeed?: number;
  maxSpeed?: number;
  trackDuration?: '1orbit' | '6h' | '12h';
  setTrackDuration?: (d: '1orbit' | '6h' | '12h') => void;
  satLocationName?: string;
  isMobile?: boolean;
}) {
  const { isMobile, ...rest } = props;

  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SatelliteDetailHeader {...rest} />
        <div className="flex-1 overflow-y-auto">
          <SatelliteDetailBody {...rest} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-white">
      <SatelliteDetailHeader {...rest} />
      <div className="mt-4">
        <SatelliteDetailBody {...rest} />
      </div>
    </div>
  );
}

export function SatelliteDetailHeader({
  satellite,
  onClose,
}: {
  satellite: any;
  onClose?: () => void;
}) {
  const data: Satellite = {
    noradId: String(satellite.noradId),
    name: satellite.name,
    description: satellite.description,
    ucs: satellite.masterData?.ucs ?? satellite.omm?.ucs ?? satellite.omm?.UCS ?? {},
    oscar: satellite.masterData?.oscar ?? satellite.omm?.oscar ?? satellite.omm?.OSCAR ?? {},
    satnogs: {
      name: satellite.name,
      status: satellite.status ?? 'Unknown',
      launched: satellite.launched,
      operator: satellite.operator,
      countries: satellite.countries,
      website: satellite.website,
    },
    gcat: satellite.masterData?.gcat ?? satellite.omm?.gcat ?? satellite.omm?.GCAT ?? {},
    spacetrack: {
      ...satellite.omm,
      ...satellite.masterData?.spacetrack,
      meanElements:
        satellite.masterData?.spacetrack?.meanElements ??
        satellite.omm?.meanElements ??
        {},
      COUNTRY_CODE: satellite.countries,
      OBJECT_TYPE:
        satellite.masterData?.spacetrack?.OBJECT_TYPE ?? satellite.omm?.OBJECT_TYPE,
      SITE: satellite.masterData?.spacetrack?.SITE ?? satellite.omm?.SITE,
    },
    gunters:
      satellite.masterData?.gunters ?? satellite.omm?.gunters ?? satellite.omm?.GUNTERS ?? {},
    wiki:
      satellite.masterData?.wiki ?? satellite.omm?.wiki ?? satellite.omm?.WIKI ?? {},
  };

  const name = satellite.name || 'Unknown';
  const country = data.spacetrack?.COUNTRY_CODE;
  
  const orbitClass = getOrbitRegime({
    apoapsis: data.spacetrack?.APOAPSIS,
    eccentricity: data.spacetrack?.ECCENTRICITY,
    gcatOpOrbit: data.gcat?.OpOrbit
  });

  return (
    <div className="px-4 pt-4 pb-2 space-y-2 text-white">
      <div className="flex justify-between items-start gap-4">
        <h1 className="text-2xl font-black">{name}</h1>
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 -m-1 text-zinc-500 hover:text-white transition-colors flex-shrink-0"
            aria-label="Close detail view"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
            </svg>
          </button>
        )}
      </div>
      <p className="text-zinc-400 text-sm">
        {[
          data?.noradId && !['None', 'null', 'undefined'].includes(String(data.noradId)) ? `NORAD ${data.noradId}` : null,
          getCountryName(country),
          orbitClass
        ]
          .filter(v => v && v !== 'None' && v !== 'null' && String(v).toLowerCase() !== 'unknown')
          .join(' · ')}
      </p>
    </div>
  );
}

export function SatelliteDetailBody({
  satellite,
  groundTrack = [],
  minSpeed = 0,
  maxSpeed = 0,
  trackDuration = '1orbit',
  setTrackDuration,
  satLocationName = '',
}: {
  satellite: any;
  groundTrack?: { lat: number; lng: number; speed: number }[][];
  minSpeed?: number;
  maxSpeed?: number;
  trackDuration?: '1orbit' | '6h' | '12h';
  setTrackDuration?: (d: '1orbit' | '6h' | '12h') => void;
  satLocationName?: string;
}) {
  const data: Satellite = {
    noradId: String(satellite.noradId),
    name: satellite.name,
    description: satellite.description,
    ucs: satellite.masterData?.ucs ?? satellite.omm?.ucs ?? satellite.omm?.UCS ?? {},
    oscar: satellite.masterData?.oscar ?? satellite.omm?.oscar ?? satellite.omm?.OSCAR ?? {},
    satnogs: {
      name: satellite.name,
      status: satellite.status ?? 'Unknown',
      launched: satellite.launched,
      operator: satellite.operator,
      countries: satellite.countries,
      website: satellite.website,
    },
    gcat: satellite.masterData?.gcat ?? satellite.omm?.gcat ?? satellite.omm?.GCAT ?? {},
    spacetrack: {
      ...satellite.omm,
      ...satellite.masterData?.spacetrack,
      // Priority 1: Check masterData.spacetrack (ALL CAPS from server)
      // Priority 2: Check satellite.omm (worker-mapped ALL CAPS)
      INCLINATION: satellite.masterData?.spacetrack?.INCLINATION ?? satellite.omm?.INCLINATION,
      MEAN_MOTION: satellite.masterData?.spacetrack?.MEAN_MOTION ?? satellite.omm?.MEAN_MOTION,
      ECCENTRICITY: satellite.masterData?.spacetrack?.ECCENTRICITY ?? satellite.omm?.ECCENTRICITY,
      APOAPSIS: satellite.masterData?.spacetrack?.APOAPSIS ?? satellite.omm?.APOAPSIS,
      PERIAPSIS: satellite.masterData?.spacetrack?.PERIAPSIS ?? satellite.omm?.PERIAPSIS,
      PERIOD: satellite.masterData?.spacetrack?.PERIOD ?? satellite.omm?.PERIOD,
      SEMIMAJOR_AXIS: satellite.masterData?.spacetrack?.SEMIMAJOR_AXIS ?? satellite.omm?.SEMIMAJOR_AXIS,
      COUNTRY_CODE: satellite.countries,
      OBJECT_TYPE: satellite.masterData?.spacetrack?.OBJECT_TYPE ?? satellite.omm?.OBJECT_TYPE,
      SITE: satellite.masterData?.spacetrack?.SITE ?? satellite.omm?.SITE,
    },
    gunters:
      satellite.masterData?.gunters ?? satellite.omm?.gunters ?? satellite.omm?.GUNTERS ?? {},
    wiki:
      satellite.masterData?.wiki ?? satellite.omm?.wiki ?? satellite.omm?.WIKI ?? {},
  };

  const status = getStatusInfo(data);
  const operator = data.satnogs?.operator;
  const country = data.spacetrack?.COUNTRY_CODE;
  const isGeo = isGeostationary(data.spacetrack, data.gcat);

  const desc = satellite.description ?? '';



  const identityFields = useMemo<[string, string][]>(() => {
    return ([
      ['Operator', operator],
      ['Owner', data.gcat?.Owner && data.gcat.Owner !== operator ? data.gcat.Owner : null],
      ['Country', getCountryName(country)],
      ['Manufacturer', data.gcat?.Manufacturer],
      ['Bus', data.gcat?.Bus],
      ['Status', status.label],
      ['COSPAR ID', data.spacetrack?.objectId || data.wiki?.infobox?.['COSPAR ID']],
      ['End of Life', data.oscar?.EoL],
    ] as [string, any][]).filter(([, v]) => v && String(v).trim() !== '-' && String(v).toLowerCase() !== 'unknown') as [string, string][];
  }, [data, operator, country, status.label]);

  const orbitalFields = useMemo<[string, string][]>(() => {
    const epoch = data.spacetrack?.EPOCH || data.spacetrack?.meanElements?.EPOCH;
    let formattedEpoch = null;
    if (epoch) {
      try {
        formattedEpoch = new Date(epoch).toLocaleString();
      } catch (e) {
        formattedEpoch = epoch;
      }
    }

    return ([
      ['Data Epoch', formattedEpoch],
      ['Semi-major axis', data.spacetrack?.SEMIMAJOR_AXIS ? `${data.spacetrack.SEMIMAJOR_AXIS} km` : null],
      ['Apoapsis', data.spacetrack?.APOAPSIS ? `${data.spacetrack.APOAPSIS} km` : null],
      ['Periapsis', data.spacetrack?.PERIAPSIS ? `${data.spacetrack.PERIAPSIS} km` : null],
      ['Eccentricity', data.spacetrack?.ECCENTRICITY],
      ['Mean Motion', data.spacetrack?.MEAN_MOTION ? `${data.spacetrack.MEAN_MOTION} rev/day` : null],
      ['Inclination', data.spacetrack?.INCLINATION ? `${data.spacetrack.INCLINATION}°` : null],
    ] as [string, any][]).filter(([, v]) => !!v && String(v).trim() !== '-' && String(v).toLowerCase() !== 'unknown') as [string, string][];
  }, [data]);

  const spacecraftFields = useMemo<[string, string][]>(() => {
    const dims = [data.gcat?.Length, data.gcat?.Diameter].filter(v => v != null).join(' × ');
    const span = data.gcat?.Span;
    const dimDisplay = dims ? `${dims} m` : (span ? `${span} m (span)` : null);

    return ([
      ['Launch Vehicle', data.gunters.details?.['Launch Vehicle']],
      ['Launch Site', data.spacetrack?.SITE],
      ['Mass', data.gcat?.Mass ? `${data.gcat.Mass} kg` : data.gunters.details?.['Mass']],
      ['Shape', data.gcat?.Shape],
      ['Dimensions', dimDisplay],
      ['Power', data.gunters.details?.['Power']],
      ['Design Lifetime', data.gunters.details?.['Lifetime']],
      ['Object Type', data.spacetrack?.OBJECT_TYPE],
    ] as [string, any][]).filter(([, v]) => !!v && String(v).trim() !== '-' && String(v).toLowerCase() !== 'unknown') as [string, string][];
  }, [data]);

  const isWikiList = (url: string) => url.toLowerCase().includes('wikipedia.org/wiki/list_of_');

  const externalLinks = useMemo<[string, string][]>(() => {
    return ([
      ['OSCAR', data.oscar?.link],
      ['Website', data.satnogs?.website],
      ['Wikipedia', data.wiki?.url && !isWikiList(data.wiki.url) ? data.wiki.url : null],
    ] as [string, any][]).filter(([, v]) => !!v && String(v).toLowerCase() !== 'unknown') as [string, string][];
  }, [data]);

  const trackLines = useMemo(() => {
    if (!groundTrack.length) return null;
    const segments = groundTrack.flatMap((seg) => splitTrajectory(seg));
    const NUM_BINS = 12; // Fewer bins = fewer SVG elements = faster rendering

    return segments.map((segment, segIdx) => {
      if (segment.length < 2) return null;

      const groupedLines: React.ReactNode[] = [];
      let currentGroup: [number, number][] = [[segment[0].lng, segment[0].lat]];
      let currentBin = -1;

      for (let i = 1; i < segment.length; i++) {
        const pt = segment[i];
        const prev = segment[i - 1];
        const avgSpeed = (prev.speed + pt.speed) / 2;

        const range = maxSpeed - minSpeed || 1;
        const t = Math.max(0, Math.min(1, (avgSpeed - minSpeed) / range));
        const bin = Math.floor(t * (NUM_BINS - 1));

        if (currentBin === -1) {
          currentBin = bin;
        }

        if (bin === currentBin) {
          currentGroup.push([pt.lng, pt.lat] as any);
        } else {
          const color = speedColor(minSpeed + (currentBin / (NUM_BINS - 1)) * range, minSpeed, maxSpeed);
          groupedLines.push(
            <MapLine
              key={`track-${segIdx}-${groupedLines.length}`}
              coordinates={currentGroup as any}
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.85}
            />
          );
          currentBin = bin;
          currentGroup = [[prev.lng, prev.lat], [pt.lng, pt.lat]];
        }
      }

      if (currentGroup.length >= 2) {
        const range = maxSpeed - minSpeed || 1;
        const color = speedColor(minSpeed + (currentBin / (NUM_BINS - 1)) * range, minSpeed, maxSpeed);
        groupedLines.push(
          <MapLine
            key={`track-${segIdx}-${groupedLines.length}-last`}
            coordinates={currentGroup as any}
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.85}
          />
        );
      }

      return groupedLines;
    });
  }, [groundTrack, minSpeed, maxSpeed]);

  const currentPosition =
    satellite.lat !== undefined && satellite.lng !== undefined
      ? `${Math.abs(satellite.lat).toFixed(2)}°${satellite.lat >= 0 ? 'N' : 'S'} ${Math.abs(satellite.lng).toFixed(2)}°${satellite.lng >= 0 ? 'E' : 'W'}`
      : 'Position Unknown';

  // Determine what to show in the track card area:
  //   - groundTrack.length > 0  → show the map
  //   - never loaded yet         → show the animated loading state
  //   - loaded but empty         → show the static "unavailable" fallback
  const trackContent = (() => {
    if (groundTrack.length > 0) {
      return (
        <>
          <GroundTrackMap
            groundTrack={groundTrack}
            trackLines={trackLines}
            currentLat={satellite.lat}
            currentLng={satellite.lng}
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-zinc-500 font-mono shrink-0">{currentPosition}</span>
              {satLocationName && (
                <>
                  <span className="text-[10px] text-zinc-700 shrink-0">·</span>
                  <span className="text-[10px] text-zinc-400 font-medium truncate">{satLocationName}</span>
                </>
              )}
            </div>
            {!isGeo && (
              <div className="flex items-center gap-1 shrink-0">
                {(['1orbit', '6h', '12h'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setTrackDuration?.(opt)}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide transition-colors ${trackDuration === opt
                      ? 'bg-sky-400/20 text-sky-400 border border-sky-400/30'
                      : 'bg-white/5 text-zinc-500 border border-white/10 hover:bg-white/10'
                      }`}
                  >
                    {opt === '1orbit' ? 'Orbit' : opt.replace('h', 'hr')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      );
    }

    return <GroundTrackLoading />;
  })();

  return (
    <div className="w-full space-y-6 p-4 pt-0 text-white">
      <div className="text-sm text-zinc-300 leading-relaxed min-h-[40px]">
        {desc ? (
          desc
        ) : (
          <div className="animate-pulse space-y-2 py-1">
            <div className="h-2 bg-white/10 rounded w-full" />
            <div className="h-2 bg-white/10 rounded w-5/6" />
          </div>
        )}
      </div>

      <div className="max-w-[340px] mx-auto">
        {trackContent}
      </div>

      <div className="flex justify-evenly border-t border-b border-white/[0.06] py-4">
        <MetricCard
          label="Altitude"
          value={satellite.alt !== undefined ? `${Math.round(satellite.alt)}` : (data.spacetrack?.APOAPSIS ? `${data.spacetrack.APOAPSIS}` : '—')}
          unit="km"
        />
        <MetricCard
          label="Velocity"
          value={satellite.velocity !== undefined ? `${satellite.velocity.toFixed(2)}` : '—'}
          unit="km/s"
        />
        <MetricCard
          label="Period"
          value={data.spacetrack?.PERIOD ? `${Number(data.spacetrack.PERIOD).toFixed(1)}` : '—'}
          unit="min"
        />
        <MetricCard
          label="Inclination"
          value={data.spacetrack?.INCLINATION ? `${Number(data.spacetrack.INCLINATION).toFixed(2)}°` : '—'}
          unit="deg"
        />
      </div>

      {(identityFields.length > 0 || !satellite.masterData) && (
        <Collapsible defaultOpen>
          <div className="px-1">
            <CollapsibleTrigger className="flex justify-between w-full text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              Identity &amp; Operators{' '}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-2 text-sm">
              {identityFields.length > 0 ? (
                identityFields.map(([k, v]) => (
                  <FieldRow key={k} label={k} value={v} />
                ))
              ) : (
                <div className="animate-pulse space-y-4">
                  <div className="h-3 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-full" />
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {orbitalFields.length > 0 && (
        <Collapsible defaultOpen>
          <div className="px-1">
            <CollapsibleTrigger className="flex justify-between w-full text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              Orbital Parameters{' '}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-2 text-sm">
              {orbitalFields.map(([k, v]) => (
                <FieldRow key={k} label={k} value={v} />
              ))}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {spacecraftFields.length > 0 && (
        <Collapsible defaultOpen>
          <div className="px-1">
            <CollapsibleTrigger className="flex justify-between w-full text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              Spacecraft{' '}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-2 text-sm">
              {spacecraftFields.map(([k, v]) => (
                <FieldRow key={k} label={k} value={v} />
              ))}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {externalLinks.length > 0 && (
        <Collapsible>
          <div className="px-1">
            <CollapsibleTrigger className="flex justify-between w-full text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              External Links{' '}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-2 text-sm">
              {externalLinks.map(([k, v]) => (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sky-400 hover:underline"
                >
                  {k}
                  <span className="text-[10px] opacity-60">↗</span>
                </a>
              ))}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

    </div>
  );
}

export const SatelliteDetailViewSkeleton = () => (
  <div className="w-full space-y-6 p-4 animate-pulse">
    <div className="h-8 bg-zinc-200 rounded w-1/3" />
    <div className="h-4 bg-zinc-200 rounded w-2/3" />
    <div className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 bg-zinc-200 rounded" />
      ))}
    </div>
  </div>
);

export const MOCK_SATELLITE: Satellite = {
  noradId: '25544',
  name: 'International Space Station',
  description:
    'The International Space Station (ISS) is a modular space station in low Earth orbit. It is a multinational collaborative project involving five participating space agencies: NASA (United States), Roscosmos (Russia), JAXA (Japan), ESA (Europe), and CSA (Canada).',
  ucs: { orbitClass: 'LEO', operator: 'NASA/Roscosmos' },
  oscar: { status: 'Operational', launch_date: '1998-11-20' },
  satnogs: { status: 'alive' },
  gcat: {},
  spacetrack: { APOAPSIS: 420, PERIOD: 92, meanElements: { INCLINATION: 51.6 } },
  gunters: {},
  wiki: {
    intro:
      'The International Space Station is the largest modular space station currently in low Earth orbit.',
  },
};
