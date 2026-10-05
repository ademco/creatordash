// Y-axis ticks at round numbers (0, 2K, 4K, ...) that hug the data. Charting
// libraries round the axis ends outward to a full tick, so a dip of -50 can add
// a whole empty band down to -2,000. Here the axis ends exactly at the data,
// and the ticks are the round numbers that fall inside it.

/** A round step (1, 2, 2.5, or 5 times a power of 10) giving about `count` ticks. */
export function niceStep(range: number, count = 5): number {
  if (range <= 0) return 1;
  const rough = range / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= rough) ?? 10;
  return step * power;
}

export interface Axis {
  domain: [number, number];
  ticks: number[];
}

export function axisFor(values: number[], includeZero: boolean): Axis {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) max = min + 1;
  const step = niceStep(max - min);
  const ticks: number[] = [];
  // `+ 0` turns -0 into 0, so the zero tick never prints as "-0".
  for (let tick = Math.ceil(min / step) * step + 0; tick <= max; tick += step) ticks.push(tick);
  return { domain: [min, max], ticks };
}
