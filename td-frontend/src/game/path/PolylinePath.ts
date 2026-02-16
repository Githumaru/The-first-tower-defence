import type { Point } from "../types";

type Segment = {
  p0: Point;
  p1: Point;
  len: number;
  nx: number; // normalized dx
  ny: number; // normalized dy
  startDist: number;
  endDist: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function distSqPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq <= 1e-9) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

export class PolylinePath {
  private segments: Segment[] = [];
  public totalLength = 0;

  constructor(points: Point[]) {
    if (!points || points.length < 2) {
      throw new Error("PolylinePath: need at least 2 points");
    }

    let acc = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);

      if (len <= 0.000001) {
        continue;
      }

      const seg: Segment = {
        p0,
        p1,
        len,
        nx: dx / len,
        ny: dy / len,
        startDist: acc,
        endDist: acc + len,
      };

      this.segments.push(seg);
      acc += len;
    }

    if (this.segments.length === 0) {
      throw new Error("PolylinePath: all segments have zero length");
    }

    this.totalLength = acc;
  }

  getPointAtDistance(distance: number): { x: number; y: number; done: boolean } {
    if (distance <= 0) {
      const first = this.segments[0].p0;
      return { x: first.x, y: first.y, done: false };
    }

    if (distance >= this.totalLength) {
      const last = this.segments[this.segments.length - 1].p1;
      return { x: last.x, y: last.y, done: true };
    }

    for (const s of this.segments) {
      if (distance >= s.startDist && distance <= s.endDist) {
        const local = distance - s.startDist;
        return {
          x: s.p0.x + s.nx * local,
          y: s.p0.y + s.ny * local,
          done: false,
        };
      }
    }

    const last = this.segments[this.segments.length - 1].p1;
    return { x: last.x, y: last.y, done: true };
  }

  /** Минимальная дистанция до polyline (в пикселях) */
  distanceToPath(px: number, py: number): number {
    let best = Number.POSITIVE_INFINITY;
    for (const s of this.segments) {
      const d2 = distSqPointToSegment(px, py, s.p0.x, s.p0.y, s.p1.x, s.p1.y);
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  /** true если точка слишком близко к дороге (для no-build зоны) */
  isNearPath(px: number, py: number, radiusPx: number): boolean {
    return this.distanceToPath(px, py) <= radiusPx;
  }
}
