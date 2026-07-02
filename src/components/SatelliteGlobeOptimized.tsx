import React, { useRef, useEffect, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PositionBufferRef, AppSatellite } from '../AppOptimized';

export interface GroundTrackData {
  segments: Float32Array[];
  minSpeed: number;
  maxSpeed: number;
}

interface SatelliteGlobeOptimizedProps {
  count: number;
  workerRef: React.RefObject<Worker | null>;
  satellites: AppSatellite[];
  onSelectSatellite: (satellite: AppSatellite) => void;
  focusedIndex: number;
  groundTrack: GroundTrackData | null;
  showStarlink: boolean;
  onPositionUpdate?: (pos: { lat: number; lng: number; alt: number; velocity: number }) => void;
  onReady?: () => void;
  onSatellitesRendered?: () => void;
  positionBufferRef?: React.RefObject<PositionBufferRef>;
  visibleNoradIds?: Set<number> | null;
  isMobile?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────────────────────────────────────

const SPHERE_VERTEX_SHADER = `
  attribute float aLat;
  attribute float aLng;
  attribute float aAlt;
  attribute float aVisible;
  attribute vec3 aColor;
  uniform float globeRadius;
  varying vec3 vColor;

  vec3 latLngAltToWorld(float lat, float lng, float alt) {
    float phi   = (90.0 - lat) * 3.141592653589793 / 180.0;
    float theta = lng           * 3.141592653589793 / 180.0;
    float r     = globeRadius + (alt / 6371.0) * 100.0;
    return vec3(
      r * sin(phi) * sin(theta),
      r * cos(phi),
      r * sin(phi) * cos(theta)
    );
  }

  void main() {
    vColor = aColor;
    float scale = aVisible > 0.5 ? 1.0 : 0.0;
    
    // Scale based on orbit regime (altitude in km)
    float sizeMultiplier = 1.0;
    if (aAlt > 60000.0) {
        sizeMultiplier = 10.0; // Deep HEO
    } else if (aAlt > 35786.0) {
        sizeMultiplier = 6.0; // HEO
    } else if (aAlt > 35000.0) {
        sizeMultiplier = 2.0; // GEO
    } else if (aAlt > 2000.0) {
        sizeMultiplier = 1.5; // MEO
    }
    
    vec3 satPos = latLngAltToWorld(aLat, aLng, aAlt);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * scale * sizeMultiplier + satPos, 1.0);
  }
`;

const SPHERE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

const PICKING_VERTEX_SHADER = `
  attribute float aLat;
  attribute float aLng;
  attribute float aAlt;
  attribute float aInstanceID;
  attribute float aVisible;
  uniform float globeRadius;
  varying vec3 vPickingColor;

  vec3 latLngAltToWorld(float lat, float lng, float alt) {
    float phi   = (90.0 - lat) * 3.141592653589793 / 180.0;
    float theta = lng           * 3.141592653589793 / 180.0;
    float r     = globeRadius + (alt / 6371.0) * 100.0;
    return vec3(
      r * sin(phi) * sin(theta),
      r * cos(phi),
      r * sin(phi) * cos(theta)
    );
  }

  void main() {
    if (aVisible < 0.5) {
      gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    // Scale based on orbit regime (altitude in km)
    float sizeMultiplier = 1.0;
    if (aAlt > 60000.0) {
        sizeMultiplier = 30.0; // Deep HEO
    } else if (aAlt > 35786.0) {
        sizeMultiplier = 8.0; // HEO
    } else if (aAlt > 35000.0) {
        sizeMultiplier = 4.0; // GEO
    } else if (aAlt > 2000.0) {
        sizeMultiplier = 2.0; // MEO
    }

    vec3 satPos = latLngAltToWorld(aLat, aLng, aAlt);
    float id    = aInstanceID;
    float r     = floor(id / 65536.0) / 255.0;
    float g     = floor(mod(id, 65536.0) / 256.0) / 255.0;
    float b     = mod(id, 256.0) / 255.0;
    vPickingColor = vec3(r, g, b);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * sizeMultiplier + satPos, 1.0);
  }
`;

const PICKING_FRAGMENT_SHADER = `
  varying vec3 vPickingColor;
  void main() {
    gl_FragColor = vec4(vPickingColor, 1.0);
  }
`;

const LINE_VERTEX_SHADER = `
  attribute float aLat;
  attribute float aLng;
  attribute float aAlt;
  attribute float aVisible;
  attribute float aVertexIndex;
  uniform float globeRadius;

  vec3 latLngAltToWorld(float lat, float lng, float alt) {
    float phi   = (90.0 - lat) * 3.141592653589793 / 180.0;
    float theta = lng           * 3.141592653589793 / 180.0;
    float r     = globeRadius + (alt / 6371.0) * 100.0;
    return vec3(
      r * sin(phi) * sin(theta),
      r * cos(phi),
      r * sin(phi) * cos(theta)
    );
  }

  void main() {
    float scale = aVisible > 0.5 ? 1.0 : 0.0;
    vec3 satPos = latLngAltToWorld(aLat, aLng, aAlt);
    float phi   = (90.0 - aLat) * 3.141592653589793 / 180.0;
    float theta = aLng           * 3.141592653589793 / 180.0;
    vec3 surfacePos = vec3(
      globeRadius * sin(phi) * sin(theta),
      globeRadius * cos(phi),
      globeRadius * sin(phi) * cos(theta)
    );
    vec3 pos = (aVertexIndex < 0.5) ? satPos : surfacePos;

    if (aVisible < 0.5) {
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  }
`;

const LINE_FRAGMENT_SHADER = `
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 0.13);
  }
`;

const TRACK_VERTEX_SHADER = `
  attribute float aProgress;
  attribute float aTotalDist;
  varying vec3  vColor;
  varying float vProgress;
  varying float vTotalDist;
  attribute vec3 color;

  void main() {
    vColor    = color;
    vProgress = aProgress;
    vTotalDist = aTotalDist;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRACK_FRAGMENT_SHADER = `
  varying vec3  vColor;
  varying float vProgress;
  varying float vTotalDist;
  uniform float uTime;

  const float GAP_LENGTH = 25.0;
  const float EDGE_SOFT  = .001;

  void main() {
    float distAlongLine = vProgress * vTotalDist;
    float head = mod(uTime * 50.0, vTotalDist);
    float distBehindHead = mod(head - distAlongLine + vTotalDist, vTotalDist);

    float alpha = 1.0;
    if (distBehindHead < GAP_LENGTH) {
      float edge = GAP_LENGTH * EDGE_SOFT;
      if (distBehindHead < edge) {
        alpha = distBehindHead / edge;
      } else if (distBehindHead > GAP_LENGTH - edge) {
        alpha = (GAP_LENGTH - distBehindHead) / edge;
      } else {
        alpha = 0.0;
      }
    }

    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_TICK_MS = 100;
const CAMERA_LERP = 0.05;
const AUTOPILOT_RESUME_DELAY_MS = 10_000;
const MAX_TRACK_SEGMENTS = 8;
const TRACK_MAX_POINTS = 512;
const TRACK_SURFACE_OFFSET_KM = 20;
const POSITION_UPDATE_INTERVAL_MS = 10000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function latLngAltToWorld(
  lat: number,
  lng: number,
  alt: number,
  globeRadius = 100,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lng * (Math.PI / 180);
  const r = globeRadius + (alt / 6371) * 100;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.cos(theta),
  );
}

function allocateTrackPool(count: number): { lines: THREE.Line[]; timeUniform: { value: number } } {
  const lines: THREE.Line[] = [];
  const timeUniform = { value: 0 };

  for (let i = 0; i < count; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRACK_MAX_POINTS * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(TRACK_MAX_POINTS * 3), 3));
    geo.setAttribute('aProgress', new THREE.Float32BufferAttribute(new Float32Array(TRACK_MAX_POINTS), 1));
    geo.setAttribute('aTotalDist', new THREE.Float32BufferAttribute(new Float32Array(TRACK_MAX_POINTS), 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      vertexShader: TRACK_VERTEX_SHADER,
      fragmentShader: TRACK_FRAGMENT_SHADER,
      uniforms: { uTime: timeUniform },
      transparent: true,
      depthWrite: false,
      linewidth: 2.0,
    });
    lines.push(new THREE.Line(geo, mat));
  }
  return { lines, timeUniform };
}

const SR = 0x0e / 255, SG = 0xa5 / 255, SB = 0xe9 / 255;
const FR = SR, FG = SG, FB = SB;

function fillTrackLine(
  line: THREE.Line,
  segData: Float32Array,
  speedMin: number,
  speedMax: number,
  globeRadius = 100,
): void {
  const STRIDE = 4;
  const rawPoints = segData.length / STRIDE;
  const stride = rawPoints > TRACK_MAX_POINTS ? Math.ceil(rawPoints / TRACK_MAX_POINTS) : 1;
  const n = Math.min(Math.ceil(rawPoints / stride), TRACK_MAX_POINTS);

  if (n < 2) {
    line.geometry.setDrawRange(0, 0);
    return;
  }

  const posArr = line.geometry.attributes.position.array as Float32Array;
  const colArr = line.geometry.attributes.color.array as Float32Array;
  const progArr = line.geometry.attributes.aProgress.array as Float32Array;
  const totalDistArr = line.geometry.attributes.aTotalDist.array as Float32Array;
  const span = speedMax - speedMin || 1;

  let totalDist = 0;
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < n; i++) {
    const base = i * stride * STRIDE;
    const lat = segData[base];
    const lng = segData[base + 1];
    const alt = segData[base + 2];
    const speed = segData[base + 3];

    const phi = (90 - lat) * (Math.PI / 180);
    const theta = lng * (Math.PI / 180);
    const r = globeRadius + ((alt + TRACK_SURFACE_OFFSET_KM) / 6371) * 100;

    const x = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.cos(theta);

    posArr[i * 3] = x;
    posArr[i * 3 + 1] = y;
    posArr[i * 3 + 2] = z;

    if (i > 0) {
      const prev = points[i - 1];
      totalDist += Math.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2 + (z - prev.z) ** 2);
    }
    points.push(new THREE.Vector3(x, y, z));

    const t = Math.max(0, Math.min(1, (speed - speedMin) / span));
    colArr[i * 3] = SR + (FR - SR) * t;
    colArr[i * 3 + 1] = SG + (FG - SG) * t;
    colArr[i * 3 + 2] = SB + (FB - SB) * t;
  }

  let accumulatedDist = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const curr = points[i];
      const prev = points[i - 1];
      accumulatedDist += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2 + (curr.z - prev.z) ** 2);
    }
    progArr[i] = totalDist > 0 ? accumulatedDist / totalDist : 0;
    totalDistArr[i] = totalDist;
  }

  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.attributes.color.needsUpdate = true;
  line.geometry.attributes.aProgress.needsUpdate = true;
  line.geometry.attributes.aTotalDist.needsUpdate = true;
  line.geometry.setDrawRange(0, n);
  line.geometry.computeBoundingSphere();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const SatelliteGlobeOptimized: React.FC<SatelliteGlobeOptimizedProps> = React.memo(({
  count,
  workerRef,
  satellites,
  onSelectSatellite,
  focusedIndex,
  groundTrack,
  showStarlink,
  onPositionUpdate,
  onReady,
  onSatellitesRendered,
  positionBufferRef,
  visibleNoradIds,
  isMobile = false,
}) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sphereMeshRef = useRef<THREE.Mesh | null>(null);
  const lineSegmentsRef = useRef<THREE.LineSegments | null>(null);
  const pickingTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [globeDims, setGlobeDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  const trackPoolRef = useRef<THREE.Line[]>([]);
  const trackTimeRef = useRef<{ value: number }>({ value: 0 });

  const latestLats = useRef<Float32Array | null>(null);
  const latestLngs = useRef<Float32Array | null>(null);
  const latestAlts = useRef<Float32Array | null>(null);
  const latestVelocities = useRef<Float32Array | null>(null);

  const focusedIndexRef = useRef(focusedIndex);
  const autopilotRef = useRef(false);
  const lastInteractionRef = useRef<number>(0);
  const prevFocusedIndexRef = useRef(-1);

  const onPositionUpdateRef = useRef(onPositionUpdate);
  useEffect(() => { onPositionUpdateRef.current = onPositionUpdate; }, [onPositionUpdate]);

  // Update Three.js renderer size and picking target when the container resizes.
  // react-globe.gl sizes its canvas from the `width`/`height` props — it does
  // not use a ResizeObserver internally — so we must drive the update explicitly.
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      setGlobeDims({ w, h });
      // Recreate the picking render target at the new resolution so click/hover
      // hit-testing stays accurate after a device rotation.
      if (pickingTargetRef.current) {
        pickingTargetRef.current.dispose();
        pickingTargetRef.current = new THREE.WebGLRenderTarget(w, h);
      }
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const lastPositionUpdateRef = useRef(0);

  // ── Sync visibility state ────────────────────────────────────────────────
  useEffect(() => {
    if (!sphereMeshRef.current || !lineSegmentsRef.current || satellites.length === 0) return;

    const sVis = sphereMeshRef.current.geometry.attributes.aVisible as THREE.InstancedBufferAttribute;
    const lVis = lineSegmentsRef.current.geometry.attributes.aVisible as THREE.InstancedBufferAttribute;
    const n = satellites.length;

    if (sVis.count !== n) return;

    const visArr = sVis.array as Float32Array;

    if (focusedIndex >= 0) {
      visArr.fill(0);
      visArr[focusedIndex] = 1;
    } else {
      for (let i = 0; i < n; i++) {
        if (visibleNoradIds) {
          visArr[i] = visibleNoradIds.has(satellites[i].noradId) ? 1 : 0;
        } else {
          const isStarlink = satellites[i].name.toUpperCase().startsWith('STARLINK');
          visArr[i] = (showStarlink || !isStarlink) ? 1 : 0;
        }
      }
    }

    sVis.needsUpdate = true;
    (lVis.array as Float32Array).set(visArr);
    lVis.needsUpdate = true;
  }, [showStarlink, focusedIndex, satellites, visibleNoradIds]);

  // ── Sync focusedIndex + autopilot ────────────────────────────────────────
  useEffect(() => {
    const wasUnfocused = prevFocusedIndexRef.current === -1;
    const isNowFocused = focusedIndex >= 0;

    if (isNowFocused && (wasUnfocused || focusedIndex !== prevFocusedIndexRef.current)) {
      autopilotRef.current = true;
      lastInteractionRef.current = 0;
      lastPositionUpdateRef.current = -1;
    }
    if (!isNowFocused) {
      autopilotRef.current = false;
    }

    focusedIndexRef.current = focusedIndex;
    prevFocusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // ── Ground track: fill pool ──────────────────────────────────────────────
  useEffect(() => {
    const pool = trackPoolRef.current;
    if (pool.length === 0) return;

    for (const line of pool) line.geometry.setDrawRange(0, 0);

    if (!groundTrack || groundTrack.segments.length === 0) return;

    const { segments, minSpeed, maxSpeed } = groundTrack;
    for (let i = 0; i < Math.min(segments.length, pool.length); i++) {
      fillTrackLine(pool[i], segments[i], minSpeed, maxSpeed);
    }
  }, [groundTrack]);

  // ── Main setup effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current || count === 0 || !workerRef.current) return;

    const renderer = globeRef.current.renderer() as THREE.WebGLRenderer;
    const scene = globeRef.current.scene() as THREE.Scene;
    const camera = globeRef.current.camera() as THREE.PerspectiveCamera;
    const controls = globeRef.current.controls?.() as OrbitControls;

    camera.position.z = isMobile ? 600 : 400;
    controls.maxDistance = 20000;

    const n = count;
    sceneRef.current = scene;
    onReady?.();
    pickingTargetRef.current = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

    const { lines: pool, timeUniform } = allocateTrackPool(MAX_TRACK_SEGMENTS);
    for (const line of pool) scene.add(line);
    trackPoolRef.current = pool;
    trackTimeRef.current = timeUniform;

    const mkAttr = () => new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    const mkVisAttr = () => {
      const arr = new Float32Array(n).fill(1);
      for (let i = 0; i < n; i++) {
        const isStarlink = satellites[i]?.name?.toUpperCase().startsWith('STARLINK');
        if (!showStarlink && isStarlink) arr[i] = 0;
      }
      return new THREE.InstancedBufferAttribute(arr, 1);
    };

    // ── Helper: Map Object Type to Color ──────────────────────────────────
    const getSatColor = (type: string | null | undefined): [number, number, number] => {
      switch (type) {
        case 'PAYLOAD': return [0x0e / 255, 0xa5 / 255, 0xe9 / 255];      // #0EA5E9
        case 'ROCKET BODY': return [0xf9 / 255, 0x73 / 255, 0x16 / 255];  // #F97316
        case 'DEBRIS': return [0x94 / 255, 0xa3 / 255, 0xb8 / 255];       // #94A3B8
        default: return [0xa8 / 255, 0xa2 / 255, 0x9e / 255];             // #A8A29E
      }
    };

    // ── Sphere geometry ───────────────────────────────────────────────────
    const baseGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const sphereGeo = new THREE.InstancedBufferGeometry();
    sphereGeo.copy(baseGeo as unknown as THREE.InstancedBufferGeometry);
    sphereGeo.instanceCount = n;
    sphereGeo.setAttribute('aLat', mkAttr());
    sphereGeo.setAttribute('aLng', mkAttr());
    sphereGeo.setAttribute('aAlt', mkAttr());
    sphereGeo.setAttribute('aVisible', mkVisAttr());
    
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    for (let i = 0; i < n; i++) {
        const color = getSatColor(satellites[i]?.objectType);
        colorAttr.setXYZ(i, color[0], color[1], color[2]);
    }
    sphereGeo.setAttribute('aColor', colorAttr);

    const ids = new Float32Array(n).map((_, i) => i + 1);
    sphereGeo.setAttribute('aInstanceID', new THREE.InstancedBufferAttribute(ids, 1));

    const sphereMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERTEX_SHADER,
      fragmentShader: SPHERE_FRAGMENT_SHADER,
      uniforms: { globeRadius: { value: 100.0 } },
    });

    const spheres = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(spheres);
    sphereMeshRef.current = spheres;

    // ── Nadir-line geometry ───────────────────────────────────────────────
    const nadirGeo = new THREE.InstancedBufferGeometry();
    nadirGeo.instanceCount = n;
    nadirGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3));
    nadirGeo.setAttribute('aLat', mkAttr());
    nadirGeo.setAttribute('aLng', mkAttr());
    nadirGeo.setAttribute('aAlt', mkAttr());
    nadirGeo.setAttribute('aVisible', mkVisAttr());
    nadirGeo.setAttribute('aVertexIndex', new THREE.BufferAttribute(new Float32Array([0, 1]), 1));

    const nadirMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: { globeRadius: { value: 100.0 } },
      transparent: true,
    });

    const nadirLines = new THREE.LineSegments(nadirGeo, nadirMat);
    scene.add(nadirLines);
    lineSegmentsRef.current = nadirLines;

    let hasRendered = false;
    const isWorkerBusy = { current: false };

    const onMessage = (e: MessageEvent) => {
      const { type, lats, lngs, alts, velocities } = e.data;
      if (type !== 'POSITIONS_UPDATED') return;

      isWorkerBusy.current = false;

      latestLats.current = lats as Float32Array;
      latestLngs.current = lngs as Float32Array;
      latestAlts.current = alts as Float32Array;
      latestVelocities.current = velocities as Float32Array;

      if (positionBufferRef?.current) {
        positionBufferRef.current.lats = lats;
        positionBufferRef.current.lngs = lngs;
        positionBufferRef.current.alts = alts;
        positionBufferRef.current.velocities = velocities;
      }
      
      if (onSatellitesRendered && !hasRendered) {
        hasRendered = true;
        onSatellitesRendered();
      }
    };
    workerRef.current?.addEventListener('message', onMessage);

    // ── Position request loop ─────────────────────────────────────────────
    const tickInterval = setInterval(() => {
      if (isWorkerBusy.current) return;
      isWorkerBusy.current = true;
      workerRef.current?.postMessage({ type: 'GET_POSITIONS', data: { time: Date.now() } });
    }, POSITION_TICK_MS);

    isWorkerBusy.current = true;
    workerRef.current?.postMessage({ type: 'GET_POSITIONS', data: { time: Date.now() } });

    // ── Interaction → interrupt autopilot ─────────────────────────────────
    const onUserInteraction = () => {
      if (focusedIndexRef.current >= 0) {
        autopilotRef.current = false;
        lastInteractionRef.current = Date.now();
      }
    };
    renderer.domElement.addEventListener('mousedown', onUserInteraction, { passive: true });
    renderer.domElement.addEventListener('wheel', onUserInteraction, { passive: true });
    renderer.domElement.addEventListener('touchstart', onUserInteraction, { passive: true });

    const trackStartTime = performance.now();

    // ── rAF loop ──────────────────────────────────────────────────────────
    let rafId: number;
    const animate = () => {
      const lats = latestLats.current;
      const lngs = latestLngs.current;
      const alts = latestAlts.current;
      const focused = focusedIndexRef.current;
      const now = Date.now();
      const perfNow = performance.now();

      trackTimeRef.current.value = (perfNow - trackStartTime) / 1000;

      if (
        focused >= 0 &&
        !autopilotRef.current &&
        lastInteractionRef.current > 0 &&
        now - lastInteractionRef.current >= AUTOPILOT_RESUME_DELAY_MS
      ) {
        autopilotRef.current = true;
        lastInteractionRef.current = 0;
      }

      if (lats && lngs && alts && sphereMeshRef.current && lineSegmentsRef.current) {
        const sLat = sphereMeshRef.current.geometry.attributes.aLat as THREE.InstancedBufferAttribute;
        const sLng = sphereMeshRef.current.geometry.attributes.aLng as THREE.InstancedBufferAttribute;
        const sAlt = sphereMeshRef.current.geometry.attributes.aAlt as THREE.InstancedBufferAttribute;
        const lLat = lineSegmentsRef.current.geometry.attributes.aLat as THREE.InstancedBufferAttribute;
        const lLng = lineSegmentsRef.current.geometry.attributes.aLng as THREE.InstancedBufferAttribute;
        const lAlt = lineSegmentsRef.current.geometry.attributes.aAlt as THREE.InstancedBufferAttribute;

        if (lats.length !== sLat.count) {
          return;
        }

        (sLat.array as Float32Array).set(lats);
        (sLng.array as Float32Array).set(lngs);
        (sAlt.array as Float32Array).set(alts);
        (lLat.array as Float32Array).set(lats);
        (lLng.array as Float32Array).set(lngs);
        (lAlt.array as Float32Array).set(alts);
        sLat.needsUpdate = true; sLng.needsUpdate = true; sAlt.needsUpdate = true;
        lLat.needsUpdate = true; lLng.needsUpdate = true; lAlt.needsUpdate = true;

        // ── Throttled live position readout → detail panel ────────────────
        if (focused >= 0 && onPositionUpdateRef.current) {
          if (lastPositionUpdateRef.current === -1 || perfNow - lastPositionUpdateRef.current >= POSITION_UPDATE_INTERVAL_MS) {
            lastPositionUpdateRef.current = perfNow;
            onPositionUpdateRef.current({
              lat: lats[focused],
              lng: lngs[focused],
              alt: alts[focused],
              velocity: latestVelocities.current ? latestVelocities.current[focused] : 0,
            });
          }
        }

        if (autopilotRef.current && focused >= 0 && controls) {
          const lat = lats[focused];
          const lng = lngs[focused];
          const alt = alts[focused];

          const satWorld = latLngAltToWorld(lat, lng, alt);

          const dir = satWorld.clone().normalize();
          const buffer = isMobile ? 400 : 150;
          const dist = satWorld.length() + buffer;
          const desiredCamPos = dir.multiplyScalar(dist);

          controls.target.lerp(satWorld, CAMERA_LERP);
          camera.position.lerp(desiredCamPos, CAMERA_LERP);
          controls.update();
        }
      }

      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    // ── GPU picking ───────────────────────────────────────────────────────
    const getPickedId = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = rect.height - (event.clientY - rect.top);

      const pickingMat = new THREE.ShaderMaterial({
        vertexShader: PICKING_VERTEX_SHADER,
        fragmentShader: PICKING_FRAGMENT_SHADER,
        uniforms: { globeRadius: { value: 100.0 } },
      });
      
      const pickingGeo = new THREE.InstancedBufferGeometry();
      pickingGeo.copy(sphereGeo);
      
      const pickingScene = new THREE.Scene();
      pickingScene.add(new THREE.Mesh(pickingGeo, pickingMat));

      renderer.setRenderTarget(pickingTargetRef.current);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(pickingScene, camera);

      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(pickingTargetRef.current!, x, y, 1, 1, pixel);
      renderer.setRenderTarget(null);
      pickingMat.dispose();

      return (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    };

    const handleClick = (event: MouseEvent) => {
      if (focusedIndexRef.current !== -1) return;
      const id = getPickedId(event);
      if (id > 0 && satellites?.[id - 1]) {
        const sat = { ...satellites[id - 1] };
        if (latestVelocities.current) sat.velocity = latestVelocities.current[id - 1];
        if (latestAlts.current) sat.alt = latestAlts.current[id - 1];
        if (latestLats.current) sat.lat = latestLats.current[id - 1];
        if (latestLngs.current) sat.lng = latestLngs.current[id - 1];
        onSelectSatellite(sat);
      }
    };

    let lastMouseMove = 0;
    const handleMouseMove = (event: MouseEvent) => {
      if (focusedIndexRef.current !== -1) {
        renderer.domElement.style.cursor = 'default';
        return;
      }
      const now = Date.now();
      if (now - lastMouseMove < 30) return;
      lastMouseMove = now;
      const id = getPickedId(event);
      renderer.domElement.style.cursor = id > 0 ? 'pointer' : 'default';
    };

    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    return () => {
      workerRef.current?.removeEventListener('message', onMessage);
      clearInterval(tickInterval);
      cancelAnimationFrame(rafId);

      for (const line of trackPoolRef.current) {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      trackPoolRef.current = [];
      sceneRef.current = null;

      scene.remove(spheres);
      scene.remove(nadirLines);
      baseGeo.dispose();
      sphereGeo.dispose();
      nadirGeo.dispose();
      sphereMat.dispose();
      nadirMat.dispose();
      pickingTargetRef.current?.dispose();

      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mousedown', onUserInteraction);
      renderer.domElement.removeEventListener('wheel', onUserInteraction);
      renderer.domElement.removeEventListener('touchstart', onUserInteraction);
    };
  }, [count]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Globe
        ref={globeRef}
        width={globeDims.w}
        height={globeDims.h}
        globeImageUrl="/assets/8k_earth_nightmap.jpg"
        backgroundImageUrl="/assets/8k_stars_milky_way.jpg"
      />
    </div>
  );
});
