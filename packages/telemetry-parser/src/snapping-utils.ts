/**
 * Distancia Haversine entre dos puntos en km.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula el rumbo (heading) entre dos coordenadas en grados [0, 360).
 */
export function calculateHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Obtiene la diferencia absoluta menor entre dos ángulos en grados.
 */
export function getAngleDiff(angle1: number, angle2: number): number {
  const diff = Math.abs(angle1 - angle2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export interface SnappingLink {
  linkId: string;
  functionalClass: number;
  speedLimit: number;
  points: [number, number][]; // Array of [lng, lat]
}

/**
 * Snaps a GPS coordinate to the closest point of a list of candidate map links.
 * Incorporates distance, heading, and speed penalties for accurate selection.
 */
export function snapPointToLinks(
  lat: number,
  lng: number,
  speed: number | undefined,
  angle: number | undefined,
  links: SnappingLink[],
  maxDistKm = 0.035,
): {
  snapped: boolean;
  latitude: number;
  longitude: number;
  bestDist: number;
  matchedLink: SnappingLink | null;
} {
  let bestScore = Infinity;
  let closestPt: [number, number] | null = null;
  let bestDist = Infinity;
  let matchedLink: SnappingLink | null = null;

  const speedToUse = speed ?? 0;
  const cosLat = Math.cos((lat * Math.PI) / 180);

  for (const link of links) {
    const pointsCount = link.points.length;
    if (pointsCount === 0) continue;

    // Fallback if link only has 1 point (no segments can be formed)
    if (pointsCount < 2) {
      const linkPt = link.points[0];
      const dist = haversineDistance(lat, lng, linkPt[1], linkPt[0]);

      let anglePenalty = 0;
      let speedPenalty = 0;

      if (speedToUse > 55 && link.speedLimit <= 40) {
        speedPenalty = 0.05;
      }

      const score = dist + anglePenalty + speedPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestDist = dist;
        closestPt = linkPt;
        matchedLink = link;
      }
      continue;
    }

    // Iterate segments
    for (let idx = 0; idx < pointsCount - 1; idx++) {
      const ptA = link.points[idx];
      const ptB = link.points[idx + 1];

      const lngA = ptA[0];
      const latA = ptA[1];
      const lngB = ptB[0];
      const latB = ptB[1];

      // Segment vector AB and point vector AP in flat space
      const dx = (lngB - lngA) * cosLat;
      const dy = latB - latA;
      const ab2 = dx * dx + dy * dy;

      let t = 0;
      if (ab2 > 0) {
        const px = (lng - lngA) * cosLat;
        const py = lat - latA;
        t = Math.max(0, Math.min(1, (px * dx + py * dy) / ab2));
      }

      // Projected coordinate
      const projLat = latA + t * dy;
      const projLng = lngA + t * (lngB - lngA);

      // Distance from GPS point to projected point (flat-plane approximation in km)
      const fdx = (lng - projLng) * cosLat;
      const fdy = lat - projLat;
      const dist2 = fdx * fdx + fdy * fdy;
      const distKm = Math.sqrt(dist2) * 111.1949;

      // Optimization: prune branch early if flat distance exceeds current best score
      if (distKm >= bestScore) {
        continue;
      }

      let anglePenalty = 0;
      let speedPenalty = 0;

      if (angle !== undefined && speedToUse > 15) {
        const segmentHeading = calculateHeading(latA, lngA, latB, lngB);
        const diffNormal = getAngleDiff(angle, segmentHeading);
        const diffReverse = getAngleDiff(angle, (segmentHeading + 180) % 360);
        const minDiff = Math.min(diffNormal, diffReverse);

        if (minDiff > 45) {
          anglePenalty = 0.05; // 50m penalty
        }
      }

      if (speedToUse > 55) {
        if (link.speedLimit <= 40) {
          speedPenalty = 0.05; // 50m penalty
        }
      }

      const score = distKm + anglePenalty + speedPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestDist = distKm;
        closestPt = [projLng, projLat];
        matchedLink = link;
      }
    }
  }

  if (closestPt) {
    const exactDist = haversineDistance(lat, lng, closestPt[1], closestPt[0]);
    if (exactDist <= maxDistKm) {
      return {
        snapped: true,
        latitude: closestPt[1],
        longitude: closestPt[0],
        bestDist: exactDist,
        matchedLink,
      };
    }
  }

  return {
    snapped: false,
    latitude: lat,
    longitude: lng,
    bestDist,
    matchedLink: null,
  };
}
