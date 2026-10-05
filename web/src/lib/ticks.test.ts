import { describe, expect, it } from 'vitest';

import { axisFor, niceStep } from './ticks';

describe('niceStep', () => {
  it('picks round steps', () => {
    expect(niceStep(4850)).toBe(1000);
    expect(niceStep(100)).toBe(20);
    expect(niceStep(20200)).toBe(5000);
  });
});

describe('axisFor', () => {
  it('does not add an empty band below a small dip', () => {
    expect(axisFor([-50, 0, 4800], true)).toEqual({ domain: [-50, 4800], ticks: [0, 1000, 2000, 3000, 4000] });
  });

  it('can leave zero out for totals', () => {
    expect(axisFor([1500, 21700], false)).toEqual({
      domain: [1500, 21700],
      ticks: [5000, 10000, 15000, 20000],
    });
  });

  it('handles flat and empty data', () => {
    expect(axisFor([], true)).toEqual({ domain: [0, 1], ticks: [0, 1] });
    expect(axisFor([0, 0], true).domain).toEqual([0, 1]);
  });
});
