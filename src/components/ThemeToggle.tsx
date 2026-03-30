import type { Theme } from "../lib/theme";

type ThemeToggleProps = {
  theme: Theme;
  onChange: (t: Theme) => void;
};

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div
      className="segmented segmented--compact"
      role="radiogroup"
      aria-label="Color Theme"
    >
      {(
        [
          { id: "light" as const, label: "Light" },
          { id: "dark" as const, label: "Dark" },
        ] as const
      ).map((opt) => (
        <label key={opt.id} className="segmented-option">
          <input
            type="radio"
            name="glossa-theme"
            value={opt.id}
            className="sr-only"
            checked={theme === opt.id}
            onChange={() => onChange(opt.id)}
          />
          <span className="segmented-label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
