import type { CurvePoint, Curves } from '../state/types';

export const LUT_SIZE = 1024;

/** Monotone cubic (Fritsch–Carlson) interpolator through sorted points. */
export function makeCurve(points: CurvePoint[]): (x: number) => number {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n === 0) return (x) => x;
  if (n === 1) return () => pts[0].y;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    d.push(dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx);
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    if (h === 0) return ys[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    return Math.min(1, Math.max(0, y));
  };
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
  return points.every((p) => Math.abs(p.x - p.y) < 1e-4);
}

export function curvesAreIdentity(c: Curves): boolean {
  return isIdentityCurve(c.master) && isIdentityCurve(c.red) && isIdentityCurve(c.green) && isIdentityCurve(c.blue);
}

/**
 * Build an RGBA float LUT (RGB used). Filter curves (if any) are blended in by `filterAmount`
 * and applied before the user's curves.
 */
export function buildLut(user: Curves, filter: Curves | null, filterAmount: number): Float32Array {
  const um = makeCurve(user.master);
  const uc = [makeCurve(user.red), makeCurve(user.green), makeCurve(user.blue)];
  const fm = filter ? makeCurve(filter.master) : null;
  const fc = filter ? [makeCurve(filter.red), makeCurve(filter.green), makeCurve(filter.blue)] : null;
  const out = new Float32Array(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    const x = i / (LUT_SIZE - 1);
    for (let c = 0; c < 3; c++) {
      let v = x;
      if (fm && fc) v = v + (fc[c](fm(v)) - v) * filterAmount;
      v = uc[c](um(v));
      out[i * 4 + c] = v;
    }
    out[i * 4 + 3] = 1;
  }
  return out;
}
