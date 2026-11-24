import { describe, expect, it } from 'vitest';
import { resizeCrop } from './CropOverlay';

const start = { x: 0.1, y: 0.1, w: 0.6, h: 0.6 };

describe('resizeCrop', () => {
  it('free corner drag', () => {
    const r = resizeCrop(start, { hx: 1, hy: 1 }, 0.1, -0.1, null);
    expect(r).toMatchObject({ x: 0.1, y: 0.1 });
    expect(r.w).toBeCloseTo(0.7);
    expect(r.h).toBeCloseTo(0.5);
  });
  it('locked corner keeps ratio and stays inside', () => {
    const r = resizeCrop(start, { hx: 1, hy: 1 }, 0.5, 0.5, 1);
    expect(r.w / r.h).toBeCloseTo(1);
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9);
  });
  it('locked corner shrinks when dragged inward', () => {
    const r = resizeCrop(start, { hx: 1, hy: 1 }, -0.2, 0.05, 1);
    expect(r.w).toBeLessThan(start.w);
  });
  it('top-left anchor is the bottom-right corner', () => {
    const r = resizeCrop(start, { hx: -1, hy: -1 }, 0.1, 0.1, 1);
    expect(r.x + r.w).toBeCloseTo(0.7);
    expect(r.y + r.h).toBeCloseTo(0.7);
  });
  it('locked edge drag keeps ratio centered', () => {
    const r = resizeCrop(start, { hx: 1, hy: 0 }, -0.2, 0, 1);
    expect(r.w).toBeCloseTo(0.4);
    expect(r.h).toBeCloseTo(0.4);
    expect(r.y + r.h / 2).toBeCloseTo(0.4);
  });
});
