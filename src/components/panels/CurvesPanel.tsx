import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import type { CurveChannel, CurvePoint } from '../../state/types';
import { makeCurve } from '../../engine/curves';

const SIZE = 260;
const PADV = 10; // viewBox padding so end points aren't clipped
const CHANNELS: { id: CurveChannel; label: string; color: string }[] = [
  { id: 'master', label: 'RGB', color: '#ffffff' },
  { id: 'red', label: 'R', color: '#ff5a5a' },
  { id: 'green', label: 'G', color: '#4cd964' },
  { id: 'blue', label: 'B', color: '#4da3ff' },
];

const PRESETS: { name: string; pts: CurvePoint[] }[] = [
  { name: 'Linear', pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
  { name: 'Soft S', pts: [{ x: 0, y: 0 }, { x: 0.25, y: 0.2 }, { x: 0.75, y: 0.8 }, { x: 1, y: 1 }] },
  { name: 'Strong S', pts: [{ x: 0, y: 0 }, { x: 0.25, y: 0.15 }, { x: 0.75, y: 0.87 }, { x: 1, y: 1 }] },
  { name: 'Matte', pts: [{ x: 0, y: 0.12 }, { x: 0.3, y: 0.3 }, { x: 0.75, y: 0.78 }, { x: 1, y: 0.95 }] },
  { name: 'Brighten', pts: [{ x: 0, y: 0 }, { x: 0.45, y: 0.56 }, { x: 1, y: 1 }] },
];

export function CurvesPanel() {
  const curves = useStore((s) => s.edit.adjust.curves);
  const setAdjust = useStore((s) => s.setAdjust);
  const checkpoint = useStore((s) => s.checkpoint);
  const resetSection = useStore((s) => s.resetSection);
  const [ch, setCh] = useState<CurveChannel>('master');
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ idx: number } | null>(null);
  const pts = curves[ch];
  const color = CHANNELS.find((c) => c.id === ch)!.color;

  const setPts = (p: CurvePoint[]) => setAdjust({ curves: { ...curves, [ch]: p } });

  const path = useMemo(() => {
    const f = makeCurve(pts);
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const x = i / 64;
      d += `${i ? 'L' : 'M'}${(x * SIZE).toFixed(1)} ${((1 - f(x)) * SIZE).toFixed(1)}`;
    }
    return d;
  }, [pts]);

  const toLocal = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const full = SIZE + PADV * 2;
    const x = (((e.clientX - r.left) / r.width) * full - PADV) / SIZE;
    const y = (((e.clientY - r.top) / r.height) * full - PADV) / SIZE;
    return { x, y: 1 - y };
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    svgRef.current!.setPointerCapture(e.pointerId);
    checkpoint();
    const p = toLocal(e);
    // grab the nearest point if close, else insert one
    let best = -1;
    let bestD = 0.06;
    pts.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best === -1) {
      const next = [...pts, { x: Math.min(0.99, Math.max(0.01, p.x)), y: Math.min(1, Math.max(0, p.y)) }].sort((a, b) => a.x - b.x);
      best = next.findIndex((q) => q.x === Math.min(0.99, Math.max(0.01, p.x)));
      setPts(next);
    }
    drag.current = { idx: best };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toLocal(e);
    const i = drag.current.idx;
    const cur = useStore.getState().edit.adjust.curves[ch];
    const last = cur.length - 1;
    const next = [...cur];
    // drag an interior point far outside to delete it
    if (i !== 0 && i !== last && (p.y < -0.15 || p.y > 1.15)) {
      next.splice(i, 1);
      drag.current = null;
      setPts(next);
      return;
    }
    const lo = i === 0 ? 0 : cur[i - 1].x + 0.01;
    const hi = i === last ? 1 : cur[i + 1].x - 0.01;
    const x = i === 0 ? Math.min(hi, Math.max(0, p.x)) : i === last ? Math.min(1, Math.max(lo, p.x)) : Math.min(hi, Math.max(lo, p.x));
    next[i] = { x, y: Math.min(1, Math.max(0, p.y)) };
    setPts(next);
  };
  const onUp = () => {
    drag.current = null;
  };
  const removePoint = (i: number) => {
    if (i === 0 || i === pts.length - 1) return;
    checkpoint();
    setPts(pts.filter((_, j) => j !== i));
  };

  return (
    <div className="panel">
      <div className="chips">
        {CHANNELS.map((c) => (
          <button key={c.id} className={'chip' + (ch === c.id ? ' active' : '')} style={{ color: ch === c.id ? undefined : c.color }} onClick={() => setCh(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        className="curve-editor"
        viewBox={`${-PADV} ${-PADV} ${SIZE + PADV * 2} ${SIZE + PADV * 2}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label="Tone curve editor"
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t}>
            <line x1={t * SIZE} x2={t * SIZE} y1={0} y2={SIZE} className="grid" />
            <line y1={t * SIZE} y2={t * SIZE} x1={0} x2={SIZE} className="grid" />
          </g>
        ))}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} className="diag" />
        <path d={path} stroke={color} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x * SIZE}
            cy={(1 - p.y) * SIZE}
            r={7}
            fill="#111"
            stroke={color}
            strokeWidth={2}
            onDoubleClick={() => removePoint(i)}
          />
        ))}
      </svg>
      <p className="hint">Tap to add a point, drag to shape. Double-tap a point (or drag it off the graph) to remove it.</p>
      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className="chip"
            onClick={() => {
              checkpoint();
              setPts(p.pts.map((q) => ({ ...q })));
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <button className="btn ghost wide" onClick={() => resetSection('curves')}>
        Reset all curves
      </button>
    </div>
  );
}
