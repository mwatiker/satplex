export interface GeoJSONFeature {
  type: string;
  properties: {
    NAME: string;
    CONTINENT: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
    bbox?: number[];
  };
  bbox?: number[];
}

export interface GeoJSON {
  type: string;
  features: GeoJSONFeature[];
}

let worldData: GeoJSON | null = null;

export async function initGeocoding() {
  if (worldData) return;
  try {
    const resp = await fetch('/world-borders.json');
    worldData = await resp.json();
  } catch (err) {
    console.error('Failed to load world borders for local geocoding', err);
  }
}

function isPointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [lng, lat] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getLocalLocation(lat: number, lng: number): string {
  if (!worldData) return '';

  // Standardize lng to [-180, 180]
  let normalLng = ((lng + 180) % 360);
  if (normalLng < 0) normalLng += 360;
  normalLng -= 180;

  const point: [number, number] = [normalLng, lat];

  for (const feature of worldData.features) {
    // Quick BBOX check if available
    if (feature.bbox) {
      const [minLng, minLat, maxLng, maxLat] = feature.bbox;
      if (normalLng < minLng || normalLng > maxLng || lat < minLat || lat > maxLat) {
        continue;
      }
    }

    const { type, coordinates } = feature.geometry;
    
    if (type === 'Polygon') {
      const poly = coordinates as number[][][];
      if (poly.length > 0 && isPointInPolygon(point, poly[0])) {
        return feature.properties.NAME;
      }
    } else if (type === 'MultiPolygon') {
      const multiPoly = coordinates as number[][][][];
      for (const poly of multiPoly) {
        if (poly.length > 0 && isPointInPolygon(point, poly[0])) {
          return feature.properties.NAME;
        }
      }
    }
  }

  return '';
}
