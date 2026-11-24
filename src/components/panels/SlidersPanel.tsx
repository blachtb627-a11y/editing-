import { useStore } from '../../state/store';
import type { SliderDef } from '../../state/defaults';
import { Slider } from '../Slider';

interface Group {
  title?: string;
  sliders: SliderDef[];
}

export function SlidersPanel({ groups, section }: { groups: Group[]; section: 'light' | 'color' | 'effects' }) {
  const adjust = useStore((s) => s.edit.adjust);
  const setAdjust = useStore((s) => s.setAdjust);
  const resetSection = useStore((s) => s.resetSection);
  return (
    <div className="panel">
      {groups.map((g, i) => (
        <div key={i} className="group">
          {g.title && <h3 className="section-title">{g.title}</h3>}
          {g.sliders.map((d) => (
            <Slider
              key={d.key}
              label={d.label}
              value={adjust[d.key]}
              min={d.min}
              max={d.max}
              step={d.step}
              track={d.track}
              format={d.format}
              defaultValue={d.key === 'vignetteMidpoint' || d.key === 'vignetteFeather' ? 50 : d.key === 'grainSize' ? 25 : undefined}
              onChange={(v) => setAdjust({ [d.key]: v })}
            />
          ))}
        </div>
      ))}
      <button className="btn ghost wide" onClick={() => resetSection(section)}>
        Reset {section}
      </button>
    </div>
  );
}
