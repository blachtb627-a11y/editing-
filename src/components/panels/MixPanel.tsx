import { useState } from 'react';
import { useStore } from '../../state/store';
import { HSL_BANDS } from '../../state/types';
import { HSL_COLORS } from '../../state/defaults';
import { Slider } from '../Slider';

const HUE_CENTERS = [0, 30, 60, 120, 180, 240, 270, 300];
const hsl = (h: number, s = 90, l = 55) => `hsl(${h} ${s}% ${l}%)`;

export function MixPanel() {
  const mix = useStore((s) => s.edit.adjust.hsl);
  const setAdjust = useStore((s) => s.setAdjust);
  const resetSection = useStore((s) => s.resetSection);
  const [band, setBand] = useState(0);
  const h = HUE_CENTERS[band];
  const set = (ch: 'hue' | 'sat' | 'lum', v: number) => {
    const arr = [...mix[ch]];
    arr[band] = v;
    setAdjust({ hsl: { ...mix, [ch]: arr } });
  };
  return (
    <div className="panel">
      <div className="swatches" role="radiogroup" aria-label="Color band">
        {HSL_BANDS.map((b, i) => {
          const edited = mix.hue[i] || mix.sat[i] || mix.lum[i];
          return (
            <button
              key={b}
              role="radio"
              aria-checked={band === i}
              aria-label={b}
              title={b}
              className={'swatch' + (band === i ? ' active' : '') + (edited ? ' edited' : '')}
              style={{ background: HSL_COLORS[i] }}
              onClick={() => setBand(i)}
            />
          );
        })}
      </div>
      <h3 className="section-title cap">{HSL_BANDS[band]}</h3>
      <Slider
        label="Hue"
        value={mix.hue[band]}
        min={-100}
        max={100}
        track={`linear-gradient(90deg, ${hsl(h - 30)}, ${hsl(h)}, ${hsl(h + 30)})`}
        onChange={(v) => set('hue', v)}
      />
      <Slider
        label="Saturation"
        value={mix.sat[band]}
        min={-100}
        max={100}
        track={`linear-gradient(90deg, ${hsl(h, 0)}, ${hsl(h, 100)})`}
        onChange={(v) => set('sat', v)}
      />
      <Slider
        label="Luminance"
        value={mix.lum[band]}
        min={-100}
        max={100}
        track={`linear-gradient(90deg, ${hsl(h, 80, 15)}, ${hsl(h, 80, 50)}, ${hsl(h, 80, 85)})`}
        onChange={(v) => set('lum', v)}
      />
      <p className="hint">Tip: lower Orange saturation & raise its luminance for smoother skin; shift Green toward yellow for warm foliage.</p>
      <button className="btn ghost wide" onClick={() => resetSection('mix')}>
        Reset color mix
      </button>
    </div>
  );
}
