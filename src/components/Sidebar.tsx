import { Aperture, Crop, Frame, Palette, SlidersHorizontal, Spline, Sparkles, Sun, Droplets } from 'lucide-react';
import { useStore, type Tab } from '../state/store';
import { COLOR_SLIDERS, DETAIL_SLIDERS, EFFECT_SLIDERS, LIGHT_SLIDERS } from '../state/defaults';
import { FiltersPanel } from './panels/FiltersPanel';
import { CropPanel } from './panels/CropPanel';
import { SlidersPanel } from './panels/SlidersPanel';
import { MixPanel } from './panels/MixPanel';
import { CurvesPanel } from './panels/CurvesPanel';
import { GradePanel } from './panels/GradePanel';
import { FramePanel } from './panels/FramePanel';
import { Histogram } from './Histogram';
import { frameLayout } from '../engine/geometry';

const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: 'filters', label: 'Filters', icon: Sparkles },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'frame', label: 'Format', icon: Frame },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'color', label: 'Color', icon: Droplets },
  { id: 'mix', label: 'Mix', icon: Palette },
  { id: 'curves', label: 'Curves', icon: Spline },
  { id: 'grade', label: 'Grade', icon: Aperture },
  { id: 'effects', label: 'Effects', icon: SlidersHorizontal },
];

function Panel({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'filters':
      return <FiltersPanel />;
    case 'crop':
      return <CropPanel />;
    case 'frame':
      return <FramePanel />;
    case 'light':
      return <SlidersPanel section="light" groups={[{ sliders: LIGHT_SLIDERS }]} />;
    case 'color':
      return <SlidersPanel section="color" groups={[{ title: 'White balance', sliders: COLOR_SLIDERS.slice(0, 2) }, { title: 'Presence', sliders: COLOR_SLIDERS.slice(2) }]} />;
    case 'mix':
      return <MixPanel />;
    case 'curves':
      return <CurvesPanel />;
    case 'grade':
      return <GradePanel />;
    case 'effects':
      return <SlidersPanel section="effects" groups={[{ title: 'Detail', sliders: DETAIL_SLIDERS }, { title: 'Effects', sliders: EFFECT_SLIDERS }]} />;
  }
}

export function Sidebar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const image = useStore((s) => s.image);
  const edit = useStore((s) => s.edit);
  const layout = image ? frameLayout(edit, image.width, image.height) : null;
  return (
    <aside className="sidebar">
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            <t.icon size={18} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="panel-scroll">
        <div className="panel-head">
          <Histogram />
          {layout && (
            <div className="out-info">
              {layout.slideWidth}×{layout.height}
              {layout.slides > 1 ? ` ×${layout.slides}` : ''}
            </div>
          )}
        </div>
        {layout?.warnings.map((w) => (
          <p key={w} className="warning small">
            {w}
          </p>
        ))}
        <Panel tab={tab} />
      </div>
    </aside>
  );
}
