import type { Renderer } from './renderer';

type Listener = () => void;

/** Shared renderer handle (owned by the Viewport) + a "frame rendered" signal. */
export const engine = {
  renderer: null as Renderer | null,
  listeners: new Set<Listener>(),
  onRender(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },
  notify() {
    this.listeners.forEach((l) => l());
  },
};
