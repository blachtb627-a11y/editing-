import { useStore } from '../state/store';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  track?: string;
  format?: (v: number) => string;
  onChange(v: number): void;
  /** called once when a drag/keyboard interaction begins (for undo history) */
  onBegin?(): void;
}

export function Slider({ label, value, min, max, step = 1, defaultValue, track, format, onChange, onBegin }: Props) {
  const checkpoint = useStore((s) => s.checkpoint);
  const begin = onBegin ?? checkpoint;
  const zero = defaultValue ?? (min < 0 ? 0 : min);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const a = Math.min(pct(zero), pct(value));
  const b = Math.max(pct(zero), pct(value));
  const fill = track
    ? track
    : `linear-gradient(90deg, var(--track) ${a}%, var(--accent) ${a}%, var(--accent) ${b}%, var(--track) ${b}%)`;
  const shown = format ? format(value) : (value > 0 && min < 0 ? '+' : '') + Math.round(value);
  const changed = Math.abs(value - zero) > 1e-6;
  return (
    <div className={'slider' + (changed ? ' changed' : '')}>
      <div className="slider-head">
        <label
          title="Double-click to reset"
          onDoubleClick={() => {
            begin();
            onChange(zero);
          }}
        >
          {label}
        </label>
        <input
          className="slider-num"
          type="number"
          value={step < 1 ? value.toFixed(2) : Math.round(value)}
          min={min}
          max={max}
          step={step}
          aria-label={label + ' value'}
          onFocus={begin}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          data-shown={shown}
        />
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ background: fill }}
        className={track ? 'custom-track' : ''}
        onPointerDown={begin}
        onKeyDown={(e) => {
          if (!e.repeat && e.key.startsWith('Arrow')) begin();
        }}
        onDoubleClick={() => {
          begin();
          onChange(zero);
        }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
