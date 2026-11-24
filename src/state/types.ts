export interface CurvePoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface Curves {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export type CurveChannel = keyof Curves;

export interface GradeWheel {
  hue: number; // 0..360
  sat: number; // 0..100
  lum: number; // -100..100
}

export interface Grading {
  shadows: GradeWheel;
  midtones: GradeWheel;
  highlights: GradeWheel;
  balance: number; // -100..100
  blending: number; // 0..100
}

export const HSL_BANDS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const;
export type HslBand = (typeof HSL_BANDS)[number];

export interface HslMix {
  hue: number[]; // 8 values, -100..100
  sat: number[];
  lum: number[];
}

export interface Adjustments {
  // Light
  exposure: number; // EV, -3..3
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  // Color
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  // Effects / detail
  clarity: number;
  texture: number;
  dehaze: number;
  sharpen: number; // 0..100
  noiseReduction: number; // 0..100
  vignette: number; // -100..100
  vignetteMidpoint: number; // 0..100
  vignetteFeather: number; // 0..100
  grain: number; // 0..100
  grainSize: number; // 0..100
  fade: number; // 0..100
  // Complex
  hsl: HslMix;
  curves: Curves;
  grading: Grading;
}

export type FormatId = 'original' | 'square' | 'portrait' | 'grid' | 'landscape' | 'story';

export interface FormatDef {
  id: FormatId;
  label: string;
  sub: string;
  ratio: number | null; // width / height; null = follow crop
}

export const FORMATS: FormatDef[] = [
  { id: 'portrait', label: 'Portrait', sub: '4:5 · 1080×1350', ratio: 4 / 5 },
  { id: 'square', label: 'Square', sub: '1:1 · 1080×1080', ratio: 1 },
  { id: 'grid', label: 'Tall', sub: '3:4 · 1080×1440', ratio: 3 / 4 },
  { id: 'landscape', label: 'Landscape', sub: '1.91:1 · 1080×566', ratio: 1080 / 566 },
  { id: 'story', label: 'Story / Reel', sub: '9:16 · 1080×1920', ratio: 9 / 16 },
  { id: 'original', label: 'Original', sub: 'Keep crop shape', ratio: null },
];

export type CropAspect = 'free' | 'original' | '1:1' | '4:5' | '3:4' | '1.91:1' | '9:16' | '16:9' | '3:2' | '2:3';

export const CROP_ASPECTS: { id: CropAspect; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '1.91:1', label: '1.91:1', ratio: 1.91 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Geometry {
  rotation: 0 | 1 | 2 | 3; // quarter turns clockwise
  flipH: boolean;
  flipV: boolean;
  straighten: number; // degrees, -45..45
  crop: Rect; // normalized to the oriented (rotated/flipped) image
  cropAspect: CropAspect;
}

export interface Frame {
  format: FormatId;
  slides: number; // carousel slide count, 1..10
  border: boolean; // fit image inside frame with padding
  padding: number; // 0..30 (% of frame short side)
  color: string; // hex
}

export interface FilterState {
  id: string | null;
  amount: number; // 0..100
}

export interface EditState {
  adjust: Adjustments;
  geometry: Geometry;
  frame: Frame;
  filter: FilterState;
}
