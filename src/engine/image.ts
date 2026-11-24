import type { LoadedImage } from '../state/store';
import type { Adjustments, EditState } from '../state/types';
import { buildRenderParams } from './pipeline';
import { frameLayout } from './geometry';
import { MAX_SOURCE, type Renderer } from './renderer';

function capSize(w: number, h: number, max: number): [number, number] {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)];
}

/** Decode a file, honour EXIF orientation, and cap the working copy to MAX_SOURCE px. */
export async function loadImageFile(file: File | Blob, name = 'photo', maxSize = MAX_SOURCE): Promise<LoadedImage> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback for formats createImageBitmap can't decode (Safari HEIC etc. decode via <img>)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      bmp = img;
    } catch {
      throw new Error("This file couldn't be opened. Try a JPEG or PNG (on iPhone, choose 'Most Compatible' in camera settings).");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const ow = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width;
  const oh = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height;
  const [w, h] = capSize(ow, oh, maxSize);
  let out: ImageBitmap | HTMLCanvasElement;
  if (w === ow && h === oh && bmp instanceof ImageBitmap) out = bmp;
  else {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    out = c;
    if (bmp instanceof ImageBitmap) bmp.close();
  }
  return { bitmap: out, name: name.replace(/\.[^.]+$/, ''), width: w, height: h, originalWidth: ow, originalHeight: oh };
}

export interface ExportOptions {
  baseWidth: number;
  quality: number; // 0..1
  type: 'image/jpeg' | 'image/png';
}

function pixelsToBlob(px: Uint8ClampedArray<ArrayBuffer>, w: number, h: number, type: string, quality: number): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(px, w, h), 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), type, quality));
}

/** Render the final post. Returns one blob per carousel slide. */
export async function exportImages(r: Renderer, edit: EditState, opts: ExportOptions): Promise<Blob[]> {
  const layout = frameLayout(edit, r.srcWidth, r.srcHeight, opts.baseWidth);
  const blobs: Blob[] = [];
  for (let i = 0; i < layout.slides; i++) {
    const view = { x: i / layout.slides, y: 0, w: 1 / layout.slides, h: 1 };
    const params = buildRenderParams(edit, r.srcWidth, r.srcHeight, { view, baseWidth: opts.baseWidth });
    const px = r.renderToPixels(params, layout.slideWidth, layout.height);
    blobs.push(await pixelsToBlob(px, layout.slideWidth, layout.height, opts.type, opts.quality));
  }
  return blobs;
}

export async function renderThumbnail(r: Renderer, edit: EditState, size: number): Promise<string> {
  const layout = frameLayout(edit, r.srcWidth, r.srcHeight);
  const s = size / Math.max(layout.width, layout.height);
  const w = Math.max(1, Math.round(layout.width * s));
  const h = Math.max(1, Math.round(layout.height * s));
  const px = r.renderToPixels(buildRenderParams(edit, r.srcWidth, r.srcHeight), w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(px, w, h), 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
}

export interface Histogram {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  l: Uint32Array;
  max: number;
}

export function histogramOf(px: Uint8ClampedArray): Histogram {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    r[px[i]]++;
    g[px[i + 1]]++;
    b[px[i + 2]]++;
    l[Math.round(px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722)]++;
  }
  let max = 1;
  // ignore the extreme bins when scaling so clipped spikes don't flatten the graph
  for (let i = 1; i < 255; i++) max = Math.max(max, r[i], g[i], b[i], l[i]);
  return { r, g, b, l, max };
}

export function renderHistogram(r: Renderer, edit: EditState, cropMode: boolean): Histogram {
  const params = buildRenderParams(edit, r.srcWidth, r.srcHeight, { cropMode });
  const px = r.renderToPixels(params, 192, 192);
  return histogramOf(px);
}

/** Analyse the cropped, unedited image and suggest balanced base adjustments. */
export function autoEnhance(r: Renderer, edit: EditState): Partial<Adjustments> {
  const params = buildRenderParams({ ...edit, frame: { ...edit.frame, border: false } }, r.srcWidth, r.srcHeight, { bypass: true });
  const px = r.renderToPixels(params, 160, 160);
  const n = px.length / 4;
  const lum = new Float32Array(n);
  let sr = 0,
    sg = 0,
    sb = 0,
    sum = 0,
    sum2 = 0;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const R = px[i] / 255,
      G = px[i + 1] / 255,
      B = px[i + 2] / 255;
    const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    lum[j] = L;
    sr += R;
    sg += G;
    sb += B;
    sum += L;
    sum2 += L * L;
  }
  const sorted = Float32Array.from(lum).sort();
  const pct = (p: number) => sorted[Math.min(n - 1, Math.floor(p * n))];
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  const lo = pct(0.005);
  const hi = pct(0.995);
  const clipped = lum.filter((v) => v > 0.97).length / n;
  const dark = lum.filter((v) => v < 0.12).length / n;
  const clamp = (v: number, a: number, b: number) => Math.round(Math.min(b, Math.max(a, v)));
  const exposure = Math.max(-1.2, Math.min(1.2, Math.log2(0.46 / Math.max(0.02, mean)) * 0.8));
  const avgR = sr / n,
    avgG = sg / n,
    avgB = sb / n;
  return {
    exposure: Math.round(exposure * 100) / 100,
    contrast: clamp((0.22 - std) * 120, -10, 25),
    highlights: clamp(-clipped * 900 - 10, -60, 0),
    shadows: clamp(dark * 120 + 8, 0, 45),
    whites: clamp((0.96 - hi) * 140, -15, 35),
    blacks: clamp(-lo * 250, -35, 10),
    vibrance: 18,
    temperature: clamp((avgB - avgR) * 90, -20, 20),
    tint: clamp(((avgR + avgB) / 2 - avgG) * -90, -15, 15),
    clarity: 8,
  };
}

/** Procedural landscape so people can try the editor without a photo handy. */
export function makeSampleImage(): LoadedImage {
  const w = 2400,
    h = 3000;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#2c3e70');
  sky.addColorStop(0.45, '#c06c84');
  sky.addColorStop(0.8, '#f8b26a');
  sky.addColorStop(1, '#fde3a7');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const sun = g.createRadialGradient(w * 0.62, h * 0.5, 10, w * 0.62, h * 0.5, 420);
  sun.addColorStop(0, 'rgba(255,250,220,1)');
  sun.addColorStop(0.2, 'rgba(255,220,150,0.9)');
  sun.addColorStop(1, 'rgba(255,180,120,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  const ridge = (base: number, amp: number, color: string, seed: number) => {
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = base + Math.sin(x * 0.002 + seed) * amp + Math.sin(x * 0.0071 + seed * 3) * amp * 0.35 + Math.sin(x * 0.023 + seed) * amp * 0.08;
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  ridge(h * 0.5, 120, '#7a5c7e', 1);
  ridge(h * 0.56, 150, '#4b3b63', 2.3);
  ridge(h * 0.62, 90, '#2a2340', 4.1);
  const sea = g.createLinearGradient(0, h * 0.62, 0, h);
  sea.addColorStop(0, '#3d4f7a');
  sea.addColorStop(1, '#0f1a33');
  g.fillStyle = sea;
  g.fillRect(0, h * 0.66, w, h);
  for (let i = 0; i < 900; i++) {
    const y = h * 0.67 + Math.random() * h * 0.33;
    const x = Math.random() * w;
    const near = Math.abs(x - w * 0.62) < 260 + (y - h * 0.66) * 0.4;
    g.fillStyle = near ? `rgba(255,214,160,${0.15 + Math.random() * 0.4})` : `rgba(180,200,255,${Math.random() * 0.12})`;
    g.fillRect(x, y, 30 + Math.random() * 140, 3 + Math.random() * 4);
  }
  // fine noise so detail tools have something to bite on
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return { bitmap: c, name: 'sample', width: w, height: h, originalWidth: w, originalHeight: h };
}
