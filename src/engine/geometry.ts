import { CROP_ASPECTS, FORMATS, type EditState, type Geometry, type Rect } from '../state/types';

/** 2D affine transform: x' = a*x + c*y + e, y' = b*x + d*y + f */
export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** returns m1 ∘ m2 (apply m2 first, then m1) */
export function compose(m1: Affine, m2: Affine): Affine {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function apply(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invert(m: Affine): Affine {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** Column-major mat3 for GLSL */
export function toMat3(m: Affine): Float32Array {
  return new Float32Array([m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
}

const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
const scale = (sx: number, sy = sx): Affine => [sx, 0, 0, sy, 0, 0];
const rotate = (rad: number): Affine => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
};

export function orientedSize(srcW: number, srcH: number, rotation: number): [number, number] {
  return rotation % 2 === 1 ? [srcH, srcW] : [srcW, srcH];
}

/** Zoom needed so an image rotated by `deg` still covers its own W×H frame (no empty corners). */
export function straightenScale(W: number, H: number, deg: number): number {
  const t = Math.abs((deg * Math.PI) / 180);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return Math.max((W * c + H * s) / W, (W * s + H * c) / H);
}

/** Map oriented-normalized (u,v) → source-normalized uv (undo flip, then undo rotation). */
export function orientedToSource(g: Pick<Geometry, 'rotation' | 'flipH' | 'flipV'>): Affine {
  let m: Affine = IDENTITY;
  // undo flip
  const flip: Affine = [g.flipH ? -1 : 1, 0, 0, g.flipV ? -1 : 1, g.flipH ? 1 : 0, g.flipV ? 1 : 0];
  m = flip;
  // undo k clockwise quarter turns: (u,v) -> (v, 1-u)
  const step: Affine = [0, -1, 1, 0, 0, 1];
  for (let i = 0; i < g.rotation; i++) m = compose(step, m);
  return m;
}

/**
 * Affine mapping crop-local coords p ∈ [0,1]² (y down) → source texture uv.
 * Pass crop = {0,0,1,1} to get the whole straightened, oriented image (used by the crop tool).
 */
export function cropToSourceMatrix(g: Geometry, srcW: number, srcH: number, crop: Rect = g.crop): Affine {
  const [W, H] = orientedSize(srcW, srcH, g.rotation);
  const toPx: Affine = [crop.w * W, 0, 0, crop.h * H, crop.x * W, crop.y * H];
  const s = straightenScale(W, H, g.straighten);
  const rad = (g.straighten * Math.PI) / 180;
  // Q = C + R(-θ)(P - C)/s
  const straighten = compose(translate(W / 2, H / 2), compose(rotate(-rad), compose(scale(1 / s), translate(-W / 2, -H / 2))));
  const toNorm = scale(1 / W, 1 / H);
  return compose(orientedToSource(g), compose(toNorm, compose(straighten, toPx)));
}

export function cropPixelRatio(crop: Rect, W: number, H: number): number {
  return (crop.w * W) / (crop.h * H);
}

export function formatRatio(state: EditState): number | null {
  return FORMATS.find((f) => f.id === state.frame.format)?.ratio ?? null;
}

/** Ratio (px w/h) the crop rectangle must keep, or null when free. */
export function lockedCropRatio(state: EditState, srcW: number, srcH: number): number | null {
  const fr = formatRatio(state);
  if (fr !== null && !state.frame.border) return fr * state.frame.slides;
  const a = state.geometry.cropAspect;
  if (a === 'free') return null;
  if (a === 'original') {
    const [W, H] = orientedSize(srcW, srcH, state.geometry.rotation);
    return W / H;
  }
  return CROP_ASPECTS.find((c) => c.id === a)?.ratio ?? null;
}

/** Largest rect with pixel ratio `ratio` centered (as close as possible) on the current crop center. */
export function fitCropToRatio(crop: Rect, ratio: number, W: number, H: number): Rect {
  const imgRatio = W / H;
  // normalized w/h relation: (w*W)/(h*H) = ratio  =>  w = h * ratio / imgRatio
  let h = 1;
  let w = ratio / imgRatio;
  if (w > 1) {
    w = 1;
    h = imgRatio / ratio;
  }
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h });
}

export function clampRect(r: Rect): Rect {
  const w = Math.min(1, Math.max(0.02, r.w));
  const h = Math.min(1, Math.max(0.02, r.h));
  return { x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)), w, h };
}

export interface FrameLayout {
  /** total output size in px (all slides) */
  width: number;
  height: number;
  slides: number;
  slideWidth: number;
  /** image area inside the frame, normalized */
  imageRect: Rect;
  /** px ratio of the crop */
  cropRatio: number;
  /** warnings to show the user */
  warnings: string[];
}

export function frameLayout(state: EditState, srcW: number, srcH: number, baseWidth = 1080): FrameLayout {
  const [W, H] = orientedSize(srcW, srcH, state.geometry.rotation);
  const cropRatio = cropPixelRatio(state.geometry.crop, W, H);
  const fr = formatRatio(state);
  const warnings: string[] = [];
  const slides = fr === null ? 1 : Math.max(1, Math.min(10, Math.round(state.frame.slides)));
  const slideRatio = fr ?? cropRatio;
  const slideWidth = baseWidth;
  const slideHeight = Math.round(baseWidth / slideRatio);
  const width = slideWidth * slides;
  const height = slideHeight;

  let imageRect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  if (state.frame.border) {
    const pad = (Math.min(width, height) * state.frame.padding) / 100;
    const innerW = width - 2 * pad;
    const innerH = height - 2 * pad;
    let iw = innerW;
    let ih = iw / cropRatio;
    if (ih > innerH) {
      ih = innerH;
      iw = ih * cropRatio;
    }
    imageRect = { x: (width - iw) / 2 / width, y: (height - ih) / 2 / height, w: iw / width, h: ih / height };
  }

  if (fr === null) {
    if (slideRatio < 0.8 - 1e-3) warnings.push('Taller than 4:5 — feed posts will be cropped. Use Story format or add a border.');
    if (slideRatio > 1.91 + 1e-3) warnings.push('Wider than 1.91:1 — feed posts will be cropped. Try a carousel or a border.');
  }
  const longSrc = Math.max(srcW, srcH) * Math.min(state.geometry.crop.w, state.geometry.crop.h);
  if (longSrc < baseWidth * 0.6) warnings.push('Low resolution crop — the post may look soft.');

  return { width, height, slides, slideWidth, imageRect, cropRatio, warnings };
}
