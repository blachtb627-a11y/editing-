import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Renderer } from '../engine/renderer';
import { engine } from '../engine/instance';
import { buildRenderParams } from '../engine/pipeline';
import { frameLayout, lockedCropRatio, orientedSize } from '../engine/geometry';
import { CropOverlay } from './CropOverlay';
import type { Rect } from '../state/types';

const PAD = 16;
const MAX_PREVIEW = 2600;

function zoomAt(view: Rect | null, cx: number, cy: number, factor: number): Rect | null {
  const v = view ?? { x: 0, y: 0, w: 1, h: 1 };
  const px = v.x + cx * v.w;
  const py = v.y + cy * v.h;
  const w = Math.min(1, Math.max(1 / 10, v.w / factor));
  if (w >= 0.999) return null;
  return { x: Math.min(1 - w, Math.max(0, px - cx * w)), y: Math.min(1 - w, Math.max(0, py - cy * w)), w, h: w };
}

export function Viewport() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const image = useStore((s) => s.image);
  const edit = useStore((s) => s.edit);
  const tab = useStore((s) => s.tab);
  const compare = useStore((s) => s.compare);
  const zoom = useStore((s) => s.zoom);
  const overlays = useStore((s) => s.overlays);
  const setZoom = useStore((s) => s.setZoom);
  const setCompare = useStore((s) => s.setCompare);
  const setGeometry = useStore((s) => s.setGeometry);
  const checkpoint = useStore((s) => s.checkpoint);
  const cropMode = tab === 'crop';

  // create renderer once
  useLayoutEffect(() => {
    try {
      const r = new Renderer(canvasRef.current!);
      engine.renderer = r;
      return () => {
        engine.renderer = null;
      };
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useLayoutEffect(() => {
    if (image && engine.renderer) engine.renderer.setImage(image.bitmap);
  }, [image]);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // display geometry
  let aspect = 1;
  let layout = null;
  if (image) {
    layout = frameLayout(edit, image.width, image.height);
    if (cropMode) {
      const [W, H] = orientedSize(image.width, image.height, edit.geometry.rotation);
      aspect = W / H;
    } else aspect = layout.width / layout.height;
  }
  const availW = Math.max(10, box.w - PAD * 2);
  const availH = Math.max(10, box.h - PAD * 2);
  let cssW = availW;
  let cssH = cssW / aspect;
  if (cssH > availH) {
    cssH = availH;
    cssW = cssH * aspect;
  }
  cssW = Math.floor(cssW);
  cssH = Math.floor(cssH);

  // render (coalesced into one frame)
  const raf = useRef(0);
  useEffect(() => {
    const r = engine.renderer;
    if (!r || !image || !r.hasImage || cssW < 2) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      let w = Math.round(cssW * dpr);
      let h = Math.round(cssH * dpr);
      const s = Math.min(1, MAX_PREVIEW / Math.max(w, h));
      w = Math.round(w * s);
      h = Math.round(h * s);
      const params = buildRenderParams(edit, image.width, image.height, {
        cropMode,
        bypass: compare,
        view: cropMode ? undefined : zoom ?? undefined,
      });
      r.renderToCanvas(params, w, h);
      engine.notify();
    });
  }, [edit, compare, zoom, cssW, cssH, cropMode, image]);

  useEffect(() => {
    if (!engine.renderer) return;
    engine.renderer.onRestored = () => setBox((b) => ({ ...b }));
  }, []);

  // ---- gestures (edit mode): wheel zoom, drag pan, pinch, press-and-hold compare ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: Rect | null; dist: number; mid: { x: number; y: number }; moved: boolean } | null>(null);
  const holdTimer = useRef<number>();

  const rel = (x: number, y: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (cropMode || !image) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const mid = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { view: useStore.getState().zoom, dist, mid, moved: false };
    clearTimeout(holdTimer.current);
    if (pts.length === 1) holdTimer.current = window.setTimeout(() => setCompare(true), 280);
    else setCompare(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const rect = canvasRef.current!.getBoundingClientRect();
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const c = rel(g.mid.x, g.mid.y);
      setZoom(zoomAt(g.view, c.x, c.y, dist / Math.max(1, g.dist)));
      g.moved = true;
      return;
    }
    const dx = e.clientX - g.mid.x;
    const dy = e.clientY - g.mid.y;
    if (Math.hypot(dx, dy) > 6) {
      g.moved = true;
      clearTimeout(holdTimer.current);
    }
    if (g.view && g.moved) {
      const v = g.view;
      setZoom({
        ...v,
        x: Math.min(1 - v.w, Math.max(0, v.x - (dx / rect.width) * v.w)),
        y: Math.min(1 - v.h, Math.max(0, v.y - (dy / rect.height) * v.h)),
      });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    clearTimeout(holdTimer.current);
    setCompare(false);
    if (pointers.current.size === 0) gesture.current = null;
    else {
      const p = [...pointers.current.values()][0];
      gesture.current = { view: useStore.getState().zoom, dist: 0, mid: p, moved: true };
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (cropMode || !image) return;
    const c = rel(e.clientX, e.clientY);
    setZoom(zoomAt(useStore.getState().zoom, c.x, c.y, Math.exp(-e.deltaY * 0.0025)));
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if (cropMode || !image) return;
    if (zoom) return setZoom(null);
    const c = rel(e.clientX, e.clientY);
    setZoom(zoomAt(null, c.x, c.y, 3));
  };

  // ---- overlays ----
  const ratio = image ? lockedCropRatio(edit, image.width, image.height) : null;
  let ratioN: number | null = null;
  if (image && ratio) {
    const [W, H] = orientedSize(image.width, image.height, edit.geometry.rotation);
    ratioN = (ratio * H) / W;
  }
  const slides = layout?.slides ?? 1;
  const showOverlays = !cropMode && !zoom && !compare;
  const story = edit.frame.format === 'story';
  let profileCrop: Rect | null = null;
  if (overlays.profileCrop && layout && !story) {
    const slideRatio = layout.slideWidth / layout.height;
    const fw = 1 / slides;
    profileCrop =
      slideRatio > 0.75
        ? { x: (fw * (1 - 0.75 / slideRatio)) / 2, y: 0, w: (fw * 0.75) / slideRatio, h: 1 }
        : { x: 0, y: (1 - slideRatio / 0.75) / 2, w: fw, h: slideRatio / 0.75 };
  }

  return (
    <div
      ref={wrapRef}
      className={'viewport' + (zoom ? ' zoomed' : '')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      {error && <div className="viewport-error">{error}</div>}
      <div className="canvas-holder" style={{ width: cssW, height: cssH }}>
        <canvas ref={canvasRef} style={{ width: cssW, height: cssH }} />
        {cropMode && image && (
          <CropOverlay
            width={cssW}
            height={cssH}
            crop={edit.geometry.crop}
            ratioN={ratioN}
            onBegin={checkpoint}
            onChange={(crop) => setGeometry({ crop })}
          />
        )}
        {showOverlays && (
          <div className="overlays">
            {overlays.grid && (
              <>
                <div className="thirds v1" />
                <div className="thirds v2" />
                <div className="thirds h1" />
                <div className="thirds h2" />
              </>
            )}
            {Array.from({ length: slides - 1 }, (_, i) => (
              <div key={i} className="slide-divider" style={{ left: `${((i + 1) / slides) * 100}%` }}>
                <span>{i + 2}</span>
              </div>
            ))}
            {slides > 1 && (
              <div className="slide-divider first">
                <span>1</span>
              </div>
            )}
            {story && overlays.safeZones && (
              <>
                <div className="safe-zone top">Profile & close button area</div>
                <div className="safe-zone bottom">Reply bar / captions area</div>
              </>
            )}
            {profileCrop && (
              <div
                className="profile-crop"
                style={{
                  left: `${profileCrop.x * 100}%`,
                  top: `${profileCrop.y * 100}%`,
                  width: `${profileCrop.w * 100}%`,
                  height: `${profileCrop.h * 100}%`,
                }}
              >
                <span>Profile grid</span>
              </div>
            )}
          </div>
        )}
        {compare && <div className="badge before">Original</div>}
        {zoom && !cropMode && <div className="badge zoom">{Math.round(100 / zoom.w)}% · double-tap to fit</div>}
      </div>
    </div>
  );
}
