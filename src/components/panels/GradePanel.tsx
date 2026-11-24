import { useRef } from 'react';
import { useStore } from '../../state/store';
import type { GradeWheel } from '../../state/types';
import { Slider } from '../Slider';

function ColorWheel({ value, onChange, onBegin, label }: { value: GradeWheel; onChange(v: GradeWheel): void; onBegin(): void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    const dist = Math.min(1, Math.hypot(dx, dy) * 2);
    let hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    onChange({ ...value, hue: Math.round(hue), sat: Math.round(dist * 100) });
  };
  const rad = (value.hue * Math.PI) / 180;
  const r = (value.sat / 100) * 50;
  return (
    <div className="wheel-wrap">
      <div
        ref={ref}
        className="wheel"
        role="slider"
        aria-label={`${label} color`}
        aria-valuetext={`hue ${value.hue}, saturation ${value.sat}`}
        tabIndex={0}
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          dragging.current = true;
          onBegin();
          pick(e);
        }}
        onPointerMove={(e) => dragging.current && pick(e)}
        onPointerUp={() => (dragging.current = false)}
        onDoubleClick={() => {
          onBegin();
          onChange({ ...value, sat: 0 });
        }}
      >
        <div className="puck" style={{ left: `${50 + Math.sin(rad) * r}%`, top: `${50 - Math.cos(rad) * r}%` }} />
      </div>
      <span className="wheel-label">{label}</span>
    </div>
  );
}

export function GradePanel() {
  const grading = useStore((s) => s.edit.adjust.grading);
  const setAdjust = useStore((s) => s.setAdjust);
  const checkpoint = useStore((s) => s.checkpoint);
  const resetSection = useStore((s) => s.resetSection);
  const set = (patch: Partial<typeof grading>) => setAdjust({ grading: { ...grading, ...patch } });
  const wheels = [
    ['shadows', 'Shadows'],
    ['midtones', 'Midtones'],
    ['highlights', 'Highlights'],
  ] as const;
  return (
    <div className="panel">
      <div className="wheels">
        {wheels.map(([k, label]) => (
          <ColorWheel key={k} label={label} value={grading[k]} onBegin={checkpoint} onChange={(v) => set({ [k]: v })} />
        ))}
      </div>
      {wheels.map(([k, label]) => (
        <Slider key={k} label={`${label} luminance`} value={grading[k].lum} min={-100} max={100} onChange={(lum) => set({ [k]: { ...grading[k], lum } })} />
      ))}
      <Slider label="Balance" value={grading.balance} min={-100} max={100} onChange={(balance) => set({ balance })} />
      <Slider label="Blending" value={grading.blending} min={0} max={100} defaultValue={50} onChange={(blending) => set({ blending })} />
      <p className="hint">Drag inside a wheel to tint that tonal range — e.g. teal shadows + warm highlights for a cinematic look. Double-tap a wheel to clear it.</p>
      <button className="btn ghost wide" onClick={() => resetSection('grade')}>
        Reset grading
      </button>
    </div>
  );
}
