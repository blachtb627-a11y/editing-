import { describe, expect, it } from 'vitest';
import { buildLut, makeCurve, LUT_SIZE } from './curves';
import { defaultCurves } from '../state/defaults';

describe('curves', () => {
  it('identity curve', () => {
    const f = makeCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(f(0.37)).toBeCloseTo(0.37);
  });
  it('passes through control points and stays monotone', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0.25, y: 0.15 }, { x: 0.75, y: 0.85 }, { x: 1, y: 1 }];
    const f = makeCurve(pts);
    expect(f(0.25)).toBeCloseTo(0.15);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = f(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
  it('identity LUT', () => {
    const lut = buildLut(defaultCurves(), null, 0);
    expect(lut[(LUT_SIZE - 1) * 4]).toBeCloseTo(1);
    expect(lut[512 * 4 + 1]).toBeCloseTo(512 / (LUT_SIZE - 1));
  });
});
