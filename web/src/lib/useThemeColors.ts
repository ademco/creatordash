import { useEffect, useState } from 'react';

import { PLATFORM_IDS } from './platforms';

// Colors are defined once, as CSS variables in styles.css, with a light and a
// dark version. HTML elements use them directly; the SVG chart needs real color
// strings in props, so this hook reads the current values and re-reads them
// when the system switches between light and dark.

export interface ThemeColors {
  platform: Record<string, string>;
  ink: string;
  muted: string;
  rule: string;
  paper: string;
}

function readColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    platform: Object.fromEntries(PLATFORM_IDS.map((id) => [id, read(`--platform-${id}`)])),
    ink: read('--ink'),
    muted: read('--muted'),
    rule: read('--rule'),
    paper: read('--paper'),
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(readColors());
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return colors;
}

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
