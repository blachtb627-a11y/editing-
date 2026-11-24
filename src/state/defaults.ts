import type { Adjustments, Curves, EditState, Frame, Geometry, Grading, HslMix } from './types';

export const identityCurve = () => [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export const defaultCurves = (): Curves => ({
  master: identityCurve(),
  red: identityCurve(),
  green: identityCurve(),
  blue: identityCurve(),
});

export const defaultHsl = (): HslMix => ({
  hue: Array(8).fill(0),
  sat: Array(8).fill(0),
  lum: Array(8).fill(0),
});

export const defaultGrading = (): Grading => ({
  shadows: { hue: 220, sat: 0, lum: 0 },
  midtones: { hue: 40, sat: 0, lum: 0 },
  highlights: { hue: 40, sat: 0, lum: 0 },
  balance: 0,
  blending: 50,
});

export const defaultAdjustments = (): Adjustments => ({
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  texture: 0,
  dehaze: 0,
  sharpen: 0,
  noiseReduction: 0,
  vignette: 0,
  vignetteMidpoint: 50,
  vignetteFeather: 50,
  grain: 0,
  grainSize: 25,
  fade: 0,
  hsl: defaultHsl(),
  curves: defaultCurves(),
  grading: defaultGrading(),
});

export const defaultGeometry = (): Geometry => ({
  rotation: 0,
  flipH: false,
  flipV: false,
  straighten: 0,
  crop: { x: 0, y: 0, w: 1, h: 1 },
  cropAspect: 'free',
});

export const defaultFrame = (): Frame => ({
  format: 'portrait',
  slides: 1,
  border: false,
  padding: 6,
  color: '#ffffff',
});

export const defaultEditState = (): EditState => ({
  adjust: defaultAdjustments(),
  geometry: defaultGeometry(),
  frame: defaultFrame(),
  filter: { id: null, amount: 100 },
});

export type ScalarKey = {
  [K in keyof Adjustments]: Adjustments[K] extends number ? K : never;
}[keyof Adjustments];

export interface SliderDef {
  key: ScalarKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** css gradient for the track, optional */
  track?: string;
  format?: (v: number) => string;
}

const ev = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2);

export const LIGHT_SLIDERS: SliderDef[] = [
  { key: 'exposure', label: 'Exposure', min: -3, max: 3, step: 0.01, format: ev },
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 1 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1 },
  { key: 'whites', label: 'Whites', min: -100, max: 100, step: 1 },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, step: 1 },
];

export const COLOR_SLIDERS: SliderDef[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    min: -100,
    max: 100,
    step: 1,
    track: 'linear-gradient(90deg,#3f7fd9,#d9d4c7,#e0a030)',
  },
  {
    key: 'tint',
    label: 'Tint',
    min: -100,
    max: 100,
    step: 1,
    track: 'linear-gradient(90deg,#3fae4f,#d0d0d0,#c344c0)',
  },
  {
    key: 'vibrance',
    label: 'Vibrance',
    min: -100,
    max: 100,
    step: 1,
    track: 'linear-gradient(90deg,#8a8a8a,#b88c6a,#e05a3a)',
  },
  {
    key: 'saturation',
    label: 'Saturation',
    min: -100,
    max: 100,
    step: 1,
    track: 'linear-gradient(90deg,#808080,#ff4d4d)',
  },
];

export const DETAIL_SLIDERS: SliderDef[] = [
  { key: 'texture', label: 'Texture', min: -100, max: 100, step: 1 },
  { key: 'clarity', label: 'Clarity', min: -100, max: 100, step: 1 },
  { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, step: 1 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100, step: 1 },
  { key: 'noiseReduction', label: 'Smooth skin / noise', min: 0, max: 100, step: 1 },
];

export const EFFECT_SLIDERS: SliderDef[] = [
  { key: 'vignette', label: 'Vignette', min: -100, max: 100, step: 1 },
  { key: 'vignetteMidpoint', label: 'Vignette size', min: 0, max: 100, step: 1 },
  { key: 'vignetteFeather', label: 'Vignette feather', min: 0, max: 100, step: 1 },
  { key: 'grain', label: 'Grain', min: 0, max: 100, step: 1 },
  { key: 'grainSize', label: 'Grain size', min: 0, max: 100, step: 1 },
  { key: 'fade', label: 'Fade', min: 0, max: 100, step: 1 },
];

export const HSL_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#30d5c8', '#007aff', '#8e5cf7', '#ff2d92'];
