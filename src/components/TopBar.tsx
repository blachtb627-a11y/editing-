import { ChevronLeft, Eye, Redo2, SplitSquareHorizontal, Undo2, Upload, Wand2 } from 'lucide-react';
import { useStore } from '../state/store';
import { useAutoEnhance } from './panels/FiltersPanel';

export function TopBar() {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const setCompare = useStore((s) => s.setCompare);
  const compare = useStore((s) => s.compare);
  const closeImage = useStore((s) => s.closeImage);
  const setShowExport = useStore((s) => s.setShowExport);
  const setShowPreview = useStore((s) => s.setShowPreview);
  const resetAll = useStore((s) => s.resetAll);
  const auto = useAutoEnhance();

  return (
    <header className="topbar">
      <button
        className="icon-btn"
        aria-label="Close photo"
        title="Close photo"
        onClick={() => (useStore.getState().past.length === 0 || confirm('Close this photo? Unsaved edits will be lost.')) && closeImage()}
      >
        <ChevronLeft size={20} />
      </button>
      <span className="brand">Postframe</span>
      <div className="topbar-group">
        <button className="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </button>
        <button
          className={'icon-btn' + (compare ? ' on' : '')}
          aria-label="Hold to compare with original"
          title="Hold to see original (\)"
          onPointerDown={() => setCompare(true)}
          onPointerUp={() => setCompare(false)}
          onPointerLeave={() => setCompare(false)}
        >
          <SplitSquareHorizontal size={18} />
        </button>
        <button className="icon-btn" aria-label="Auto enhance" title="Auto enhance" onClick={auto}>
          <Wand2 size={18} />
        </button>
        <button className="btn ghost small hide-mobile" onClick={() => confirm('Reset all edits?') && resetAll()}>
          Reset
        </button>
      </div>
      <div className="topbar-group right">
        <button className="btn small" onClick={() => setShowPreview(true)}>
          <Eye size={16} /> <span className="hide-mobile">Preview</span>
        </button>
        <button className="btn primary small" onClick={() => setShowExport(true)}>
          <Upload size={16} /> Export
        </button>
      </div>
    </header>
  );
}
