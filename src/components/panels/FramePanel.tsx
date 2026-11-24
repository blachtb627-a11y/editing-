import { Minus, Plus } from 'lucide-react';
import { useStore } from '../../state/store';
import { FORMATS } from '../../state/types';
import { Slider } from '../Slider';

const COLORS = ['#ffffff', '#000000', '#f3ede2', '#e9e4dc', '#1c1c1e', '#d8c3a5'];

export function FramePanel() {
  const frame = useStore((s) => s.edit.frame);
  const setFrame = useStore((s) => s.setFrame);
  const checkpoint = useStore((s) => s.checkpoint);
  const overlays = useStore((s) => s.overlays);
  const toggleOverlay = useStore((s) => s.toggleOverlay);
  const resetSection = useStore((s) => s.resetSection);
  const change = (patch: Partial<typeof frame>) => {
    checkpoint();
    setFrame(patch);
  };
  const canCarousel = frame.format !== 'original';

  return (
    <div className="panel">
      <h3 className="section-title">Post format</h3>
      <div className="format-grid">
        {FORMATS.map((f) => (
          <button key={f.id} className={'format-card' + (frame.format === f.id ? ' active' : '')} onClick={() => change({ format: f.id })}>
            <div className="shape-box">
              <div className="shape" style={f.ratio ? { aspectRatio: String(f.ratio) } : { aspectRatio: '1', borderStyle: 'dashed' }} />
            </div>
            <b>{f.label}</b>
            <small>{f.sub}</small>
          </button>
        ))}
      </div>

      <h3 className="section-title">Carousel / panorama</h3>
      <div className={'stepper' + (canCarousel ? '' : ' disabled')}>
        <button className="icon-btn" aria-label="Fewer slides" disabled={!canCarousel || frame.slides <= 1} onClick={() => change({ slides: frame.slides - 1 })}>
          <Minus size={16} />
        </button>
        <span>
          {frame.slides} slide{frame.slides > 1 ? 's' : ''}
        </span>
        <button className="icon-btn" aria-label="More slides" disabled={!canCarousel || frame.slides >= 10} onClick={() => change({ slides: frame.slides + 1 })}>
          <Plus size={16} />
        </button>
      </div>
      <p className="hint">
        {canCarousel
          ? 'Spread one wide photo across up to 10 seamless slides — swipe-through panoramas. Each slide is exported separately.'
          : 'Pick a fixed format to split into a carousel.'}
      </p>

      <h3 className="section-title">Border</h3>
      <label className="toggle">
        <input type="checkbox" checked={frame.border} onChange={(e) => change({ border: e.target.checked })} />
        <span>Fit whole photo with a border (no cropping)</span>
      </label>
      {frame.border && (
        <>
          <Slider label="Border size" value={frame.padding} min={0} max={30} step={0.5} defaultValue={6} onChange={(padding) => setFrame({ padding })} />
          <div className="color-row">
            {COLORS.map((c) => (
              <button
                key={c}
                className={'color-dot' + (frame.color.toLowerCase() === c ? ' active' : '')}
                style={{ background: c }}
                aria-label={`Border color ${c}`}
                onClick={() => change({ color: c })}
              />
            ))}
            <label className="color-dot custom" aria-label="Custom border color">
              <input type="color" value={frame.color} onFocus={checkpoint} onChange={(e) => setFrame({ color: e.target.value })} />
            </label>
          </div>
        </>
      )}

      <h3 className="section-title">Guides</h3>
      <label className="toggle">
        <input type="checkbox" checked={overlays.grid} onChange={() => toggleOverlay('grid')} />
        <span>Rule-of-thirds grid</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={overlays.profileCrop} onChange={() => toggleOverlay('profileCrop')} />
        <span>Profile grid preview (the 3:4 area shown on your profile)</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={overlays.safeZones} onChange={() => toggleOverlay('safeZones')} />
        <span>Story safe zones (keep text out of the shaded areas)</span>
      </label>
      <button className="btn ghost wide" onClick={() => resetSection('frame')}>
        Reset frame
      </button>
    </div>
  );
}
