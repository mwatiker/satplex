function toCartesian(lat: number, lng: number, alt: number, R = 6371) {
    const r = R + alt;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.sin(theta),
    };
}

function arcLength(
    a: { lat: number; lng: number; alt: number },
    b: { lat: number; lng: number; alt: number }
) {
    const A = toCartesian(a.lat, a.lng, a.alt);
    const B = toCartesian(b.lat, b.lng, b.alt);
    return Math.sqrt(
        (A.x - B.x) ** 2 + (A.y - B.y) ** 2 + (A.z - B.z) ** 2
    );
}

function lerpPoint(
    a: { lat: number; lng: number; alt: number },
    b: { lat: number; lng: number; alt: number },
    t: number
) {
    // Lerp in Cartesian, then convert back to lat/lng
    const A = toCartesian(a.lat, a.lng, a.alt);
    const B = toCartesian(b.lat, b.lng, b.alt);
    const x = A.x + (B.x - A.x) * t;
    const y = A.y + (B.y - A.y) * t;
    const z = A.z + (B.z - A.z) * t;

    const r = Math.sqrt(x * x + y * y + z * z);
    const lat = 90 - (Math.acos(y / r) * 180) / Math.PI;
    const lng = (Math.atan2(z, x) * 180) / Math.PI - 180;
    const alt = r - 6371;
    return { lat, lng, alt };
}

export function resampleTrajectory<T extends { lat: number; lng: number; alt: number }>(
    points: T[],
    targetCount = 200
): T[] {
    if (points.length < 2) return points;

    // 1. Compute cumulative arc lengths
    const cumLengths = [0];
    for (let i = 1; i < points.length; i++) {
        cumLengths.push(cumLengths[i - 1] + arcLength(points[i - 1], points[i]));
    }
    const totalLength = cumLengths[cumLengths.length - 1];
    const step = totalLength / (targetCount - 1);

    // 2. Walk the cumulative length curve and interpolate
    const resampled: T[] = [];
    let segIdx = 0;

    for (let i = 0; i < targetCount; i++) {
        const targetLen = i * step;
        while (segIdx < cumLengths.length - 2 && cumLengths[segIdx + 1] < targetLen) {
            segIdx++;
        }
        const segStart = cumLengths[segIdx];
        const segEnd = cumLengths[segIdx + 1];
        const t = segEnd === segStart ? 0 : (targetLen - segStart) / (segEnd - segStart);
        
        const pos = lerpPoint(points[segIdx], points[segIdx + 1], t);
        
        const interpolated = { ...points[segIdx] };
        interpolated.lat = pos.lat;
        interpolated.lng = pos.lng;
        interpolated.alt = pos.alt;
        
        if ('speed' in points[segIdx] && 'speed' in points[segIdx + 1]) {
            (interpolated as any).speed = (points[segIdx] as any).speed + ((points[segIdx + 1] as any).speed - (points[segIdx] as any).speed) * t;
        }
        
        resampled.push(interpolated);
    }

    return resampled;
}

/**
 * Splits a trajectory into segments when it crosses the antimeridian (dateline).
 */
export function splitTrajectory<T extends { lng: number }>(points: T[]): T[][] {
    if (points.length === 0) return [];
    const segments: T[][] = [[]];
    let currentSegment = segments[0];

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i > 0) {
            const prev = points[i - 1];
            if (Math.abs(p.lng - prev.lng) > 180) {
                currentSegment = [];
                segments.push(currentSegment);
            }
        }
        currentSegment.push(p);
    }
    return segments.filter(seg => seg.length > 0);
}
