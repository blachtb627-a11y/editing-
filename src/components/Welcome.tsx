import { useRef, useState } from 'react';
import { ImagePlus, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { loadImageFile, makeSampleImage } from '../engine/image';

export function useOpenFile() {
  const setImage = useStore((s) => s.setImage);
  return async (file: File) => {
    if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp|avif)$/i.test(file.name)) {
      throw new Error('Please choose an image file.');
    }
    setImage(await loadImageFile(file, file.name));
  };
}

export function Welcome() {
  const input = useRef<HTMLInputElement>(null);
  const open = useOpenFile();
  const setImage = useStore((s) => s.setImage);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handle = async (f?: File) => {
    if (!f) return;
    setLoading(true);
    setError(null);
    try {
      await open(f);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="logo">
          <span className="logo-mark" />
          <h1>Postframe</h1>
        </div>
        <p className="tagline">Pro photo editing, made for your feed. Crop to every Instagram format, grade like a pro, and export at the exact size Instagram wants.</p>
        <button className="drop" onClick={() => input.current?.click()} disabled={loading}>
          <ImagePlus size={36} />
          <b>{loading ? 'Opening…' : 'Open a photo'}</b>
          <span>or drop / paste it anywhere</span>
        </button>
        <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => handle(e.target.files?.[0])} />
        <button className="btn ghost" onClick={() => setImage(makeSampleImage())}>
          <Sparkles size={16} /> Try with a sample photo
        </button>
        {error && <p className="warning">{error}</p>}
        <ul className="features">
          <li>Feed, carousel, story & reel formats</li>
          <li>Curves, HSL mixer, color grading</li>
          <li>Seamless panorama carousels</li>
          <li>Borders, grid & safe-zone guides</li>
          <li>Your photos never leave your device</li>
        </ul>
      </div>
    </div>
  );
}
