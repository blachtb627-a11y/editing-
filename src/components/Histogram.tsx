import { useEffect, useRef } from 'react';
import { engine } from '../engine/instance';
import { renderHistogram } from '../engine/image';
import { useStore } from '../state/store';

export function Histogram() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let t = 0;
    const draw = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        const r = engine.renderer;
        const c = ref.current;
        if (!r || !c || !r.hasImage) return;
        const { edit, tab, compare } = useStore.getState();
        const h = renderHistogram(r, compare ? { ...edit, filter: { id: null, amount: 0 } } : edit, tab === 'crop');
        const ctx = c.getContext('2d')!;
        const W = c.width;
        const H = c.height;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        const series: [Uint32Array, string][] = [
          [h.r, 'rgba(255,70,70,0.55)'],
          [h.g, 'rgba(70,220,90,0.55)'],
          [h.b, 'rgba(70,140,255,0.55)'],
        ];
        for (const [bins, color] of series) {
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * W, H - Math.min(1, bins[i] / h.max) * H);
          ctx.lineTo(W, H);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // clipping warnings
        const total = h.l.reduce((a, b) => a + b, 0);
        if (h.l[0] / total > 0.01) {
          ctx.fillStyle = '#4da3ff';
          ctx.fillRect(0, 0, 6, 6);
        }
        if (h.l[255] / total > 0.01) {
          ctx.fillStyle = '#ff5a5a';
          ctx.fillRect(W - 6, 0, 6, 6);
        }
      }, 180);
    };
    const off = engine.onRender(draw);
    draw();
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return <canvas ref={ref} className="histogram" width={256} height={72} aria-label="Histogram" />;
}
