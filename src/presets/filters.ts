import type { Adjustments, Curves, Grading, HslMix } from '../state/types';
import { defaultCurves, defaultGrading, defaultHsl, type ScalarKey } from '../state/defaults';

export interface FilterLook {
  scalars?: Partial<Record<ScalarKey, number>>;
  curves?: Partial<Curves>;
  hsl?: Partial<HslMix>;
  grading?: Partial<Grading>;
}

export interface FilterDef {
  id: string;
  name: string;
  group: 'Natural' | 'Warm' | 'Cool' | 'Film' | 'B&W' | 'Bold';
  look: FilterLook;
}

const pts = (...xy: number[]) => {
  const out = [];
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] });
  return out;
};
const wheel = (hue: number, sat: number, lum = 0) => ({ hue, sat, lum });

export const FILTERS: FilterDef[] = [
  {
    id: 'clean',
    name: 'Clean',
    group: 'Natural',
    look: { scalars: { contrast: 8, vibrance: 15, clarity: 8, highlights: -15, shadows: 12, sharpen: 15 } },
  },
  {
    id: 'bright',
    name: 'Airy',
    group: 'Natural',
    look: {
      scalars: { exposure: 0.35, contrast: -10, highlights: -30, shadows: 30, vibrance: 10, temperature: 4, fade: 8 },
      curves: { master: pts(0, 0.04, 0.5, 0.56, 1, 1) },
    },
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    group: 'Warm',
    look: {
      scalars: { temperature: 28, tint: 6, vibrance: 18, contrast: 6, highlights: -12, vignette: -12 },
      grading: { highlights: wheel(42, 30), shadows: wheel(20, 12), balance: 10 },
    },
  },
  {
    id: 'desert',
    name: 'Desert',
    group: 'Warm',
    look: {
      scalars: { temperature: 20, saturation: -12, contrast: 10, fade: 12 },
      hsl: { hue: [6, 8, -6, -30, 0, 0, 0, 0], sat: [0, 10, -10, -45, -30, -30, 0, 0], lum: [0, 6, 0, 0, 0, 0, 0, 0] },
      grading: { midtones: wheel(32, 18) },
    },
  },
  {
    id: 'warmmatte',
    name: 'Warm Matte',
    group: 'Warm',
    look: {
      scalars: { temperature: 14, contrast: -6, vibrance: 8 },
      curves: { master: pts(0, 0.1, 0.3, 0.3, 0.7, 0.74, 1, 0.94) },
      grading: { shadows: wheel(25, 14), highlights: wheel(45, 12) },
    },
  },
  {
    id: 'coolbreeze',
    name: 'Cool Breeze',
    group: 'Cool',
    look: {
      scalars: { temperature: -20, tint: -4, vibrance: 12, highlights: -10, clarity: 6 },
      grading: { shadows: wheel(210, 20), highlights: wheel(190, 8) },
    },
  },
  {
    id: 'tealorange',
    name: 'Teal & Orange',
    group: 'Cool',
    look: {
      scalars: { contrast: 14, vibrance: 10, clarity: 10 },
      hsl: { hue: [0, -4, -12, 30, 6, -6, 0, 0], sat: [0, 15, -10, -25, 10, 10, 0, 0], lum: [0, 6, 0, -10, -6, -10, 0, 0] },
      grading: { shadows: wheel(195, 32), highlights: wheel(35, 26), balance: -6 },
    },
  },
  {
    id: 'nightcity',
    name: 'Night City',
    group: 'Cool',
    look: {
      scalars: { contrast: 18, temperature: -10, tint: 10, vibrance: 15, blacks: -12, clarity: 12, dehaze: 10 },
      grading: { shadows: wheel(235, 30), highlights: wheel(320, 16) },
    },
  },
  {
    id: 'film400',
    name: 'Film 400',
    group: 'Film',
    look: {
      scalars: { contrast: 4, saturation: -8, grain: 28, grainSize: 30, temperature: 6 },
      curves: {
        master: pts(0, 0.06, 0.25, 0.24, 0.75, 0.8, 1, 0.96),
        blue: pts(0, 0.08, 1, 0.94),
        red: pts(0, 0.02, 0.5, 0.52, 1, 1),
      },
      hsl: { hue: [0, 0, -8, 18, 0, -8, 0, 0], sat: [0, 6, 0, -18, 0, -10, 0, 0], lum: Array(8).fill(0) },
    },
  },
  {
    id: 'faded',
    name: 'Faded',
    group: 'Film',
    look: {
      scalars: { fade: 30, contrast: -12, saturation: -18, highlights: -15 },
      grading: { shadows: wheel(200, 10), highlights: wheel(40, 10) },
    },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    group: 'Film',
    look: {
      scalars: { temperature: 18, saturation: -25, vignette: -22, grain: 22, fade: 18, contrast: 6 },
      curves: { red: pts(0, 0.05, 0.5, 0.55, 1, 0.98), blue: pts(0, 0.12, 0.5, 0.45, 1, 0.85) },
    },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    group: 'Film',
    look: {
      scalars: { exposure: 0.2, contrast: -22, saturation: -10, vibrance: 15, fade: 20, highlights: -20 },
      grading: { shadows: wheel(300, 10), highlights: wheel(60, 8) },
    },
  },
  {
    id: 'vivid',
    name: 'Vivid Pop',
    group: 'Bold',
    look: { scalars: { contrast: 20, vibrance: 35, saturation: 8, clarity: 16, dehaze: 8, sharpen: 25, blacks: -8, whites: 8 } },
  },
  {
    id: 'moody',
    name: 'Moody',
    group: 'Bold',
    look: {
      scalars: { exposure: -0.2, contrast: 14, highlights: -25, shadows: -8, saturation: -20, clarity: 14, vignette: -25, temperature: -6 },
      curves: { master: pts(0, 0.06, 0.3, 0.25, 0.75, 0.75, 1, 0.92) },
      grading: { shadows: wheel(195, 18), highlights: wheel(35, 10) },
    },
  },
  {
    id: 'portrait',
    name: 'Soft Portrait',
    group: 'Natural',
    look: {
      scalars: { exposure: 0.1, contrast: -6, clarity: -12, texture: -15, noiseReduction: 25, highlights: -15, shadows: 10, temperature: 6, vibrance: 6 },
      hsl: { hue: [0, 0, 0, 0, 0, 0, 0, 0], sat: [-6, -8, 0, 0, 0, 0, 0, 0], lum: [6, 10, 0, 0, 0, 0, 0, 0] },
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    group: 'B&W',
    look: {
      scalars: { saturation: -100, contrast: 30, clarity: 18, blacks: -15, vignette: -18, grain: 12 },
      curves: { master: pts(0, 0, 0.25, 0.18, 0.75, 0.84, 1, 1) },
    },
  },
  {
    id: 'silver',
    name: 'Silver',
    group: 'B&W',
    look: {
      scalars: { saturation: -100, contrast: -8, fade: 22, highlights: -10, grain: 8 },
      grading: { midtones: wheel(215, 6) },
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    group: 'B&W',
    look: {
      scalars: { saturation: -100, contrast: 6, fade: 10 },
      grading: { shadows: wheel(28, 30), midtones: wheel(35, 25), highlights: wheel(45, 18) },
    },
  },
];

export const getFilter = (id: string | null) => FILTERS.find((f) => f.id === id) ?? null;

const SCALAR_LIMITS: Partial<Record<ScalarKey, [number, number]>> = {
  exposure: [-3, 3],
  sharpen: [0, 100],
  noiseReduction: [0, 100],
  grain: [0, 100],
  grainSize: [0, 100],
  fade: [0, 100],
  vignetteMidpoint: [0, 100],
  vignetteFeather: [0, 100],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Combine the user's manual adjustments with the chosen filter at `amount` (0..1). */
export function effectiveAdjustments(user: Adjustments, filter: FilterDef | null, amount: number): {
  adjust: Adjustments;
  filterCurves: Curves | null;
} {
  if (!filter || amount <= 0) return { adjust: user, filterCurves: null };
  const look = filter.look;
  const out: Adjustments = { ...user, hsl: { ...user.hsl }, grading: { ...user.grading } };
  for (const [k, v] of Object.entries(look.scalars ?? {}) as [ScalarKey, number][]) {
    const [lo, hi] = SCALAR_LIMITS[k] ?? [-100, 100];
    // midpoint/feather are absolute settings rather than offsets
    if (k === 'vignetteMidpoint' || k === 'vignetteFeather' || k === 'grainSize') {
      out[k] = user[k] + (v - user[k]) * amount;
    } else {
      out[k] = clamp(user[k] + v * amount, lo, hi);
    }
  }
  if (look.hsl) {
    const base = defaultHsl();
    for (const ch of ['hue', 'sat', 'lum'] as const) {
      const f = look.hsl[ch] ?? base[ch];
      out.hsl[ch] = user.hsl[ch].map((v, i) => clamp(v + f[i] * amount, -100, 100));
    }
  }
  if (look.grading) {
    const fg = { ...defaultGrading(), ...look.grading };
    for (const w of ['shadows', 'midtones', 'highlights'] as const) {
      const u = user.grading[w];
      const f = fg[w];
      if (f.sat > 0 && u.sat === 0) out.grading[w] = { hue: f.hue, sat: f.sat * amount, lum: u.lum + f.lum * amount };
      else out.grading[w] = { ...u, lum: clamp(u.lum + f.lum * amount, -100, 100) };
    }
    out.grading.balance = clamp(user.grading.balance + fg.balance * amount, -100, 100);
  }
  const filterCurves = look.curves ? { ...defaultCurves(), ...look.curves } : null;
  return { adjust: out, filterCurves };
}
