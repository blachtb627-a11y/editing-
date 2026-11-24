import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from 'lucide-react';
import { useStore } from '../../state/store';
import { CROP_ASPECTS, FORMATS } from '../../state/types';
import { Slider } from '../Slider';

export function CropPanel() {
  const g = useStore((s) => s.edit.geometry);
  const frame = useStore((s) => s.edit.frame);
  const setGeometry = useStore((s) => s.setGeometry);
  const rotate = useStore((s) => s.rotate);
  const flip = useStore((s) => s.flip);
  const checkpoint = useStore((s) => s.checkpoint);
  const resetSection = useStore((s) => s.resetSection);
  const setTab = useStore((s) => s.setTab);
  const format = FORMATS.find((f) => f.id === frame.format)!;
  const locked = format.ratio !== null && !frame.border;

  return (
    <div className="panel">
      <div className="button-row">
        <button className="btn" onClick={() => rotate(-1)} aria-label="Rotate left">
          <RotateCcw size={16} /> Left
        </button>
        <button className="btn" onClick={() => rotate(1)} aria-label="Rotate right">
          <RotateCw size={16} /> Right
        </button>
        <button className={'btn' + (g.flipH ? ' on' : '')} onClick={() => flip('h')} aria-label="Flip horizontal">
          <FlipHorizontal2 size={16} /> Flip
        </button>
        <button className={'btn' + (g.flipV ? ' on' : '')} onClick={() => flip('v')} aria-label="Flip vertical">
          <FlipVertical2 size={16} />
        </button>
      </div>
      <Slider
        label="Straighten"
        value={g.straighten}
        min={-45}
        max={45}
        step={0.1}
        format={(v) => v.toFixed(1) + '°'}
        onChange={(straighten) => setGeometry({ straighten })}
      />
      <h3 className="section-title">Aspect ratio</h3>
      {locked ? (
        <p className="hint">
          Locked to <b>{format.label}</b> ({format.sub.split(' · ')[0]}{frame.slides > 1 ? ` × ${frame.slides} slides` : ''}) so it fills the post.
          To crop freely, pick <b>Original</b> format or turn on a border in{' '}
          <button className="link" onClick={() => setTab('frame')}>
            Frame
          </button>
          .
        </p>
      ) : (
        <div className="chips">
          {CROP_ASPECTS.map((a) => (
            <button
              key={a.id}
              className={'chip' + (g.cropAspect === a.id ? ' active' : '')}
              onClick={() => {
                checkpoint();
                setGeometry({ cropAspect: a.id });
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <p className="hint">Drag the box to reposition, corners to resize.</p>
      <button className="btn ghost wide" onClick={() => resetSection('crop')}>
        Reset crop & rotation
      </button>
    </div>
  );
}
