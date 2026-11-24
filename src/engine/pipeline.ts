import type { Adjustments, Curves, EditState, Rect } from '../state/types';
import { buildLut, curvesAreIdentity } from './curves';
import { cropToSourceMatrix, frameLayout, orientedSize, toMat3 } from './geometry';
import { effectiveAdjustments, getFilter } from '../presets/filters';

export interface RenderParams {
  matrix: Float32Array;
  view: Rect;
  imageRect: Rect;
  borderColor: [number, number, number];
  framePx: [number, number];
  cropAspect: number;
  bypass: boolean;
  lut: Float32Array | null;
  useHsl: boolean;
  floats: Record<string, number>;
  vecs: Record<string, number[]>;
  hslHue: Float32Array;
  hslSat: Float32Array;
  hslLum: Float32Array;
}

export interface RenderOptions {
  /** show the whole oriented/straightened image without crop or frame (crop tool) */
  cropMode?: boolean;
  /** sub-rect of the frame to render (zoom / carousel slice) */
  view?: Rect;
  /** show the unedited image (before) */
  bypass?: boolean;
  /** override the export width used for the frame layout */
  baseWidth?: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hueColor(hueDeg: number): [number, number, number] {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return [r, g, b];
}

/** Zero-luminance tint offset for a grading wheel. */
export function gradeOffset(hue: number, sat: number, strength = 0.22): number[] {
  const [r, g, b] = hueColor(hue);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const s = (sat / 100) * strength;
  return [(r - l) * s, (g - l) * s, (b - l) * s];
}

// LUT cache keyed by curve content so the texture is only rebuilt when curves change
let lutKey = '';
let lutVal: Float32Array | null = null;
function lutFor(user: Curves, filter: Curves | null, amount: number): Float32Array | null {
  if (curvesAreIdentity(user) && (!filter || amount <= 0 || curvesAreIdentity(filter))) return null;
  const key = JSON.stringify([user, filter, amount]);
  if (key !== lutKey) {
    lutKey = key;
    lutVal = buildLut(user, filter, amount);
  }
  return lutVal;
}

export function resolveAdjustments(state: EditState): { adjust: Adjustments; filterCurves: Curves | null; amount: number } {
  const amount = state.filter.amount / 100;
  const { adjust, filterCurves } = effectiveAdjustments(state.adjust, getFilter(state.filter.id), amount);
  return { adjust, filterCurves, amount };
}

export function buildRenderParams(state: EditState, srcW: number, srcH: number, opts: RenderOptions = {}): RenderParams {
  const { adjust: a, filterCurves, amount } = resolveAdjustments(state);
  const g = state.geometry;
  const [W, H] = orientedSize(srcW, srcH, g.rotation);
  const layout = frameLayout(state, srcW, srcH, opts.baseWidth);
  const crop = opts.cropMode ? { x: 0, y: 0, w: 1, h: 1 } : g.crop;
  const matrix = toMat3(cropToSourceMatrix(g, srcW, srcH, crop));
  const imageRect = opts.cropMode ? { x: 0, y: 0, w: 1, h: 1 } : layout.imageRect;
  const cropAspect = (crop.w * W) / (crop.h * H);
  const hasHsl = [...a.hsl.hue, ...a.hsl.sat, ...a.hsl.lum].some((v) => v !== 0);
  const gr = a.grading;
  const s = (v: number) => v / 100;

  return {
    matrix,
    view: opts.view ?? { x: 0, y: 0, w: 1, h: 1 },
    imageRect,
    borderColor: hexToRgb(state.frame.color),
    framePx: opts.cropMode ? [1080, 1080 / cropAspect] : [layout.width, layout.height],
    cropAspect,
    bypass: !!opts.bypass,
    lut: lutFor(a.curves, filterCurves, amount),
    useHsl: hasHsl,
    floats: {
      u_exposure: a.exposure,
      u_brightness: s(a.brightness),
      u_contrast: s(a.contrast),
      u_highlights: s(a.highlights),
      u_shadows: s(a.shadows),
      u_whites: s(a.whites),
      u_blacks: s(a.blacks),
      u_temp: s(a.temperature),
      u_tint: s(a.tint),
      u_vibrance: s(a.vibrance),
      u_saturation: s(a.saturation),
      u_clarity: s(a.clarity),
      u_texture: s(a.texture),
      u_dehaze: s(a.dehaze),
      u_sharpen: s(a.sharpen),
      u_nr: s(a.noiseReduction),
      u_fade: s(a.fade),
    },
    vecs: {
      u_vignette: [s(a.vignette), s(a.vignetteMidpoint), s(a.vignetteFeather)],
      u_grain: [s(a.grain), s(a.grainSize)],
      u_gradeS: gradeOffset(gr.shadows.hue, gr.shadows.sat),
      u_gradeM: gradeOffset(gr.midtones.hue, gr.midtones.sat, 0.16),
      u_gradeH: gradeOffset(gr.highlights.hue, gr.highlights.sat),
      u_gradeLum: [s(gr.shadows.lum) * 0.2, s(gr.midtones.lum) * 0.2, s(gr.highlights.lum) * 0.2],
      u_gradeBal: [s(gr.balance), s(gr.blending)],
    },
    hslHue: new Float32Array(a.hsl.hue.map(s)),
    hslSat: new Float32Array(a.hsl.sat.map(s)),
    hslLum: new Float32Array(a.hsl.lum.map(s)),
  };
}
