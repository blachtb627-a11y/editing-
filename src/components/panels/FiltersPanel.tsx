import { useEffect, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useStore } from '../../state/store';
import { FILTERS } from '../../presets/filters';
import { engine } from '../../engine/instance';
import { autoEnhance, renderThumbnail } from '../../engine/image';
import { Slider } from '../Slider';

export function useAutoEnhance() {
  const replaceEdit = useStore((s) => s.replaceEdit);
  return () => {
    const r = engine.renderer;
    const { edit } = useStore.getState();
    if (!r) return;
    const auto = autoEnhance(r, edit);
    replaceEdit({ ...edit, adjust: { ...edit.adjust, ...auto } });
  };
}

export function FiltersPanel() {
  const image = useStore((s) => s.image);
  const geometry = useStore((s) => s.edit.geometry);
  const frame = useStore((s) => s.edit.frame);
  const filter = useStore((s) => s.edit.filter);
  const setFilter = useStore((s) => s.setFilter);
  const setFilterAmount = useStore((s) => s.setFilterAmount);
  const presets = useStore((s) => s.presets);
  const savePreset = useStore((s) => s.savePreset);
  const deletePreset = useStore((s) => s.deletePreset);
  const applyPreset = useStore((s) => s.applyPreset);
  const auto = useAutoEnhance();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // thumbnails reflect the current crop + manual edits, with each filter at full strength
  useEffect(() => {
    const t = setTimeout(() => {
      const r = engine.renderer;
      if (!r || !image) return;
      const { edit } = useStore.getState();
      const base = { ...edit, frame: { ...edit.frame, border: false } };
      const out: Record<string, string> = {};
      const jobs = [{ id: '__none', fid: null }, ...FILTERS.map((f) => ({ id: f.id, fid: f.id }))];
      Promise.all(
        jobs.map(async (j) => {
          out[j.id] = await renderThumbnail(r, { ...base, filter: { id: j.fid, amount: 100 } }, 160);
        }),
      ).then(() => setThumbs(out));
    }, 150);
    return () => clearTimeout(t);
  }, [image, geometry, frame.format, frame.slides]);

  const current = FILTERS.find((f) => f.id === filter.id);

  return (
    <div className="panel">
      <button className="btn wide accent-soft" onClick={auto}>
        <Wand2 size={16} /> Auto enhance
      </button>
      {current && (
        <Slider
          label={`${current.name} strength`}
          value={filter.amount}
          min={0}
          max={100}
          defaultValue={100}
          onChange={setFilterAmount}
        />
      )}
      <div className="filter-grid">
        <button className={'filter-tile' + (filter.id === null ? ' active' : '')} onClick={() => setFilter(null)}>
          <div className="thumb" style={{ backgroundImage: thumbs.__none ? `url(${thumbs.__none})` : undefined }} />
          <span>None</span>
        </button>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={'filter-tile' + (filter.id === f.id ? ' active' : '')}
            onClick={() => setFilter(f.id)}
            title={f.group}
          >
            <div className="thumb" style={{ backgroundImage: thumbs[f.id] ? `url(${thumbs[f.id]})` : undefined }} />
            <span>{f.name}</span>
          </button>
        ))}
      </div>
      <p className="hint">Filters are a base look — everything you change in the other tabs stacks on top.</p>

      <h3 className="section-title">My presets</h3>
      <p className="hint">Save your full look (filter + all adjustments) to reuse across photos for a consistent feed.</p>
      <button
        className="btn wide"
        onClick={() => {
          const name = prompt('Preset name', `My look ${presets.length + 1}`);
          if (name) savePreset(name.trim().slice(0, 40));
        }}
      >
        <Plus size={16} /> Save current look
      </button>
      <div className="preset-list">
        {presets.map((p) => (
          <div key={p.id} className="preset-row">
            <button className="btn ghost" onClick={() => applyPreset(p.id)}>
              {p.name}
            </button>
            <button className="icon-btn" aria-label={`Delete ${p.name}`} onClick={() => confirm(`Delete "${p.name}"?`) && deletePreset(p.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
