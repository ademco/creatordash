import { useEffect, useRef, useState } from 'react';

import { usePrefersReducedMotion } from './useThemeColors';

// A number that rolls up to its value instead of appearing. The maths is two
// small pure functions (tested); the hook only drives them from the browser's
// animation frames.

/** Fast start, gentle landing. Takes progress 0..1 and returns 0..1. */
export function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** The value to show `progress` (0..1) of the way from `from` to `to`, as a whole number. */
export function interpolate(from: number, to: number, progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return Math.round(from + (to - from) * easeOutCubic(clamped));
}

/**
 * Returns `target` after rolling up to it from the previous value (or from 0 on
 * the first render). With reduced motion on, it is just `target`, immediately.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  // The value on screen right now, so a change mid-roll continues from there
  // instead of jumping back.
  const onScreen = useRef(0);

  useEffect(() => {
    if (reducedMotion) return;
    const from = onScreen.current;
    if (from === target) return;

    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = (now - startedAt) / durationMs;
      onScreen.current = interpolate(from, target, progress);
      setValue(onScreen.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reducedMotion]);

  return reducedMotion ? target : value;
}
