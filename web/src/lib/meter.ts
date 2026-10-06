// Geometry for the little gauge next to each breakout. The needle points at how
// many times the usual views a post got: straight left is "usual" (1×), straight
// right is the top of the scale. Pure functions, so the numbers are tested.

/** A breakout is anything at least this many times the usual views (the API's default). */
export const BREAKOUT_MIN = 2.5;

/** The scale: 1× ("usual") at the left end, SCALE_MAX at the right end. Bigger values pin there. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 8;

/** The needle swings this many degrees either side of straight up. */
export const SWEEP = 68;

export const PIVOT = { x: 42, y: 46 };
export const RADIUS = 34;

/** Needle angle in degrees from straight up: negative leans left, positive leans right. */
export function meterAngle(multiple: number): number {
  const clamped = Math.min(Math.max(multiple, SCALE_MIN), SCALE_MAX);
  return -SWEEP + ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * SWEEP * 2;
}

/** A point on a circle around the pivot. 0° is straight up, positive leans right. */
export function polar(angle: number, radius: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return { x: PIVOT.x + radius * Math.sin(radians), y: PIVOT.y - radius * Math.cos(radians) };
}

/** The same point as "x y" text, for an SVG path. */
export function pointAt(angle: number, radius: number): string {
  const { x, y } = polar(angle, radius);
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

/** An SVG arc along the gauge from one angle to another, drawn left to right over the top. */
export function arcPath(fromAngle: number, toAngle: number, radius = RADIUS): string {
  return `M ${pointAt(fromAngle, radius)} A ${radius} ${radius} 0 0 1 ${pointAt(toAngle, radius)}`;
}
