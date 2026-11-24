import { describe, expect, it } from 'vitest';
import { apply, compose, cropToSourceMatrix, fitCropToRatio, frameLayout, invert, orientedToSource, straightenScale } from './geometry';
import { defaultEditState, defaultGeometry } from '../state/defaults';

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe('orientation', () => {
  it('identity maps corners to themselves', () => {
    const m = orientedToSource({ rotation: 0, flipH: false, flipV: false });
    close(apply(m, 0.25, 0.75), [0.25, 0.75]);
  });
  it('90° cw: oriented top-left comes from source bottom-left', () => {
    const m = orientedToSource({ rotation: 1, flipH: false, flipV: false });
    close(apply(m, 0, 0), [0, 1]);
    close(apply(m, 1, 0), [0, 0]);
  });
  it('180°', () => {
    const m = orientedToSource({ rotation: 2, flipH: false, flipV: false });
    close(apply(m, 0, 0), [1, 1]);
  });
  it('flipH mirrors x', () => {
    const m = orientedToSource({ rotation: 0, flipH: true, flipV: false });
    close(apply(m, 0.2, 0.3), [0.8, 0.3]);
  });
});

describe('crop matrix', () => {
  it('maps crop corners to source uv', () => {
    const g = { ...defaultGeometry(), crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 } };
    const m = cropToSourceMatrix(g, 2000, 1000);
    close(apply(m, 0, 0), [0.1, 0.2]);
    close(apply(m, 1, 1), [0.6, 0.6]);
  });
  it('straightened full crop stays inside the image', () => {
    const g = { ...defaultGeometry(), straighten: 12 };
    const m = cropToSourceMatrix(g, 3000, 2000);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [u, v] = apply(m, x, y);
      expect(u).toBeGreaterThanOrEqual(-1e-9);
      expect(u).toBeLessThanOrEqual(1 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('compose/invert roundtrip', () => {
    const m = cropToSourceMatrix({ ...defaultGeometry(), straighten: 7, rotation: 1 }, 1200, 900);
    close(apply(compose(invert(m), m), 0.3, 0.7), [0.3, 0.7]);
  });
  it('straightenScale is 1 at 0°', () => {
    expect(straightenScale(100, 50, 0)).toBe(1);
  });
});

describe('frame layout', () => {
  it('portrait = 1080x1350', () => {
    const l = frameLayout(defaultEditState(), 4000, 5000);
    expect([l.width, l.height]).toEqual([1080, 1350]);
  });
  it('carousel of 3 square slides', () => {
    const s = defaultEditState();
    s.frame.format = 'square';
    s.frame.slides = 3;
    const l = frameLayout(s, 6000, 2000);
    expect([l.width, l.height, l.slides]).toEqual([3240, 1080, 3]);
  });
  it('border fits a landscape crop inside a portrait frame', () => {
    const s = defaultEditState();
    s.frame.border = true;
    const l = frameLayout(s, 3000, 2000);
    expect(l.imageRect.w).toBeLessThan(1);
    expect(l.imageRect.x).toBeCloseTo((1 - l.imageRect.w) / 2);
  });
});

describe('fitCropToRatio', () => {
  it('produces requested pixel ratio', () => {
    const r = fitCropToRatio({ x: 0, y: 0, w: 1, h: 1 }, 4 / 5, 3000, 2000);
    expect((r.w * 3000) / (r.h * 2000)).toBeCloseTo(0.8);
    expect(r.h).toBeCloseTo(1);
  });
});
