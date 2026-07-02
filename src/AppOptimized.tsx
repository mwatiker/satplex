import { useIsMobile } from './hooks/useIsMobile';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSatelliteData, fetchSatelliteDetail, type MergedSatellite } from './services/satelliteData';
import { SatelliteGlobeOptimized, type GroundTrackData } from './components/SatelliteGlobeOptimized';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { initGeocoding, getLocalLocation } from './utils/geocoding';
import { InfoPage } from './components/InfoPage';
import { SatelliteList } from './components/SatelliteList';
import { Sidebar } from './components/Sidebar';
import { FilterSheet } from './components/FilterSheet';
import { BottomSheet } from './components/BottomSheet';
import { useSatelliteFilters } from './hooks/useSatelliteFilters';
import SatelliteDetailView, { SatelliteDetailHeader, SatelliteDetailBody } from './components/SatelliteDetailView';
import { Helmet } from 'react-helmet-async'

export type TrackDuration = '1orbit' | '6h' | '12h';

export interface GroundTrackPoint {
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

export interface PositionBufferRef {
  lats: Float32Array | null;
  lngs: Float32Array | null;
  alts: Float32Array | null;
  velocities: Float32Array | null;
}

export type AppSatellite = MergedSatellite & {
  lat?: number;
  lng?: number;
  alt?: number;
  velocity?: number;
};

function AppOptimized() {
  const isMobile = useIsMobile();
  const { noradId } = useParams();
  const navigate = useNavigate();
  const [globeReady, setGlobeReady] = useState(false);
  const [satellitesRendered, setSatellitesRendered] = useState(false);

  const [satellites, setSatellites] = useState<AppSatellite[]>([]);
  const [visibleNoradIds, setVisibleNoradIds] = useState<Set<number> | null>(null);
  const [showStarlink, setShowStarlink] = useState(true);

  // Clear filters if switching to mobile
  useEffect(() => {
    if (isMobile) setVisibleNoradIds(null);
  }, [isMobile]);

  const filters = useSatelliteFilters(
    satellites,
    showStarlink,
    setShowStarlink,
    setVisibleNoradIds,
  );

  useEffect(() => {
    console.log('DEBUG: URL Sync Effect', { noradId, satCount: satellites.length, globeReady });
    if (noradId && satellites.length > 0 && globeReady) {
      const sat = satellites.find((s) => String(s.noradId) === String(noradId));
      if (sat) {
        handleSelectSatellite(sat, satellites);
      } else {
        console.warn('DEBUG: Satellite not found in catalog');
      }
    }
  }, [noradId, satellites, globeReady]);

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
  }, []);

  const handleSatellitesRendered = useCallback(() => {
    setSatellitesRendered(true);
  }, []);

  const [selectedSat, setSelectedSat] = useState<AppSatellite | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [catalogSheetOpen, setCatalogSheetOpen] = useState(false);
  const loadingScreenRequired = loading || !globeReady || !satellitesRendered;
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);

  const [selectedPosition, setSelectedPosition] = useState<{
    lat: number;
    lng: number;
    alt: number;
    velocity: number;
  } | null>(null);

  const [globeTrack, setGlobeTrack] = useState<GroundTrackData | null>(null);
  const [detailTrack, setDetailTrack] = useState<GroundTrackPoint[][]>([]);
  const [speedRange, setSpeedRange] = useState({ min: 0, max: 0 });
  const [trackDuration, setTrackDuration] = useState<TrackDuration>('1orbit');

  const workerRef = useRef<Worker | null>(null);
  const trackWorkerRef = useRef<Worker | null>(null);

  const pendingTrackNoradId = useRef<string | number | null>(null);
  const lastTrackRequestId = useRef<number>(0);

  const positionBufferRef = useRef<PositionBufferRef>({
    lats: null,
    lngs: null,
    alts: null,
    velocities: null,
  });

  const metrics = useMemo(() => {
    const filtered = showStarlink
      ? satellites
      : satellites.filter(s => !s.name.toUpperCase().startsWith('STARLINK'));
    return {
      total: filtered.length,
      withTelemetry: filtered.filter(s => s.hasTelemetry).length,
    };
  }, [satellites, showStarlink]);

  useEffect(() => {
    if (loadingScreenRequired) {
      setShowLoadingOverlay(true);
      return;
    }

    const timer = window.setTimeout(() => setShowLoadingOverlay(false), 1000);
    return () => window.clearTimeout(timer);
  }, [loadingScreenRequired]);

  useEffect(() => {
    const globeWorker = new Worker(
      new URL('./workers/satellite.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = globeWorker;

    const trackWorker = new Worker(
      new URL('./workers/track.worker.ts', import.meta.url),
      { type: 'module' },
    );
    trackWorkerRef.current = trackWorker;

    trackWorker.onmessage = (e) => {
      const { type, requestId } = e.data;

      if (type === 'GROUND_TRACK_CALCULATED') {
        const { noradId, segments, minSpeed, maxSpeed } = e.data;

        if (requestId < lastTrackRequestId.current) return;
        if (String(noradId) !== String(pendingTrackNoradId.current)) return;

        if (segments && segments.length > 0) {
          setGlobeTrack({ segments, minSpeed, maxSpeed });

          const STRIDE = 4;
          const legacy: GroundTrackPoint[][] = segments.map((seg: Float32Array) => {
            const pts: GroundTrackPoint[] = [];
            for (let i = 0; i < seg.length; i += STRIDE) {
              pts.push({ lat: seg[i], lng: seg[i + 1], alt: seg[i + 2], speed: seg[i + 3] });
            }
            return pts;
          });
          setDetailTrack(legacy);
        } else {
          setGlobeTrack(null);
          setDetailTrack([]);
        }

        setSpeedRange({ min: minSpeed, max: maxSpeed });
      } else if (type === 'GROUND_TRACK_FAILED') {
        const { noradId } = e.data;
        if (String(noradId) === String(pendingTrackNoradId.current)) {
          setGlobeTrack(null);
          setDetailTrack([]);
        }
      }
    };

    return () => {
      globeWorker.terminate();
      trackWorker.terminate();
    };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await fetchSatelliteData();
        console.log('[App] Fetched satellite data:', { count: data.satellites.length, hasBuffer: !!data.orbitalBuffer });
        if (data.orbitalBuffer) {
          console.log('[App] Sending INIT_SATELLITES to workers...');
          const buffer1 = data.orbitalBuffer;
          const buffer2 = new Float32Array(buffer1.length);
          buffer2.set(buffer1);

          workerRef.current?.postMessage(
            { type: 'INIT_SATELLITES', data: { orbitalBuffer: buffer1 } },
            [buffer1.buffer],
          );
          trackWorkerRef.current?.postMessage(
            { type: 'INIT_SATELLITES', data: { orbitalBuffer: buffer2 } },
            [buffer2.buffer],
          );
        }
        setSatellites(data.satellites);
        await initGeocoding();
      } catch {
        setError('Failed to synchronize satellite catalog.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedSat) {
      pendingTrackNoradId.current = null;
      setGlobeTrack(null);
      setDetailTrack([]);
      return;
    }

    const durationMins =
      trackDuration === '1orbit' ? 180 :
        trackDuration === '6h' ? 360 : 720;

    setGlobeTrack(null);
    setDetailTrack([]);

    const requestId = Date.now();
    pendingTrackNoradId.current = selectedSat.noradId;
    lastTrackRequestId.current = requestId;

    trackWorkerRef.current?.postMessage({
      type: 'CALCULATE_GROUND_TRACK',
      requestId,
      data: {
        noradId: selectedSat.noradId,
        durationMins,
        startTime: Date.now()
      },
    });
  }, [selectedSat?.noradId, trackDuration]);

  useEffect(() => {
    if (!selectedSat) return;

    const interval = setInterval(() => {
      const durationMins =
        trackDuration === '1orbit' ? 180 :
          trackDuration === '6h' ? 360 : 720;

      const requestId = Date.now();
      lastTrackRequestId.current = requestId;

      trackWorkerRef.current?.postMessage({
        type: 'CALCULATE_GROUND_TRACK',
        requestId,
        data: {
          noradId: selectedSat.noradId,
          durationMins,
          startTime: Date.now()
        },
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedSat?.noradId, trackDuration]);

  const handleSelectSatellite = useCallback(async (sat: AppSatellite, satList: AppSatellite[]) => {
    navigate(`/satellite/${sat.noradId}`);
    setSelectedSat(sat);
    const idx = satList.findIndex(
      (s) => String(s.noradId) === String(sat.noradId),
    );
    setFocusedIndex(idx);

    const buf = positionBufferRef.current;
    if (buf.lats && idx >= 0 && idx < buf.lats.length) {
      setSelectedPosition({
        lat: buf.lats[idx],
        lng: buf.lngs![idx],
        alt: buf.alts![idx],
        velocity: buf.velocities?.[idx] ?? 0,
      });
    } else if (sat.lat !== undefined && sat.lng !== undefined) {
      setSelectedPosition({
        lat: sat.lat,
        lng: sat.lng,
        alt: sat.alt ?? 0,
        velocity: sat.velocity ?? 0,
      });
    } else {
      setSelectedPosition(null);
    }

    try {
      const detail = await fetchSatelliteDetail(sat.noradId);
      setSelectedSat((prev) => {
        if (prev && String(prev.noradId) === String(sat.noradId)) {
          return {
            ...prev,
            masterData: detail.masterData,
            description: detail.description ?? undefined,
          };
        }
        return prev;
      });
    } catch {
      console.warn('Failed to load deep details for satellite', sat.noradId);
    }
  }, [navigate]);

  const handleClose = useCallback(() => {
    navigate('/');
    setSelectedSat(null);
    setFocusedIndex(-1);
    setGlobeTrack(null);
    setDetailTrack([]);
    setSelectedPosition(null);
    setShowInfo(false);
    pendingTrackNoradId.current = null;
  }, [navigate]);

  const satelliteWithLivePosition = selectedSat
    ? {
      ...selectedSat,
      lat: selectedPosition?.lat ?? selectedSat.lat,
      lng: selectedPosition?.lng ?? selectedSat.lng,
      alt: selectedPosition?.alt ?? selectedSat.alt,
      velocity: selectedPosition?.velocity ?? selectedSat.velocity,
    }
    : null;

  const satLocationName = useMemo(() => {
    if (!satelliteWithLivePosition) return '';
    if (satelliteWithLivePosition.lat === undefined || satelliteWithLivePosition.lng === undefined) return '';
    return getLocalLocation(satelliteWithLivePosition.lat, satelliteWithLivePosition.lng);
  }, [satelliteWithLivePosition?.lat, satelliteWithLivePosition?.lng]);

  const mobileObjectCount = isMobile
    ? filters.filteredSatellites.length
    : metrics.total;

  // iPad landscape gets narrower panels (60% of standard) to leave more globe visible.
  const isIPadLandscape = !isMobile && (
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const panelWidth = isIPadLandscape ? 240 : 360;

  // Blank overlay shown during device rotation so the user never sees the
  // content animating mid-rotation. Appears instantly, fades out smoothly.
  const [isRotating, setIsRotating] = useState(false);
  const rotatingRef = useRef(false);
  useEffect(() => {
    const onStart = () => { rotatingRef.current = true; setIsRotating(true); };
    const onEnd = () => {
      if (!rotatingRef.current) return;
      rotatingRef.current = false;
      // Small delay so React finishes rendering the new layout before reveal.
      setTimeout(() => setIsRotating(false), 150);
    };
    window.addEventListener('satplexrotationstart', onStart);
    window.addEventListener('satplexrotationend', onEnd);
    return () => {
      window.removeEventListener('satplexrotationstart', onStart);
      window.removeEventListener('satplexrotationend', onEnd);
    };
  }, []);

  return (
    <div className="relative bg-black overflow-hidden" style={{ width: 'var(--app-width, 100vw)', height: 'var(--app-height, 100dvh)' }}>
      {showLoadingOverlay && <GlobalLoadingOverlay />}
      <Helmet>
        {selectedSat ? (
          <>
            <title>{`${selectedSat.name} (NORAD ${selectedSat.noradId}) — Satplex.io`}</title>
            <meta name="description" content={selectedSat.description ?? `Track ${selectedSat.name} in real time. View live orbital position, ground track, and technical specifications.`} />
            <meta property="og:title" content={`${selectedSat.name} (NORAD ${selectedSat.noradId}) — satplex.io`} />
            <meta property="og:description" content={selectedSat.description ?? `Track ${selectedSat.name} in real time.`} />
          </>
        ) : (
          <title>Satplex.io — Real-time Satellite Tracker</title>
        )}
      </Helmet>
      <SatelliteGlobeOptimized
        count={satellites.length}
        satellites={satellites}
        workerRef={workerRef}
        focusedIndex={focusedIndex}
        groundTrack={globeTrack}
        showStarlink={showStarlink}
        onReady={handleGlobeReady}
        onSatellitesRendered={handleSatellitesRendered}
        onSelectSatellite={(sat) => handleSelectSatellite(sat, satellites)}
        onPositionUpdate={setSelectedPosition}
        positionBufferRef={positionBufferRef}
        visibleNoradIds={visibleNoradIds}
        isMobile={isMobile}
      />

      {isMobile && !loading && !error && (
        <div
          className="absolute top-0 left-0 right-0 z-[500] flex items-center justify-center pointer-events-none"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingLeft: '16px', paddingRight: '16px' }}
        >
          <div className="w-full max-w-[420px] flex items-center justify-between">
          <button
            onClick={() => setFilterSheetOpen(true)}
            className="bg-zinc-900/75 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg pointer-events-auto"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6" className="text-zinc-400">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-300">Filters</span>
            {filters.activeFilterCount > 0 && (
              <span style={{ width: 5, height: 5, borderRadius: 999, background: '#38bdf8', flexShrink: 0 }} />
            )}
          </button>

          <button
            onClick={() => setCatalogSheetOpen(true)}
            className="bg-zinc-900/75 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg pointer-events-auto"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6" className="text-zinc-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-300">Catalog</span>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-white/75 text-[13px] font-mono font-light tabular-nums leading-none">
              {mobileObjectCount.toLocaleString()}
            </span>
            <span className="text-zinc-600 text-[9px] font-mono uppercase tracking-widest font-bold leading-none">
              obj
            </span>
          </div>

          <div className="relative pointer-events-auto">
            <button
              onClick={() => setShowMobileMenu((v) => !v)}
              className="bg-zinc-900/75 backdrop-blur-md border border-white/10 rounded-full w-8 h-8 flex items-center justify-center shadow-lg text-zinc-400 hover:text-white transition-colors"
              aria-label="Menu"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="2.5" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13.5" cy="8" r="1.5" />
              </svg>
            </button>

            {showMobileMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMobileMenu(false)}
                />
                <div className="absolute right-0 top-10 z-20 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                  <button
                    onClick={() => { setShowInfo(true); setShowMobileMenu(false); }}
                    className="w-full text-left px-4 py-3 text-zinc-300 hover:text-white hover:bg-white/5 text-sm transition-colors"
                  >
                    About
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
      </div>
      )}

      {isMobile && (
        <SatelliteList
          satellites={filters.filteredSatellites}
          onSelect={(sat) => handleSelectSatellite(sat, satellites)}
          selectedNoradId={selectedSat?.noradId}
          isOpen={catalogSheetOpen}
          onClose={() => setCatalogSheetOpen(false)}
        />
      )}

      {isMobile && (
        <FilterSheet filters={filters} isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} />
      )}

      {isMobile ? (
        <BottomSheet
          isOpen={!!selectedSat || showInfo}
          onClose={handleClose}
          snapPoints={showInfo ? [440] : [145, '78vh']}
          snapIndex={showInfo ? 0 : undefined}
          header={
            satelliteWithLivePosition && (
              <SatelliteDetailHeader
                satellite={satelliteWithLivePosition}
                onClose={handleClose}
              />
            )
          }
        >
          {showInfo ? (
            <InfoPage onClose={() => setShowInfo(false)} />
          ) : satelliteWithLivePosition ? (
            <SatelliteDetailBody
              satellite={satelliteWithLivePosition}
              groundTrack={detailTrack}
              minSpeed={speedRange.min}
              maxSpeed={speedRange.max}
              trackDuration={trackDuration}
              setTrackDuration={setTrackDuration}
              satLocationName={satLocationName}
            />
          ) : null}
        </BottomSheet>
      ) : (
        <>
          <Sidebar
            satellites={satellites}
            filters={filters}
            onSelect={(sat) => handleSelectSatellite(sat, satellites)}
            selectedNoradId={selectedSat?.noradId}
            loading={loading}
            error={error}
            onInfoClick={() => setShowInfo(true)}
            width={panelWidth}
            isNarrow={isIPadLandscape}
          />

          {(satelliteWithLivePosition || showInfo) && (
            <div className="absolute top-0 right-0 h-full z-50 bg-zinc-900/90 border-l border-white/10 shadow-2xl overflow-y-auto overflow-x-hidden" style={{ width: panelWidth }}>
              {showInfo ? (
                <InfoPage onClose={() => setShowInfo(false)} />
              ) : (
                <SatelliteDetailView
                  satellite={satelliteWithLivePosition}
                  onClose={handleClose}
                  groundTrack={detailTrack}
                  minSpeed={speedRange.min}
                  maxSpeed={speedRange.max}
                  trackDuration={trackDuration}
                  setTrackDuration={setTrackDuration}
                  satLocationName={satLocationName}
                  isNarrow={isIPadLandscape}
                />
              )}
            </div>
          )}
        </>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-40 mobile-vignette"
        style={{ boxShadow: isMobile ? 'inset 0 0 40px rgba(0,0,0,0.25)' : 'inset 0 0 150px rgba(0,0,0,0.8)' }}
      />

      {/* Rotation overlay — hides content during device rotation animation */}
      <div
        className="fixed inset-0 bg-black z-[9000] transition-opacity"
        style={{
          opacity: isRotating ? 1 : 0,
          pointerEvents: isRotating ? 'auto' : 'none',
          transitionDuration: isRotating ? '0ms' : '250ms',
        }}
      />
    </div>
  );
}

export default AppOptimized;
