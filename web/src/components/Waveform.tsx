import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { formatLongDate, formatMultiple, formatSigned } from '../lib/format';
import { PLATFORM_IDS, platformName } from '../lib/platforms';
import { usePrefersReducedMotion } from '../lib/useThemeColors';
import {
  dailyGains,
  indexForDate,
  layoutWave,
  netGain,
  peakDay,
  playbackIndex,
  totalThrough,
  type Rect,
  type Series,
} from '../lib/waveform';

interface Pin {
  title: string;
  platform: string;
  publishedDate: string;
  multiple: number;
}

interface Props {
  series: Series[];
  /** Breakouts, pinned to their publish date like timed comments on a SoundCloud track. */
  pins: Pin[];
}

// The drawing is 1000 x 200 units and stretches to fit the page, so it works at
// any width. The center line sits 62% of the way down: gains grow up from it,
// losses grow down.
const WIDTH = 1000;
const HEIGHT = 200;
const SIZE = { width: WIDTH, height: HEIGHT, baseline: HEIGHT * 0.62 };
const PLAY_MS = 8000;

/** The bars. Memoized: while the playhead moves, they do not need to be redrawn. */
const Bars = memo(function Bars({ rects }: { rects: Rect[] }) {
  return (
    <g>
      {rects.map((r) => (
        <rect
          key={r.key}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          style={{ fill: `var(--platform-${r.platform})` }}
        />
      ))}
    </g>
  );
});

/**
 * Daily fan gains drawn like an audio waveform. Drag (or hover with a mouse, or
 * use the arrow keys) to move the playhead; press play to sweep it across the
 * window. The bright part is "played", the faded part is still to come. Every
 * number is also available in the table under the chart.
 */
export function Waveform({ series, pins }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const clipId = `wave-clip-${useId().replace(/:/g, '')}`;
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const days = useMemo(() => dailyGains(series), [series]);
  const rects = useMemo(() => layoutWave(days, PLATFORM_IDS, SIZE), [days]);
  const count = days.length;

  // null means "follow the end": the whole window is played, which matches the headline.
  const [picked, setPicked] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const at = picked === null ? count - 1 : Math.min(picked, count - 1);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const elapsed = now - startedAt;
      setPicked(playbackIndex(elapsed, PLAY_MS, count));
      if (elapsed >= PLAY_MS) setPlaying(false);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, count]);

  if (count === 0) {
    return <p className="chart-empty">There aren’t enough days of data to draw a waveform yet.</p>;
  }

  const day = days[at];
  if (!day) return null;
  const peak = peakDay(days);
  const slot = WIDTH / count;
  const total = totalThrough(days, at);
  const dayNet = netGain(day);

  const moveTo = (index: number) => {
    setPlaying(false);
    setPicked(Math.min(count - 1, Math.max(0, index)));
  };

  const indexFromPointer = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || box.width === 0) return at;
    return Math.floor(((clientX - box.left) / box.width) * count);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(indexFromPointer(e.clientX));
  };
  // A mouse scrubs just by hovering. Touch and pen only scrub while pressed, so
  // a vertical swipe to scroll the page never moves the playhead.
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current || e.pointerType === 'mouse') moveTo(indexFromPointer(e.clientX));
  };
  const onPointerEnd = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -7, PageUp: 7 };
    const step = steps[e.key];
    if (step !== undefined) moveTo(at + step);
    else if (e.key === 'Home') moveTo(0);
    else if (e.key === 'End') moveTo(count - 1);
    else return;
    e.preventDefault();
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setPicked(0);
    setPlaying(true);
  };

  return (
    <div className="wave">
      <div className="wave-tools">
        {!reducedMotion && (
          <button type="button" className="play" onClick={togglePlay} aria-pressed={playing}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              {playing ? (
                <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />
              ) : (
                <path d="M2 1l9 5-9 5z" fill="currentColor" />
              )}
            </svg>
            {playing ? 'Pause' : 'Play your last stretch'}
          </button>
        )}
        {peak && (
          <p className="wave-peak">
            Biggest day: {formatLongDate(peak.date)} ({formatSigned(netGain(peak))})
          </p>
        )}
      </div>

      <div className="wave-pins">
        {pins.map((pin) => {
          const index = indexForDate(days, pin.publishedDate);
          const left = ((index + 0.5) / count) * 100;
          return (
            <button
              key={`${pin.platform}-${pin.publishedDate}-${pin.title}`}
              type="button"
              className={left > 60 ? 'pin pin-end' : left < 15 ? 'pin pin-start' : 'pin'}
              style={{ left: `${left}%`, '--pin': `var(--platform-${pin.platform})` } as CSSProperties}
              onClick={() => moveTo(index)}
              aria-label={`Jump to ${formatLongDate(pin.publishedDate)}: ${pin.title}, ${formatMultiple(pin.multiple)} the usual views on ${platformName(pin.platform)}`}
            >
              <span className="pin-dot" aria-hidden="true" />
              <span className="pin-label" aria-hidden="true">
                {formatMultiple(pin.multiple)} · {pin.title}
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={stage}
        className="wave-stage"
        role="slider"
        tabIndex={0}
        aria-label="Fans gained each day. Use the arrow keys to move through the days."
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={at}
        aria-valuetext={`${formatLongDate(day.date)}: ${formatSigned(dayNet)} fans that day, ${formatSigned(total)} so far`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={(at + 1) * slot} height={HEIGHT} />
            </clipPath>
          </defs>
          <g className="wave-ahead">
            <Bars rects={rects} />
          </g>
          <g clipPath={`url(#${clipId})`}>
            <Bars rects={rects} />
          </g>
          <line className="wave-base" x1="0" x2={WIDTH} y1={SIZE.baseline} y2={SIZE.baseline} />
        </svg>
        <div className="wave-playhead" style={{ left: `${((at + 0.5) / count) * 100}%` }} aria-hidden="true" />
      </div>

      <div className="wave-axis" aria-hidden="true">
        <span>{formatLongDate(days[0]?.date ?? day.date)}</span>
        <span>{formatLongDate(days[count - 1]?.date ?? day.date)}</span>
      </div>

      <div className="wave-readout">
        <p className="wave-total">
          <strong>{formatSigned(total)}</strong> fans by {formatLongDate(day.date)}
        </p>
        <ul className="wave-platforms">
          {PLATFORM_IDS.filter((id) => series.some((s) => s.platform === id)).map((id) => {
            const gain = day.gains[id] ?? 0;
            return (
              <li key={id} className={gain === 0 ? 'is-quiet' : undefined}>
                <span className="wave-key" style={{ background: `var(--platform-${id})` }} aria-hidden="true" />
                {platformName(id)} <strong>{formatSigned(gain)}</strong>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
