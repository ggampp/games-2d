export type Point = { x: number; y: number };

export type Lane = {
  id: number;
  points: Point[];
};

export { GAME_WIDTH, GAME_HEIGHT } from "../data/layout.ts";
import { WALL_X } from "../data/layout.ts";

export function createLanes(): Lane[] {
  return [240, 370, 510].map((y, id) => ({
    id,
    points: [
      { x: 1260, y },
      { x: 980, y },
      { x: 720, y: y - 2 },
      { x: 480, y: y - 4 },
      { x: WALL_X + 24, y: y - 6 },
    ],
  }));
}

export function pointOnPath(points: Point[], t: number): Point {
  const clamped = Math.min(1, Math.max(0, t));
  if (points.length === 1) return points[0];
  const segs = points.length - 1;
  const scaled = clamped * segs;
  const i = Math.min(segs - 1, Math.floor(scaled));
  const local = scaled - i;
  const a = points[i];
  const b = points[i + 1];
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

export function advanceT(points: Point[], t: number, distance: number): number {
  const total = pathLength(points);
  if (total <= 0) return 1;
  return Math.min(1, t + distance / total);
}

export function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function remainingDistance(points: Point[], t: number): number {
  return pathLength(points) * (1 - Math.min(1, Math.max(0, t)));
}
