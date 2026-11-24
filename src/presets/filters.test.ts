import { describe, expect, it } from 'vitest';
import { FILTERS, effectiveAdjustments, getFilter } from './filters';
import { defaultAdjustments } from '../state/defaults';

describe('filters', () => {
  it('ids are unique', () => {
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
  });
  it('amount scales offsets and stacks on user values', () => {
    const user = { ...defaultAdjustments(), contrast: 10 };
    const { adjust } = effectiveAdjustments(user, getFilter('vivid'), 0.5);
    expect(adjust.contrast).toBe(20);
    expect(user.contrast).toBe(10);
  });
  it('clamps', () => {
    const user = { ...defaultAdjustments(), saturation: -50 };
    expect(effectiveAdjustments(user, getFilter('noir'), 1).adjust.saturation).toBe(-100);
  });
});
