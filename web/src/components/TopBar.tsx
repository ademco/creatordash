export const WINDOW_OPTIONS = [30, 90, 180] as const;

interface Props {
  days: number;
  onDaysChange: (days: number) => void;
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
          Regiwock <span className="brand-sub">fan insights</span>
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
