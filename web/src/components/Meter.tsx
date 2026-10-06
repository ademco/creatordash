import type { CSSProperties } from 'react';

import { arcPath, BREAKOUT_MIN, meterAngle, PIVOT, polar, RADIUS, SCALE_MIN, SWEEP } from '../lib/meter';

interface Props {
  multiple: number;
  platform: string;
  /** Row number, so the needles swing one after another. */
  index: number;
}

/**
 * A VU-meter style gauge for "how many times the usual views". The colored part
 * of the dial is the breakout zone (2.5× and up). The needle swings in with a
 * CSS spring (see .meter-needle in styles.css), so there is no animation code
 * here. It is decoration: the "7.1×" text next to it carries the value.
 */
export function Meter({ multiple, platform, index }: Props) {
  const zoneStart = meterAngle(BREAKOUT_MIN);
  // A short tick across the dial where "usual" (1×) is.
  const tickInner = polar(-SWEEP, RADIUS - 7);
  const tickOuter = polar(-SWEEP, RADIUS + 6);
  const style = {
    '--angle': `${meterAngle(multiple)}deg`,
    '--start': `${meterAngle(SCALE_MIN)}deg`,
    '--i': index,
  } as CSSProperties;

  return (
    <svg className="meter" viewBox="0 0 84 50" aria-hidden="true" focusable="false" style={style}>
      <path className="meter-track" d={arcPath(-SWEEP, zoneStart)} />
      <path className="meter-zone" d={arcPath(zoneStart, SWEEP)} style={{ stroke: `var(--platform-${platform})` }} />
      <line className="meter-tick" x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} />
      <line className="meter-needle" x1={PIVOT.x} y1={PIVOT.y} x2={PIVOT.x} y2={PIVOT.y - RADIUS + 4} />
      <circle className="meter-pivot" cx={PIVOT.x} cy={PIVOT.y} r="3.5" />
    </svg>
  );
}
