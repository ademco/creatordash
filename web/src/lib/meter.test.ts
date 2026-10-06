import { describe, expect, it } from 'vitest';

import { arcPath, meterAngle, pointAt, SWEEP } from './meter';

describe('meterAngle', () => {
  it('puts "usual" (1×) at the far left and the top of the scale at the far right', () => {
    expect(meterAngle(1)).toBe(-SWEEP);
    expect(meterAngle(8)).toBe(SWEEP);
  });

  it('pins values outside the scale to the ends instead of swinging past them', () => {
    expect(meterAngle(0.2)).toBe(-SWEEP);
    expect(meterAngle(40)).toBe(SWEEP);
  });

  it('puts the middle of the scale straight up', () => {
    expect(meterAngle(4.5)).toBeCloseTo(0);
  });

  it('moves right as the multiple grows', () => {
    expect(meterAngle(7.1)).toBeGreaterThan(meterAngle(2.5));
  });
});

describe('pointAt and arcPath', () => {
  it('puts 0° straight above the pivot and 90° level with it, to the right', () => {
    expect(pointAt(0, 10)).toBe('42.00 36.00');
    expect(pointAt(90, 10)).toBe('52.00 46.00');
  });

  it('draws an arc between two angles, clockwise over the top', () => {
    expect(arcPath(-90, 90, 10)).toBe('M 32.00 46.00 A 10 10 0 0 1 52.00 46.00');
  });
});
