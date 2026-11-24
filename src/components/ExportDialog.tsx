import { useEffect, useMemo, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { useStore } from '../state/store';
import { engine } from '../engine/instance';
import { exportImages } from '../engine/image';
import { frameLayout } from '../engine/geometry';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function ExportDialog() {
  const image = useStore((s) => s.image)!;
  const edit = useStore((s) => s.edit);
  const close = () => useStore.getState().setShowExport(false);
  const [baseWidth, setBaseWidth] = useState(1080);
  const [quality, setQuality] = useState(92);
  const [type, setType] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [busy, setBusy] = useState(false);
  const [blobs, setBlobs] = useState<Blob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const layout = frameLayout(edit, image.width, image.height, baseWidth);
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const names = useMemo(
    () => Array.from({ length: layout.slides }, (_, i) => `${image.name}-ig${layout.slides > 1 ? `-${i + 1}` : ''}.${ext}`),
    [layout.slides, image.name, ext],
  );
  const urls = useMemo(() => blobs?.map((b) => URL.createObjectURL(b)) ?? [], [blobs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  // re-render whenever settings change
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = engine.renderer!;
        const out = await exportImages(r, edit, { baseWidth, quality: quality / 100, type });
        if (!cancelled) setBlobs(out);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [edit, baseWidth, quality, type]);

  const files = blobs?.map((b, i) => new File([b], names[i], { type })) ?? [];
  const canShare = files.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files });
  const totalKb = blobs ? Math.round(blobs.reduce((a, b) => a + b.size, 0) / 1024) : 0;
  const tooBig = layout.height > 1920 * (baseWidth / 1080) + 1;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-label="Export" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Export for Instagram</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="export-previews">
          {urls.map((u, i) => (
            <figure key={u}>
              <img src={u} alt={`Slide ${i + 1}`} />
              {layout.slides > 1 && <figcaption>{i + 1}</figcaption>}
            </figure>
          ))}
          {!urls.length && <div className="export-placeholder">{busy ? 'Rendering…' : error}</div>}
        </div>
        <dl className="export-info">
          <div>
            <dt>Size</dt>
            <dd>
              {layout.slideWidth} × {layout.height}px{layout.slides > 1 ? ` · ${layout.slides} slides` : ''}
            </dd>
          </div>
          <div>
            <dt>File{layout.slides > 1 ? 's' : ''}</dt>
            <dd>{busy ? '…' : `${totalKb.toLocaleString()} KB`}</dd>
          </div>
        </dl>
        {layout.warnings.map((w) => (
          <p key={w} className="warning">
            {w}
          </p>
        ))}
        {tooBig && <p className="warning">Very tall image — Instagram may crop it.</p>}
        <div className="field">
          <span>Resolution</span>
          <div className="chips">
            <button className={'chip' + (baseWidth === 1080 ? ' active' : '')} onClick={() => setBaseWidth(1080)}>
              1080 px (recommended)
            </button>
            <button className={'chip' + (baseWidth === 1440 ? ' active' : '')} onClick={() => setBaseWidth(1440)}>
              1440 px (high-res)
            </button>
          </div>
        </div>
        <div className="field">
          <span>Format</span>
          <div className="chips">
            <button className={'chip' + (type === 'image/jpeg' ? ' active' : '')} onClick={() => setType('image/jpeg')}>
              JPEG
            </button>
            <button className={'chip' + (type === 'image/png' ? ' active' : '')} onClick={() => setType('image/png')}>
              PNG
            </button>
          </div>
        </div>
        {type === 'image/jpeg' && (
          <div className="field">
            <span>Quality {quality}%</span>
            <input type="range" min={60} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} aria-label="JPEG quality" />
          </div>
        )}
        <p className="hint">Instagram re-compresses every upload. A sRGB JPEG at exactly 1080px wide and ~90% quality avoids an extra resize and keeps it sharpest.</p>
        <div className="modal-actions">
          {canShare && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => navigator.share({ files }).catch(() => undefined)}
            >
              <Share2 size={16} /> Share to Instagram…
            </button>
          )}
          <button
            className={'btn' + (canShare ? '' : ' primary')}
            disabled={busy || !blobs}
            onClick={() => blobs?.forEach((b, i) => setTimeout(() => download(b, names[i]), i * 350))}
          >
            <Download size={16} /> Download{layout.slides > 1 ? ` ${layout.slides} files` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
