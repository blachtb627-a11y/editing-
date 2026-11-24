import { create } from 'zustand';
import type { Adjustments, EditState, Frame, Geometry, Rect } from './types';
import { defaultAdjustments, defaultEditState, defaultFrame, defaultGeometry } from './defaults';
import { clampRect, cropPixelRatio, fitCropToRatio, lockedCropRatio, orientedSize } from '../engine/geometry';

export type Tab = 'filters' | 'crop' | 'light' | 'color' | 'mix' | 'curves' | 'grade' | 'effects' | 'frame';

export interface LoadedImage {
  bitmap: ImageBitmap | HTMLCanvasElement;
  name: string;
  width: number;
  height: number;
  /** original pixel size before the working copy was capped */
  originalWidth: number;
  originalHeight: number;
}

export interface UserPreset {
  id: string;
  name: string;
  adjust: Adjustments;
  filter: EditState['filter'];
}

interface Store {
  image: LoadedImage | null;
  edit: EditState;
  past: EditState[];
  future: EditState[];
  tab: Tab;
  compare: boolean;
  zoom: Rect | null;
  overlays: { grid: boolean; safeZones: boolean; profileCrop: boolean };
  presets: UserPreset[];
  showExport: boolean;
  showPreview: boolean;

  setImage(img: LoadedImage): void;
  closeImage(): void;
  setTab(t: Tab): void;
  setCompare(v: boolean): void;
  setZoom(r: Rect | null): void;
  toggleOverlay(k: keyof Store['overlays']): void;
  setShowExport(v: boolean): void;
  setShowPreview(v: boolean): void;

  /** Save the current state to history (call at the start of a drag or before a discrete change). */
  checkpoint(): void;
  undo(): void;
  redo(): void;

  setAdjust(patch: Partial<Adjustments>): void;
  setGeometry(patch: Partial<Geometry>): void;
  setFrame(patch: Partial<Frame>): void;
  setFilter(id: string | null, amount?: number): void;
  setFilterAmount(amount: number): void;
  replaceEdit(edit: EditState): void;

  rotate(dir: 1 | -1): void;
  flip(axis: 'h' | 'v'): void;
  resetAll(): void;
  resetSection(section: 'light' | 'color' | 'mix' | 'curves' | 'grade' | 'effects' | 'crop' | 'frame'): void;

  savePreset(name: string): void;
  deletePreset(id: string): void;
  applyPreset(id: string): void;
}

const PRESET_KEY = 'igstudio.presets.v1';
function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? (JSON.parse(raw) as UserPreset[]) : [];
  } catch {
    return [];
  }
}
function savePresets(p: UserPreset[]) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

/** Keep the crop rectangle consistent with the frame/aspect lock. */
export function normalizeEdit(edit: EditState, img: LoadedImage | null): EditState {
  if (!img) return edit;
  const ratio = lockedCropRatio(edit, img.width, img.height);
  const [W, H] = orientedSize(img.width, img.height, edit.geometry.rotation);
  let crop = clampRect(edit.geometry.crop);
  if (ratio !== null && Math.abs(cropPixelRatio(crop, W, H) / ratio - 1) > 0.005) {
    crop = fitCropToRatio(crop, ratio, W, H);
  }
  const frame = edit.frame.format === 'original' && edit.frame.slides !== 1 ? { ...edit.frame, slides: 1 } : edit.frame;
  if (crop === edit.geometry.crop && frame === edit.frame) return edit;
  return { ...edit, frame, geometry: { ...edit.geometry, crop } };
}

const MAX_HISTORY = 100;
const same = (a: EditState, b: EditState) => JSON.stringify(a) === JSON.stringify(b);

export const useStore = create<Store>((set, get) => {
  const update = (fn: (e: EditState) => EditState) =>
    set((s) => ({ edit: normalizeEdit(fn(s.edit), s.image) }));
  const commit = (fn: (e: EditState) => EditState) => {
    get().checkpoint();
    update(fn);
  };

  return {
    image: null,
    edit: defaultEditState(),
    past: [],
    future: [],
    tab: 'filters',
    compare: false,
    zoom: null,
    overlays: { grid: false, safeZones: true, profileCrop: false },
    presets: loadPresets(),
    showExport: false,
    showPreview: false,

    setImage(img) {
      const edit = defaultEditState();
      // pick a sensible starting format from the photo's shape
      const r = img.width / img.height;
      edit.frame.format = r > 1.3 ? 'landscape' : r > 0.9 ? 'square' : 'portrait';
      set({ image: img, edit: normalizeEdit(edit, img), past: [], future: [], zoom: null, tab: 'filters' });
    },
    closeImage() {
      set({ image: null, past: [], future: [], edit: defaultEditState() });
    },
    setTab(tab) {
      set({ tab, zoom: tab === 'crop' ? null : get().zoom });
    },
    setCompare(compare) {
      set({ compare });
    },
    setZoom(zoom) {
      set({ zoom });
    },
    toggleOverlay(k) {
      set((s) => ({ overlays: { ...s.overlays, [k]: !s.overlays[k] } }));
    },
    setShowExport(showExport) {
      set({ showExport });
    },
    setShowPreview(showPreview) {
      set({ showPreview });
    },

    checkpoint() {
      const { past, edit } = get();
      if (past.length && same(past[past.length - 1], edit)) return;
      set({ past: [...past, edit].slice(-MAX_HISTORY), future: [] });
    },
    undo() {
      const { past, edit, future } = get();
      const p = [...past];
      while (p.length) {
        const prev = p.pop()!;
        if (!same(prev, edit)) {
          set({ past: p, edit: prev, future: [edit, ...future] });
          return;
        }
      }
    },
    redo() {
      const { past, edit, future } = get();
      if (!future.length) return;
      const [next, ...rest] = future;
      set({ past: [...past, edit], edit: next, future: rest });
    },

    setAdjust(patch) {
      update((e) => ({ ...e, adjust: { ...e.adjust, ...patch } }));
    },
    setGeometry(patch) {
      update((e) => ({ ...e, geometry: { ...e.geometry, ...patch } }));
    },
    setFrame(patch) {
      update((e) => ({ ...e, frame: { ...e.frame, ...patch } }));
    },
    setFilter(id, amount) {
      commit((e) => ({ ...e, filter: { id, amount: amount ?? (id === e.filter.id ? e.filter.amount : 100) } }));
    },
    setFilterAmount(amount) {
      update((e) => ({ ...e, filter: { ...e.filter, amount } }));
    },
    replaceEdit(edit) {
      commit(() => edit);
    },

    rotate(dir) {
      commit((e) => {
        const c = e.geometry.crop;
        const crop = dir === 1 ? { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w };
        const rotation = (((e.geometry.rotation + dir) % 4) + 4) % 4;
        return { ...e, geometry: { ...e.geometry, rotation: rotation as Geometry['rotation'], crop } };
      });
    },
    flip(axis) {
      commit((e) => {
        const c = e.geometry.crop;
        const g = e.geometry;
        return axis === 'h'
          ? { ...e, geometry: { ...g, flipH: !g.flipH, crop: { ...c, x: 1 - c.x - c.w }, straighten: -g.straighten } }
          : { ...e, geometry: { ...g, flipV: !g.flipV, crop: { ...c, y: 1 - c.y - c.h }, straighten: -g.straighten } };
      });
    },
    resetAll() {
      commit((e) => ({ ...defaultEditState(), frame: { ...defaultFrame(), format: e.frame.format } }));
    },
    resetSection(section) {
      const d = defaultAdjustments();
      commit((e) => {
        const a = { ...e.adjust };
        switch (section) {
          case 'light':
            Object.assign(a, { exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 });
            break;
          case 'color':
            Object.assign(a, { temperature: 0, tint: 0, vibrance: 0, saturation: 0 });
            break;
          case 'mix':
            a.hsl = d.hsl;
            break;
          case 'curves':
            a.curves = d.curves;
            break;
          case 'grade':
            a.grading = d.grading;
            break;
          case 'effects':
            for (const k of ['clarity', 'texture', 'dehaze', 'sharpen', 'noiseReduction', 'vignette', 'vignetteMidpoint', 'vignetteFeather', 'grain', 'grainSize', 'fade'] as const)
              a[k] = d[k];
            break;
          case 'crop':
            return { ...e, geometry: defaultGeometry() };
          case 'frame':
            return { ...e, frame: { ...defaultFrame(), format: e.frame.format } };
        }
        return { ...e, adjust: a };
      });
    },

    savePreset(name) {
      const { edit, presets } = get();
      const p: UserPreset = { id: String(Date.now()), name, adjust: edit.adjust, filter: edit.filter };
      const next = [...presets, p];
      savePresets(next);
      set({ presets: next });
    },
    deletePreset(id) {
      const next = get().presets.filter((p) => p.id !== id);
      savePresets(next);
      set({ presets: next });
    },
    applyPreset(id) {
      const p = get().presets.find((x) => x.id === id);
      if (!p) return;
      commit((e) => ({ ...e, adjust: structuredClone(p.adjust), filter: { ...p.filter } }));
    },
  };
});
