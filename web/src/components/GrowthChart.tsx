import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

import { formatCompact, formatLongDate, formatNumber, formatShortDate, formatSigned } from '../lib/format';
import { PLATFORM_IDS, platformName } from '../lib/platforms';
import { axisFor } from '../lib/ticks';
import { usePrefersReducedMotion, useThemeColors } from '../lib/useThemeColors';

interface Series {
  platform: string;
  points: { date: string; audience: number }[];
}

type Mode = 'growth' | 'total';
type Row = { date: string } & Record<string, number | string>;

/**
 * One row per date with a column per platform: the shape Recharts wants.
 * In "growth" mode each value is the gain since the first day of the window,
 * so platforms of very different sizes share one readable scale.
 */
export function toChartRows(series: Series[], mode: Mode): Row[] {
  const byDate = new Map<string, Row>();
  for (const { platform, points } of series) {
    const start = points[0]?.audience ?? 0;
    for (const { date, audience } of points) {
      const row: Row = byDate.get(date) ?? { date };
      row[platform] = mode === 'growth' ? audience - start : audience;
      byDate.set(date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface Props {
  series: Series[];
  days: number;
}

export function GrowthChart({ series, days }: Props) {
  const [mode, setMode] = useState<Mode>('growth');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const colors = useThemeColors();
  const reducedMotion = usePrefersReducedMotion();

  const rows = useMemo(() => toChartRows(series, mode), [series, mode]);
  // Chips follow the fixed platform order, so colors and positions never shuffle.
  const platforms = PLATFORM_IDS.filter((id) => series.some((s) => s.platform === id));
  const visible = platforms.filter((id) => !hidden.has(id));
  const axis = useMemo(
    () => axisFor(rows.flatMap((row) => visible.map((id) => Number(row[id] ?? 0))), mode === 'growth'),
    // `visible` is rebuilt every render, so depend on its contents instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, visible.join()],
  );

  const toggle = (id: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const formatValue = (value: number) => (mode === 'growth' ? formatSigned(value) : formatNumber(value));

  return (
    <section className="section" aria-labelledby="growth-title">
      <div className="section-head">
        <h2 id="growth-title">How your audience grew</h2>
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={mode === 'growth'} onClick={() => setMode('growth')}>
            Growth
          </button>
          <button type="button" aria-pressed={mode === 'total'} onClick={() => setMode('total')}>
            Total
          </button>
        </div>
      </div>
      <p className="section-note">
        {mode === 'growth'
          ? `Fans gained on each platform since the start of the last ${days} days.`
          : 'Total followers, subscribers, or monthly listeners on each platform.'}
      </p>

      <div className="chips" role="group" aria-label="Platforms on the chart">
        {platforms.map((id) => (
          <button
            key={id}
            type="button"
            className="chip"
            aria-pressed={!hidden.has(id)}
            onClick={() => toggle(id)}
          >
            <span className="chip-key" style={{ background: `var(--platform-${id})` }} aria-hidden="true" />
            {platformName(id)}
          </button>
        ))}
      </div>

      <div className="chart">
        {visible.length === 0 ? (
          <p className="chart-empty">Turn on a platform above to see its line.</p>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke={colors.rule} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                stroke={colors.rule}
                tick={{ fill: colors.muted, fontSize: 12 }}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(value: number) => formatCompact(value, mode === 'growth')}
                stroke={colors.rule}
                tick={{ fill: colors.muted, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={axis.domain}
                ticks={axis.ticks}
                allowDataOverflow
              />
              <Tooltip
                content={(props: TooltipContentProps) => (
                  <ChartTooltip {...props} formatValue={formatValue} colors={colors.platform} />
                )}
                cursor={{ stroke: colors.muted, strokeWidth: 1 }}
                isAnimationActive={false}
              />
              {visible.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={platformName(id)}
                  stroke={colors.platform[id]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: colors.paper, strokeWidth: 2 }}
                  isAnimationActive={!reducedMotion}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <details className="table-view">
        <summary>See these numbers as a table</summary>
        <GrowthTable series={series} />
      </details>
    </section>
  );
}

interface TooltipProps extends TooltipContentProps {
  formatValue: (value: number) => string;
  colors: Record<string, string>;
}

/** One readout for every visible line at the hovered date, biggest first. */
function ChartTooltip({ active, payload, label, formatValue, colors }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const items = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="tooltip">
      <p className="tooltip-date">{formatLongDate(String(label))}</p>
      <ul>
        {items.map((item) => (
          <li key={String(item.dataKey)}>
            <span className="tooltip-key" style={{ background: colors[String(item.dataKey)] }} aria-hidden="true" />
            <strong>{formatValue(Number(item.value))}</strong>
            <span className="tooltip-name">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The same numbers without the chart: start, end, and change for each platform. */
function GrowthTable({ series }: { series: Series[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Platform</th>
          <th scope="col">Start of window</th>
          <th scope="col">Latest</th>
          <th scope="col">Change</th>
        </tr>
      </thead>
      <tbody>
        {series.map(({ platform, points }) => {
          const first = points[0];
          const last = points.at(-1);
          if (!first || !last) return null;
          return (
            <tr key={platform}>
              <th scope="row">{platformName(platform)}</th>
              <td>
                {formatNumber(first.audience)} <span className="muted">({formatShortDate(first.date)})</span>
              </td>
              <td>
                {formatNumber(last.audience)} <span className="muted">({formatShortDate(last.date)})</span>
              </td>
              <td>{formatSigned(last.audience - first.audience)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
