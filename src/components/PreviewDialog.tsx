import { useEffect, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Send, X } from 'lucide-react';
import { useStore } from '../state/store';
import { engine } from '../engine/instance';
import { exportImages } from '../engine/image';

type Mode = 'feed' | 'grid' | 'story';

export function PreviewDialog() {
  const edit = useStore((s) => s.edit);
  const close = () => useStore.getState().setShowPreview(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [slide, setSlide] = useState(0);
  const isStory = edit.frame.format === 'story';
  const [mode, setMode] = useState<Mode>(isStory ? 'story' : 'feed');

  useEffect(() => {
    let made: string[] = [];
    exportImages(engine.renderer!, edit, { baseWidth: 720, quality: 0.85, type: 'image/jpeg' }).then((blobs) => {
      made = blobs.map((b) => URL.createObjectURL(b));
      setUrls(made);
    });
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, [edit]);

  const first = urls[0];
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal preview" role="dialog" aria-label="Preview" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="chips">
            {(['feed', 'grid', 'story'] as Mode[]).map((m) => (
              <button key={m} className={'chip' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>
                {m === 'feed' ? 'Feed post' : m === 'grid' ? 'Profile grid' : 'Story'}
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="phone">
          {mode === 'feed' && (
            <div className="feed">
              <div className="feed-head">
                <div className="avatar" />
                <b>your.account</b>
              </div>
              <div className="feed-media" onClick={() => urls.length > 1 && setSlide((slide + 1) % urls.length)}>
                {urls[slide] && <img src={urls[slide]} alt="Post preview" />}
                {urls.length > 1 && <span className="slide-count">{slide + 1}/{urls.length}</span>}
              </div>
              {urls.length > 1 && (
                <div className="dots">
                  {urls.map((_, i) => (
                    <i key={i} className={i === slide ? 'on' : ''} />
                  ))}
                </div>
              )}
              <div className="feed-actions">
                <Heart size={22} />
                <MessageCircle size={22} />
                <Send size={22} />
                <span style={{ flex: 1 }} />
                <Bookmark size={22} />
              </div>
              <div className="feed-caption">
                <b>your.account</b> Caption goes here ✨
              </div>
            </div>
          )}
          {mode === 'grid' && (
            <div className="grid-preview">
              <div className="profile-head">
                <div className="avatar big" />
                <div className="stats">
                  <span><b>128</b> posts</span>
                  <span><b>2.4k</b> followers</span>
                </div>
              </div>
              <div className="grid3">
                {first && <div className="tile" style={{ backgroundImage: `url(${first})` }} />}
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="tile empty" />
                ))}
              </div>
              <p className="hint">Profile thumbnails show the centre 3:4 of your first slide.</p>
            </div>
          )}
          {mode === 'story' && (
            <div className="story">
              {first && <img src={first} alt="Story preview" className={isStory ? '' : 'contain'} />}
              <div className="story-top">
                <div className="bar" />
                <div className="story-user">
                  <div className="avatar" /> your.account
                </div>
              </div>
              <div className="story-bottom">Send message</div>
              {!isStory && <p className="story-note">Not 9:16 — Instagram will letterbox this story. Use the Story format to fill the screen.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
