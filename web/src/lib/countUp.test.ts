import { describe, expect, it } from 'vitest';

import { easeOutCubic, interpolate } from './countUp';

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1, and is already past halfway at the midpoint', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('interpolate', () => {
  it('lands exactly on the target at the end and on the start at the beginning', () => {
    expect(interpolate(0, 11041, 0)).toBe(0);
    expect(interpolate(0, 11041, 1)).toBe(11041);
  });

  it('never goes outside the progress range', () => {
    expect(interpolate(100, 200, -3)).toBe(100);
    expect(interpolate(100, 200, 7)).toBe(200);
  });

  it('counts down as well as up, in whole numbers', () => {
    const mid = interpolate(1000, 0, 0.5);
    expect(mid).toBeLessThan(500);
    expect(Number.isInteger(mid)).toBe(true);
  });
});
