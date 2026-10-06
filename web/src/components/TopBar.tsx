import { PLATFORM_IDS } from '../lib/platforms';

export const WINDOW_OPTIONS = [30, 90, 180] as const;

interface Props {
  days: number;
  onDaysChange: (days: number) => void;
}

// Five bars, one per platform color, mirrored around the middle like an audio
// waveform. It is the favicon too (see index.html).
const LOGO_BAR_HEIGHTS = [8, 16, 20, 12, 6];

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 28 20" aria-hidden="true" focusable="false">
      {PLATFORM_IDS.map((id, index) => {
        const height = LOGO_BAR_HEIGHTS[index] ?? 8;
        return (
          <rect
            key={id}
            x={index * 6}
            y={(20 - height) / 2}
            width="4"
            height={height}
            rx="2"
            style={{ fill: `var(--platform-${id})` }}
          />
        );
      })}
    </svg>
  );
}

/** App name and the window picker: one row above everything the picker controls. */
export function TopBar({ days, onDaysChange }: Props) {
  return (
    <header className="topbar">
      <div className="page topbar-inner">
        <a className="skip-link" href="#main">
          Skip to the numbers
        </a>
        <p className="brand">
          <Logo />
          <span>
            Regiwock <span className="brand-sub">fan insights</span>
          </span>
        </p>
        <fieldset className="window-picker">
          <legend className="visually-hidden">Time window</legend>
          {WINDOW_OPTIONS.map((option) => (
            <label key={option} className="window-option">
              <input
                type="radio"
                name="window"
                value={option}
                checked={days === option}
                onChange={() => onDaysChange(option)}
              />
              <span>{option} days</span>
            </label>
          ))}
        </fieldset>
      </div>
    </header>
  );
}
