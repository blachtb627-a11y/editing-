import { useRef } from 'react';
import type { Rect } from '../state/types';

type Handle = { hx: -1 | 0 | 1; hy: -1 | 0 | 1 };
const HANDLES: Handle[] = [
  { hx: -1, hy: -1 },
  { hx: 0, hy: -1 },
  { hx: 1, hy: -1 },
  { hx: 1, hy: 0 },
  { hx: 1, hy: 1 },
  { hx: 0, hy: 1 },
  { hx: -1, hy: 1 },
  { hx: -1, hy: 0 },
];
const MIN = 0.05;

/** Resize `s` by dragging handle h by (dx,dy) in normalized units. ratioN = w/h in normalized units (null = free). */
export function resizeCrop(s: Rect, h: Handle, dx: number, dy: number, ratioN: number | null): Rect {
  const right = s.x + s.w;
  const bottom = s.y + s.h;
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  let w = h.hx === 1 ? s.w + dx : h.hx === -1 ? s.w - dx : s.w;
  let hh = h.hy === 1 ? s.h + dy : h.hy === -1 ? s.h - dy : s.h;
  const maxW = h.hx === 1 ? 1 - s.x : h.hx === -1 ? right : 2 * Math.min(cx, 1 - cx);
  const maxH = h.hy === 1 ? 1 - s.y : h.hy === -1 ? bottom : 2 * Math.min(cy, 1 - cy);
  if (ratioN) {
    if (h.hx !== 0 && h.hy !== 0) {
      // corner: scale by the average of both axes' change (projection onto the diagonal)
      const k = (w / s.w + hh / s.h) / 2;
      w = s.w * k;
      hh = w / ratioN;
    } else if (h.hx !== 0) hh = w / ratioN;
    else w = hh * ratioN;
    w = Math.max(w, 1e-4);
    hh = Math.max(hh, 1e-4);
    const k = Math.min(1, maxW / w, maxH / hh);
    w *= k;
    hh *= k;
    const m = Math.max(1, MIN / w, MIN / hh);
    w *= m;
    hh *= m;
  } else {
    w = Math.min(maxW, Math.max(MIN, w));
    hh = Math.min(maxH, Math.max(MIN, hh));
  }
  w = Math.max(MIN, w);
  hh = Math.max(MIN, hh);
  const x = h.hx === 1 ? s.x : h.hx === -1 ? right - w : cx - w / 2;
  const y = h.hy === 1 ? s.y : h.hy === -1 ? bottom - hh : cy - hh / 2;
  return { x, y, w, h: hh };
}

interface Props {
  width: number;
  height: number;
  crop: Rect;
  ratioN: number | null;
  onBegin(): void;
  onChange(r: Rect): void;
}

export function CropOverlay({ width, height, crop, ratioN, onBegin, onChange }: Props) {
  const drag = useRef<{ start: Rect; px: number; py: number; handle: Handle | null } | null>(null);

  const down = (e: React.PointerEvent, handle: Handle | null) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    onBegin();
    drag.current = { start: crop, px: e.clientX, py: e.clientY, handle };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / width;
    const dy = (e.clientY - d.py) / height;
    if (!d.handle) {
      const s = d.start;
      onChange({ ...s, x: Math.min(1 - s.w, Math.max(0, s.x + dx)), y: Math.min(1 - s.h, Math.max(0, s.y + dy)) });
    } else onChange(resizeCrop(d.start, d.handle, dx, dy, ratioN));
  };
  const up = () => {
    drag.current = null;
  };

  const L = crop.x * width;
  const T = crop.y * height;
  const W = crop.w * width;
  const H = crop.h * height;
  return (
    <div className="crop-overlay" style={{ width, height }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg width={width} height={height} className="crop-mask">
        <path
          fillRule="evenodd"
          d={`M0 0H${width}V${height}H0Z M${L} ${T}h${W}v${H}h${-W}Z`}
          fill="rgba(0,0,0,0.55)"
        />
      </svg>
      <div className="crop-box" style={{ left: L, top: T, width: W, height: H }} onPointerDown={(e) => down(e, null)}>
        <div className="thirds v1" />
        <div className="thirds v2" />
        <div className="thirds h1" />
        <div className="thirds h2" />
        {HANDLES.map((h) => (
          <div
            key={`${h.hx}${h.hy}`}
            className={`crop-handle ${h.hx && h.hy ? 'corner' : 'edge'} ${h.hx === 0 ? 'hcenter' : ''} ${h.hy === 0 ? 'vcenter' : ''}`}
            style={{ left: `${((h.hx + 1) / 2) * 100}%`, top: `${((h.hy + 1) / 2) * 100}%` }}
            onPointerDown={(e) => down(e, h)}
          />
        ))}
      </div>
    </div>
  );
}
