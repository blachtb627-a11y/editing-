import { useEffect } from 'react';
import { useStore } from './state/store';
import { Welcome, useOpenFile } from './components/Welcome';
import { TopBar } from './components/TopBar';
import { Viewport } from './components/Viewport';
import { Sidebar } from './components/Sidebar';
import { ExportDialog } from './components/ExportDialog';
import { PreviewDialog } from './components/PreviewDialog';

export function App() {
  const image = useStore((s) => s.image);
  const showExport = useStore((s) => s.showExport);
  const showPreview = useStore((s) => s.showPreview);
  const open = useOpenFile();

  // global drop / paste / keyboard shortcuts
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) open(f).catch((err) => alert(err.message));
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) open(f).catch((err) => alert(err.message));
    };
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range' || t.tagName === 'TEXTAREA');
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === 'Escape') {
        s.setShowExport(false);
        s.setShowPreview(false);
      }
      if (!s.image || typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (e.key === '\\' && !e.repeat) s.setCompare(true);
      else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        s.setShowExport(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\') useStore.getState().setCompare(false);
    };
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [open]);

  if (!image) return <Welcome />;
  return (
    <div className="editor">
      <TopBar />
      <main className="workspace">
        <Viewport />
        <Sidebar />
      </main>
      {showExport && <ExportDialog />}
      {showPreview && <PreviewDialog />}
    </div>
  );
}
